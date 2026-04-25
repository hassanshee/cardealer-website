export const stockCategories = [
  "new",
  "used",
  "imported",
  "available_for_importation",
  "traded_in",
] as const;

export const vehicleStatuses = [
  "draft",
  "published",
  "sold",
  "unpublished",
] as const;

export const vehicleConditionOptions = [
  "Foreign used",
  "Locally used",
  "Brand new",
  "Trade-in unit",
  "Very clean",
  "Clean unit",
  "Accident free, original paint",
  "New registration",
  "Traded-in / Very clean",
  "Traded-in / Clean unit",
] as const;

export const vehicleTransmissionOptions = [
  "Automatic",
  "Manual",
  "CVT",
] as const;

export const vehicleFuelTypeOptions = [
  "Petrol",
  "Diesel",
  "Hybrid",
  "Electric",
] as const;

export const leadTypes = ["quote", "contact", "financing"] as const;

export const inventorySortOptions = [
  "latest",
  "price-asc",
  "price-desc",
  "year-desc",
  "mileage-asc",
] as const;

export const leadInboxFilters = [
  "all",
  "quote",
  "contact",
  "financing",
  "test_drive",
  "trade_in",
] as const;

export const leadWorkflowStatuses = [
  "new",
  "contacted",
  "follow_up",
  "closed",
] as const;

export const leadInboxSourceTypes = [
  "lead",
  "test_drive",
  "trade_in",
] as const;

export const adminVehicleSortOptions = [
  "updated-desc",
  "price-desc",
  "price-asc",
] as const;

export type StockCategory = (typeof stockCategories)[number];
export type VehicleStatus = (typeof vehicleStatuses)[number];
export type LeadType = (typeof leadTypes)[number];
export type InventorySort = (typeof inventorySortOptions)[number];
export type LeadInboxFilter = (typeof leadInboxFilters)[number];
export type LeadWorkflowStatus = (typeof leadWorkflowStatuses)[number];
export type LeadInboxSourceType = (typeof leadInboxSourceTypes)[number];
export type LeadInboxStatusFilter = "all" | LeadWorkflowStatus;
export type AdminVehicleSort = (typeof adminVehicleSortOptions)[number];

export interface Location {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  phone: string;
  email?: string | null;
  hours: string;
  mapUrl?: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  customerName: string;
  rating: number;
  quote: string;
  vehicleLabel?: string | null;
  featured: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface VehicleImage {
  id: string;
  vehicleId: string;
  imageUrl: string;
  altText?: string | null;
  cloudinaryPublicId?: string | null;
  sortOrder: number;
  isHero: boolean;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  title: string;
  stockCode: string;
  slug: string;
  make: string;
  model: string;
  year: number;
  condition: string;
  price: number;
  negotiable: boolean;
  mileage: number;
  transmission: string;
  fuelType: string;
  driveType?: string | null;
  bodyType?: string | null;
  engineCapacity?: string | null;
  color?: string | null;
  locationId?: string | null;
  location?: Location | null;
  featured: boolean;
  status: VehicleStatus;
  stockCategory: StockCategory;
  description: string;
  heroImageUrl?: string | null;
  images: VehicleImage[];
  createdAt: string;
  updatedAt: string;
}

export type VehicleCard = Vehicle;
export type VehicleDetail = Vehicle;

export interface InventoryQuery {
  q?: string;
  make?: string;
  category?: "new" | "used" | "imported" | "traded-in";
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  yearFrom?: number;
  yearTo?: number;
  transmission?: string;
  fuelType?: string;
  sort?: InventorySort;
  page?: number;
  pageSize?: number;
}

export interface InventoryFacets {
  makes: string[];
  locations: string[];
  transmissions: string[];
  fuelTypes: string[];
  minPrice: number;
  maxPrice: number;
}

export interface InventoryResult {
  items: VehicleCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: InventoryFacets;
  filters: InventoryQuery;
}

export interface LeadInput {
  vehicleId?: string | null;
  vehicleTitle?: string | null;
  leadType: LeadType;
  name: string;
  phone: string;
  email?: string | null;
  message?: string | null;
  source?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}

export interface TestDriveRequestInput {
  vehicleId?: string | null;
  vehicleTitle?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  message?: string | null;
  source?: string | null;
}

export interface TradeInRequestInput {
  desiredVehicleId?: string | null;
  desiredVehicleTitle?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  currentVehicleMake: string;
  currentVehicleModel: string;
  currentVehicleYear: number;
  currentVehicleMileage?: number | null;
  conditionNotes?: string | null;
  message?: string | null;
  source?: string | null;
}

export interface LeadRecord extends LeadInput {
  id: string;
  createdAt: string;
}

export interface TestDriveRequest extends TestDriveRequestInput {
  id: string;
  createdAt: string;
}

export interface TradeInRequest extends TradeInRequestInput {
  id: string;
  createdAt: string;
}

export interface LeadInboxDetail {
  label: string;
  value: string;
}

export interface LeadWorkflowStateRecord {
  id: string;
  sourceType: LeadInboxSourceType;
  sourceId: string;
  status: LeadWorkflowStatus;
  lastContactedAt?: string | null;
  updatedAt: string;
}

export interface LeadInboxItem {
  id: string;
  type: Exclude<LeadInboxFilter, "all">;
  sourceType: LeadInboxSourceType;
  sourceId: string;
  status: LeadWorkflowStatus;
  name: string;
  phone: string;
  email?: string | null;
  message?: string | null;
  vehicleId?: string | null;
  vehicleTitle?: string | null;
  source?: string | null;
  createdAt: string;
  lastContactedAt?: string | null;
  details: LeadInboxDetail[];
}

export interface LeadInboxQuery {
  q?: string;
  type?: LeadInboxFilter;
  status?: LeadInboxStatusFilter;
  page?: number;
  pageSize?: number;
}

export interface LeadInboxSummary {
  total: number;
  newCount: number;
  contactedCount: number;
  followUpCount: number;
  closedCount: number;
}

export interface LeadInboxResult {
  items: LeadInboxItem[];
  filters: Required<LeadInboxQuery>;
  summary: LeadInboxSummary;
  scopedSummary: LeadInboxSummary;
  typeCounts: Record<LeadInboxFilter, number>;
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ActionState {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
  redirectTo?: string;
  savedImages?: VehicleImageInput[];
}

export interface AdminSession {
  mode: "demo" | "supabase";
  email: string;
  name: string;
  userId?: string;
}

export interface VehicleImageInput {
  imageUrl: string;
  altText?: string | null;
  cloudinaryPublicId?: string | null;
  sortOrder: number;
  isHero: boolean;
  uploadState?: "uploaded" | "pending_url";
  sourceUrl?: string | null;
}

export interface VehicleFormInput {
  id?: string;
  title: string;
  stockCode: string;
  slug?: string;
  make: string;
  model: string;
  year: number;
  condition: string;
  price: number;
  negotiable: boolean;
  mileage: number;
  transmission: string;
  fuelType: string;
  driveType?: string | null;
  bodyType?: string | null;
  engineCapacity?: string | null;
  color?: string | null;
  locationId?: string | null;
  featured: boolean;
  status: VehicleStatus;
  stockCategory: StockCategory;
  description: string;
  images: VehicleImageInput[];
}

export interface AdminVehicleWorkspaceQuery {
  q?: string;
  status?: VehicleStatus | "all";
  category?: StockCategory | "all";
  featured?: "all" | "featured" | "standard";
  fuelType?: string;
  sort?: AdminVehicleSort;
  page?: number;
  pageSize?: number;
}

export interface AdminVehicleWorkspaceSummary {
  total: number;
  published: number;
  draft: number;
  sold: number;
}

export interface AdminVehicleWorkspaceResult {
  items: Vehicle[];
  filters: Required<AdminVehicleWorkspaceQuery>;
  locations: Array<Pick<Location, "id" | "name">>;
  fuelTypes: string[];
  summary: AdminVehicleWorkspaceSummary;
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface HomeStats {
  inStockCount: number;
  deliveredCount: number;
  financePartners: number;
  responseTime: string;
}
