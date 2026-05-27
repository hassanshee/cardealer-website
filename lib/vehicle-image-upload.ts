import { normalizeStockCode } from "@/lib/utils";

export const VEHICLE_IMAGE_UPLOAD_MAX_FILES = 30;
export const VEHICLE_IMAGE_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const SUPPORTED_IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp"] as const;
export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const SUPPORTED_IMAGE_FORMAT_SET = new Set(SUPPORTED_IMAGE_FORMATS);

type VehicleUploadFileLike = {
  name: string;
  size: number;
  type: string;
};

export function getVehicleAssetFolder(stockCode?: string) {
  const normalizedStockCode = stockCode
    ? normalizeStockCode(stockCode)
    : "";

  return normalizedStockCode ? normalizedStockCode.toLowerCase() : "unsorted-vehicles";
}

function getFileExtension(name: string) {
  const segments = name.toLowerCase().split(".");
  return segments.length > 1 ? segments.pop() || "" : "";
}

export function validateVehicleImageUpload(file: VehicleUploadFileLike) {
  validateVehicleImageUploadFormat(file);

  if (file.size > VEHICLE_IMAGE_UPLOAD_MAX_BYTES) {
    throw new Error("Each image must be 8 MB or smaller.");
  }
}

export function validateVehicleImageUploadFormat(file: VehicleUploadFileLike) {
  const fileType = file.type.toLowerCase();
  const extension = getFileExtension(file.name);
  const isSupportedMimeType = SUPPORTED_IMAGE_MIME_TYPES.includes(
    fileType as (typeof SUPPORTED_IMAGE_MIME_TYPES)[number],
  );
  const isSupportedExtension = SUPPORTED_IMAGE_FORMAT_SET.has(
    extension as (typeof SUPPORTED_IMAGE_FORMATS)[number],
  );

  if (!isSupportedMimeType && !isSupportedExtension) {
    throw new Error("Upload a JPG, PNG, or WEBP image.");
  }
}
