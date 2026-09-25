import { supabase } from "@/lib/supabase";
import { starterCalls, starterProperties } from "@/lib/mock-data";
import {
  CallRequest,
  ClientRequest,
  Deal,
  Property,
  PropertyFormValues,
  RentalHomeUnit,
  formToPropertyInput,
} from "@/types";

const propertyKey = "sampadha-properties";
const callKey = "sampadha-call-requests";
const dealKey = "sampadha-deals";
const requestKey = "sampadha-client-requests";

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
  property_category: property?.property_category || "sale",
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
  total_price: property?.total_price ?? (
    property?.custom_price_enabled
      ? property?.custom_selling_price ?? null
      : property?.price != null && property?.total_area != null
        ? property.price * property.total_area
        : null
  ),
  custom_price_enabled: Boolean(property?.custom_price_enabled),
  custom_selling_price: property?.custom_selling_price ?? null,
  rent_price: property?.rent_price ?? null,
  advance_price: property?.advance_price ?? null,
  visited: Boolean(property?.visited),
  documents_collected: Boolean(property?.documents_collected),
  video_uploaded: Boolean(property?.video_uploaded),
  sold: Boolean(property?.sold),
  deal_status: property?.deal_status ?? null,
  years_old: property?.years_old ?? null,
  details: property?.details ?? "",
  final_price: property?.final_price ?? null,
  created_at: property?.created_at ?? new Date().toISOString(),
  updated_at: property?.updated_at ?? new Date().toISOString(),
  image_path: property?.image_path ?? null,
  image_url: property?.image_url ?? null,
});

const normalizeDeal = (deal: Partial<Deal> | null | undefined): Deal => ({
  id: deal?.id ?? crypto.randomUUID(),
  property_id: deal?.property_id ?? "",
  buyer_name: deal?.buyer_name ?? "",
  buyer_phone: deal?.buyer_phone ?? "",
  deal_price: deal?.deal_price ?? null,
  deal_price_unit: deal?.deal_price_unit ?? "sqft",
  custom_deal_price_enabled: Boolean(deal?.custom_deal_price_enabled),
  custom_deal_price: deal?.custom_deal_price ?? null,
  deal_status: deal?.deal_status ?? "In Talk",
  created_at: deal?.created_at ?? new Date().toISOString(),
  updated_at: deal?.updated_at ?? new Date().toISOString(),
});

const normalizeRequest = (request: Partial<ClientRequest> | null | undefined): ClientRequest => ({
  id: request?.id ?? crypto.randomUUID(),
  request_code: request?.request_code ?? "RQ000",
  client_name: request?.client_name ?? "",
  phone_number: request?.phone_number ?? "",
  property_category: request?.property_category || "sale",
  property_type: request?.property_type ?? "",
  rental_type: request?.rental_type ?? "",
  rental_category: request?.rental_category ?? "",
  location: request?.location ?? "",
  facing: request?.facing ?? "Any Facing",
  dimension: request?.dimension ?? "",
  area: request?.area ?? null,
  area_unit: request?.area_unit ?? "sqft",
  price: request?.price ?? null,
  price_unit: request?.price_unit ?? "sqft",
  custom_budget_enabled: Boolean(request?.custom_budget_enabled),
  custom_budget: request?.custom_budget ?? null,
  budget: request?.budget ?? null,
  area_match_mode: request?.area_match_mode ?? "min",
  budget_match_mode: request?.budget_match_mode ?? request?.match_mode ?? "min",
  details: request?.details ?? "",
  match_mode: request?.match_mode ?? "min",
  floor: request?.floor ?? "",
  property_kind: request?.property_kind ?? "",
  advance_budget: request?.advance_budget ?? null,
  created_at: request?.created_at ?? new Date().toISOString(),
  updated_at: request?.updated_at ?? new Date().toISOString(),
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

export async function listDeals(): Promise<Deal[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((item) => normalizeDeal(item as Partial<Deal>));
  }
  return read<Deal[]>(dealKey, []);
}

export async function listClientRequests(): Promise<ClientRequest[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("client_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((item) => normalizeRequest(item as Partial<ClientRequest>));
  }
  return read<ClientRequest[]>(requestKey, []);
}

export async function listRentalHomeUnits(): Promise<RentalHomeUnit[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("rental_home_units")
      .select("*")
      .eq("available", true)
      .order("created_at", { ascending: true });
    if (error) {
      if (error.code === "42P01") return [];
      throw error;
    }
    return (data ?? []) as RentalHomeUnit[];
  }
  return [];
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
    video_uploaded: false,
    sold: false,
    years_old: null,
    details: "",
    final_price: null,
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
    const databaseInput = Object.fromEntries(
      Object.entries(input),
    );
    const { data, error } = await supabase
      .from("properties")
      .update(databaseInput)
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
  patch: Partial<Pick<Property, "visited" | "documents_collected" | "video_uploaded" | "sold">>,
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

export async function createDeal(input: Omit<Deal, "id" | "created_at" | "updated_at">): Promise<Deal> {
  if (supabase) {
    const { data, error } = await supabase
      .from("deals")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return normalizeDeal(data as Partial<Deal>);
  }

  const deals = read<Deal[]>(dealKey, []);
  const now = new Date().toISOString();
  const deal = normalizeDeal({ ...input, id: crypto.randomUUID(), created_at: now, updated_at: now });
  write(dealKey, [deal, ...deals]);
  return deal;
}

export async function markDealDoneAndSold(propertyId: string, property: Property): Promise<Property> {
  if (supabase) {
    const { data, error } = await supabase
      .from("properties")
      .update({ sold: true, updated_at: new Date().toISOString() })
      .eq("id", propertyId)
      .select()
      .single();
    if (error) throw error;
    return normalizeProperty(data as Partial<Property>);
  }

  const updated = {
    ...normalizeProperty(property),
    sold: true,
    updated_at: new Date().toISOString(),
  } as Property;

  write(
    propertyKey,
    read<Property[]>(propertyKey, starterProperties).map((item) =>
      item.id === propertyId ? updated : item,
    ),
  );
  return updated;
}

export async function updateDeal(deal: Deal, patch: Partial<Deal>): Promise<Deal> {
  const updated = { ...deal, ...patch, updated_at: new Date().toISOString() };

  if (supabase) {
    const { data, error } = await supabase
      .from("deals")
      .update(patch)
      .eq("id", deal.id)
      .select()
      .single();
    if (error) throw error;
    return normalizeDeal(data as Partial<Deal>);
  }

  write(
    dealKey,
    read<Deal[]>(dealKey, []).map((item) => (item.id === deal.id ? updated : item)),
  );
  return updated;
}

export async function createClientRequest(
  input: Omit<ClientRequest, "id" | "request_code" | "created_at" | "updated_at">,
): Promise<ClientRequest> {
  if (supabase) {
    const { data, error } = await supabase.rpc("create_client_request", {
      payload: input,
    });
    if (error) throw error;
    return normalizeRequest(data as Partial<ClientRequest>);
  }

  const requests = read<ClientRequest[]>(requestKey, []);
  const next = Math.max(0, ...requests.map((item) => Number(item.request_code.replace("RQ", "")))) + 1;
  const now = new Date().toISOString();
  const request = normalizeRequest({
    ...input,
    id: crypto.randomUUID(),
    request_code: `RQ${String(next).padStart(3, "0")}`,
    created_at: now,
    updated_at: now,
  });
  write(requestKey, [request, ...requests]);
  return request;
}

export async function updateClientRequest(request: ClientRequest, patch: Partial<ClientRequest>): Promise<ClientRequest> {
  const updated = { ...request, ...patch, updated_at: new Date().toISOString() };

  if (supabase) {
    const { data, error } = await supabase
      .from("client_requests")
      .update(patch)
      .eq("id", request.id)
      .select()
      .single();
    if (error) throw error;
    return normalizeRequest(data as Partial<ClientRequest>);
  }

  write(
    requestKey,
    read<ClientRequest[]>(requestKey, []).map((item) =>
      item.id === request.id ? updated : item,
    ),
  );
  return updated;
}

