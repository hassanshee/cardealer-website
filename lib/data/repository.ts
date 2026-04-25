import {
  deleteCloudinaryAssets,
  listCloudinaryVehicleAssets,
} from "@/lib/cloudinary";
import { formatMileage, sortByNewest, vehicleSearchText } from "@/lib/utils";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { allowLocalDemoMode, hasCloudinaryConfig } from "@/lib/env";
import {
  applyInventoryFilters,
  buildFacets,
  createVehicleFromInput,
  paginateVehicles,
} from "@/lib/data/filters";
import { RepositoryUnavailableError } from "@/lib/data/errors";
import { getDemoState, mutateDemoState } from "@/lib/data/demo-store";
import type {
  AdminVehicleWorkspaceQuery,
  AdminVehicleWorkspaceResult,
  InventoryQuery,
  LeadInboxFilter,
  LeadInboxItem,
  LeadInboxQuery,
  LeadInboxResult,
  LeadInboxSourceType,
  LeadInboxStatusFilter,
  LeadInput,
  LeadRecord,
  LeadWorkflowStateRecord,
  LeadWorkflowStatus,
  Location,
  Review,
  TestDriveRequest,
  TestDriveRequestInput,
  TradeInRequest,
  TradeInRequestInput,
  Vehicle,
  VehicleFormInput,
} from "@/types/dealership";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type WriteOptions = {
  forceDemo?: boolean;
};

type SupabaseClient =
  | NonNullable<ReturnType<typeof createSupabasePublicClient>>
  | NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

function getSupabaseErrorLike(error: unknown): SupabaseErrorLike | null {
  if (typeof error !== "object" || !error) {
    return null;
  }

  const candidate = error as SupabaseErrorLike;
  return {
    code: candidate.code,
    message: candidate.message,
  };
}

function isMissingSupabaseTableError(error: unknown) {
  const parsed = getSupabaseErrorLike(error);
  const message = parsed?.message || "";

  return (
    parsed?.code === "PGRST205" ||
    parsed?.code === "42P01" ||
    message.includes("Could not find the table 'public.")
  );
}

function logSupabaseReadFailure(prefix: string, error: unknown) {
  console.error(prefix, error instanceof Error ? error.message : error);
}

function getLocalDemoState() {
  return allowLocalDemoMode ? getDemoState() : null;
}

function createAdminUnavailableError(message: string) {
  return new RepositoryUnavailableError("admin_unavailable", message);
}

function createPersistenceUnavailableError(message: string) {
  return new RepositoryUnavailableError("persistence_unavailable", message);
}

function buildLeadWorkflowKey(sourceType: LeadInboxSourceType, sourceId: string) {
  return `${sourceType}:${sourceId}`;
}

function buildLeadInboxSummary(items: LeadInboxItem[]) {
  return items.reduce<LeadInboxResult["summary"]>(
    (summary, item) => {
      summary.total += 1;

      if (item.status === "new") {
        summary.newCount += 1;
      } else if (item.status === "contacted") {
        summary.contactedCount += 1;
      } else if (item.status === "follow_up") {
        summary.followUpCount += 1;
      } else if (item.status === "closed") {
        summary.closedCount += 1;
      }

      return summary;
    },
    {
      total: 0,
      newCount: 0,
      contactedCount: 0,
      followUpCount: 0,
      closedCount: 0,
    },
  );
}

function buildLeadInboxTypeCounts(items: LeadInboxItem[]) {
  return items.reduce<LeadInboxResult["typeCounts"]>(
    (counts, item) => {
      counts.all += 1;
      counts[item.type] += 1;
      return counts;
    },
    {
      all: 0,
      quote: 0,
      contact: 0,
      financing: 0,
      test_drive: 0,
      trade_in: 0,
    },
  );
}

function defaultLeadStatus(value: LeadInboxStatusFilter | undefined) {
  return value || "all";
}

function defaultLeadType(value: LeadInboxFilter | undefined) {
  return value || "all";
}

const DEFAULT_ADMIN_VEHICLE_PAGE_SIZE = 10;
const DEFAULT_LEAD_INBOX_PAGE_SIZE = 10;

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.floor(value as number);
  return normalized > 0 ? normalized : fallback;
}

function paginateAdminItems<T>(items: T[], page: number, pageSize: number) {
  const normalizedPageSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / normalizedPageSize));
  const currentPage = Math.min(
    normalizePositiveInteger(page, 1),
    totalPages,
  );
  const start = (currentPage - 1) * normalizedPageSize;

  return {
    items: items.slice(start, start + normalizedPageSize),
    totalItems,
    page: currentPage,
    pageSize: normalizedPageSize,
    totalPages,
  };
}

function handlePublicReadFailure<T>(
  prefix: string,
  error: unknown,
  demoValue: T,
  fallbackValue: T,
) {
  if (allowLocalDemoMode) {
    if (!isMissingSupabaseTableError(error)) {
      logSupabaseReadFailure(prefix, error);
    }
    return clone(demoValue);
  }

  logSupabaseReadFailure(prefix, error);
  return fallbackValue;
}

function handleAdminReadFailure<T>(prefix: string, error: unknown, demoValue: T) {
  if (allowLocalDemoMode) {
    if (!isMissingSupabaseTableError(error)) {
      logSupabaseReadFailure(prefix, error);
    }
    return clone(demoValue);
  }

  logSupabaseReadFailure(prefix, error);
  throw createAdminUnavailableError(
    "Admin data is unavailable until Supabase is configured and the schema is ready.",
  );
}

function requireServerClientOrDemo(message: string, forceDemo?: boolean) {
  if (forceDemo || allowLocalDemoMode) {
    return null;
  }

  throw createPersistenceUnavailableError(message);
}

function mapSupabaseVehicleRow(row: Record<string, unknown>): Vehicle {
  const locationRow = row.locations as Record<string, unknown> | null;
  const imageRows = (row.vehicle_images || []) as Array<Record<string, unknown>>;
  const heroImageUrl = row.hero_image_url ? String(row.hero_image_url) : null;
  const mappedImages = imageRows
    .map((image) => ({
      id: String(image.id),
      vehicleId: String(image.vehicle_id),
      imageUrl: String(image.image_url),
      altText: image.alt_text ? String(image.alt_text) : null,
      cloudinaryPublicId: image.cloudinary_public_id
        ? String(image.cloudinary_public_id)
        : null,
      sortOrder: Number(image.sort_order),
      isHero: Boolean(image.is_hero),
      createdAt: String(image.created_at),
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const fallbackImages = heroImageUrl
    ? [
        {
          id: `${String(row.id)}-hero-image`,
          vehicleId: String(row.id),
          imageUrl: heroImageUrl,
          altText: `${String(row.title)} hero image`,
          cloudinaryPublicId: null,
          sortOrder: 0,
          isHero: true,
          createdAt: String(row.updated_at || row.created_at),
        },
      ]
    : [];

  return {
    id: String(row.id),
    title: String(row.title),
    stockCode: String(row.stock_code),
    slug: String(row.slug),
    make: String(row.make),
    model: String(row.model),
    year: Number(row.year),
    condition: String(row.condition),
    price: Number(row.price),
    negotiable: Boolean(row.negotiable),
    mileage: Number(row.mileage),
    transmission: String(row.transmission),
    fuelType: String(row.fuel_type),
    driveType: row.drive_type ? String(row.drive_type) : null,
    bodyType: row.body_type ? String(row.body_type) : null,
    engineCapacity: row.engine_capacity ? String(row.engine_capacity) : null,
    color: row.color ? String(row.color) : null,
    locationId: row.location_id ? String(row.location_id) : null,
    location: locationRow
      ? {
          id: String(locationRow.id),
          name: String(locationRow.name),
          addressLine: String(locationRow.address_line),
          city: String(locationRow.city),
          phone: String(locationRow.phone),
          email: locationRow.email ? String(locationRow.email) : null,
          hours: String(locationRow.hours),
          mapUrl: locationRow.map_url ? String(locationRow.map_url) : null,
          isPrimary: Boolean(locationRow.is_primary),
          createdAt: String(locationRow.created_at),
        }
      : null,
    featured: Boolean(row.featured),
    status: row.status as Vehicle["status"],
    stockCategory: row.stock_category as Vehicle["stockCategory"],
    description: String(row.description),
    heroImageUrl,
    images: mappedImages.length ? mappedImages : fallbackImages,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function selectAllVehicleRows(client: SupabaseClient) {
  const { data, error } = await client
    .from("vehicles")
    .select("*, locations(*), vehicle_images(*)")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as Array<Record<string, unknown>>;
}

async function selectVehicleRowById(client: SupabaseClient, id: string) {
  const { data, error } = await client
    .from("vehicles")
    .select("*, locations(*), vehicle_images(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Record<string, unknown> | null;
}

async function selectVehicleRowByStockCode(
  client: SupabaseClient,
  stockCode: string,
) {
  const { data, error } = await client
    .from("vehicles")
    .select("*, locations(*), vehicle_images(*)")
    .eq("stock_code", stockCode)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Record<string, unknown> | null;
}

async function selectVehicleRowBySlug(client: SupabaseClient, slug: string) {
  const { data, error } = await client
    .from("vehicles")
    .select("*, locations(*), vehicle_images(*)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Record<string, unknown> | null;
}

function buildSyncedVehicleImages(vehicle: Vehicle, assets: Awaited<ReturnType<typeof listCloudinaryVehicleAssets>>["assets"]) {
  const timestamp = new Date().toISOString();

  return assets.map((asset, index) => ({
    id: `${vehicle.id}-image-${index + 1}`,
    vehicleId: vehicle.id,
    imageUrl: asset.secureUrl,
    altText:
      index === 0
        ? `${vehicle.title} hero image`
        : `${vehicle.title} gallery image ${index + 1}`,
    cloudinaryPublicId: asset.publicId,
    sortOrder: index,
    isHero: index === 0,
    createdAt: timestamp,
  })) satisfies Vehicle["images"];
}

async function collectVehicleCloudinaryPublicIds(vehicle: Vehicle) {
  const publicIds = new Set(
    vehicle.images
      .map((image) => image.cloudinaryPublicId)
      .filter((value): value is string => Boolean(value)),
  );

  if (hasCloudinaryConfig && vehicle.stockCode) {
    try {
      const { assets } = await listCloudinaryVehicleAssets(vehicle.stockCode);
      assets.forEach((asset) => publicIds.add(asset.publicId));
    } catch (error) {
      console.warn(
        `[cloudinary] Unable to list folder assets for ${vehicle.stockCode}.`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return [...publicIds];
}

async function hydrateVehicleGalleryFromCloudinary(vehicle: Vehicle) {
  if (!hasCloudinaryConfig || !vehicle.stockCode || vehicle.images.length > 1) {
    return vehicle;
  }

  try {
    const { assets } = await listCloudinaryVehicleAssets(vehicle.stockCode);

    if (!assets.length || assets.length <= vehicle.images.length) {
      return vehicle;
    }

    const syncedImages = buildSyncedVehicleImages(vehicle, assets);

    return {
      ...vehicle,
      heroImageUrl: syncedImages[0]?.imageUrl || vehicle.heroImageUrl,
      images: syncedImages,
    };
  } catch (error) {
    console.warn(
      `[cloudinary] Unable to hydrate gallery for ${vehicle.stockCode}.`,
      error instanceof Error ? error.message : error,
    );

    return vehicle;
  }
}

export async function getLocations() {
  const supabase = createSupabasePublicClient();
  const demoState = getLocalDemoState();

  if (!supabase) {
    return demoState ? clone(demoState.locations) : [];
  }

  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .order("is_primary", { ascending: false });

  if (error) {
    return handlePublicReadFailure(
      "[supabase] Failed to fetch locations",
      error,
      demoState?.locations || [],
      [],
    );
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    addressLine: row.address_line,
    city: row.city,
    phone: row.phone,
    email: row.email,
    hours: row.hours,
    mapUrl: row.map_url,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
  })) satisfies Location[];
}

export async function getAdminLocations(options: WriteOptions = {}) {
  const serverClient = options.forceDemo
    ? null
    : await createSupabaseServerClient();
  const demoState = getLocalDemoState();

  if (!serverClient) {
    if (demoState) {
      return clone(demoState.locations);
    }

    throw createAdminUnavailableError(
      "Admin locations are unavailable until Supabase is configured.",
    );
  }

  const { data, error } = await serverClient
    .from("locations")
    .select("*")
    .order("is_primary", { ascending: false });

  if (error) {
    return handleAdminReadFailure(
      "[supabase] Failed to fetch admin locations",
      error,
      demoState?.locations || [],
    );
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    addressLine: row.address_line,
    city: row.city,
    phone: row.phone,
    email: row.email,
    hours: row.hours,
    mapUrl: row.map_url,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
  })) satisfies Location[];
}

export async function getReviews() {
  const supabase = createSupabasePublicClient();
  const demoState = getLocalDemoState();

  if (!supabase) {
    return demoState ? clone(demoState.reviews) : [];
  }

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("featured", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return handlePublicReadFailure(
      "[supabase] Failed to fetch reviews",
      error,
      demoState?.reviews || [],
      [],
    );
  }

  return (data || []).map((row) => ({
    id: row.id,
    customerName: row.customer_name,
    rating: row.rating,
    quote: row.quote,
    vehicleLabel: row.vehicle_label,
    featured: row.featured,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  })) satisfies Review[];
}

export async function getAllVehicles() {
  const supabase = createSupabasePublicClient();
  const demoState = getLocalDemoState();

  if (!supabase) {
    return demoState ? clone(demoState.vehicles) : [];
  }

  try {
    const rows = await selectAllVehicleRows(supabase);
    return rows.map(mapSupabaseVehicleRow);
  } catch (error) {
    return handlePublicReadFailure(
      "[supabase] Failed to fetch vehicles",
      error,
      demoState?.vehicles || [],
      [],
    );
  }
}

export async function getHomepageCollections() {
  const vehicles = await getAllVehicles();
  const publicVehicles = vehicles.filter((vehicle) => vehicle.status === "published");

  return {
    featured: publicVehicles.filter((vehicle) => vehicle.featured).slice(0, 4),
    latest: sortByNewest(publicVehicles).slice(0, 4),
    imported: publicVehicles
      .filter((vehicle) =>
        ["imported", "available_for_importation"].includes(vehicle.stockCategory),
      )
      .slice(0, 4),
    tradedIn: publicVehicles
      .filter((vehicle) => vehicle.stockCategory === "traded_in")
      .slice(0, 4),
    sold: vehicles.filter((vehicle) => vehicle.status === "sold").slice(0, 3),
  };
}

export async function listInventory(query: InventoryQuery) {
  const vehicles = await getAllVehicles();
  const filtered = applyInventoryFilters(vehicles, query);
  return paginateVehicles(filtered, query);
}

export async function getInventoryFacets() {
  const vehicles = await getAllVehicles();
  const publicVehicles = vehicles.filter((vehicle) => vehicle.status === "published");
  return buildFacets(publicVehicles);
}

export async function getVehicleBySlug(slug: string) {
  const supabase = createSupabasePublicClient();
  const demoState = getLocalDemoState();

  if (supabase) {
    try {
      const row = await selectVehicleRowBySlug(supabase, slug);

      if (row) {
        return hydrateVehicleGalleryFromCloudinary(mapSupabaseVehicleRow(row));
      }
    } catch (error) {
      if (allowLocalDemoMode && demoState) {
        return (
          demoState.vehicles.find(
            (item) => item.slug === slug && item.status === "published",
          ) || null
        );
      }

      logSupabaseReadFailure("[supabase] Failed to fetch vehicle by slug", error);
      return null;
    }
  }

  if (!demoState) {
    return null;
  }

  const vehicles = clone(demoState.vehicles);
  const vehicle =
    vehicles.find(
      (item) => item.slug === slug && item.status === "published",
    ) || null;

  return vehicle ? hydrateVehicleGalleryFromCloudinary(vehicle) : null;
}

export async function getVehicleById(id: string, options: WriteOptions = {}) {
  const serverClient = options.forceDemo
    ? null
    : await createSupabaseServerClient();
  const demoState = getLocalDemoState();

  if (serverClient) {
    try {
      const row = await selectVehicleRowById(serverClient, id);

      return row ? hydrateVehicleGalleryFromCloudinary(mapSupabaseVehicleRow(row)) : null;
    } catch (error) {
      return handleAdminReadFailure(
        "[supabase] Failed to fetch vehicle by id",
        error,
        demoState?.vehicles.find((item) => item.id === id) || null,
      );
    }
  }

  if (!demoState) {
    throw createAdminUnavailableError(
      "Vehicle data is unavailable until Supabase is configured.",
    );
  }

  const vehicle = demoState.vehicles.find((item) => item.id === id) || null;
  return vehicle ? hydrateVehicleGalleryFromCloudinary(vehicle) : null;
}

export async function getSimilarVehicles(vehicle: Vehicle, limit = 3) {
  const vehicles = await getAllVehicles();

  return vehicles
    .filter(
      (item) =>
        item.id !== vehicle.id &&
        item.status === "published" &&
        (item.make === vehicle.make ||
          item.stockCategory === vehicle.stockCategory),
    )
    .slice(0, limit);
}

export async function getAdminVehicles(options: WriteOptions = {}) {
  const serverClient = options.forceDemo
    ? null
    : await createSupabaseServerClient();
  const demoState = getLocalDemoState();

  if (!serverClient) {
    if (demoState) {
      return clone(demoState.vehicles);
    }

    throw createAdminUnavailableError(
      "Admin inventory is unavailable until Supabase is configured.",
    );
  }

  try {
    const rows = await selectAllVehicleRows(serverClient);
    return rows.map(mapSupabaseVehicleRow);
  } catch (error) {
    return handleAdminReadFailure(
      "[supabase] Failed to fetch admin vehicles",
      error,
      demoState?.vehicles || [],
    );
  }
}

function normalizeAdminVehicleWorkspaceQuery(
  query: AdminVehicleWorkspaceQuery = {},
) {
  return {
    q: query.q?.trim() || "",
    status: query.status || "all",
    category: query.category || "all",
    featured: query.featured || "all",
    fuelType: query.fuelType || "",
    sort: query.sort || "updated-desc",
    page: normalizePositiveInteger(query.page, 1),
    pageSize: normalizePositiveInteger(
      query.pageSize,
      DEFAULT_ADMIN_VEHICLE_PAGE_SIZE,
    ),
  } satisfies Required<AdminVehicleWorkspaceQuery>;
}

function matchesAdminVehicleWorkspaceQuery(
  vehicle: Vehicle,
  filters: Required<AdminVehicleWorkspaceQuery>,
) {
  if (
    filters.q &&
    !vehicleSearchText(vehicle).includes(filters.q.toLowerCase())
  ) {
    return false;
  }

  if (filters.status !== "all" && vehicle.status !== filters.status) {
    return false;
  }

  if (filters.category !== "all" && vehicle.stockCategory !== filters.category) {
    return false;
  }

  if (filters.featured === "featured" && !vehicle.featured) {
    return false;
  }

  if (filters.featured === "standard" && vehicle.featured) {
    return false;
  }

  if (filters.fuelType && vehicle.fuelType !== filters.fuelType) {
    return false;
  }

  return true;
}

function sortAdminVehicleWorkspaceItems(
  vehicles: Vehicle[],
  sort: Required<AdminVehicleWorkspaceQuery>["sort"],
) {
  return [...vehicles].sort((left, right) => {
    if (sort === "price-asc") {
      return left.price - right.price;
    }

    if (sort === "price-desc") {
      return right.price - left.price;
    }

    return (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  });
}

export async function getAdminVehicleWorkspace(
  query: AdminVehicleWorkspaceQuery = {},
  options: WriteOptions = {},
): Promise<AdminVehicleWorkspaceResult> {
  const vehicles = await getAdminVehicles(options);
  const filters = normalizeAdminVehicleWorkspaceQuery(query);
  const filteredItems = sortAdminVehicleWorkspaceItems(
    vehicles.filter((vehicle) => matchesAdminVehicleWorkspaceQuery(vehicle, filters)),
    filters.sort,
  );
  const paginatedItems = paginateAdminItems(
    filteredItems,
    filters.page,
    filters.pageSize,
  );

  return {
    items: paginatedItems.items,
    filters: {
      ...filters,
      page: paginatedItems.page,
      pageSize: paginatedItems.pageSize,
    },
    locations: vehicles
      .map((vehicle) => vehicle.location)
      .filter((location): location is NonNullable<Vehicle["location"]> => Boolean(location))
      .filter(
        (location, index, locations) =>
          locations.findIndex((item) => item.id === location.id) === index,
      )
      .map((location) => ({
        id: location.id,
        name: location.name,
      })),
    fuelTypes: [...new Set(vehicles.map((vehicle) => vehicle.fuelType))]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right)),
    summary: {
      total: vehicles.length,
      published: vehicles.filter((vehicle) => vehicle.status === "published").length,
      draft: vehicles.filter((vehicle) => vehicle.status === "draft").length,
      sold: vehicles.filter((vehicle) => vehicle.status === "sold").length,
    },
    totalItems: paginatedItems.totalItems,
    page: paginatedItems.page,
    pageSize: paginatedItems.pageSize,
    totalPages: paginatedItems.totalPages,
  };
}

export async function saveVehicle(input: VehicleFormInput, options: WriteOptions = {}) {
  const locations = await getAdminLocations(options);
  const existing = input.id ? await getVehicleById(input.id, options) : null;
  const nextVehicle = createVehicleFromInput(input, existing || undefined, locations);
  const removedCloudinaryPublicIds = existing
    ? existing.images
        .filter(
          (image) =>
            image.cloudinaryPublicId &&
            !nextVehicle.images.some(
              (nextImage) =>
                nextImage.cloudinaryPublicId === image.cloudinaryPublicId,
            ),
        )
        .map((image) => image.cloudinaryPublicId as string)
    : [];
  const serverClient = await createSupabaseServerClient();

  if (options.forceDemo || !serverClient) {
    requireServerClientOrDemo(
      "Persistent vehicle storage is unavailable until Supabase is configured.",
      options.forceDemo,
    );
    mutateDemoState((state) => {
      const index = state.vehicles.findIndex(
        (vehicle) => vehicle.id === nextVehicle.id,
      );

      if (index >= 0) {
        state.vehicles[index] = nextVehicle;
        return;
      }

      state.vehicles.unshift(nextVehicle);
    });

    return nextVehicle;
  }

  const { error: vehicleError } = await serverClient.from("vehicles").upsert({
    id: nextVehicle.id,
    title: nextVehicle.title,
    stock_code: nextVehicle.stockCode,
    slug: nextVehicle.slug,
    make: nextVehicle.make,
    model: nextVehicle.model,
    year: nextVehicle.year,
    condition: nextVehicle.condition,
    price: nextVehicle.price,
    negotiable: nextVehicle.negotiable,
    mileage: nextVehicle.mileage,
    transmission: nextVehicle.transmission,
    fuel_type: nextVehicle.fuelType,
    drive_type: nextVehicle.driveType,
    body_type: nextVehicle.bodyType,
    engine_capacity: nextVehicle.engineCapacity,
    color: nextVehicle.color,
    location_id: nextVehicle.locationId,
    featured: nextVehicle.featured,
    status: nextVehicle.status,
    stock_category: nextVehicle.stockCategory,
    description: nextVehicle.description,
    hero_image_url: nextVehicle.heroImageUrl,
    updated_at: nextVehicle.updatedAt,
  });

  if (vehicleError) {
    throw vehicleError;
  }

  if (nextVehicle.images.length) {
    const { error: imagesError } = await serverClient.from("vehicle_images").upsert(
      nextVehicle.images.map((image) => ({
        id: image.id,
        vehicle_id: nextVehicle.id,
        cloudinary_public_id: image.cloudinaryPublicId,
        image_url: image.imageUrl,
        alt_text: image.altText,
        sort_order: image.sortOrder,
        is_hero: image.isHero,
        created_at: image.createdAt,
      })),
    );

    if (imagesError) {
      throw imagesError;
    }
  }

  const deleteImagesQuery = serverClient
    .from("vehicle_images")
    .delete()
    .eq("vehicle_id", nextVehicle.id);
  const { error: deleteImagesError } = nextVehicle.images.length
    ? await deleteImagesQuery.not(
        "id",
        "in",
        `(${nextVehicle.images.map((image) => image.id).join(",")})`,
      )
    : await deleteImagesQuery;

  if (deleteImagesError) {
    throw deleteImagesError;
  }

  if (removedCloudinaryPublicIds.length) {
    try {
      await deleteCloudinaryAssets(removedCloudinaryPublicIds);
    } catch (error) {
      console.warn(
        `[cloudinary] Unable to remove deleted vehicle images for ${nextVehicle.stockCode}.`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return nextVehicle;
}

export async function getVehicleByStockCode(
  stockCode: string,
  options: WriteOptions = {},
) {
  const serverClient = options.forceDemo
    ? null
    : await createSupabaseServerClient();
  const demoState = getLocalDemoState();

  if (serverClient) {
    try {
      const row = await selectVehicleRowByStockCode(serverClient, stockCode);

      return row ? hydrateVehicleGalleryFromCloudinary(mapSupabaseVehicleRow(row)) : null;
    } catch (error) {
      return handleAdminReadFailure(
        "[supabase] Failed to fetch vehicle by stock code",
        error,
        demoState?.vehicles.find(
          (item) => item.stockCode.toLowerCase() === stockCode.toLowerCase(),
        ) || null,
      );
    }
  }

  if (!demoState) {
    throw createAdminUnavailableError(
      "Vehicle data is unavailable until Supabase is configured.",
    );
  }

  const vehicle =
    demoState.vehicles.find(
      (item) => item.stockCode.toLowerCase() === stockCode.toLowerCase(),
    ) || null;

  return vehicle ? hydrateVehicleGalleryFromCloudinary(vehicle) : null;
}

export async function syncVehicleImagesFromCloudinary(
  id: string,
  options: WriteOptions = {},
) {
  const vehicle = await getVehicleById(id, options);

  if (!vehicle) {
    throw new Error("Vehicle not found.");
  }

  const { assetFolder, assets } = await listCloudinaryVehicleAssets(vehicle.stockCode);
  const syncedImages = buildSyncedVehicleImages(vehicle, assets);
  const heroImageUrl = syncedImages[0]?.imageUrl || null;
  const updatedAt = new Date().toISOString();
  const serverClient = await createSupabaseServerClient();

  if (options.forceDemo || !serverClient) {
    requireServerClientOrDemo(
      "Cloudinary sync is unavailable until Supabase is configured.",
      options.forceDemo,
    );
    return mutateDemoState((state) => {
      const target = state.vehicles.find((item) => item.id === id);

      if (!target) {
        throw new Error("Vehicle not found in demo state.");
      }

      target.images = syncedImages;
      target.heroImageUrl = heroImageUrl;
      target.updatedAt = updatedAt;

      return {
        vehicle: clone(target),
        assetFolder,
        syncedCount: syncedImages.length,
      };
    });
  }

  const { error: deleteError } = await serverClient
    .from("vehicle_images")
    .delete()
    .eq("vehicle_id", vehicle.id);

  if (deleteError) {
    throw deleteError;
  }

  const { error: insertError } = await serverClient.from("vehicle_images").insert(
    syncedImages.map((image) => ({
      vehicle_id: vehicle.id,
      cloudinary_public_id: image.cloudinaryPublicId,
      image_url: image.imageUrl,
      alt_text: image.altText,
      sort_order: image.sortOrder,
      is_hero: image.isHero,
      created_at: image.createdAt,
    })),
  );

  if (insertError) {
    throw insertError;
  }

  const { error: updateError } = await serverClient
    .from("vehicles")
    .update({
      hero_image_url: heroImageUrl,
      updated_at: updatedAt,
    })
    .eq("id", vehicle.id);

  if (updateError) {
    throw updateError;
  }

    return {
      vehicle:
      (await getVehicleById(id, options)) || {
        ...vehicle,
        images: syncedImages,
        heroImageUrl,
        updatedAt,
      },
    assetFolder,
    syncedCount: syncedImages.length,
  };
}

export async function updateVehicleStatus(
  id: string,
  status: Vehicle["status"],
  options: WriteOptions = {},
) {
  const serverClient = await createSupabaseServerClient();

  if (options.forceDemo || !serverClient) {
    requireServerClientOrDemo(
      "Vehicle publishing is unavailable until Supabase is configured.",
      options.forceDemo,
    );
    return mutateDemoState((state) => {
      const vehicle = state.vehicles.find((item) => item.id === id);

      if (vehicle) {
        vehicle.status = status;
        vehicle.updatedAt = new Date().toISOString();
      }

      return vehicle || null;
    });
  }

  const { error } = await serverClient
    .from("vehicles")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw error;
  }

  return getVehicleById(id, options);
}

export async function toggleVehicleFeatured(id: string, options: WriteOptions = {}) {
  const existing = await getVehicleById(id, options);
  if (!existing) {
    return null;
  }

  const nextFeatured = !existing.featured;
  const serverClient = await createSupabaseServerClient();

  if (options.forceDemo || !serverClient) {
    requireServerClientOrDemo(
      "Vehicle featured updates are unavailable until Supabase is configured.",
      options.forceDemo,
    );
    return mutateDemoState((state) => {
      const vehicle = state.vehicles.find((item) => item.id === id);

      if (vehicle) {
        vehicle.featured = nextFeatured;
        vehicle.updatedAt = new Date().toISOString();
      }

      return vehicle || null;
    });
  }

  const { error } = await serverClient
    .from("vehicles")
    .update({ featured: nextFeatured, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw error;
  }

  return getVehicleById(id, options);
}

export async function deleteVehicle(id: string, options: WriteOptions = {}) {
  const existing = await getVehicleById(id, options);
  const serverClient = await createSupabaseServerClient();

  if (options.forceDemo || !serverClient) {
    requireServerClientOrDemo(
      "Vehicle deletion is unavailable until Supabase is configured.",
      options.forceDemo,
    );
    mutateDemoState((state) => {
      state.vehicles = state.vehicles.filter((vehicle) => vehicle.id !== id);
    });
    return;
  }

  const { error: deleteImagesError } = await serverClient
    .from("vehicle_images")
    .delete()
    .eq("vehicle_id", id);

  if (deleteImagesError) {
    throw deleteImagesError;
  }

  const { error: deleteVehicleError } = await serverClient
    .from("vehicles")
    .delete()
    .eq("id", id);

  if (deleteVehicleError) {
    throw deleteVehicleError;
  }

  if (existing) {
    try {
      const publicIds = await collectVehicleCloudinaryPublicIds(existing);
      await deleteCloudinaryAssets(publicIds);
    } catch (error) {
      console.warn(
        `[cloudinary] Unable to remove vehicle assets for ${existing.stockCode}.`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

export async function saveLead(input: LeadInput) {
  const record: LeadRecord = {
    ...input,
    id: `lead-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  const serverClient = await createSupabaseServerClient();

  if (!serverClient) {
    requireServerClientOrDemo(
      "Lead capture is unavailable until Supabase is configured.",
    );
    mutateDemoState((state) => {
      state.leads.unshift(record);
    });
    return record;
  }

  const { error } = await serverClient.from("leads").insert({
    vehicle_id: input.vehicleId || null,
    lead_type: input.leadType,
    name: input.name,
    phone: input.phone,
    email: input.email || null,
    message: input.message || null,
    source: input.source || null,
    utm_source: input.utmSource || null,
    utm_medium: input.utmMedium || null,
    utm_campaign: input.utmCampaign || null,
  });

  if (error) {
    throw error;
  }

  return record;
}

export async function saveTestDriveRequest(input: TestDriveRequestInput) {
  const record: TestDriveRequest = {
    ...input,
    id: `test-drive-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  const serverClient = await createSupabaseServerClient();

  if (!serverClient) {
    requireServerClientOrDemo(
      "Viewing requests are unavailable until Supabase is configured.",
    );
    mutateDemoState((state) => {
      state.testDriveRequests.unshift(record);
    });
    return record;
  }

  const { error } = await serverClient.from("test_drive_requests").insert({
    vehicle_id: input.vehicleId || null,
    name: input.name,
    phone: input.phone,
    email: input.email || null,
    preferred_date: input.preferredDate || null,
    preferred_time: input.preferredTime || null,
    message: input.message || null,
  });

  if (error) {
    throw error;
  }

  return record;
}

export async function saveTradeInRequest(input: TradeInRequestInput) {
  const record: TradeInRequest = {
    ...input,
    id: `trade-in-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  const serverClient = await createSupabaseServerClient();

  if (!serverClient) {
    requireServerClientOrDemo(
      "Trade-in requests are unavailable until Supabase is configured.",
    );
    mutateDemoState((state) => {
      state.tradeInRequests.unshift(record);
    });
    return record;
  }

  const { error } = await serverClient.from("trade_in_requests").insert({
    desired_vehicle_id: input.desiredVehicleId || null,
    name: input.name,
    phone: input.phone,
    email: input.email || null,
    current_vehicle_make: input.currentVehicleMake,
    current_vehicle_model: input.currentVehicleModel,
    current_vehicle_year: input.currentVehicleYear,
    current_vehicle_mileage: input.currentVehicleMileage || null,
    condition_notes: input.conditionNotes || null,
    message: input.message || null,
  });

  if (error) {
    throw error;
  }

  return record;
}

function resolveLeadWorkflowState(
  workflowLookup: Map<string, LeadWorkflowStateRecord>,
  sourceType: LeadInboxSourceType,
  sourceId: string,
) {
  return (
    workflowLookup.get(buildLeadWorkflowKey(sourceType, sourceId)) || {
      id: `${sourceType}-${sourceId}`,
      sourceType,
      sourceId,
      status: "new" as LeadWorkflowStatus,
      lastContactedAt: null,
      updatedAt: "",
    }
  );
}

function filterLeadInboxItemsByType(
  items: LeadInboxItem[],
  type: LeadInboxFilter,
) {
  if (type === "all") {
    return items;
  }

  return items.filter((item) => item.type === type);
}

function buildLeadInboxSearchText(item: LeadInboxItem) {
  return [
    item.name,
    item.phone,
    item.email || "",
    item.vehicleTitle || "",
    item.message || "",
    item.source || "",
    item.type,
    item.status,
    ...item.details.flatMap((detail) => [detail.label, detail.value]),
  ]
    .join(" ")
    .toLowerCase();
}

function normalizeLeadInboxQuery(query: LeadInboxQuery = {}) {
  return {
    q: query.q?.trim() || "",
    type: defaultLeadType(query.type),
    status: defaultLeadStatus(query.status),
    page: normalizePositiveInteger(query.page, 1),
    pageSize: normalizePositiveInteger(query.pageSize, DEFAULT_LEAD_INBOX_PAGE_SIZE),
  } satisfies Required<LeadInboxQuery>;
}

function getAllowedLeadWorkflowTransitions(
  currentStatus: LeadWorkflowStatus,
): LeadWorkflowStatus[] {
  if (currentStatus === "new") {
    return ["contacted"];
  }

  if (currentStatus === "contacted") {
    return ["follow_up", "closed"];
  }

  if (currentStatus === "follow_up") {
    return ["contacted", "closed"];
  }

  return ["contacted"];
}

function isLeadWorkflowTransitionAllowed(
  currentStatus: LeadWorkflowStatus,
  nextStatus: LeadWorkflowStatus,
) {
  return (
    currentStatus === nextStatus ||
    getAllowedLeadWorkflowTransitions(currentStatus).includes(nextStatus)
  );
}

function resolveLeadLastContactedAt(
  existingValue: string | null | undefined,
  nextStatus: LeadWorkflowStatus,
  now: string,
) {
  if (nextStatus === "new") {
    return null;
  }

  if (nextStatus === "contacted") {
    return now;
  }

  return existingValue || now;
}

function toLeadInboxItems(
  leads: LeadRecord[],
  testDriveRequests: TestDriveRequest[],
  tradeInRequests: TradeInRequest[],
  workflowStates: LeadWorkflowStateRecord[],
) {
  const workflowLookup = new Map(
    workflowStates.map((state) => [
      buildLeadWorkflowKey(state.sourceType, state.sourceId),
      state,
    ]),
  );

  const leadItems: LeadInboxItem[] = leads.map((item) => {
    const workflowState = resolveLeadWorkflowState(workflowLookup, "lead", item.id);

    return {
      id: item.id,
      type: item.leadType,
      sourceType: "lead",
      sourceId: item.id,
      status: workflowState.status,
      name: item.name,
      phone: item.phone,
      email: item.email,
      message: item.message,
      vehicleId: item.vehicleId,
      vehicleTitle: item.vehicleTitle,
      source: item.source,
      createdAt: item.createdAt,
      lastContactedAt: workflowState.lastContactedAt,
      details: [
        { label: "Lead type", value: item.leadType.replace("_", " ") },
        ...(item.source
          ? [{ label: "Page source", value: item.source }]
          : []),
        ...(item.utmSource
          ? [{ label: "UTM source", value: item.utmSource }]
          : []),
        ...(item.utmMedium
          ? [{ label: "UTM medium", value: item.utmMedium }]
          : []),
        ...(item.utmCampaign
          ? [{ label: "UTM campaign", value: item.utmCampaign }]
          : []),
      ],
    };
  });

  const testDriveItems: LeadInboxItem[] = testDriveRequests.map((item) => {
    const workflowState = resolveLeadWorkflowState(
      workflowLookup,
      "test_drive",
      item.id,
    );

    return {
      id: item.id,
      type: "test_drive",
      sourceType: "test_drive",
      sourceId: item.id,
      status: workflowState.status,
      name: item.name,
      phone: item.phone,
      email: item.email,
      message: item.message,
      vehicleId: item.vehicleId,
      vehicleTitle: item.vehicleTitle,
      source: item.source,
      createdAt: item.createdAt,
      lastContactedAt: workflowState.lastContactedAt,
      details: [
        ...(item.preferredDate
          ? [{ label: "Preferred date", value: item.preferredDate }]
          : []),
        ...(item.preferredTime
          ? [{ label: "Preferred time", value: item.preferredTime }]
          : []),
      ],
    };
  });

  const tradeInItems: LeadInboxItem[] = tradeInRequests.map((item) => {
    const workflowState = resolveLeadWorkflowState(
      workflowLookup,
      "trade_in",
      item.id,
    );

    return {
      id: item.id,
      type: "trade_in",
      sourceType: "trade_in",
      sourceId: item.id,
      status: workflowState.status,
      name: item.name,
      phone: item.phone,
      email: item.email,
      message: item.message,
      vehicleId: item.desiredVehicleId,
      vehicleTitle: item.desiredVehicleTitle,
      source: item.source,
      createdAt: item.createdAt,
      lastContactedAt: workflowState.lastContactedAt,
      details: [
        {
          label: "Current vehicle",
          value: `${item.currentVehicleYear} ${item.currentVehicleMake} ${item.currentVehicleModel}`,
        },
        ...(item.currentVehicleMileage
          ? [{ label: "Mileage", value: formatMileage(item.currentVehicleMileage) }]
          : []),
        ...(item.conditionNotes
          ? [{ label: "Condition notes", value: item.conditionNotes }]
          : []),
      ],
    };
  });

  return [...leadItems, ...testDriveItems, ...tradeInItems].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

async function fetchLeadTables(options: WriteOptions = {}) {
  const serverClient = options.forceDemo
    ? null
    : await createSupabaseServerClient();
  if (!serverClient) {
    const demoState = getLocalDemoState();

    if (demoState) {
      return {
        leads: clone(demoState.leads),
        leadWorkflowStates: clone(demoState.leadWorkflowStates),
        testDriveRequests: clone(demoState.testDriveRequests),
        tradeInRequests: clone(demoState.tradeInRequests),
      };
    }

    throw createAdminUnavailableError(
      "Lead inbox is unavailable until Supabase is configured.",
    );
  }

  const [leadsResult, workflowResult, testDriveResult, tradeInResult, vehiclesResult] =
    await Promise.all([
    serverClient.from("leads").select("*").order("created_at", { ascending: false }),
    serverClient.from("lead_inbox_state").select("*"),
    serverClient
      .from("test_drive_requests")
      .select("*")
      .order("created_at", { ascending: false }),
    serverClient
      .from("trade_in_requests")
      .select("*")
      .order("created_at", { ascending: false }),
    serverClient.from("vehicles").select("id, title"),
  ]);

  const workflowStateMissingTable = isMissingSupabaseTableError(
    workflowResult.error,
  );

  if (
    leadsResult.error ||
    testDriveResult.error ||
    tradeInResult.error ||
    vehiclesResult.error ||
    (workflowResult.error && !workflowStateMissingTable)
  ) {
    return handleAdminReadFailure(
      "[supabase] Failed to fetch admin leads",
      leadsResult.error ||
        workflowResult.error ||
        testDriveResult.error ||
        tradeInResult.error ||
        vehiclesResult.error,
      {
        leads: getLocalDemoState()?.leads || [],
        leadWorkflowStates: getLocalDemoState()?.leadWorkflowStates || [],
        testDriveRequests: getLocalDemoState()?.testDriveRequests || [],
        tradeInRequests: getLocalDemoState()?.tradeInRequests || [],
      },
    );
  }

  const vehicles = (vehiclesResult.data || []) as Array<Record<string, unknown>>;
  const vehicleLookup = new Map(
    vehicles.map((vehicle) => [
      String(vehicle.id),
      vehicle.title ? String(vehicle.title) : undefined,
    ]),
  );

  return {
    leads: ((leadsResult.data || []) as Array<Record<string, unknown>>).map(
      (row) => ({
        id: String(row.id),
        vehicleId: row.vehicle_id ? String(row.vehicle_id) : undefined,
        vehicleTitle: row.vehicle_id
          ? vehicleLookup.get(String(row.vehicle_id))
          : undefined,
        leadType: row.lead_type as LeadRecord["leadType"],
        name: String(row.name),
        phone: String(row.phone),
        email: row.email ? String(row.email) : undefined,
        message: row.message ? String(row.message) : undefined,
        source: row.source ? String(row.source) : undefined,
        utmSource: row.utm_source ? String(row.utm_source) : undefined,
        utmMedium: row.utm_medium ? String(row.utm_medium) : undefined,
        utmCampaign: row.utm_campaign ? String(row.utm_campaign) : undefined,
        createdAt: String(row.created_at),
      }),
    ),
    leadWorkflowStates: (
      (workflowResult.data || []) as Array<Record<string, unknown>>
    ).map((row) => ({
      id: String(row.id),
      sourceType: row.source_type as LeadInboxSourceType,
      sourceId: String(row.source_id),
      status: row.status as LeadWorkflowStatus,
      lastContactedAt: row.last_contacted_at
        ? String(row.last_contacted_at)
        : null,
      updatedAt: String(row.updated_at),
    })),
    testDriveRequests: (
      (testDriveResult.data || []) as Array<Record<string, unknown>>
    ).map((row) => ({
      id: String(row.id),
      vehicleId: row.vehicle_id ? String(row.vehicle_id) : undefined,
      vehicleTitle: row.vehicle_id
        ? vehicleLookup.get(String(row.vehicle_id))
        : undefined,
      name: String(row.name),
      phone: String(row.phone),
      email: row.email ? String(row.email) : undefined,
      preferredDate: row.preferred_date ? String(row.preferred_date) : undefined,
      preferredTime: row.preferred_time ? String(row.preferred_time) : undefined,
      message: row.message ? String(row.message) : undefined,
      source: "Admin inbox",
      createdAt: String(row.created_at),
    })),
    tradeInRequests: (
      (tradeInResult.data || []) as Array<Record<string, unknown>>
    ).map((row) => ({
      id: String(row.id),
      desiredVehicleId: row.desired_vehicle_id
        ? String(row.desired_vehicle_id)
        : undefined,
      desiredVehicleTitle: row.desired_vehicle_id
        ? vehicleLookup.get(String(row.desired_vehicle_id))
        : undefined,
      name: String(row.name),
      phone: String(row.phone),
      email: row.email ? String(row.email) : undefined,
      currentVehicleMake: String(row.current_vehicle_make),
      currentVehicleModel: String(row.current_vehicle_model),
      currentVehicleYear: Number(row.current_vehicle_year),
      currentVehicleMileage: row.current_vehicle_mileage
        ? Number(row.current_vehicle_mileage)
        : undefined,
      conditionNotes: row.condition_notes ? String(row.condition_notes) : undefined,
      message: row.message ? String(row.message) : undefined,
      source: "Admin inbox",
      createdAt: String(row.created_at),
    })),
  };
}

export async function getLeadInbox(
  query: LeadInboxQuery = {},
  options: WriteOptions = {},
): Promise<LeadInboxResult> {
  const tables = await fetchLeadTables(options);
  const filters = normalizeLeadInboxQuery(query);
  const allItems = toLeadInboxItems(
    tables.leads,
    tables.testDriveRequests,
    tables.tradeInRequests,
    tables.leadWorkflowStates,
  );
  const searchScopedItems = filters.q
    ? allItems.filter((item) =>
        buildLeadInboxSearchText(item).includes(filters.q.toLowerCase()),
      )
    : allItems;
  const statusScopedItems =
    filters.status === "all"
      ? searchScopedItems
      : searchScopedItems.filter((item) => item.status === filters.status);
  const scopedItems = filterLeadInboxItemsByType(searchScopedItems, filters.type);
  const filteredItems = scopedItems.filter((item) => {

    if (filters.status !== "all" && item.status !== filters.status) {
      return false;
    }

    return true;
  });
  const paginatedItems = paginateAdminItems(
    filteredItems,
    filters.page,
    filters.pageSize,
  );

  return {
    items: paginatedItems.items,
    filters: {
      ...filters,
      page: paginatedItems.page,
      pageSize: paginatedItems.pageSize,
    },
    summary: buildLeadInboxSummary(allItems),
    scopedSummary: buildLeadInboxSummary(scopedItems),
    typeCounts: buildLeadInboxTypeCounts(statusScopedItems),
    totalItems: paginatedItems.totalItems,
    page: paginatedItems.page,
    pageSize: paginatedItems.pageSize,
    totalPages: paginatedItems.totalPages,
  };
}

export async function updateLeadInboxState(
  input: {
    sourceId: string;
    sourceType: LeadInboxSourceType;
    status: LeadWorkflowStatus;
  },
  options: WriteOptions = {},
) {
  const now = new Date().toISOString();
  const serverClient = await createSupabaseServerClient();

  if (options.forceDemo || !serverClient) {
    requireServerClientOrDemo(
      "Lead workflow updates are unavailable until Supabase is configured.",
      options.forceDemo,
    );

    return mutateDemoState((state) => {
      const existing = state.leadWorkflowStates.find(
        (item) =>
          item.sourceId === input.sourceId && item.sourceType === input.sourceType,
      );
      const currentStatus = existing?.status || "new";

      if (!isLeadWorkflowTransitionAllowed(currentStatus, input.status)) {
        throw new Error(
          "Move the lead to contacted before follow-up or closing it.",
        );
      }

      if (existing) {
        existing.status = input.status;
        existing.lastContactedAt = resolveLeadLastContactedAt(
          existing.lastContactedAt,
          input.status,
          now,
        );
        existing.updatedAt = now;
        return clone(existing);
      }

      const nextState: LeadWorkflowStateRecord = {
        id: `lead-workflow-${Date.now()}`,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        status: input.status,
        lastContactedAt: resolveLeadLastContactedAt(null, input.status, now),
        updatedAt: now,
      };

      state.leadWorkflowStates.unshift(nextState);
      return clone(nextState);
    });
  }

  const { data: existingState, error: existingStateError } = await serverClient
    .from("lead_inbox_state")
    .select("*")
    .eq("source_type", input.sourceType)
    .eq("source_id", input.sourceId)
    .maybeSingle();

  if (existingStateError) {
    throw existingStateError;
  }

  const currentStatus = (existingState?.status as LeadWorkflowStatus | undefined) || "new";

  if (!isLeadWorkflowTransitionAllowed(currentStatus, input.status)) {
    throw new Error("Move the lead to contacted before follow-up or closing it.");
  }

  const { data, error } = await serverClient
    .from("lead_inbox_state")
    .upsert(
      {
        id: existingState?.id,
        source_type: input.sourceType,
        source_id: input.sourceId,
        status: input.status,
        last_contacted_at: resolveLeadLastContactedAt(
          existingState?.last_contacted_at
            ? String(existingState.last_contacted_at)
            : null,
          input.status,
          now,
        ),
        updated_at: now,
      },
      {
        onConflict: "source_type,source_id",
      },
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return {
    id: String(data.id),
    sourceType: data.source_type as LeadInboxSourceType,
    sourceId: String(data.source_id),
    status: data.status as LeadWorkflowStatus,
    lastContactedAt: data.last_contacted_at
      ? String(data.last_contacted_at)
      : null,
    updatedAt: String(data.updated_at),
  } satisfies LeadWorkflowStateRecord;
}
