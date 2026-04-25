import { describe, expect, it } from "vitest";

import { mapVehicleFormData } from "@/lib/vehicle-form";

function buildVehicleFormData() {
  const formData = new FormData();
  formData.set("title", "2020 Toyota Prado");
  formData.set("make", "Toyota");
  formData.set("model", "Prado");
  formData.set("year", "2020");
  formData.set("condition", "Foreign used");
  formData.set("price", "6500000");
  formData.set("mileage", "42000");
  formData.set("transmission", "Automatic");
  formData.set("fuelType", "Diesel");
  formData.set("status", "draft");
  formData.set("stockCategory", "used");
  formData.set(
    "description",
    "A clean SUV with strong condition notes and ready availability.",
  );
  return formData;
}

describe("mapVehicleFormData", () => {
  it("maps form data into a typed vehicle payload", () => {
    const formData = buildVehicleFormData();
    formData.set(
      "imagesJson",
      JSON.stringify([
        {
          imageUrl: "https://example.com/car.jpg",
          sortOrder: 0,
          isHero: true,
        },
      ]),
    );

    const result = mapVehicleFormData(formData);

    expect(result.title).toBe("2020 Toyota Prado");
    expect(result.stockCode).toBe("2020-TOY-PRA");
    expect(result.slug).toBe("2020-toyota-prado");
    expect(result.price).toBe(6500000);
    expect(result.images).toHaveLength(1);
    expect(result.images[0].isHero).toBe(true);
  });

  it("accepts staged URL images with explicit pending state", () => {
    const formData = buildVehicleFormData();
    formData.set(
      "imagesJson",
      JSON.stringify([
        {
          imageUrl: "https://example.com/car.jpg",
          sourceUrl: "https://example.com/car.jpg",
          sortOrder: 0,
          isHero: true,
          uploadState: "pending_url",
        },
      ]),
    );

    const result = mapVehicleFormData(formData);

    expect(result.images[0].uploadState).toBe("pending_url");
    expect(result.images[0].sourceUrl).toBe("https://example.com/car.jpg");
  });

  it("rejects blob preview URLs marked as uploaded", () => {
    const formData = buildVehicleFormData();
    formData.set(
      "imagesJson",
      JSON.stringify([
        {
          imageUrl: "blob:vehicle-preview",
          sortOrder: 0,
          isHero: true,
          uploadState: "uploaded",
        },
      ]),
    );

    expect(() => mapVehicleFormData(formData)).toThrowError(/valid image url/i);
  });

  it("rejects pending file images at the server boundary", () => {
    const formData = buildVehicleFormData();
    formData.set(
      "imagesJson",
      JSON.stringify([
        {
          imageUrl: "blob:vehicle-preview",
          sortOrder: 0,
          isHero: true,
          uploadState: "pending_file",
        },
      ]),
    );

    expect(() => mapVehicleFormData(formData)).toThrowError(
      /staged files must be uploaded before saving/i,
    );
  });

  it("uses resolved identifiers when they are provided by the client upload flow", () => {
    const formData = buildVehicleFormData();
    formData.set("resolvedStockCode", "KDL-777");
    formData.set("resolvedSlug", "2020-toyota-prado-signature");

    const result = mapVehicleFormData(formData);

    expect(result.stockCode).toBe("KDL-777");
    expect(result.slug).toBe("2020-toyota-prado-signature");
  });

  it("accepts comma-formatted Kenyan price and mileage values", () => {
    const formData = buildVehicleFormData();
    formData.set("price", "2,790,000");
    formData.set("mileage", "85,000");

    const result = mapVehicleFormData(formData);

    expect(result.price).toBe(2790000);
    expect(result.mileage).toBe(85000);
  });

  it("rejects blank numeric fields instead of saving them as zero", () => {
    const formData = buildVehicleFormData();
    formData.set("price", "");
    formData.set("mileage", "");

    let thrownError: {
      flatten: () => { fieldErrors: Record<string, string[] | undefined> };
    } | null = null;

    try {
      mapVehicleFormData(formData);
    } catch (error) {
      thrownError = error as {
        flatten: () => { fieldErrors: Record<string, string[] | undefined> };
      };
    }

    expect(thrownError).not.toBeNull();

    const fieldErrors = thrownError!.flatten().fieldErrors;
    expect(fieldErrors.price).toBeDefined();
    expect(fieldErrors.mileage).toBeDefined();
  });

  it("derives the listing title from core details when the title field is empty", () => {
    const formData = buildVehicleFormData();
    formData.set("title", "");

    const result = mapVehicleFormData(formData);

    expect(result.title).toBe("2020 Toyota Prado");
    expect(result.slug).toBe("2020-toyota-prado");
  });

  it("requires an image before publishing a listing", () => {
    const formData = buildVehicleFormData();
    formData.set("status", "published");
    formData.set("imagesJson", JSON.stringify([]));

    let thrownError: {
      flatten: () => { fieldErrors: Record<string, string[] | undefined> };
    } | null = null;

    try {
      mapVehicleFormData(formData);
    } catch (error) {
      thrownError = error as {
        flatten: () => { fieldErrors: Record<string, string[] | undefined> };
      };
    }

    expect(thrownError).not.toBeNull();
    expect(thrownError!.flatten().fieldErrors.images).toEqual([
      "Add at least one image before publishing.",
    ]);
  });

  it("allows draft listings to be saved without images", () => {
    const formData = buildVehicleFormData();
    formData.set("status", "draft");
    formData.set("imagesJson", JSON.stringify([]));

    const result = mapVehicleFormData(formData);

    expect(result.status).toBe("draft");
    expect(result.images).toEqual([]);
  });

  it("rejects unsupported select values from stale or tampered forms", () => {
    const formData = buildVehicleFormData();
    formData.set("condition", "Mint");
    formData.set("transmission", "Tiptronic");
    formData.set("fuelType", "Solar");

    let thrownError: {
      flatten: () => { fieldErrors: Record<string, string[] | undefined> };
    } | null = null;

    try {
      mapVehicleFormData(formData);
    } catch (error) {
      thrownError = error as {
        flatten: () => { fieldErrors: Record<string, string[] | undefined> };
      };
    }

    expect(thrownError).not.toBeNull();

    const fieldErrors = thrownError!.flatten().fieldErrors;
    expect(fieldErrors.condition).toEqual(["Select a supported condition."]);
    expect(fieldErrors.transmission).toEqual([
      "Select a supported transmission.",
    ]);
    expect(fieldErrors.fuelType).toEqual(["Select a supported fuel type."]);
  });

  it("does not surface a stock-code error when the source fields are invalid", () => {
    const formData = buildVehicleFormData();
    formData.set("title", "");
    formData.set("make", "");
    formData.set("year", "");

    let thrownError: {
      flatten: () => { fieldErrors: Record<string, string[] | undefined> };
    } | null = null;

    try {
      mapVehicleFormData(formData);
    } catch (error) {
      thrownError = error as {
        flatten: () => { fieldErrors: Record<string, string[] | undefined> };
      };
    }

    expect(thrownError).not.toBeNull();

    const fieldErrors = thrownError!.flatten().fieldErrors;
    expect(fieldErrors.stockCode).toBeUndefined();
    expect(fieldErrors.title).toBeDefined();
    expect(fieldErrors.make).toBeDefined();
    expect(fieldErrors.year).toBeDefined();
  });
});
