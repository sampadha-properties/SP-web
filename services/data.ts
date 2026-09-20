import { supabase } from "@/lib/supabase";
import { starterCalls, starterProperties } from "@/lib/mock-data";
import { CallRequest, Property, PropertyFormValues, formToPropertyInput } from "@/types";

const propertyKey = "sampadha-properties";
const callKey = "sampadha-call-requests";

const read = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  const saved = window.localStorage.getItem(key);
  return saved ? (JSON.parse(saved) as T) : fallback;
};

const write = (key: string, value: unknown) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
};

const normalizeProperty = (property: Partial<Property> | null | undefined): Property => ({
  id: property?.id ?? crypto.randomUUID(),
  property_code: property?.property_code ?? "SP000",
  name: property?.name ?? "",
  keyword: property?.keyword ?? "",
  location: property?.location ?? "",
  google_maps_url: property?.google_maps_url ?? "",
  owner_name: property?.owner_name ?? "",
  contact_number: property?.contact_number ?? "",
  second_contact_number: property?.second_contact_number ?? "",
  property_category: property?.property_category ?? "sale",
  property_type: property?.property_type ?? "",
  rental_type: property?.rental_type ?? "",
  rental_category: property?.rental_category ?? "",
  facing: property?.facing ?? "",
  dimension: property?.dimension ?? "",
  floor: property?.floor ?? "",
  property_kind: property?.property_kind ?? "",
  total_area: property?.total_area ?? null,
  area_unit: property?.area_unit ?? "sqft",
  price: property?.price ?? null,
  price_unit: property?.price_unit ?? "sqft",
  total_price: property?.total_price ?? null,
  custom_price_enabled: Boolean(property?.custom_price_enabled),
  custom_selling_price: property?.custom_selling_price ?? null,
  rent_price: property?.rent_price ?? null,
  advance_price: property?.advance_price ?? null,
  visited: Boolean(property?.visited),
  documents_collected: Boolean(property?.documents_collected),
  sold: Boolean(property?.sold),
  created_at: property?.created_at ?? new Date().toISOString(),
  updated_at: property?.updated_at ?? new Date().toISOString(),
  image_path: property?.image_path ?? null,
  image_url: property?.image_url ?? null,
});

export async function listProperties(): Promise<Property[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((item) => normalizeProperty(item as Partial<Property>));
  }
  return read<Property[]>(propertyKey, starterProperties).map((item) => normalizeProperty(item));
}

export async function listCalls(): Promise<CallRequest[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("call_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as CallRequest[];
  }
  return read(callKey, starterCalls);
}

export async function createProperty(): Promise<Property> {
  if (supabase) {
    const { data, error } = await supabase.rpc("create_property");
    if (error) throw error;
    return normalizeProperty(data as Partial<Property>);
  }

  const properties = read<Property[]>(propertyKey, starterProperties);
  const next = Math.max(0, ...properties.map((item) => Number(item.property_code.replace("SP", "")))) + 1;
  const now = new Date().toISOString();
  const property: Property = {
    id: crypto.randomUUID(),
    property_code: `SP${String(next).padStart(3, "0")}`,
    name: "",
    keyword: "",
    location: "",
    google_maps_url: "",
    owner_name: "",
    contact_number: "",
    second_contact_number: "",
    property_category: "",
    property_type: "",
    rental_type: "",
    rental_category: "",
    facing: "",
    dimension: "",
    floor: "",
    property_kind: "",
    total_area: null,
    area_unit: "sqft",
    price: null,
    price_unit: "sqft",
    total_price: null,
    custom_price_enabled: false,
    custom_selling_price: null,
    rent_price: null,
    advance_price: null,
    visited: false,
    documents_collected: false,
    sold: false,
    created_at: now,
    updated_at: now,
    image_path: null,
    image_url: null,
  };

  write(propertyKey, [property, ...properties]);
  return property;
}

export async function updateProperty(property: Property, form: PropertyFormValues): Promise<Property> {
  const input = formToPropertyInput(form);
  const updated = {
    ...normalizeProperty(property),
    ...input,
    updated_at: new Date().toISOString(),
  } as Property;

  if (supabase) {
    const { data, error } = await supabase
      .from("properties")
      .update(input)
      .eq("id", property.id)
      .select()
      .single();
    if (error) throw error;
    return normalizeProperty(data as Partial<Property>);
  }

  write(
    propertyKey,
    read<Property[]>(propertyKey, starterProperties).map((item) =>
      item.id === property.id ? updated : item,
    ),
  );
  return updated;
}

export async function updatePropertyStatus(
  property: Property,
  patch: Partial<Pick<Property, "visited" | "documents_collected" | "sold">>,
): Promise<Property> {
  if (supabase) {
    const { data, error } = await supabase
      .from("properties")
      .update(patch)
      .eq("id", property.id)
      .select()
      .single();
    if (error) throw error;
    return normalizeProperty(data as Partial<Property>);
  }

  const updated = {
    ...normalizeProperty(property),
    ...patch,
    updated_at: new Date().toISOString(),
  } as Property;

  write(
    propertyKey,
    read<Property[]>(propertyKey, starterProperties).map((item) =>
      item.id === property.id ? updated : item,
    ),
  );
  return updated;
}

export async function createCall(
  input: Omit<CallRequest, "id" | "request_code" | "created_at" | "updated_at">,
): Promise<CallRequest> {
  if (supabase) {
    const { data, error } = await supabase.rpc("create_call_request", { payload: input });
    if (error) throw error;
    return data as CallRequest;
  }

  const calls = read(callKey, starterCalls);
  const next = Math.max(0, ...calls.map((item) => Number(item.request_code.replace("RQ", "")))) + 1;
  const now = new Date().toISOString();
  const request = {
    ...input,
    id: crypto.randomUUID(),
    request_code: `RQ${String(next).padStart(3, "0")}`,
    created_at: now,
    updated_at: now,
  };

  write(callKey, [request, ...calls]);
  return request;
}

export async function updateCall(call: CallRequest, patch: Partial<CallRequest>): Promise<CallRequest> {
  const updated = { ...call, ...patch, updated_at: new Date().toISOString() };

  if (supabase) {
    const { data, error } = await supabase
      .from("call_requests")
      .update(patch)
      .eq("id", call.id)
      .select()
      .single();
    if (error) throw error;
    return data as CallRequest;
  }

  write(
    callKey,
    read<CallRequest[]>(callKey, starterCalls).map((item) =>
      item.id === call.id ? updated : item,
    ),
  );
  return updated;
}

