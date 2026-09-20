"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Clipboard,
  Check,
  ExternalLink,
  Home as HomeIcon,
  ListFilter,
  MapPin,
  Menu,
  Phone,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  createCall,
  createProperty,
  listCalls,
  listProperties,
  updateCall,
  updateProperty,
  updatePropertyStatus,
} from "@/services/data";
import {
  emptyCallRequest,
  propertyToForm,
  Property,
  PropertyFormValues,
  CallRequest,
  PROPERTY_TYPES,
  RENTAL_CATEGORY_OPTIONS,
  RENTAL_FACING_OPTIONS,
  RENTAL_PROPERTY_KIND_OPTIONS,
  AreaUnit,
  RENTAL_LISTING_TYPES,
  PropertyCategory,
  PROPERTY_CATEGORIES,
} from "@/types";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

type Tab = "listing" | "visit" | "collect" | "calls" | "edit";
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
  { id: "edit", label: "Edit property", short: "Edit" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("listing");
  const [properties, setProperties] = useState<Property[]>([]);
  const [calls, setCalls] = useState<CallRequest[]>([]);
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

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };
  const reload = async () => {
    setLoading(true);
    try {
      const [nextProperties, nextCalls] = await Promise.all([
        listProperties(),
        listCalls(),
      ]);
      setProperties(nextProperties);
      setCalls(nextCalls);
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
        const value = item.property_category === "sale" ? item.total_price : item.rent_price;
        return value !== null && value >= minimum;
      });
    }
    if (maximum !== null && Number.isFinite(maximum)) {
      result = result.filter((item) => {
        const value = item.property_category === "sale" ? item.total_price : item.rent_price;
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
    key: "visited" | "documents_collected",
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
          : "Document status updated.",
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
              src="/logo.png"
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
            <strong>{tab === "calls" ? filteredCalls.length : properties.length}</strong>
            <span>{tab === "calls" ? "call requests" : "properties"}</span>
          </div>
        </section>
        <div className="toolbar">
          <label className="search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                tab === "calls" ? "Search requests..." : "Search properties..."
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
          {tab === "listing" && (
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
        ) : (
          <PropertyList
            properties={filteredProperties}
            tab={tab}
            onToggle={toggle}
            onEdit={(property) => {
              setEditProperty(property);
              setTab("edit");
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
  tab,
  onToggle,
  onEdit,
}: {
  properties: Property[];
  tab: Tab;
  onToggle: (
    property: Property,
    key: "visited" | "documents_collected",
  ) => void;
  onEdit: (property: Property) => void;
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
          onToggle={onToggle}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
function PropertyCard({
  property,
  onToggle,
  onEdit,
}: {
  property: Property;
  onToggle: (
    property: Property,
    key: "visited" | "documents_collected",
  ) => void;
  onEdit: (property: Property) => void;
}) {
  const [copied, setCopied] = useState(false);
  const categoryLabel =
    property.property_category === "rental"
      ? "RENTAL"
      : property.property_category === "lease"
        ? "LEASE"
        : "SALE";

  const priceLabel =
    property.custom_price_enabled && property.custom_selling_price != null
      ? "Custom Price"
      : property.rent_price != null
        ? "Rent"
        : property.price
          ? `Area × Price`
          : "Price not added";

  const displayPrice =
    property.custom_price_enabled && property.custom_selling_price != null
      ? formatCurrency(property.custom_selling_price)
      : property.rent_price != null
        ? formatCurrency(property.rent_price)
        : formatCurrency(property.total_price);

  return (
    <article
      className={`property-card ${property.property_category === "sale" ? "sale-card" : property.property_category === "lease" ? "lease-card" : "rental-card"}`}
    >
      <div className="card-head">
        <span className="code">{property.property_code}</span>
        <div className="card-tags">
          <span className="category-badge">{categoryLabel}</span>
          {property.sold && <span className="sold-badge">SOLD</span>}
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
            <span>Type</span>
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
          <div>
            <span>Contact</span>
            <strong className="contact">
              <a
                href={
                  property.contact_number
                    ? `tel:${property.contact_number}`
                    : undefined
                }
              >
                {property.contact_number || "—"}
              </a>
              {property.contact_number && (
                <button
                  onClick={() => {
                    void navigator.clipboard?.writeText(property.contact_number);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1800);
                  }}
                  aria-label="Copy contact"
                >
                  {copied ? <Check size={14} /> : <Clipboard size={14} />}
                </button>
              )}
            </strong>
          </div>
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
            <span>Property Type</span>
            <strong>
              {property.property_category === "sale"
                ? property.property_type || "—"
                : property.rental_category === "home"
                  ? "Home"
                  : property.rental_category === "commercial_space"
                    ? "Commercial place"
                    : "—"}
            </strong>
          </div>
          <div>
            <span>Facing</span>
            <strong>{property.facing || "—"}</strong>
          </div>
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
        <div className="price-row">
          <span>
            {priceLabel}
          </span>
          <strong>{displayPrice}</strong>
        </div>
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
        </div>
        <p className="created">Created {formatDate(property.created_at)}</p>
        <button className="edit-button" onClick={() => onEdit(property)}>
          Edit property
        </button>
      </div>
    </article>
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
  const [copied, setCopied] = useState(false);

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
                <strong className="contact">
                  <a href={`tel:${call.contact_number}`}>
                    {call.contact_number || "—"}
                  </a>
                  {call.contact_number && (
                    <button
                      onClick={() =>
                        void navigator.clipboard?.writeText(call.contact_number).then(() => {
                          setCopied(true);
                          window.setTimeout(() => setCopied(false), 1800);
                        })
                      }
                      aria-label="Copy contact"
                    >
                      {copied ? <Check size={14} /> : <Clipboard size={14} />}
                    </button>
                  )}
                </strong>
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
        error instanceof Error ? error.message : "Unable to save property.",
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
                  {RENTAL_FACING_OPTIONS.map((facing) => (
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
