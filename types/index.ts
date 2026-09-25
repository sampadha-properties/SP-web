export const SALE_PROPERTY_TYPES = [
  "Land",
  "Site",
  "Farmland",
  "Home",
  "Residential Home",
  "Rental Home",
  "Commercial Building",
  "Commercial Land",
  "Semi Commercial Land",
  "Semi Commercial Building",
] as const;
export const PROPERTY_TYPES = [...SALE_PROPERTY_TYPES] as const;
export const PROPERTY_CATEGORIES = ["sale", "rental", "lease"] as const;
export const RENTAL_LISTING_TYPES = ["rental", "lease"] as const;
export const RENTAL_CATEGORY_OPTIONS = ["home", "commercial_space"] as const;
export const RENTAL_PROPERTY_KIND_OPTIONS = ["HK", "Room", "1BHK", "2BHK", "3BHK", "4BHK", "Duplex"] as const;
export const FACING_OPTIONS = [
  "North",
  "South",
  "East",
  "West",
  "North-East",
  "South-East",
  "North-West",
  "South-West",
  "Any Facing",
] as const;
export const RENTAL_FACING_OPTIONS = [
  "North",
  "South",
  "East",
  "West",
  "North-East",
  "South-East",
  "North-West",
  "South-West",
  "Any Facing",
] as const;

export type Facing = (typeof FACING_OPTIONS)[number];
export type PropertyType = (typeof SALE_PROPERTY_TYPES)[number];
export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number];
export type RentalListingType = (typeof RENTAL_LISTING_TYPES)[number];
export type RentalCategory = (typeof RENTAL_CATEGORY_OPTIONS)[number];
export type AreaUnit = "sqft" | "gunta" | "acre";
export type CallStatus = "Pending" | "Completed";
export type DealStatus = "In Talk" | "Agreement" | "Deal Done";
export type MatchMode = "min" | "max";

export const SQFT_PER_AREA_UNIT: Record<AreaUnit, number> = {
  sqft: 1,
  gunta: 1089,
  acre: 43560,
};

export const toSqft = (value: number, unit: AreaUnit) =>
  value * (SQFT_PER_AREA_UNIT[unit] ?? 1);

export interface Property {
  id: string;
  property_code: string;
  name: string;
  keyword: string;
  location: string;
  google_maps_url: string;
  owner_name: string;
  contact_number: string;
  second_contact_number: string;
  property_category: PropertyCategory | "";
  property_type: PropertyType | "";
  rental_type: RentalListingType | "";
  rental_category: RentalCategory | "";
  facing: string;
  dimension: string;
  floor: string;
  property_kind: string;
  total_area: number | null;
  area_unit: AreaUnit;
  price: number | null;
  price_unit: AreaUnit;
  total_price: number | null;
  custom_price_enabled: boolean;
  custom_selling_price: number | null;
  rent_price: number | null;
  advance_price: number | null;
  visited: boolean;
  documents_collected: boolean;
  video_uploaded: boolean;
  sold: boolean;
  deal_status?: DealStatus | null;
  years_old: number | null;
  details: string;
  final_price: number | null;
  created_at: string;
  updated_at: string;
  image_path: string | null;
  image_url: string | null;
  home_units?: RentalHomeUnit[];
}

export interface RentalHomeUnit {
  id: string;
  property_id: string;
  floor: string;
  property_kind: string;
  facing: string;
  rent_price: number | null;
  advance_price: number | null;
  dimension: string;
  available: boolean;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  property_id: string;
  buyer_name: string;
  buyer_phone: string;
  deal_price: number | null;
  deal_price_unit: AreaUnit;
  custom_deal_price_enabled: boolean;
  custom_deal_price: number | null;
  deal_status: DealStatus;
  created_at: string;
  updated_at: string;
}

export interface ClientRequest {
  id: string;
  request_code: string;
  client_name: string;
  phone_number: string;
  property_category: PropertyCategory | "";
  property_type: PropertyType | "";
  rental_type: RentalListingType | "" | null;
  rental_category: RentalCategory | "" | null;
  location: string;
  facing: string;
  dimension: string;
  floor: string;
  property_kind: string;
  area: number | null;
  area_unit: AreaUnit;
  price: number | null;
  price_unit: AreaUnit;
  custom_budget_enabled: boolean;
  custom_budget: number | null;
  budget: number | null;
  advance_budget: number | null;
  details: string;
  area_match_mode: MatchMode;
  budget_match_mode: MatchMode;
  match_mode: MatchMode;
  created_at: string;
  updated_at: string;
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
  second_contact_number: string;
  location: string;
  google_maps_url: string;
  property_category: PropertyCategory | "";
  property_type: PropertyType | "";
  rental_type: RentalListingType | "";
  rental_category: RentalCategory | "";
  facing: string;
  dimension: string;
  floor: string;
  property_kind: string;
  total_area: string;
  area_unit: AreaUnit;
  price: string;
  price_unit: AreaUnit;
  total_price: string;
  custom_price_enabled: boolean;
  custom_selling_price: string;
  rent_price: string;
  advance_price: string;
  visited: boolean;
  documents_collected: boolean;
  video_uploaded: boolean;
  sold: boolean;
  years_old: string;
  details: string;
  final_price: string;
  image_url: string | null;
}

export interface RequestFormValues {
  request_code: string;
  client_name: string;
  phone_number: string;
  property_category: PropertyCategory | "";
  property_type: PropertyType | "";
  rental_type: RentalListingType | "";
  rental_category: RentalCategory | "";
  location: string;
  facing: string;
  dimension: string;
  floor: string;
  property_kind: string;
  area: string;
  area_unit: AreaUnit;
  price: string;
  price_unit: AreaUnit;
  custom_budget_enabled: boolean;
  custom_budget: string;
  budget: string;
  advance_budget: string;
  area_match_mode: MatchMode;
  budget_match_mode: MatchMode;
  details: string;
  match_mode: MatchMode;
}

export const emptyPropertyForm = (propertyCode = ""): PropertyFormValues => ({
  property_code: propertyCode,
  name: "",
  keyword: "",
  owner_name: "",
  contact_number: "",
  second_contact_number: "",
  location: "",
  google_maps_url: "",
  property_category: "",
  property_type: "",
  rental_type: "",
  rental_category: "",
  facing: "",
  dimension: "",
  floor: "",
  property_kind: "",
  total_area: "",
  area_unit: "sqft",
  price: "",
  price_unit: "sqft",
  total_price: "",
  custom_price_enabled: false,
  custom_selling_price: "",
  rent_price: "",
  advance_price: "",
  visited: false,
  documents_collected: false,
  video_uploaded: false,
  sold: false,
  years_old: "",
  details: "",
  final_price: "",
  image_url: null,
});

export const emptyRequestForm = (requestCode = ""): RequestFormValues => ({
  request_code: requestCode,
  client_name: "",
  phone_number: "",
  property_category: "",
  property_type: "",
  rental_type: "",
  rental_category: "",
  location: "",
  facing: "Any Facing",
  dimension: "",
  floor: "",
  property_kind: "",
  area: "",
  area_unit: "sqft",
  price: "",
  price_unit: "sqft",
  custom_budget_enabled: false,
  custom_budget: "",
  budget: "",
  advance_budget: "",
  area_match_mode: "min",
  budget_match_mode: "min",
  details: "",
  match_mode: "min",
});

export const propertyToForm = (property: Property): PropertyFormValues => ({
  property_code: property.property_code,
  name: property.name,
  keyword: property.keyword,
  owner_name: property.owner_name,
  contact_number: property.contact_number,
  second_contact_number: property.second_contact_number ?? "",
  location: property.location,
  google_maps_url: property.google_maps_url,
  property_category: property.property_category ?? "",
  property_type: property.property_type,
  rental_type: property.rental_type ?? "",
  rental_category: property.rental_category ?? "",
  facing: property.facing ?? "",
  dimension: property.dimension,
  floor: property.floor ?? "",
  property_kind: property.property_kind ?? "",
  total_area: property.total_area?.toString() ?? "",
  area_unit: property.area_unit,
  price: property.price?.toString() ?? "",
  price_unit: property.price_unit,
  total_price: property.total_price?.toString() ?? "",
  custom_price_enabled: Boolean(property.custom_price_enabled),
  custom_selling_price: property.custom_selling_price?.toString() ?? "",
  rent_price: property.rent_price?.toString() ?? "",
  advance_price: property.advance_price?.toString() ?? "",
  visited: property.visited,
  documents_collected: property.documents_collected,
  video_uploaded: Boolean(property.video_uploaded),
  sold: property.sold,
  years_old: property.years_old?.toString() ?? "",
  details: property.details ?? "",
  final_price: property.final_price?.toString() ?? "",
  image_url: property.image_url,
});

export const formToPropertyInput = (form: PropertyFormValues) => {
  const propertyCategory =
    form.property_category === "sale" ||
    form.property_category === "rental" ||
    form.property_category === "lease"
      ? form.property_category
      : "sale";

  const isSale = propertyCategory === "sale";
  const isRental = propertyCategory === "rental" || propertyCategory === "lease";
  const numericArea = form.total_area ? Number(form.total_area) : null;
  const numericPrice = form.price ? Number(form.price) : null;
  const numericCustomPrice = form.custom_price_enabled
    ? form.custom_selling_price
      ? Number(form.custom_selling_price)
      : null
    : null;
  const numericFinalPrice = form.final_price ? Number(form.final_price) : null;

  const computedTotalPrice = isSale
    ? form.custom_price_enabled
      ? numericCustomPrice
      : numericArea !== null && numericPrice !== null
        ? numericPrice * toSqft(numericArea, form.area_unit) / toSqft(1, form.price_unit)
        : null
    : null;

  return {
    name: form.name.trim(),
    keyword: form.keyword.trim(),
    owner_name: form.owner_name.trim(),
    contact_number: form.contact_number.trim(),
    second_contact_number: form.second_contact_number.trim(),
    location: form.location.trim(),
    google_maps_url: form.google_maps_url.trim(),
    property_category: propertyCategory,
    property_type: isSale ? form.property_type : "",
    rental_type: isRental ? form.rental_type : null,
    rental_category: isRental ? form.rental_category : null,
    facing: form.facing.trim(),
    dimension: form.dimension.trim(),
    floor: form.floor.trim(),
    property_kind: form.property_kind.trim(),
    total_area: numericArea,
    area_unit: form.area_unit,
    price: numericPrice,
    price_unit: form.price_unit,
    total_price: computedTotalPrice,
    custom_price_enabled: isSale ? Boolean(form.custom_price_enabled) : false,
    custom_selling_price: isSale && form.custom_price_enabled ? numericCustomPrice : null,
    rent_price: isRental ? (form.rent_price ? Number(form.rent_price) : null) : null,
    advance_price: isRental ? (form.advance_price ? Number(form.advance_price) : null) : null,
    visited: form.visited,
    documents_collected: form.documents_collected,
    video_uploaded: form.video_uploaded,
    sold: form.sold,
    years_old: form.years_old ? Number(form.years_old) : null,
    details: form.details.trim(),
    final_price: numericFinalPrice,
  };
};

export const emptyCallRequest = (code = ""): Omit<CallRequest, "id" | "created_at" | "updated_at"> => ({
  request_code: code,
  contact_number: "",
  owner_name: "",
  location: "",
  google_maps_url: "",
  property_type: "",
  notes: "",
  status: "Pending",
});