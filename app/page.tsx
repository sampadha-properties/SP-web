"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Clipboard,
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
  FACING_OPTIONS,
  AreaUnit,
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
  const [showCallForm, setShowCallForm] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [propertyType, setPropertyType] = useState("all");
  const [statusFilter, setStatusFilter] = useState<PropertyFilter>("all");
  const [maxTotalPrice, setMaxTotalPrice] = useState("");

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
      result = result.filter((item) => !item.documents_collected);
    if (propertyType !== "all")
      result = result.filter((item) => item.property_type === propertyType);
    if (statusFilter === "sold") result = result.filter((item) => item.sold);
    if (statusFilter === "notSold")
      result = result.filter((item) => !item.sold);
    if (statusFilter === "visited")
      result = result.filter((item) => item.visited);
    if (statusFilter === "notVisited")
      result = result.filter((item) => !item.visited);
    if (statusFilter === "collected")
      result = result.filter((item) => item.documents_collected);
    if (statusFilter === "notCollected")
      result = result.filter((item) => !item.documents_collected);
    if (maxTotalPrice) {
      const maximum = Number(maxTotalPrice);
      if (Number.isFinite(maximum)) {
        result = result.filter(
          (item) => item.total_price !== null && item.total_price <= maximum,
        );
      }
    }
    return result;
  }, [properties, search, tab, propertyType, statusFilter, maxTotalPrice]);
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
    if (form.google_maps_url && !/^https?:\/\//i.test(form.google_maps_url))
      throw new Error("Enter a valid Google Maps URL.");
    if (
      (form.total_area && Number(form.total_area) < 0) ||
      (form.price && Number(form.price) < 0)
    )
      throw new Error("Area and price cannot be negative.");
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
            <HomeIcon size={19} />
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
            <strong>{properties.length}</strong>
            <span>properties</span>
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
              Property type
              <select
                value={propertyType}
                onChange={(event) => setPropertyType(event.target.value)}
              >
                <option value="all">All types</option>
                {PROPERTY_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
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
                <option value="collected">Documents collected</option>
                <option value="notCollected">Documents not collected</option>
              </select>
            </label>
            <label>
              Maximum total price
              <input
                className="price-filter-input"
                type="number"
                min="0"
                inputMode="decimal"
                value={maxTotalPrice}
                onChange={(event) => setMaxTotalPrice(event.target.value)}
                placeholder="Example: 5000000"
              />
            </label>
            <button
              className="secondary-button"
              onClick={() => {
                setPropertyType("all");
                setStatusFilter("all");
                setMaxTotalPrice("");
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
            const call = await createCall(input);
            setCalls((items) => [call, ...items]);
            setShowCallForm(false);
            notify("Call request created.");
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
  return (
    <article className="property-card">
      <div className="card-head">
        <span className="code">{property.property_code}</span>
        {property.sold && <span className="sold-badge">SOLD</span>}
      </div>
      <div className="photo-placeholder">
        <HomeIcon size={26} />
        <span>{property.image_url ? "Image connected" : "No image yet"}</span>
      </div>
      <div className="card-main">
        <h2>{property.name || property.keyword || "Untitled property"}</h2>
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
            <strong>{property.property_type || "—"}</strong>
          </div>
          <div>
            <span>Facing</span>
            <strong>{property.facing || "—"}</strong>
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
                  onClick={() =>
                    void navigator.clipboard?.writeText(property.contact_number)
                  }
                  aria-label="Copy contact"
                >
                  <Clipboard size={14} />
                </button>
              )}
            </strong>
          </div>
          <div>
            <span>Area</span>
            <strong>
              {formatNumber(property.total_area)} {property.area_unit}
            </strong>
          </div>
        </div>
        <div className="price-row">
          <span>
            {property.price
              ? `${formatCurrency(property.price)} / ${property.price_unit}`
              : "Price not added"}
          </span>
          <strong>{formatCurrency(property.total_price)}</strong>
        </div>
        <div className="status-row">
          <button
            className={`status ${property.visited ? "good" : "bad"}`}
            onClick={() => onToggle(property, "visited")}
          >
            <i />
            {property.visited ? "VISITED" : "NOT VISITED"}
          </button>
          <button
            className={`status ${property.documents_collected ? "good" : "bad"}`}
            onClick={() => onToggle(property, "documents_collected")}
          >
            <i />
            {property.documents_collected ? "COLLECTED" : "NOT COLLECTED"}
          </button>
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
  onUpdate,
}: {
  calls: CallRequest[];
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
                        void navigator.clipboard?.writeText(call.contact_number)
                      }
                      aria-label="Copy contact"
                    >
                      <Clipboard size={14} />
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
            <button className="edit-button" onClick={() => void onUpdate(call)}>
              {call.status === "Pending" ? "Mark completed" : "Mark pending"}
            </button>
          </div>
        </article>
      ))}
    </div>
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
    form.total_area && form.price
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
          {(
            [
              ["name", "Property name"],
              ["keyword", "Keyword"],
              ["owner_name", "Owner name *"],
              ["contact_number", "Contact number *"],
              ["location", "Location *"],
              ["google_maps_url", "Google Maps URL"],
              ["dimension", "Dimension"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                value={form[key] as string}
                onChange={(event) => set(key, event.target.value)}
              />
            </label>
          ))}
          <label>
            Facing
            <select
              value={form.facing}
              onChange={(event) => set("facing", event.target.value)}
            >
              <option value="">Select facing</option>
              {FACING_OPTIONS.map((facing) => (
                <option key={facing}>{facing}</option>
              ))}
            </select>
          </label>
          <label>
            Property type *
            <select
              value={form.property_type}
              onChange={(event) =>
                set(
                  "property_type",
                  event.target.value as PropertyFormValues["property_type"],
                )
              }
            >
              <option value="">Select type</option>
              {PROPERTY_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            Total area *
            <input
              type="number"
              min="0"
              value={form.total_area}
              onChange={(event) => set("total_area", event.target.value)}
            />
          </label>
          <label>
            Area unit *
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
            Price unit *
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
        </div>
        <div className="calculation">
          <span>Calculated total price</span>
          <strong>{formatCurrency(total || null)}</strong>
        </div>
        <div className="switches">
          <label>
            <input
              type="checkbox"
              checked={form.visited}
              onChange={(event) => set("visited", event.target.checked)}
            />{" "}
            Visited
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.documents_collected}
              onChange={(event) =>
                set("documents_collected", event.target.checked)
              }
            />{" "}
            Documents collected
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.sold}
              onChange={(event) => set("sold", event.target.checked)}
            />{" "}
            Sold
          </label>
        </div>
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
  onSave,
}: {
  onClose: () => void;
  onSave: (
    input: Omit<
      CallRequest,
      "id" | "request_code" | "created_at" | "updated_at"
    >,
  ) => Promise<void>;
}) {
  const [form, setForm] = useState(emptyCallRequest());
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
          await onSave(form);
          setSaving(false);
        }}
      >
        <div className="panel-header">
          <div>
            <p className="eyebrow">NEW CALLBACK</p>
            <h2>Add call request</h2>
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
              {label}
              <input
                value={form[key]}
                onChange={(event) => set(key, event.target.value)}
              />
            </label>
          ))}
          <label>
            Property type
            <select
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
            {saving ? "Creating..." : "Create request"}
          </button>
        </div>
      </form>
    </div>
  );
}
