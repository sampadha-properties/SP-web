export const SALE_PROPERTY_TYPES = [
  "Land",
  "Site",
  "Farmland",
  "Home",
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
  "East",
  "West",
  "South",
  "North East",
  "South East",
  "North West",
  "South West",
] as const;
export const RENTAL_FACING_OPTIONS = ["North", "South", "East", "West"] as const;

export type Facing = (typeof FACING_OPTIONS)[number];
export type PropertyType = (typeof SALE_PROPERTY_TYPES)[number];
export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number];
export type RentalListingType = (typeof RENTAL_LISTING_TYPES)[number];
export type RentalCategory = (typeof RENTAL_CATEGORY_OPTIONS)[number];
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
  sold: boolean;
  image_url: string | null;
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
  sold: false,
  image_url: null,
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
  sold: property.sold,
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

  const computedTotalPrice = isSale
    ? form.custom_price_enabled
      ? numericCustomPrice
      : numericArea !== null && numericPrice !== null
        ? numericArea * numericPrice
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
    sold: form.sold,
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