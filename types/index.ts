export const PROPERTY_TYPES = ["Land", "Site", "Farmland", "Building", "Commercial", "Semi Commercial", "Rental Home", "Lease Home"] as const;
export const FACING_OPTIONS = ["North", "East", "West", "South", "North East", "South East", "North West", "South West"] as const;
export type Facing = (typeof FACING_OPTIONS)[number];
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type AreaUnit = "sqft" | "gunta" | "acre";
export type CallStatus = "Pending" | "Completed";

export interface Property {
  id: string;
  property_code: string;
  name: string;
  keyword: string;
  location: string;
  google_maps_url: string;
  owner_name: string;
  contact_number: string;
  property_type: PropertyType | "";
  facing: string;
  dimension: string;
  total_area: number | null;
  area_unit: AreaUnit;
  price: number | null;
  price_unit: AreaUnit;
  total_price: number | null;
  visited: boolean;
  documents_collected: boolean;
  sold: boolean;
  created_at: string;
  updated_at: string;
  image_path: string | null;
  image_url: string | null;
}

export interface CallRequest {
  id: string;
  request_code: string;
  contact_number: string;
  owner_name: string;
  location: string;
  google_maps_url: string;
  property_type: PropertyType | "";
  notes: string;
  status: CallStatus;
  created_at: string;
  updated_at: string;
}

export interface PropertyFormValues {
  property_code: string;
  name: string;
  keyword: string;
  owner_name: string;
  contact_number: string;
  location: string;
  google_maps_url: string;
  property_type: PropertyType | "";
  facing: string;
  dimension: string;
  total_area: string;
  area_unit: AreaUnit;
  price: string;
  price_unit: AreaUnit;
  visited: boolean;
  documents_collected: boolean;
  sold: boolean;
  image_url: string | null;
}

export const emptyPropertyForm = (propertyCode = ""): PropertyFormValues => ({
  property_code: propertyCode,
  name: "",
  keyword: "",
  owner_name: "",
  contact_number: "",
  location: "",
  google_maps_url: "",
  property_type: "",
  facing: "",
  dimension: "",
  total_area: "",
  area_unit: "sqft",
  price: "",
  price_unit: "sqft",
  visited: false,
  documents_collected: false,
  sold: false,
  image_url: null,
});

export const propertyToForm = (property: Property): PropertyFormValues => ({
  property_code: property.property_code,
  name: property.name,
  keyword: property.keyword,
  owner_name: property.owner_name,
  contact_number: property.contact_number,
  location: property.location,
  google_maps_url: property.google_maps_url,
  property_type: property.property_type,
  facing: property.facing ?? "",
  dimension: property.dimension,
  total_area: property.total_area?.toString() ?? "",
  area_unit: property.area_unit,
  price: property.price?.toString() ?? "",
  price_unit: property.price_unit,
  visited: property.visited,
  documents_collected: property.documents_collected,
  sold: property.sold,
  image_url: property.image_url,
});

export const formToPropertyInput = (form: PropertyFormValues) => ({
  name: form.name.trim(), keyword: form.keyword.trim(), owner_name: form.owner_name.trim(), contact_number: form.contact_number.trim(),
  location: form.location.trim(), google_maps_url: form.google_maps_url.trim(), property_type: form.property_type,
  facing: form.facing.trim(), dimension: form.dimension.trim(), total_area: form.total_area ? Number(form.total_area) : null, area_unit: form.area_unit,
  price: form.price ? Number(form.price) : null, price_unit: form.price_unit, visited: form.visited,
  documents_collected: form.documents_collected, sold: form.sold,
});

export const emptyCallRequest = (code = ""): Omit<CallRequest, "id" | "created_at" | "updated_at"> => ({
  request_code: code, contact_number: "", owner_name: "", location: "", google_maps_url: "", property_type: "", notes: "", status: "Pending",
});