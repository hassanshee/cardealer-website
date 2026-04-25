import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    envState: {
      hasCloudinaryConfig: true,
    },
    requireAdminSession: vi.fn(),
    uploadVehicleImageFromUrl: vi.fn(),
    deleteCloudinaryAssets: vi.fn(),
    mapVehicleFormData: vi.fn(),
    getAdminVehicles: vi.fn(),
    getVehicleById: vi.fn(),
    saveVehicle: vi.fn(),
    deleteVehicle: vi.fn(),
    updateVehicleStatus: vi.fn(),
    redirect: vi.fn(),
    revalidatePath: vi.fn(),
    isRedirectError: vi.fn(() => false),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("next/dist/client/components/redirect-error", () => ({
  isRedirectError: mocks.isRedirectError,
}));

vi.mock("@/lib/auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
  signInDemoAdmin: vi.fn(),
  signOutAdmin: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  allowDemoAdmin: true,
  hasAdminManagementConfig: true,
  hasAdminSuperEmailConfig: true,
  hasSupabaseConfig: true,
  get hasCloudinaryConfig() {
    return mocks.envState.hasCloudinaryConfig;
  },
  env: {
    adminDefaultPassword: "StrongTempPassword123!",
    adminSuperEmail: "owner@example.com",
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/cloudinary", () => ({
  deleteCloudinaryAssets: mocks.deleteCloudinaryAssets,
  uploadVehicleImageFromUrl: mocks.uploadVehicleImageFromUrl,
}));

vi.mock("@/lib/vehicle-form", () => ({
  mapVehicleFormData: mocks.mapVehicleFormData,
}));

vi.mock("@/lib/data/repository", () => ({
  deleteVehicle: mocks.deleteVehicle,
  getAdminVehicles: mocks.getAdminVehicles,
  getVehicleById: mocks.getVehicleById,
  saveVehicle: mocks.saveVehicle,
  syncVehicleImagesFromCloudinary: vi.fn(),
  toggleVehicleFeatured: vi.fn(),
  updateVehicleStatus: mocks.updateVehicleStatus,
}));

import {
  bulkVehicleAction,
  saveVehicleAction,
} from "@/lib/actions/admin-actions";

function buildVehicleInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "2020 Toyota Prado",
    stockCode: "KDL-001",
    slug: "2020-toyota-prado",
    make: "Toyota",
    model: "Prado",
    year: 2020,
    condition: "Foreign used",
    price: 6500000,
    negotiable: false,
    mileage: 42000,
    transmission: "Automatic",
    fuelType: "Diesel",
    driveType: null,
    bodyType: "SUV",
    engineCapacity: "3000cc",
    color: "Black",
    locationId: null,
    featured: false,
    status: "published",
    stockCategory: "used",
    description: "A clean SUV with strong condition notes and ready availability.",
    images: [],
    ...overrides,
  };
}

describe("saveVehicleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.envState.hasCloudinaryConfig = true;
    mocks.getAdminVehicles.mockResolvedValue([]);
    mocks.requireAdminSession.mockResolvedValue({
      mode: "supabase",
      email: "admin@example.com",
      name: "Admin",
    });
  });

  it("cleans up newly uploaded client assets if URL import fails", async () => {
    mocks.mapVehicleFormData.mockReturnValue(
      buildVehicleInput({
        images: [
          {
            imageUrl: "https://example.com/car.jpg",
            sourceUrl: "https://example.com/car.jpg",
            sortOrder: 0,
            isHero: true,
            uploadState: "pending_url",
          },
        ],
      }),
    );
    mocks.uploadVehicleImageFromUrl.mockRejectedValue(
      new Error("Cloudinary import failed."),
    );

    const formData = new FormData();
    formData.set("newUploadPublicIdsJson", JSON.stringify(["client-upload-1"]));

    const result = await saveVehicleAction(
      { success: false, message: "" },
      formData,
    );

    expect(result).toEqual({
      success: false,
      message: "Cloudinary import failed.",
    });
    expect(mocks.deleteCloudinaryAssets).toHaveBeenCalledWith([
      "client-upload-1",
    ]);
    expect(mocks.saveVehicle).not.toHaveBeenCalled();
  });

  it("cleans up newly uploaded client assets if metadata save fails", async () => {
    mocks.mapVehicleFormData.mockReturnValue(
      buildVehicleInput({
        images: [
          {
            imageUrl: "https://cdn.example.com/already-uploaded.jpg",
            cloudinaryPublicId: "cloudinary-direct-upload",
            sortOrder: 0,
            isHero: true,
            uploadState: "uploaded",
          },
        ],
      }),
    );
    mocks.saveVehicle.mockRejectedValue(new Error("Vehicle save failed."));

    const formData = new FormData();
    formData.set(
      "newUploadPublicIdsJson",
      JSON.stringify(["cloudinary-direct-upload"]),
    );

    const result = await saveVehicleAction(
      { success: false, message: "" },
      formData,
    );

    expect(result).toEqual({
      success: false,
      message: "We could not save the vehicle right now.",
    });
    expect(mocks.deleteCloudinaryAssets).toHaveBeenCalledWith([
      "cloudinary-direct-upload",
    ]);
  });

  it("saves staged image URLs directly when Cloudinary is unavailable", async () => {
    mocks.envState.hasCloudinaryConfig = false;
    mocks.mapVehicleFormData.mockReturnValue(
      buildVehicleInput({
        images: [
          {
            imageUrl: "https://example.com/car.jpg",
            sourceUrl: "https://example.com/car.jpg",
            sortOrder: 0,
            isHero: true,
            uploadState: "pending_url",
          },
        ],
      }),
    );
    mocks.saveVehicle.mockResolvedValue({
      id: "vehicle-created",
      slug: "2020-toyota-prado",
    });

    const result = await saveVehicleAction(
      { success: false, message: "" },
      new FormData(),
    );

    expect(result).toEqual({
      success: true,
      message: "Vehicle created successfully.",
      redirectTo: "/admin/vehicles/vehicle-created?saved=1",
    });
    expect(mocks.uploadVehicleImageFromUrl).not.toHaveBeenCalled();
    expect(mocks.saveVehicle).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [
          expect.objectContaining({
            imageUrl: "https://example.com/car.jpg",
            uploadState: "uploaded",
            cloudinaryPublicId: null,
          }),
        ],
      }),
      { forceDemo: false },
    );
  });

  it("keeps edit saves on the same page instead of redirecting back to the list", async () => {
    mocks.envState.hasCloudinaryConfig = false;
    mocks.mapVehicleFormData.mockReturnValue(
      buildVehicleInput({
        id: "vehicle-1",
        images: [
          {
            imageUrl: "https://example.com/car.jpg",
            sourceUrl: "https://example.com/car.jpg",
            sortOrder: 0,
            isHero: true,
            uploadState: "pending_url",
          },
        ],
      }),
    );
    mocks.saveVehicle.mockResolvedValue({
      id: "vehicle-1",
      slug: "2020-toyota-prado",
    });

    const result = await saveVehicleAction(
      { success: false, message: "" },
      new FormData(),
    );

    expect(result).toEqual({
      success: true,
      message: "Vehicle saved successfully.",
      savedImages: [],
    });
  });

  it("derives unique stock codes and slugs before importing and saving", async () => {
    mocks.getAdminVehicles.mockResolvedValue([
      {
        id: "existing-vehicle",
        stockCode: "2020-TOY-PRA",
        slug: "2020-toyota-prado",
      },
    ]);
    mocks.mapVehicleFormData.mockReturnValue(
      buildVehicleInput({
        stockCode: "2020-TOY-PRA",
        slug: "2020-toyota-prado",
        images: [
          {
            imageUrl: "https://example.com/car.jpg",
            sourceUrl: "https://example.com/car.jpg",
            sortOrder: 0,
            isHero: true,
            uploadState: "pending_url",
          },
        ],
      }),
    );
    mocks.uploadVehicleImageFromUrl.mockResolvedValue({
      secureUrl: "https://cdn.example.com/car.jpg",
      publicId: "cloudinary-car",
    });
    mocks.saveVehicle.mockResolvedValue({
      slug: "2020-toyota-prado-2",
    });

    await saveVehicleAction({ success: false, message: "" }, new FormData());

    expect(mocks.uploadVehicleImageFromUrl).toHaveBeenCalledWith(
      "https://example.com/car.jpg",
      {
        stockCode: "2020-TOY-PRA-2",
      },
    );
    expect(mocks.saveVehicle).toHaveBeenCalledWith(
      expect.objectContaining({
        stockCode: "2020-TOY-PRA-2",
        slug: "2020-toyota-prado-2",
      }),
      { forceDemo: false },
    );
  });

  it("keeps the current stock code and slug when editing an existing vehicle", async () => {
    mocks.getAdminVehicles.mockResolvedValue([
      {
        id: "vehicle-1",
        stockCode: "KDL-001",
        slug: "2020-toyota-prado",
      },
    ]);
    mocks.mapVehicleFormData.mockReturnValue(
      buildVehicleInput({
        id: "vehicle-1",
        stockCode: "2020-TOY-PRA",
        slug: "2020-toyota-prado-updated",
        images: [
          {
            imageUrl: "https://example.com/car.jpg",
            sourceUrl: "https://example.com/car.jpg",
            sortOrder: 0,
            isHero: true,
            uploadState: "pending_url",
          },
        ],
      }),
    );
    mocks.uploadVehicleImageFromUrl.mockResolvedValue({
      secureUrl: "https://cdn.example.com/car.jpg",
      publicId: "cloudinary-car",
    });
    mocks.saveVehicle.mockResolvedValue({
      slug: "2020-toyota-prado",
    });

    await saveVehicleAction({ success: false, message: "" }, new FormData());

    expect(mocks.uploadVehicleImageFromUrl).toHaveBeenCalledWith(
      "https://example.com/car.jpg",
      {
        stockCode: "KDL-001",
      },
    );
    expect(mocks.saveVehicle).toHaveBeenCalledWith(
      expect.objectContaining({
        stockCode: "KDL-001",
        slug: "2020-toyota-prado",
      }),
      { forceDemo: false },
    );
  });
});

describe("bulkVehicleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({
      mode: "supabase",
      email: "admin@example.com",
      name: "Admin",
    });
  });

  it("rejects requests without selected vehicles", async () => {
    const result = await bulkVehicleAction(
      { success: false, message: "" },
      new FormData(),
    );

    expect(result).toEqual({
      success: false,
      message: "Select at least one vehicle.",
    });
  });

  it("returns partial failure results when one bulk status update fails", async () => {
    mocks.updateVehicleStatus
      .mockResolvedValueOnce({ slug: "toyota-corolla" })
      .mockRejectedValueOnce(new Error("Second update failed."));

    const formData = new FormData();
    formData.set("action", "sold");
    formData.append("ids", "vehicle-1");
    formData.append("ids", "vehicle-2");

    const result = await bulkVehicleAction(
      { success: false, message: "" },
      formData,
    );

    expect(result).toEqual({
      success: false,
      message: "1 updated, 1 failed.",
      results: [
        { id: "vehicle-1", success: true },
        { id: "vehicle-2", success: false, message: "Second update failed." },
      ],
    });
    expect(mocks.updateVehicleStatus).toHaveBeenCalledTimes(2);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/vehicles");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/cars/toyota-corolla");
  });
});
