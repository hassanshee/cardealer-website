import { describe, expect, it } from "vitest";

import {
  VEHICLE_IMAGE_UPLOAD_MAX_FILES,
  VEHICLE_IMAGE_UPLOAD_MAX_BYTES,
  validateVehicleImageUpload,
} from "@/lib/vehicle-image-upload";

describe("validateVehicleImageUpload", () => {
  it("allows up to 30 vehicle images", () => {
    expect(VEHICLE_IMAGE_UPLOAD_MAX_FILES).toBe(30);
  });

  it("accepts supported image formats", () => {
    expect(() =>
      validateVehicleImageUpload({
        name: "vehicle.webp",
        size: 1024,
        type: "image/webp",
      }),
    ).not.toThrow();
  });

  it("rejects unsupported image formats", () => {
    expect(() =>
      validateVehicleImageUpload({
        name: "vehicle.gif",
        size: 1024,
        type: "image/gif",
      }),
    ).toThrowError(/jpg, png, or webp/i);
  });

  it("rejects oversized images", () => {
    expect(() =>
      validateVehicleImageUpload({
        name: "vehicle.jpg",
        size: VEHICLE_IMAGE_UPLOAD_MAX_BYTES + 1,
        type: "image/jpeg",
      }),
    ).toThrowError(/8 mb or smaller/i);
  });
});
