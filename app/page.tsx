"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ExternalLink,
  Home as HomeIcon,
  ListFilter,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  createCall,
  createClientRequest,
  createDeal,
  createProperty,
  listCalls,
  listClientRequests,
  listDeals,
  listProperties,
  listRentalHomeUnits,
  markDealDoneAndSold,
  updateCall,
  updateClientRequest,
  updateDeal,
  updateProperty,
  updatePropertyStatus,
} from "@/services/data";
import {
  emptyCallRequest,
  propertyToForm,
  Property,
  PropertyFormValues,
  RequestFormValues,
  CallRequest,
  Deal,
  ClientRequest,
  PROPERTY_TYPES,
  RENTAL_CATEGORY_OPTIONS,
  RENTAL_FACING_OPTIONS,
  RENTAL_PROPERTY_KIND_OPTIONS,
  AreaUnit,
  RENTAL_LISTING_TYPES,
  PropertyCategory,
  RentalHomeUnit,
  MatchMode,
  toSqft,
  PROPERTY_CATEGORIES,
  FACING_OPTIONS,
  emptyRequestForm,
} from "@/types";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { directCallHref, phoneHref, whatsappHref } from "@/lib/phone";

type Tab = "listing" | "visit" | "collect" | "calls" | "deals" | "requests" | "edit";
type PropertyFilter =
  | "all"
  | "sold"
  | "notSold"
  | "visited"
  | "notVisited"
  | "collected"
  | "notCollected";
const tabs: { id: Tab; label: string; short: string }[] = [
  { id: "listing", label: "Property listing", short: "Listings" },
  { id: "visit", label: "To-visit", short: "Visit" },
  { id: "collect", label: "To-collect", short: "Docs" },
  { id: "calls", label: "Do call", short: "Calls" },
  { id: "deals", label: "Deals", short: "Deals" },
  { id: "requests", label: "Request List", short: "Requests" },
];

const normalizedText = (value: string) => value.trim().toLowerCase();

const matchingText = (value: string | null | undefined) =>
  normalizedText(value ?? "").replace(/[^a-z0-9]/g, "");

const locationMatches = (requested: string, available: string) => {
  const requestValue = normalizedText(requested).replace(/\s+/g, " ");
  const propertyValue = normalizedText(available).replace(/\s+/g, " ");
  return !requestValue ||
    propertyValue.includes(requestValue) ||
    requestValue.includes(propertyValue);
};

const dimensionParts = (value: string) =>
  value.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];

const dimensionMatches = (requested: string, available: string) => {
  const requestedParts = dimensionParts(requested);
  const availableParts = dimensionParts(available);
  if (!requestedParts.length || !availableParts.length) {
    return matchingText(requested) === matchingText(available);
  }
  return requestedParts.every((part) => availableParts.includes(part));
};

const priceMatches = (value: number | null, budget: number | null, mode: MatchMode) => {
  if (budget === null) return true;
  if (value === null) return false;
  return mode === "min" ? value >= budget : value <= budget;
};

const saleListedPrice = (property: Property) => {
  const customPrice = property.custom_selling_price == null ? null : Number(property.custom_selling_price);
  const price = property.price == null ? null : Number(property.price);
  const totalArea = property.total_area == null ? null : Number(property.total_area);
  if (property.custom_price_enabled && customPrice !== null) return customPrice;
  if (price !== null && totalArea !== null) {
    return price * toSqft(totalArea, property.area_unit) / toSqft(1, property.price_unit);
  }
  return property.total_price == null ? null : Number(property.total_price);
};

type MatchFailure = "unavailable" | "category" | "location" | "type" | "facing" | "dimension" | "area" | "area_unit" | "budget" | null;

const propertyMatchFailure = (
  request: ClientRequest,
  property: Property,
  units: RentalHomeUnit[],
  deals: Deal[],
  mode: MatchMode,
) : MatchFailure => {
  if (property.sold) return "unavailable";
  if (property.deal_status === "Agreement" || property.deal_status === "Deal Done") return "unavailable";
  if (deals.some((deal) => deal.property_id === property.id && ["Agreement", "Deal Done"].includes(deal.deal_status))) {
    return "unavailable";
  }
  const propertyCategory = matchingText(property.property_category) || "sale";
  const requestCategory = matchingText(request.property_category) || "sale";
  if (propertyCategory !== requestCategory) return "category";
  if (!locationMatches(request.location, property.location)) return "location";

  const requestBudgetValue = request.custom_budget_enabled ? request.custom_budget : request.budget;
  const requestBudget = requestBudgetValue == null ? null : Number(requestBudgetValue);
  const matchesFacing = (facing: string) =>
    !request.facing || matchingText(request.facing) === "anyfacing" || matchingText(facing) === matchingText(request.facing) || matchingText(facing) === "anyfacing";
  const matchesFloor = (floor: string) => !request.floor || normalizedText(floor) === normalizedText(request.floor);
  const matchesDimension = (dimension: string) => !request.dimension || dimensionMatches(request.dimension, dimension);

  if (requestCategory === "sale") {
    const requestArea = request.area == null ? null : Number(request.area);
    const propertyArea = property.total_area == null ? null : Number(property.total_area);
    if (!request.property_type || matchingText(property.property_type) !== matchingText(request.property_type)) return "type";
    if (requestArea === null || propertyArea === null) return "area";
    if (requestBudget === null) return "budget";
    if (!matchesFacing(property.facing)) return "facing";
    if (!matchesDimension(property.dimension)) return "dimension";
    if (!(property.area_unit in { sqft: true, gunta: true, acre: true }) || !(request.area_unit in { sqft: true, gunta: true, acre: true })) return "area_unit";
    const convertedPropertyArea = toSqft(propertyArea, property.area_unit);
    const convertedRequestArea = toSqft(requestArea, request.area_unit);
    const areaMatches = request.area_match_mode === "min"
      ? convertedPropertyArea >= convertedRequestArea
      : convertedPropertyArea <= convertedRequestArea;
    if (!areaMatches) return "area";
    return priceMatches(saleListedPrice(property), requestBudget, mode) ? null : "budget";
  }

  if (request.rental_type && matchingText(property.rental_type) !== matchingText(request.rental_type)) return "type";
  if (request.rental_category && matchingText(property.rental_category) !== matchingText(request.rental_category)) return "category";

  const propertyUnits = units.filter((unit) => unit.property_id === property.id && unit.available);
  const candidates = propertyUnits.length
    ? propertyUnits
    : [{
        floor: property.floor,
        property_kind: property.property_kind,
        facing: property.facing,
        rent_price: property.rent_price,
        advance_price: property.advance_price,
        dimension: property.dimension,
      }];

  return candidates.some((unit) => {
    if (!matchesFacing(unit.facing) || !matchesFloor(unit.floor)) return false;
    if (matchingText(request.rental_category) === "home" && request.property_kind && matchingText(unit.property_kind) !== matchingText(request.property_kind)) return false;
    if (request.rental_category === "commercial_space" && !matchesDimension(unit.dimension)) return false;
    if (request.advance_budget !== null && (unit.advance_price === null || unit.advance_price > request.advance_budget)) return false;
    return priceMatches(unit.rent_price, requestBudget, mode);
  }) ? null : "budget";
};

const propertyMatchesRequest = (...args: Parameters<typeof propertyMatchFailure>) => propertyMatchFailure(...args) === null;

export default function Home() {
  const [tab, setTab] = useState<Tab>("listing");
  const [properties, setProperties] = useState<Property[]>([]);
  const [calls, setCalls] = useState<CallRequest[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clientRequests, setClientRequests] = useState<ClientRequest[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [editProperty, setEditProperty] = useState<Property | null>(null);
  const [editCall, setEditCall] = useState<CallRequest | null>(null);
  const [showCallForm, setShowCallForm] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [propertyCategory, setPropertyCategory] = useState("all");
  const [propertyType, setPropertyType] = useState("all");
  const [statusFilter, setStatusFilter] = useState<PropertyFilter>("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showDealForm, setShowDealForm] = useState(false);
  const [dealProperty, setDealProperty] = useState<Property | null>(null);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [dealTypeFilter, setDealTypeFilter] = useState("all");
  const [dealCategoryFilter, setDealCategoryFilter] = useState("all");
  const [dealPriceMin, setDealPriceMin] = useState("");
  const [dealPriceMax, setDealPriceMax] = useState("");
  const [rentalHomeUnits, setRentalHomeUnits] = useState<RentalHomeUnit[]>([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [editRequest, setEditRequest] = useState<ClientRequest | null>(null);
  const [matchRequest, setMatchRequest] = useState<ClientRequest | null>(null);
  const [matchMode, setMatchMode] = useState<MatchMode>("min");
  const [matchDebugEnabled, setMatchDebugEnabled] = useState(false);
  const [requestCategoryFilter, setRequestCategoryFilter] = useState("all");
  const [requestTypeFilter, setRequestTypeFilter] = useState("all");
  const [requestBudgetMin, setRequestBudgetMin] = useState("");
  const [requestBudgetMax, setRequestBudgetMax] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMatchDebugEnabled(new URLSearchParams(window.location.search).get("debug") === "1");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };
  const reload = async () => {
    setLoading(true);
    try {
      const [nextProperties, nextCalls, nextDeals, nextClientRequests, nextRentalHomeUnits] = await Promise.all([
        listProperties(),
        listCalls(),
        listDeals(),
        listClientRequests(),
        listRentalHomeUnits(),
      ]);
      setProperties(nextProperties.map((property) => ({
        ...property,
        home_units: nextRentalHomeUnits.filter((unit) => unit.property_id === property.id),
      })));
      setCalls(nextCalls);
      setDeals(nextDeals);
      setClientRequests(nextClientRequests);
      setRentalHomeUnits(nextRentalHomeUnits);
      setError("");
    } catch {
      setError(
        "Unable to load your data. Check the Supabase connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const load = async () => {
      await Promise.resolve();
      await reload();
    };
    void load();
  }, []);

  const filteredProperties = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let result = properties.filter(
      (item) =>
        !needle ||
        [
          item.property_code,
          item.name,
          item.keyword,
          item.owner_name,
          item.location,
          item.contact_number,
        ].some((value) => value.toLowerCase().includes(needle)),
    );
    if (tab === "visit") result = result.filter((item) => !item.visited);
    if (tab === "collect")
      result = result.filter(
        (item) => item.property_category === "sale" && !item.documents_collected,
      );
    if (propertyCategory !== "all")
      result = result.filter((item) => item.property_category === propertyCategory);
    if (propertyType !== "all") {
      const [typeCategory, typeValue] = propertyType.split(":");
      result = result.filter((item) =>
        typeCategory === "sale"
          ? item.property_category === "sale" && item.property_type === typeValue
          : item.property_category !== "sale" && item.rental_category === typeValue,
      );
    }
    if (statusFilter === "sold") result = result.filter((item) => item.sold);
    if (statusFilter === "notSold")
      result = result.filter((item) => !item.sold);
    if (statusFilter === "visited")
      result = result.filter((item) => item.visited);
    if (statusFilter === "notVisited")
      result = result.filter((item) => !item.visited);
    if (statusFilter === "collected")
      result = result.filter((item) => item.property_category === "sale" && item.documents_collected);
    if (statusFilter === "notCollected")
      result = result.filter((item) => item.property_category === "sale" && !item.documents_collected);
    const minimum = minPrice ? Number(minPrice) : null;
    const maximum = maxPrice ? Number(maxPrice) : null;
    if (minimum !== null && Number.isFinite(minimum)) {
      result = result.filter((item) => {
        const value = item.property_category === "sale" ? saleListedPrice(item) : item.rent_price;
        return value !== null && value >= minimum;
      });
    }
    if (maximum !== null && Number.isFinite(maximum)) {
      result = result.filter((item) => {
        const value = item.property_category === "sale" ? saleListedPrice(item) : item.rent_price;
        return value !== null && value <= maximum;
      });
    }
    return result;
  }, [properties, search, tab, propertyCategory, propertyType, statusFilter, minPrice, maxPrice]);
  const filteredCalls = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return calls
      .filter(
        (item) =>
          !needle ||
          [
            item.request_code,
            item.owner_name,
            item.location,
            item.contact_number,
          ].some((value) => value.toLowerCase().includes(needle)),
      )
      .sort(
        (a, b) =>
          Number(a.status === "Completed") - Number(b.status === "Completed") ||
          b.created_at.localeCompare(a.created_at),
      );
  }, [calls, search]);

  const filteredDeals = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let result = deals.filter(
      (item) =>
        !needle ||
        [item.buyer_name, item.buyer_phone, item.deal_status].some((value) =>
          value.toLowerCase().includes(needle),
        ),
    );

    if (dealTypeFilter !== "all") {
      result = result.filter((item) => {
        const property = properties.find((entry) => entry.id === item.property_id);
        return property?.property_type === dealTypeFilter;
      });
    }

    if (dealCategoryFilter !== "all") {
      result = result.filter((item) => {
        const property = properties.find((entry) => entry.id === item.property_id);
        return property?.property_category === dealCategoryFilter;
      });
    }

    const minDeal = dealPriceMin ? Number(dealPriceMin) : null;
    const maxDeal = dealPriceMax ? Number(dealPriceMax) : null;

    if (minDeal !== null && Number.isFinite(minDeal)) {
      result = result.filter((item) => {
        const value = item.custom_deal_price_enabled ? item.custom_deal_price : item.deal_price;
        return value !== null && value >= minDeal;
      });
    }

    if (maxDeal !== null && Number.isFinite(maxDeal)) {
      result = result.filter((item) => {
        const value = item.custom_deal_price_enabled ? item.custom_deal_price : item.deal_price;
        return value !== null && value <= maxDeal;
      });
    }

    return result;
  }, [deals, search, dealTypeFilter, dealCategoryFilter, dealPriceMin, dealPriceMax, properties]);

  const filteredClientRequests = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let result = clientRequests.filter(
      (item) =>
        !needle ||
        [
          item.request_code,
          item.client_name,
          item.phone_number,
          item.location,
          item.property_type,
        ].some((value) => value.toLowerCase().includes(needle)),
    );
    if (requestCategoryFilter !== "all") {
      result = result.filter((item) => item.property_category === requestCategoryFilter);
    }
    if (requestTypeFilter !== "all") {
      result = result.filter((item) => item.property_type === requestTypeFilter);
    }
    const minimum = requestBudgetMin ? Number(requestBudgetMin) : null;
    const maximum = requestBudgetMax ? Number(requestBudgetMax) : null;
    if (minimum !== null && Number.isFinite(minimum)) {
      result = result.filter((item) => (item.budget ?? 0) >= minimum);
    }
    if (maximum !== null && Number.isFinite(maximum)) {
      result = result.filter((item) => (item.budget ?? 0) <= maximum);
    }
    return result;
  }, [clientRequests, search, requestCategoryFilter, requestTypeFilter, requestBudgetMin, requestBudgetMax]);

  const matchedProperties = useMemo(() => {
    if (!matchRequest) return [];
    return properties.filter((property) =>
      propertyMatchesRequest(matchRequest, property, rentalHomeUnits, deals, matchMode),
    );
  }, [matchRequest, properties, rentalHomeUnits, deals, matchMode]);

  useEffect(() => {
    if (!matchDebugEnabled || !matchRequest) return;
    console.table(properties.map((property) => ({
      property: property.property_code,
      matched: propertyMatchesRequest(matchRequest, property, rentalHomeUnits, deals, matchMode),
      firstFailure: propertyMatchFailure(matchRequest, property, rentalHomeUnits, deals, matchMode) ?? "none",
    })));
  }, [matchDebugEnabled, matchRequest, properties, rentalHomeUnits, deals, matchMode]);

  const addVisit = async () => {
    try {
      const created = await createProperty();
      await reload();
      setTab("edit");
      setEditProperty(created);
      notify(`${created.property_code} created. Add the details below.`);
    } catch {
      notify("Unable to create property. Please try again.");
    }
  };
  const toggle = async (
    property: Property,
    key: "visited" | "documents_collected" | "video_uploaded",
  ) => {
    try {
      const updated = await updatePropertyStatus(property, {
        [key]: !property[key],
      });
      setProperties((items) =>
        items.map((item) => (item.id === property.id ? updated : item)),
      );
      notify(
        key === "visited"
          ? "Visit status updated."
          : key === "documents_collected"
            ? "Document status updated."
            : "Video uploaded status updated.",
      );
    } catch {
      notify("Unable to update status. Please try again.");
    }
  };
  const saveProperty = async (form: PropertyFormValues) => {
    const category = (form.property_category || editProperty?.property_category || "") as PropertyCategory | "";
    if (!form.owner_name.trim()) {
      throw new Error("Owner name is required.");
    }
    if (!form.contact_number.trim()) {
      throw new Error("Contact number is required.");
    }
    if (!form.location.trim()) {
      throw new Error("Location is required.");
    }
    if (!category) {
      throw new Error("Select a property category before saving.");
    }
    if (form.google_maps_url && !/^https?:\/\//i.test(form.google_maps_url))
      throw new Error("Enter a valid Google Maps URL.");
    if (form.contact_number && !/^\+?[0-9\s-]{8,15}$/.test(form.contact_number.trim())) {
      throw new Error("Contact number is invalid.");
    }
    if (form.second_contact_number && !/^\+?[0-9\s-]{8,15}$/.test(form.second_contact_number.trim())) {
      throw new Error("Second contact number is invalid.");
    }
    if (category === "sale") {
      if (!form.property_type) {
        throw new Error("Select a sale property type.");
      }
      if (!form.dimension.trim()) {
        throw new Error("Dimension is required for sale properties.");
      }
      if (!form.total_area || Number(form.total_area) <= 0) {
        throw new Error("Total area is required for sale properties.");
      }
      if (form.custom_price_enabled) {
        if (!form.custom_selling_price || Number(form.custom_selling_price) <= 0) {
          throw new Error("Custom selling price is required.");
        }
      } else {
        if (!form.price || Number(form.price) <= 0) {
          throw new Error("Price is required for sale properties.");
        }
      }
    }

    if (category === "sale" && form.years_old && Number(form.years_old) < 0) {
      throw new Error("Years Old cannot be negative.");
    }

    if (category === "rental" || category === "lease") {
      if (!form.rental_type) {
        throw new Error("Select whether this listing is a rental or a lease.");
      }
      if (!form.rental_category) {
        throw new Error("Select the rental or lease property category.");
      }
      if (!form.floor.trim()) {
        throw new Error("Floor is required for rental or lease properties.");
      }
      if (!form.facing) {
        throw new Error("Facing is required for rental or lease properties.");
      }
      if (!form.rent_price || Number(form.rent_price) <= 0) {
        throw new Error("Rent price is required.");
      }
      if (form.rental_category === "home") {
        if (!form.property_kind) {
          throw new Error("What kind is required for home properties.");
        }
        if (!form.facing) {
          throw new Error("Facing is required for home properties.");
        }
      }
      if (form.rental_category === "commercial_space" && !form.dimension.trim()) {
        throw new Error("Dimension is required for commercial space properties.");
      }
    }

    if (!editProperty) return;
    const updated = await updateProperty(editProperty, form);
    setProperties((items) =>
      items.map((item) => (item.id === updated.id ? updated : item)),
    );
    setEditProperty(null);
    notify("Property updated successfully.");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Image
              src="/logo.jpeg"
              alt="Sampadha logo"
              className="brand-logo"
              width={25}
              height={25}
            />
          </span>
          <div>
            <strong>Sampadha</strong>
            <span>Properties workspace</span>
          </div>
        </div>
        <button className="icon-button menu-button" aria-label="Open menu">
          <Menu size={21} />
        </button>
      </header>
      <main className="content">
        <section className="intro">
          <div>
            <p className="eyebrow">PROPERTY OPERATIONS</p>
            <h1>{tabs.find((item) => item.id === tab)?.label}</h1>
            <p className="muted">
              One source of truth for every property workflow.
            </p>
          </div>
          <div className="summary-pill">
            <strong>
              {tab === "calls"
                ? filteredCalls.length
                : tab === "deals"
                  ? filteredDeals.length
                  : tab === "requests"
                    ? filteredClientRequests.length
                    : properties.length}
            </strong>
            <span>
              {tab === "calls"
                ? "call requests"
                : tab === "deals"
                  ? "deals"
                  : tab === "requests"
                    ? "requests"
                    : "properties"}
            </span>
          </div>
        </section>
        <div className="toolbar">
          <label className="search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                tab === "calls"
                  ? "Search requests..."
                  : tab === "deals"
                    ? "Search deals..."
                    : tab === "requests"
                      ? "Search client requests..."
                      : "Search properties..."
              }
              aria-label="Search"
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear search">
                <X size={16} />
              </button>
            )}
          </label>
          {tab === "visit" && (
            <button className="primary-button" onClick={() => void addVisit()}>
              <Plus size={17} /> Add new visit
            </button>
          )}
          {tab === "calls" && (
            <button
              className="primary-button"
              onClick={() => setShowCallForm(true)}
            >
              <Plus size={17} /> Add request
            </button>
          )}
          {tab === "requests" && (
            <button className="primary-button" onClick={() => setShowRequestForm(true)}>
              <Plus size={17} /> Add Request
            </button>
          )}
          {tab === "listing" && (
            <button
              className="filter-button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
            >
              <ListFilter size={16} /> Filters
            </button>
          )}
          {tab === "requests" && (
            <button
              className="filter-button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
            >
              <ListFilter size={16} /> Filters
            </button>
          )}
        </div>
        {filtersOpen && tab === "listing" && (
          <div className="filter-panel">
            <label>
              Property category
              <select
                value={propertyCategory}
                onChange={(event) => {
                  setPropertyCategory(event.target.value);
                  setPropertyType("all");
                }}
              >
                <option value="all">All categories</option>
                {PROPERTY_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category === "sale" ? "Sale" : category === "rental" ? "Rental" : "Lease"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Property type
              <select
                value={propertyType}
                onChange={(event) => setPropertyType(event.target.value)}
              >
                <option value="all">All types</option>
                {(propertyCategory === "sale" || propertyCategory === "all") &&
                  PROPERTY_TYPES.map((type) => <option key={type} value={`sale:${type}`}>{type}</option>)}
                {(propertyCategory === "rental" || propertyCategory === "lease" || propertyCategory === "all") && (
                  <>
                    <option value="rental:home">Home</option>
                    <option value="rental:commercial_space">Commercial place</option>
                  </>
                )}
              </select>
            </label>
            <label>
              Status
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as PropertyFilter)
                }
              >
                <option value="all">All status</option>
                <option value="sold">Sold</option>
                <option value="notSold">Not sold</option>
                <option value="visited">Visited</option>
                <option value="notVisited">Not visited</option>
                {propertyCategory !== "rental" && propertyCategory !== "lease" && <option value="collected">Documents collected</option>}
                {propertyCategory !== "rental" && propertyCategory !== "lease" && <option value="notCollected">Documents not collected</option>}
              </select>
            </label>
            <label>
              Minimum price
              <input
                className="price-filter-input"
                type="number"
                min="0"
                inputMode="decimal"
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
                placeholder="From"
              />
            </label>
            <label>
              Maximum price
              <input
                className="price-filter-input"
                type="number"
                min="0"
                inputMode="decimal"
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                placeholder="To"
              />
            </label>
            <button
              className="secondary-button"
              onClick={() => {
                setPropertyCategory("all");
                setPropertyType("all");
                setStatusFilter("all");
                setMinPrice("");
                setMaxPrice("");
              }}
            >
              Reset
            </button>
          </div>
        )}
        {tab === "deals" && (
          <div className="filter-panel">
            <label>
              Property type
              <select
                value={dealTypeFilter}
                onChange={(event) => setDealTypeFilter(event.target.value)}
              >
                <option value="all">All types</option>
                {PROPERTY_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select
                value={dealCategoryFilter}
                onChange={(event) => setDealCategoryFilter(event.target.value)}
              >
                <option value="all">All categories</option>
                {PROPERTY_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category === "sale" ? "Sale" : category === "rental" ? "Rental" : "Lease"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Minimum price
              <input
                type="number"
                min="0"
                value={dealPriceMin}
                onChange={(event) => setDealPriceMin(event.target.value)}
                placeholder="From"
              />
            </label>
            <label>
              Maximum price
              <input
                type="number"
                min="0"
                value={dealPriceMax}
                onChange={(event) => setDealPriceMax(event.target.value)}
                placeholder="To"
              />
            </label>
            <button
              className="secondary-button"
              onClick={() => {
                setDealTypeFilter("all");
                setDealCategoryFilter("all");
                setDealPriceMin("");
                setDealPriceMax("");
              }}
            >
              Reset
            </button>
          </div>
        )}
        {filtersOpen && tab === "requests" && (
          <div className="filter-panel">
            <label>
              Category
              <select value={requestCategoryFilter} onChange={(event) => setRequestCategoryFilter(event.target.value)}>
                <option value="all">All categories</option>
                {PROPERTY_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label>
              Property type
              <select value={requestTypeFilter} onChange={(event) => setRequestTypeFilter(event.target.value)}>
                <option value="all">All types</option>
                {PROPERTY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label>
              Minimum budget
              <input type="number" min="0" value={requestBudgetMin} onChange={(event) => setRequestBudgetMin(event.target.value)} />
            </label>
            <label>
              Maximum budget
              <input type="number" min="0" value={requestBudgetMax} onChange={(event) => setRequestBudgetMax(event.target.value)} />
            </label>
            <button className="secondary-button" onClick={() => {
              setRequestCategoryFilter("all");
              setRequestTypeFilter("all");
              setRequestBudgetMin("");
              setRequestBudgetMax("");
            }}>Reset</button>
          </div>
        )}
        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => void reload()}>Retry</button>
          </div>
        )}
        {loading ? (
          <div className="loading-state">Loading workspace...</div>
        ) : tab === "calls" ? (
          <CallList
            calls={filteredCalls}
            onEdit={(call) => setEditCall(call)}
            onUpdate={async (call) => {
              const updated = await updateCall(call, {
                status: call.status === "Pending" ? "Completed" : "Pending",
              });
              setCalls((items) =>
                items.map((item) => (item.id === updated.id ? updated : item)),
              );
              notify("Call status updated.");
            }}
          />
        ) : tab === "deals" ? (
          <DealList
            deals={filteredDeals}
            properties={properties}
            onEdit={(deal) => setEditDeal(deal)}
          />
        ) : tab === "requests" ? (
          <ClientRequestList
            requests={filteredClientRequests}
            onEdit={(request) => setEditRequest(request)}
            onMatch={(request) => {
              setMatchRequest(request);
              setMatchMode(request.budget_match_mode);
            }}
          />
        ) : (
          <PropertyList
            properties={filteredProperties}
            deals={deals}
            tab={tab}
            onToggle={toggle}
            onEdit={(property) => {
              setEditProperty(property);
              setTab("edit");
            }}
            onCreateDeal={(property) => {
              setDealProperty(property);
              setShowDealForm(true);
            }}
          />
        )}
      </main>
      <nav className="bottom-nav">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "active" : ""}
            onClick={() => {
              setTab(item.id);
              setSearch("");
            }}
          >
            {item.id === "listing" ? (
              <HomeIcon size={19} />
            ) : item.id === "calls" ? (
              <Phone size={19} />
            ) : item.id === "deals" ? (
              <MessageCircle size={19} />
            ) : item.id === "requests" ? (
              <Search size={19} />
            ) : item.id === "edit" ? (
              <Menu size={19} />
            ) : (
              <ListFilter size={19} />
            )}
            <span>{item.short}</span>
          </button>
        ))}
      </nav>
      {editProperty && (
        <EditPanel
          property={editProperty}
          onClose={() => setEditProperty(null)}
          onSave={saveProperty}
        />
      )}
      {showRequestForm && (
        <RequestForm
          onClose={() => setShowRequestForm(false)}
          onSave={async (input) => {
            const created = await createClientRequest(input);
            setClientRequests((items) => [created, ...items]);
            setShowRequestForm(false);
            notify(`${created.request_code} saved successfully.`);
          }}
        />
      )}
      {editRequest && (
        <RequestForm
          initialRequest={editRequest}
          onClose={() => setEditRequest(null)}
          onSave={async (input) => {
            const updated = await updateClientRequest(editRequest, input);
            setClientRequests((items) => items.map((item) => item.id === updated.id ? updated : item));
            setEditRequest(null);
            notify(`${updated.request_code} updated successfully.`);
          }}
        />
      )}
      {matchRequest && (
        <MatchPanel
          request={matchRequest}
          mode={matchMode}
          properties={matchedProperties}
          deals={deals}
          debugEnabled={matchDebugEnabled}
          onModeChange={setMatchMode}
          onClose={() => setMatchRequest(null)}
        />
      )}
      {showDealForm && dealProperty && (
        <DealForm
          property={dealProperty}
          onClose={() => {
            setShowDealForm(false);
            setDealProperty(null);
          }}
          onSave={async (input) => {
            const created = await createDeal({
              property_id: dealProperty.id,
              buyer_name: input.buyer_name,
              buyer_phone: input.buyer_phone,
              deal_price: input.deal_price,
              deal_price_unit: input.deal_price_unit,
              custom_deal_price_enabled: input.custom_deal_price_enabled,
              custom_deal_price: input.custom_deal_price,
              deal_status: input.deal_status,
            });
            setDeals((items) => [created, ...items]);
            if (created.deal_status === "Deal Done") {
              const updated = await markDealDoneAndSold(dealProperty.id, dealProperty);
              setProperties((items) =>
                items.map((item) => (item.id === updated.id ? updated : item)),
              );
            }
            setShowDealForm(false);
            setDealProperty(null);
            notify("Deal saved successfully.");
          }}
        />
      )}
      {editDeal && (
        <DealForm
          property={properties.find((item) => item.id === editDeal.property_id)}
          initialDeal={editDeal}
          onClose={() => setEditDeal(null)}
          onSave={async (input) => {
            const updated = await updateDeal(editDeal, input);
            setDeals((items) => items.map((item) => item.id === updated.id ? updated : item));
            if (updated.deal_status === "Deal Done") {
              const property = properties.find((item) => item.id === updated.property_id);
              if (property && !property.sold) {
                const soldProperty = await markDealDoneAndSold(property.id, property);
                setProperties((items) => items.map((item) => item.id === soldProperty.id ? soldProperty : item));
              }
            }
            setEditDeal(null);
            notify("Deal updated successfully.");
          }}
        />
      )}
      {showCallForm && (
        <CallForm
          onClose={() => setShowCallForm(false)}
          onSave={async (input) => {
            if (!input.owner_name.trim()) {
              throw new Error("Owner name is required.");
            }
            if (!input.contact_number.trim()) {
              throw new Error("Contact number is required.");
            }
            if (!input.location.trim()) {
              throw new Error("Location is required.");
            }
            if (!input.property_type) {
              throw new Error("Property type is required.");
            }
            const call = await createCall(input);
            setCalls((items) => [call, ...items]);
            setShowCallForm(false);
            notify("Call request created.");
          }}
        />
      )}
      {editCall && (
        <CallForm
          initialCall={editCall}
          onClose={() => setEditCall(null)}
          onSave={async (input) => {
            const updated = await updateCall(editCall, input);
            setCalls((items) =>
              items.map((item) => (item.id === updated.id ? updated : item)),
            );
            setEditCall(null);
            notify("Call request updated.");
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function PropertyList({
  properties,
  deals,
  tab,
  onToggle,
  onEdit,
  onCreateDeal,
}: {
  properties: Property[];
  deals: Deal[];
  tab: Tab;
  onToggle: (
    property: Property,
    key: "visited" | "documents_collected" | "video_uploaded",
  ) => void;
  onEdit: (property: Property) => void;
  onCreateDeal: (property: Property) => void;
}) {
  if (!properties.length)
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <Search size={22} />
        </div>
        <h2>
          {tab === "visit"
            ? "No properties pending visit."
            : tab === "collect"
              ? "No documents pending collection."
              : "No matching records found."}
        </h2>
        <p>Your shared property records will appear here.</p>
      </div>
    );
  return (
    <div className="card-grid">
      {properties.map((property) => (
        <PropertyCard
          key={property.id}
          property={property}
          deals={deals}
          onToggle={onToggle}
          onEdit={onEdit}
          onCreateDeal={onCreateDeal}
        />
      ))}
    </div>
  );
}
function PropertyCard({
  property,
  deals,
  onToggle,
  onEdit,
  onCreateDeal,
}: {
  property: Property;
  deals: Deal[];
  onToggle: (
    property: Property,
    key: "visited" | "documents_collected" | "video_uploaded",
  ) => void;
  onEdit: (property: Property) => void;
  onCreateDeal: (property: Property) => void;
}) {
  const propertyDeals = deals.filter((deal) => deal.property_id === property.id);
  const currentDeal = propertyDeals.find((deal) => deal.deal_status === "Deal Done")
    ?? propertyDeals.find((deal) => deal.deal_status === "Agreement")
    ?? propertyDeals.find((deal) => deal.deal_status === "In Talk");
  const categoryLabel =
    property.property_category === "rental"
      ? "RENTAL"
      : property.property_category === "lease"
        ? "LEASE"
        : "SALE";

  const isSale = property.property_category === "sale";
  const isRental = property.property_category === "rental" || property.property_category === "lease";

  const salePriceTitle =
    property.custom_price_enabled && property.custom_selling_price != null
      ? "Custom Asking Price"
      : "Asking Price";

  const saleDisplayPrice =
    property.custom_price_enabled && property.custom_selling_price != null
      ? formatCurrency(property.custom_selling_price)
      : formatCurrency(saleListedPrice(property));

  const unitDisplayPrice =
    property.price != null && property.price_unit
      ? `${formatCurrency(property.price)}/${property.price_unit}`
      : "—";

  const priceLabel =
    property.custom_price_enabled && property.custom_selling_price != null
      ? "Custom Price"
      : isRental
        ? "Rent"
        : isSale
          ? "Asking Price"
          : "Price not added";

  const displayPrice =
    isRental
      ? property.rent_price != null
        ? formatCurrency(property.rent_price)
        : "—"
      : saleDisplayPrice;

  return (
    <article
      className={`property-card ${property.property_category === "sale" ? "sale-card" : property.property_category === "lease" ? "lease-card" : "rental-card"}`}
    >
      <div className="card-head">
        <span className="code">{property.property_code}</span>
        <div className="card-tags">
          <span className="category-badge">{categoryLabel}</span>
          {property.sold && <span className="sold-badge">SOLD</span>}
          {currentDeal && <span className={`call-status ${currentDeal.deal_status === "Deal Done" ? "done" : "pending"}`}>{currentDeal.deal_status}</span>}
        </div>
      </div>
      <div className="photo-placeholder">
        <HomeIcon size={26} />
        <span>{property.image_url ? "Image connected" : "No image yet"}</span>
      </div>
      <div className="card-main">
        <h2>{property.name || property.keyword || "Untitled property"}</h2>
        {property.keyword && <p className="keyword-line">Keyword: {property.keyword}</p>}
        <p className="location">
          <MapPin size={15} />
          {property.location || "Location not added"}
        </p>
        {property.google_maps_url && (
          <a
            className="maps-link"
            href={property.google_maps_url}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={14} /> Open Google Maps
          </a>
        )}
        <div className="info-grid">
          <div>
            <span>Owner</span>
            <strong>{property.owner_name || "—"}</strong>
          </div>
          <div>
            <span>Property Type</span>
            <strong>
              {property.property_category === "sale"
                ? property.property_type || "—"
                : property.rental_category === "home"
                  ? "Home"
                  : property.rental_category === "commercial_space"
                    ? "Commercial Space"
                    : property.property_type || "—"}
            </strong>
          </div>
          <div>
            <span>Floor</span>
            <strong>{property.floor || "—"}</strong>
          </div>
          {property.property_category === "sale" && property.years_old != null && (
            <div>
              <span>Years Old</span>
              <strong>{property.years_old}</strong>
            </div>
          )}
          <div>
            <span>Contact</span>
            <ContactActions value={property.contact_number} />
          </div>
          {property.second_contact_number && (
            <div>
              <span>Second Contact</span>
              <ContactActions value={property.second_contact_number} />
            </div>
          )}
          {property.property_category === "sale" && (
            <div>
              <span>Area</span>
              <strong>
                {property.total_area != null
                  ? `${formatNumber(property.total_area)} ${property.area_unit}`
                  : property.dimension || "—"}
              </strong>
            </div>
          )}
          <div>
            <span>Facing</span>
            <strong>{property.facing || "—"}</strong>
          </div>
          {property.property_category === "sale" && property.final_price != null && (
            <div>
              <span>Owner Final</span>
              <strong>{formatCurrency(property.final_price)}</strong>
            </div>
          )}
          {property.property_category !== "sale" && (
            <div>
              <span>Advance</span>
              <strong>{property.advance_price != null ? formatCurrency(property.advance_price) : "—"}</strong>
            </div>
          )}
          {property.property_category !== "sale" && property.rental_category === "commercial_space" && (
            <div>
              <span>Dimension</span>
              <strong>{property.dimension || "—"}</strong>
            </div>
          )}
        </div>
        {property.rental_category === "home" && property.home_units && property.home_units.length > 0 && (
          <div className="home-unit-list">
            <span className="section-label">Available home details</span>
            {property.home_units.map((unit) => (
              <div className="home-unit" key={unit.id}>
                <strong>{unit.floor || "Floor not added"} · {unit.property_kind || "Kind not added"}</strong>
                <span>{unit.facing || "Any Facing"} · {unit.rent_price != null ? formatCurrency(unit.rent_price) : "Rent not added"}{unit.advance_price != null ? ` · Advance ${formatCurrency(unit.advance_price)}` : ""}</span>
              </div>
            ))}
          </div>
        )}
        <div className="price-row">
          <span>
            {isSale ? salePriceTitle : priceLabel}
          </span>
          <strong>{isSale ? saleDisplayPrice : displayPrice}</strong>
        </div>
        {isSale && property.price != null && !property.custom_price_enabled && (
          <div className="price-row small-row">
            <span>Per Unit</span>
            <strong>{unitDisplayPrice}</strong>
          </div>
        )}
        {isSale && (
          <div className="price-row small-row">
            <span>Final OK Price ({property.price_unit})</span>
            <strong>{formatCurrency(property.final_price ?? saleListedPrice(property))}</strong>
          </div>
        )}
        {property.details && (
          <p className="notes truncated-notes">{property.details}</p>
        )}
        <div className="status-row">
          <button
            className={`status ${property.visited ? "good" : "bad"}`}
            onClick={() => onToggle(property, "visited")}
          >
            <i />
            {property.visited ? "VISITED" : "NOT VISITED"}
          </button>
          {property.property_category === "sale" && (
            <button
              className={`status ${property.documents_collected ? "good" : "bad"}`}
              onClick={() => onToggle(property, "documents_collected")}
            >
              <i />
              {property.documents_collected ? "COLLECTED" : "NOT COLLECTED"}
            </button>
          )}
          <button
            className={`status ${property.video_uploaded ? "good" : "bad"}`}
            onClick={() => onToggle(property, "video_uploaded")}
          >
            <i />
            {property.video_uploaded ? "VIDEO UPLOADED" : "VIDEO NOT UPLOADED"}
          </button>
        </div>
        <p className="created">Created {formatDate(property.created_at)}</p>
        {isSale && (
          <button className="secondary-button deal-button" onClick={() => onCreateDeal(property)}>
            DEAL
          </button>
        )}
        <button className="edit-button" onClick={() => onEdit(property)}>
          Edit property
        </button>
      </div>
    </article>
  );
}

function ContactActions({ value }: { value: string }) {
  if (!value.trim()) {
    return <strong className="contact-empty">—</strong>;
  }

  return (
    <div className="contact-actions">
      <a className="contact-number" href={`tel:${phoneHref(value)}`}>
        {value}
      </a>
      <a
        className="contact-action call-action"
        href={`tel:${phoneHref(value)}`}
        aria-label={`Call ${value}`}
        title="Call"
      >
        <Phone size={14} />
        <span>Call</span>
      </a>
      <a
        className="contact-action whatsapp-action"
        href={whatsappHref(value)}
        target="_blank"
        rel="noreferrer"
        aria-label={`WhatsApp ${value}`}
        title="WhatsApp"
      >
        <MessageCircle size={14} />
        <span>WhatsApp</span>
      </a>
    </div>
  );
}

function DealList({
  deals,
  properties,
  onEdit,
}: {
  deals: Deal[];
  properties: Property[];
  onEdit: (deal: Deal) => void;
}) {
  if (!deals.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <MessageCircle size={22} />
        </div>
        <h2>No deals recorded yet.</h2>
        <p>New buyer conversations and agreement updates will appear here.</p>
      </div>
    );
  }

  return (
    <div className="card-grid">
      {deals.map((deal) => {
        const property = properties.find((item) => item.id === deal.property_id);
        return (
          <article key={deal.id} className="property-card deal-card">
            <div className="card-head">
              <span className="code">DEAL</span>
              <span className={`call-status ${deal.deal_status === "Deal Done" ? "done" : "pending"}`}>
                {deal.deal_status}
              </span>
            </div>
            <div className="card-main">
              <h2>{deal.buyer_name || "Buyer"}</h2>
              <div className="info-grid">
                <div>
                  <span>Property</span>
                  <strong>{property?.property_code || deal.property_id}</strong>
                </div>
                <div>
                  <span>Category</span>
                  <strong>{property?.property_category || "—"}</strong>
                </div>
                <div>
                  <span>Type</span>
                  <strong>{property?.property_type || "—"}</strong>
                </div>
                <div>
                  <span>Phone</span>
                  <ContactActions value={deal.buyer_phone} />
                </div>
                <div className="full-span">
                  <span>Price</span>
                  <strong>
                    {deal.custom_deal_price_enabled && deal.custom_deal_price != null
                      ? formatCurrency(deal.custom_deal_price)
                      : deal.deal_price != null
                        ? `${formatCurrency(deal.deal_price)}/${deal.deal_price_unit}`
                        : "—"}
                  </strong>
                </div>
              </div>
              {property && deal.deal_price != null && property.total_area != null && (
                <div className="price-row small-row">
                  <span>Total deal value</span>
                  <strong>{formatCurrency(deal.deal_price * property.total_area)}</strong>
                </div>
              )}
              <p className="created">Created {formatDate(deal.created_at)}</p>
              <button className="edit-button" onClick={() => onEdit(deal)}>Edit deal</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ClientRequestList({
  requests,
  onEdit,
  onMatch,
}: {
  requests: ClientRequest[];
  onEdit: (request: ClientRequest) => void;
  onMatch: (request: ClientRequest) => void;
}) {
  if (!requests.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <Search size={22} />
        </div>
        <h2>No client requests found.</h2>
        <p>Matching requests will appear here once a buyer profile is added.</p>
      </div>
    );
  }

  return (
    <div className="card-grid">
      {requests.map((request) => (
        <article key={request.id} className="property-card request-card">
          <div className="card-head">
            <span className="code">{request.request_code}</span>
            <span className="category-badge">{request.property_category || "sale"}</span>
          </div>
          <div className="card-main">
            <h2>{request.client_name || "Client"}</h2>
            <p className="location">
              <MapPin size={15} />
              {request.location || "Location not added"}
            </p>
            <div className="info-grid">
              <div>
                <span>Phone</span>
                {request.phone_number ? (
                  <div className="contact-actions">
                    <a className="contact-number" href={`tel:${phoneHref(request.phone_number)}`}>
                      {request.phone_number}
                    </a>
                    <a
                      className="contact-action"
                      href={`tel:${directCallHref(request.phone_number)}`}
                      title="Call"
                      aria-label={`Call ${request.phone_number}`}
                    >
                      <Phone size={14} />
                      <span>Call</span>
                    </a>
                    <a
                      className="contact-action whatsapp-action"
                      href={whatsappHref(request.phone_number)}
                      target="_blank"
                      rel="noreferrer"
                      title="WhatsApp"
                      aria-label={`WhatsApp ${request.phone_number}`}
                    >
                      <MessageCircle size={14} />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                ) : <strong className="contact-empty">—</strong>}
              </div>
              <div>
                <span>Total budget</span>
                <strong>{request.custom_budget_enabled && request.custom_budget != null
                  ? formatCurrency(request.custom_budget)
                  : request.budget != null
                    ? formatCurrency(request.budget)
                    : "—"}</strong>
              </div>
              <div>
                <span>Facing</span>
                <strong>{request.facing || "Any Facing"}</strong>
              </div>
            </div>
            <p className="notes">{request.details || "No details were added for this request."}</p>
            <p className="created">Created {formatDate(request.created_at)}</p>
            <div className="request-actions">
              <button className="primary-button" onClick={() => onMatch(request)}>View Match Property</button>
              <button className="secondary-button" onClick={() => onEdit(request)}>Edit</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function RequestForm({
  initialRequest,
  onClose,
  onSave,
}: {
  initialRequest?: ClientRequest;
  onClose: () => void;
  onSave: (input: Omit<ClientRequest, "id" | "request_code" | "created_at" | "updated_at">) => Promise<void>;
}) {
  const [form, setForm] = useState<RequestFormValues>(() => initialRequest ? {
    request_code: initialRequest.request_code,
    client_name: initialRequest.client_name,
    phone_number: initialRequest.phone_number,
    property_category: "sale",
    property_type: initialRequest.property_type,
    rental_type: initialRequest.rental_type ?? "",
    rental_category: initialRequest.rental_category ?? "",
    location: initialRequest.location,
    facing: initialRequest.facing,
    dimension: initialRequest.dimension,
    floor: initialRequest.floor,
    property_kind: initialRequest.property_kind,
    area: initialRequest.area?.toString() ?? "",
    area_unit: initialRequest.area_unit,
    price: initialRequest.price?.toString() ?? "",
    price_unit: initialRequest.price_unit,
    custom_budget_enabled: initialRequest.custom_budget_enabled,
    custom_budget: initialRequest.custom_budget?.toString() ?? "",
    budget: initialRequest.budget?.toString() ?? "",
    advance_budget: initialRequest.advance_budget?.toString() ?? "",
    area_match_mode: initialRequest.area_match_mode ?? "min",
    budget_match_mode: initialRequest.budget_match_mode ?? initialRequest.match_mode ?? "min",
    details: initialRequest.details,
    match_mode: initialRequest.budget_match_mode ?? initialRequest.match_mode ?? "min",
  } : { ...emptyRequestForm(), property_category: "sale" });
  const [saving, setSaving] = useState(false);
  const category = "sale";
  const set = (key: keyof RequestFormValues, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.client_name.trim() || !form.phone_number.trim() || !form.location.trim()) {
      window.alert("Client name, phone number, and location are required.");
      return;
    }
    if (category === "sale" && !form.property_type) {
      window.alert("Select a sale property type.");
      return;
    }
    if (category === "sale" && (!form.area || Number(form.area) <= 0)) {
      window.alert("Enter the total area for the sale request.");
      return;
    }
    if (category === "sale" && form.custom_budget_enabled && (!form.custom_budget || Number(form.custom_budget) <= 0)) {
      window.alert("Enter the custom total budget for the sale request.");
      return;
    }
    if (category === "sale" && !form.custom_budget_enabled && (!form.price || Number(form.price) <= 0)) {
      window.alert("Enter the price per area unit for the sale request.");
      return;
    }
    const numericArea = form.area ? Number(form.area) : null;
    const numericPrice = form.price ? Number(form.price) : null;
    const numericCustomBudget = form.custom_budget ? Number(form.custom_budget) : null;
    const numericBudget = form.custom_budget_enabled
      ? numericCustomBudget
      : numericArea !== null && numericPrice !== null && category === "sale"
        ? numericArea * numericPrice
        : numericPrice;
    setSaving(true);
    try {
      await onSave({
        client_name: form.client_name.trim(),
        phone_number: form.phone_number.trim(),
        property_category: "sale",
        property_type: form.property_type,
        rental_type: null,
        rental_category: null,
        location: form.location.trim(),
        facing: form.facing,
        dimension: form.dimension.trim(),
        floor: form.floor.trim(),
        property_kind: form.property_kind,
        area: numericArea,
        area_unit: form.area_unit,
        price: numericPrice,
        price_unit: form.price_unit,
        custom_budget_enabled: form.custom_budget_enabled,
        custom_budget: numericCustomBudget,
        budget: numericBudget,
        advance_budget: null,
        area_match_mode: form.area_match_mode,
        budget_match_mode: form.budget_match_mode,
        details: form.details.trim(),
        match_mode: form.budget_match_mode,
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to save request.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel-backdrop">
      <form className="edit-panel" onSubmit={submit}>
        <div className="panel-header">
          <div><p className="eyebrow">{initialRequest ? `EDIT ${initialRequest.request_code}` : "NEW CLIENT REQUEST"}</p><h2>Request details</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="form-grid">
          <label className="full-span">Request ID<input value={initialRequest?.request_code ?? "Generated by database"} readOnly /></label>
          <label>Client name *<input value={form.client_name} onChange={(event) => set("client_name", event.target.value)} /></label>
          <label>Phone number *<input value={form.phone_number} onChange={(event) => set("phone_number", event.target.value)} /></label>
          <label className="full-span">Location *<input value={form.location} onChange={(event) => set("location", event.target.value)} /></label>
          <label className="full-span">Property category<input value="Sale" readOnly /></label>
          {category === "sale" && <label className="full-span">Property type<select value={form.property_type} onChange={(event) => set("property_type", event.target.value)}><option value="">Select type</option>{PROPERTY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>}
          <label>Facing<select value={form.facing} onChange={(event) => set("facing", event.target.value)}>{FACING_OPTIONS.map((facing) => <option key={facing} value={facing}>{facing}</option>)}</select></label>
          <label>Dimension<input value={form.dimension} onChange={(event) => set("dimension", event.target.value)} /></label>
          <label>
            Area
            <input type="number" min="0" value={form.area} onChange={(event) => set("area", event.target.value)} />
            <span className="range-buttons"><button type="button" className={form.area_match_mode === "min" ? "selected" : ""} onClick={() => set("area_match_mode", "min")}>MIN</button><button type="button" className={form.area_match_mode === "max" ? "selected" : ""} onClick={() => set("area_match_mode", "max")}>MAX</button></span>
          </label>
          <label>Area unit<select value={form.area_unit} onChange={(event) => { set("area_unit", event.target.value); set("price_unit", event.target.value); }}>{["sqft", "gunta", "acre"].map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label>
          {!form.custom_budget_enabled && <label>Price per area unit<input type="number" min="0" value={form.price} onChange={(event) => set("price", event.target.value)} /><span className="range-buttons"><button type="button" className={form.budget_match_mode === "min" ? "selected" : ""} onClick={() => set("budget_match_mode", "min")}>At or above</button><button type="button" className={form.budget_match_mode === "max" ? "selected" : ""} onClick={() => set("budget_match_mode", "max")}>At or below</button></span></label>}
          <label className="full-span inline-checkbox"><input type="checkbox" checked={form.custom_budget_enabled} onChange={(event) => set("custom_budget_enabled", event.target.checked)} /> Custom budget</label>
          {form.custom_budget_enabled && <label className="full-span">Custom total budget<input type="number" min="0" value={form.custom_budget} onChange={(event) => set("custom_budget", event.target.value)} /><span className="range-buttons"><button type="button" className={form.budget_match_mode === "min" ? "selected" : ""} onClick={() => set("budget_match_mode", "min")}>At or above</button><button type="button" className={form.budget_match_mode === "max" ? "selected" : ""} onClick={() => set("budget_match_mode", "max")}>At or below</button></span></label>}
          <label className="full-span">Property-specific details<textarea value={form.details} onChange={(event) => set("details", event.target.value)} /></label>
        </div>
        <div className="panel-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving..." : initialRequest ? "Update request" : "Save request"}</button></div>
      </form>
    </div>
  );
}

function MatchPanel({
  request,
  mode,
  properties,
  deals,
  debugEnabled,
  onModeChange,
  onClose,
}: {
  request: ClientRequest;
  mode: MatchMode;
  properties: Property[];
  deals: Deal[];
  debugEnabled: boolean;
  onModeChange: (mode: MatchMode) => void;
  onClose: () => void;
}) {
  return (
    <div className="panel-backdrop">
      <section className="edit-panel match-panel">
        <div className="panel-header"><div><p className="eyebrow">MATCH RESULTS</p><h2>{request.request_code}</h2><p className="muted">Client: {request.client_name}</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="match-mode"><span>Price matching</span><button type="button" className={mode === "min" ? "selected" : ""} onClick={() => onModeChange("min")}>At or above</button><button type="button" className={mode === "max" ? "selected" : ""} onClick={() => onModeChange("max")}>At or below</button></div>
        {debugEnabled && <p className="muted">Debug logging enabled. See the browser console for the first failed check per property.</p>}
        {!properties.length ? <div className="empty-state"><h2>No available matches</h2><p>Try MAX for properties at or below the budget, or edit the request criteria.</p></div> : <div className="card-grid">{properties.map((property) => <PropertyCard key={property.id} property={property} deals={deals} onToggle={() => undefined} onEdit={() => undefined} onCreateDeal={() => undefined} />)}</div>}
      </section>
    </div>
  );
}

function CallList({
  calls,
  onEdit,
  onUpdate,
}: {
  calls: CallRequest[];
  onEdit: (call: CallRequest) => void;
  onUpdate: (call: CallRequest) => Promise<void>;
}) {
  if (!calls.length)
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <Phone size={22} />
        </div>
        <h2>No call requests found.</h2>
        <p>Add a request when a new owner needs a callback.</p>
      </div>
    );
  return (
    <div className="card-grid">
      {calls.map((call) => (
        <CallCard key={call.id} call={call} onEdit={onEdit} onUpdate={onUpdate} />
      ))}
    </div>
  );
}

function CallCard({
  call,
  onEdit,
  onUpdate,
}: {
  call: CallRequest;
  onEdit: (call: CallRequest) => void;
  onUpdate: (call: CallRequest) => Promise<void>;
}) {
  return (
    <article className="property-card call-card" key={call.id}>
          <div className="card-head">
            <span className="code">{call.request_code}</span>
            <span
              className={`call-status ${call.status === "Completed" ? "done" : "pending"}`}
            >
              {call.status}
            </span>
          </div>
          <div className="card-main">
            <h2>{call.owner_name || "New call request"}</h2>
            <p className="location">
              <MapPin size={15} />
              {call.location || "Location not added"}
            </p>
            <div className="info-grid">
              <div>
                <span>Contact</span>
                <ContactActions value={call.contact_number} />
              </div>
              <div>
                <span>Type</span>
                <strong>{call.property_type || "—"}</strong>
              </div>
            </div>
            {call.notes && <p className="notes">{call.notes}</p>}
            <p className="created">Created {formatDate(call.created_at)}</p>
            <button className="edit-button" onClick={() => onEdit(call)}>
              Edit call request
            </button>
            <button className="secondary-button call-status-button" onClick={() => void onUpdate(call)}>
              {call.status === "Pending" ? "Mark completed" : "Mark pending"}
            </button>
          </div>
    </article>
  );
}

function EditPanel({
  property,
  onClose,
  onSave,
}: {
  property: Property;
  onClose: () => void;
  onSave: (form: PropertyFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState(() => propertyToForm(property));
  const [saving, setSaving] = useState(false);
  const category =
    (form.property_category || property.property_category || "") || "";

  const set = (key: keyof PropertyFormValues, value: string | boolean | null) =>
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "area_unit"
        ? { price_unit: value as AreaUnit }
        : key === "price_unit"
          ? { area_unit: value as AreaUnit }
          : {}),
    }));

  const total =
    form.custom_price_enabled && form.custom_selling_price
      ? Number(form.custom_selling_price)
      : form.total_area && form.price
        ? Number(form.total_area) * Number(form.price)
        : 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? `Unable to save property: ${error.message}`
          : "Unable to save property.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel-backdrop">
      <form className="edit-panel" onSubmit={submit}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">EDITING {property.property_code}</p>
            <h2>Property details</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="form-grid">
          <label className="full-span">
            Property ID
            <input value={form.property_code} readOnly />
          </label>

          {([
            ["name", "Property name"],
            ["keyword", "Keyword"],
            ["owner_name", "Owner name *"],
            ["contact_number", "Contact number *"],
            ["second_contact_number", "Second contact number"],
            ["location", "Location *"],
            ["google_maps_url", "Google Maps URL"],
          ] as const).map(([key, label]) => (
            <label key={key} className="full-span">
              {label}
              <input
                value={form[key] as string}
                onChange={(event) => set(key, event.target.value)}
              />
              {(key === "contact_number" || key === "second_contact_number") && (
                <ContactActions value={form[key] as string} />
              )}
            </label>
          ))}

          <div className="full-span category-selector">
            <span className="form-label">Property category</span>
            <div className="segmented-control" role="radiogroup" aria-label="Property category">
              <label className={category === "sale" ? "selected" : ""}>
                <input
                  type="radio"
                  name="property_category"
                  checked={category === "sale"}
                  onChange={() => set("property_category", "sale")}
                />
                <span>Sale Property</span>
              </label>
              <label className={category === "rental" || category === "lease" ? "selected" : ""}>
                <input
                  type="radio"
                  name="property_category"
                  checked={category === "rental" || category === "lease"}
                  onChange={() => {
                    set("property_category", "rental");
                    set("rental_type", "");
                    set("rental_category", "");
                  }}
                />
                <span>Rental / Lease Property</span>
              </label>
            </div>
          </div>

          {category === "sale" && (
            <>
              <label className="full-span">
                Sale Property Details
                <select
                  value={form.property_type}
                  onChange={(event) =>
                    set(
                      "property_type",
                      event.target.value as PropertyFormValues["property_type"],
                    )
                  }
                >
                  <option value="">Select property type</option>
                  {PROPERTY_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>

              <label className="full-span">
                Facing *
                <select
                  value={form.facing}
                  onChange={(event) => set("facing", event.target.value)}
                >
                  <option value="">Select facing</option>
                  {FACING_OPTIONS.map((facing) => (
                    <option key={facing} value={facing}>{facing}</option>
                  ))}
                </select>
              </label>

              <div className="full-span pricing-card">
                <div className="pricing-header">
                  <span>Sale pricing</span>
                  <label className="inline-checkbox">
                    <input
                      type="checkbox"
                      checked={form.custom_price_enabled}
                      onChange={(event) =>
                        set("custom_price_enabled", event.target.checked)
                      }
                    />
                    Use custom price
                  </label>
                </div>

                <div className="pricing-grid">
                  <label>
                    Dimension *
                    <input
                      value={form.dimension}
                      onChange={(event) => set("dimension", event.target.value)}
                    />
                  </label>

                  <label>
                    Total Area *
                    <input
                      type="number"
                      min="0"
                      value={form.total_area}
                      onChange={(event) => set("total_area", event.target.value)}
                    />
                  </label>

                  <label>
                    Area Unit *
                    <select
                      value={form.area_unit}
                      onChange={(event) =>
                        set("area_unit", event.target.value as AreaUnit)
                      }
                    >
                      <option value="sqft">sqft</option>
                      <option value="gunta">gunta</option>
                      <option value="acre">acre</option>
                    </select>
                  </label>

                  {!form.custom_price_enabled && (
                    <>
                      <label>
                        Price *
                        <input
                          type="number"
                          min="0"
                          value={form.price}
                          onChange={(event) => set("price", event.target.value)}
                        />
                      </label>

                      <label>
                        Price Unit *
                        <select
                          value={form.price_unit}
                          onChange={(event) =>
                            set("price_unit", event.target.value as AreaUnit)
                          }
                        >
                          <option value="sqft">sqft</option>
                          <option value="gunta">gunta</option>
                          <option value="acre">acre</option>
                        </select>
                      </label>
                    </>
                  )}

                  {form.custom_price_enabled && (
                    <label className="full-span">
                      Custom Selling Price *
                      <input
                        type="number"
                        min="0"
                        value={form.custom_selling_price}
                        onChange={(event) =>
                          set("custom_selling_price", event.target.value)
                        }
                      />
                    </label>
                  )}

                  <label className="full-span">
                    Final OK Price
                    <input
                      type="number"
                      min="0"
                      value={form.final_price}
                      onChange={(event) => set("final_price", event.target.value)}
                      placeholder="Optional final total price"
                    />
                  </label>
                </div>
              </div>
            </>
          )}

          {(category === "rental" || category === "lease") && (
            <>
              <label className="full-span">
                Rental / Lease Type *
                <select
                  value={form.rental_type}
                  onChange={(event) => set("rental_type", event.target.value)}
                >
                  <option value="">Select listing type</option>
                  {RENTAL_LISTING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type === "rental" ? "Rental Property" : "Lease Property"}
                    </option>
                  ))}
                </select>
              </label>

                <label className="full-span">
                Property Type *
                <select
                  value={form.rental_category}
                  onChange={(event) =>
                    set(
                      "rental_category",
                      event.target.value as PropertyFormValues["rental_category"],
                    )
                  }
                >
                  <option value="">Select category</option>
                  {RENTAL_CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === "home" ? "Home" : "Commercial Space"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="full-span">
                Facing *
                <select
                  value={form.facing}
                  onChange={(event) => set("facing", event.target.value)}
                >
                  <option value="">Select facing</option>
                  {RENTAL_FACING_OPTIONS.map((facing) => (
                    <option key={facing} value={facing}>{facing}</option>
                  ))}
                </select>
              </label>

              {form.rental_category === "home" && (
                <>
                  <label>
                    Floor *
                    <input
                      value={form.floor}
                      onChange={(event) => set("floor", event.target.value)}
                    />
                  </label>
                  <label>
                    What Kind *
                    <select
                      value={form.property_kind}
                      onChange={(event) => set("property_kind", event.target.value)}
                    >
                      <option value="">Select kind</option>
                      {RENTAL_PROPERTY_KIND_OPTIONS.map((kind) => (
                        <option key={kind} value={kind}>{kind}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Rent Price *
                    <input
                      type="number"
                      min="0"
                      value={form.rent_price}
                      onChange={(event) => set("rent_price", event.target.value)}
                    />
                  </label>
                  <label>
                    Advance Price
                    <input
                      type="number"
                      min="0"
                      value={form.advance_price}
                      onChange={(event) => set("advance_price", event.target.value)}
                    />
                  </label>
                </>
              )}

              {form.rental_category === "commercial_space" && (
                <>
                  <label>
                    Floor *
                    <input
                      value={form.floor}
                      onChange={(event) => set("floor", event.target.value)}
                    />
                  </label>
                  <label>
                    Dimension *
                    <input
                      value={form.dimension}
                      onChange={(event) => set("dimension", event.target.value)}
                    />
                  </label>
                  <label>
                    Rent Price *
                    <input
                      type="number"
                      min="0"
                      value={form.rent_price}
                      onChange={(event) => set("rent_price", event.target.value)}
                    />
                  </label>
                  <label>
                    Advance Price
                    <input
                      type="number"
                      min="0"
                      value={form.advance_price}
                      onChange={(event) => set("advance_price", event.target.value)}
                    />
                  </label>
                </>
              )}
            </>
          )}
        </div>

        {category === "sale" && (
          <div className="calculation">
            <span>{form.custom_price_enabled ? "Custom selling price" : "Calculated total price"}</span>
            <strong>{formatCurrency(total || null)}</strong>
          </div>
        )}

        {category === "sale" && (
          <div className="switches">
            <label>
              <input
                type="checkbox"
                checked={form.visited}
                onChange={(event) => set("visited", event.target.checked)}
              /> {" "}
              Visited
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.documents_collected}
                onChange={(event) => set("documents_collected", event.target.checked)}
              /> {" "}
              Documents collected
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.sold}
                onChange={(event) => set("sold", event.target.checked)}
              /> {" "}
              Sold
            </label>
          </div>
        )}

        {(category === "rental" || category === "lease") && (
          <div className="switches">
            <label>
              <input
                type="checkbox"
                checked={form.visited}
                onChange={(event) => set("visited", event.target.checked)}
              /> {" "}
              Visited
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.sold}
                onChange={(event) => set("sold", event.target.checked)}
              /> {" "}
              Sold
            </label>
          </div>
        )}
        <div className="panel-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" disabled={saving}>
            {saving ? "Saving..." : "Save property"}
          </button>
        </div>
      </form>
    </div>
  );
}
function DealForm({
  property,
  initialDeal,
  onClose,
  onSave,
}: {
  property?: Property;
  initialDeal?: Deal;
  onClose: () => void;
  onSave: (input: Omit<Deal, "id" | "created_at" | "updated_at" | "property_id">) => Promise<void>;
}) {
  const [form, setForm] = useState({
    buyer_name: initialDeal?.buyer_name ?? "",
    buyer_phone: initialDeal?.buyer_phone ?? "",
    deal_price: initialDeal?.deal_price?.toString() ?? "",
    deal_price_unit: initialDeal?.deal_price_unit ?? property?.price_unit ?? "sqft",
    custom_deal_price_enabled: initialDeal?.custom_deal_price_enabled ?? false,
    custom_deal_price: initialDeal?.custom_deal_price?.toString() ?? "",
    deal_status: initialDeal?.deal_status ?? "In Talk" as Deal["deal_status"],
  });
  const [saving, setSaving] = useState(false);

  const set = (key: string, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="panel-backdrop">
      <form
        className="edit-panel compact"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          try {
            await onSave({
              buyer_name: form.buyer_name,
              buyer_phone: form.buyer_phone,
              deal_price: form.deal_price ? Number(form.deal_price) : null,
              deal_price_unit: form.deal_price_unit,
              custom_deal_price_enabled: form.custom_deal_price_enabled,
              custom_deal_price: form.custom_deal_price ? Number(form.custom_deal_price) : null,
              deal_status: form.deal_status,
            });
          } catch (error) {
            window.alert(
              error instanceof Error ? error.message : "Unable to create deal.",
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="panel-header">
          <div>
            <p className="eyebrow">{initialDeal ? "EDIT DEAL" : "NEW DEAL"}</p>
            <h2>{property?.property_code ?? initialDeal?.property_id}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="form-grid">
          <label className="full-span">
            Buyer name *
            <input
              value={form.buyer_name}
              onChange={(event) => set("buyer_name", event.target.value)}
            />
          </label>
          <label className="full-span">
            Buyer phone number *
            <input
              value={form.buyer_phone}
              onChange={(event) => set("buyer_phone", event.target.value)}
            />
          </label>

          <label className="full-span">
            <span>Deal price mode</span>
            <div className="segmented-control">
              <label className={!form.custom_deal_price_enabled ? "selected" : ""}>
                <input
                  type="radio"
                  name="deal_mode"
                  checked={!form.custom_deal_price_enabled}
                  onChange={() => set("custom_deal_price_enabled", false)}
                />
                <span>Normal</span>
              </label>
              <label className={form.custom_deal_price_enabled ? "selected" : ""}>
                <input
                  type="radio"
                  name="deal_mode"
                  checked={form.custom_deal_price_enabled}
                  onChange={() => set("custom_deal_price_enabled", true)}
                />
                <span>Custom</span>
              </label>
            </div>
          </label>

          {!form.custom_deal_price_enabled && (
            <>
              <label>
                Deal price
                <input
                  type="number"
                  min="0"
                  value={form.deal_price}
                  onChange={(event) => set("deal_price", event.target.value)}
                />
              </label>
              <label>
                Deal price unit
                <select
                  value={form.deal_price_unit}
                  onChange={(event) => set("deal_price_unit", event.target.value)}
                >
                  <option value="sqft">sqft</option>
                  <option value="gunta">gunta</option>
                  <option value="acre">acre</option>
                </select>
              </label>
            </>
          )}

          {form.custom_deal_price_enabled && (
            <label className="full-span">
              Custom deal price *
              <input
                type="number"
                min="0"
                value={form.custom_deal_price}
                onChange={(event) => set("custom_deal_price", event.target.value)}
              />
            </label>
          )}

          <label className="full-span">
            Deal status
            <select
              value={form.deal_status}
              onChange={(event) => set("deal_status", event.target.value)}
            >
              <option value="In Talk">In Talk</option>
              <option value="Agreement">Agreement</option>
              <option value="Deal Done">Deal Done</option>
            </select>
          </label>
        </div>

        <div className="panel-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" disabled={saving}>
            {saving ? "Saving..." : initialDeal ? "Update deal" : "Save deal"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CallForm({
  onClose,
  initialCall,
  onSave,
}: {
  onClose: () => void;
  initialCall?: CallRequest;
  onSave: (
    input: Omit<
      CallRequest,
      "id" | "request_code" | "created_at" | "updated_at"
    >,
  ) => Promise<void>;
}) {
  const [form, setForm] = useState(() =>
    initialCall
      ? {
          contact_number: initialCall.contact_number,
          owner_name: initialCall.owner_name,
          location: initialCall.location,
          google_maps_url: initialCall.google_maps_url,
          property_type: initialCall.property_type,
          notes: initialCall.notes,
          status: initialCall.status,
        }
      : emptyCallRequest(),
  );
  const [saving, setSaving] = useState(false);
  const set = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="panel-backdrop">
      <form
        className="edit-panel compact"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          try {
            await onSave(form);
          } catch (error) {
            window.alert(
              error instanceof Error ? error.message : "Unable to create call request.",
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="panel-header">
          <div>
            <p className="eyebrow">{initialCall ? `EDITING ${initialCall.request_code}` : "NEW CALLBACK"}</p>
            <h2>{initialCall ? "Edit call request" : "Add call request"}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="form-grid">
          {(
            [
              ["owner_name", "Owner name"],
              ["contact_number", "Contact number"],
              ["location", "Location"],
              ["google_maps_url", "Google Maps URL"],
              ["notes", "Notes"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}{["owner_name", "contact_number", "location"].includes(key) ? " *" : ""}
              <input
                required={["owner_name", "contact_number", "location"].includes(key)}
                value={form[key]}
                onChange={(event) => set(key, event.target.value)}
              />
            </label>
          ))}
          <label>
            Property type *
            <select
              required
              value={form.property_type}
              onChange={(event) => set("property_type", event.target.value)}
            >
              <option value="">Select type</option>
              {PROPERTY_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="panel-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" disabled={saving}>
            {saving ? "Saving..." : initialCall ? "Save changes" : "Create request"}
          </button>
        </div>
      </form>
    </div>
  );
}
