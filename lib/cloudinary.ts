import "server-only";

import { v2 as cloudinary } from "cloudinary";

import { env, hasCloudinaryConfig } from "@/lib/env";
import { normalizeStockCode } from "@/lib/utils";
import {
  getVehicleAssetFolder,
  SUPPORTED_IMAGE_FORMATS,
} from "@/lib/vehicle-image-upload";

export {
  getVehicleAssetFolder,
  SUPPORTED_IMAGE_FORMATS,
  SUPPORTED_IMAGE_MIME_TYPES,
  validateVehicleImageUpload,
  VEHICLE_IMAGE_UPLOAD_MAX_BYTES,
  VEHICLE_IMAGE_UPLOAD_MAX_FILES,
} from "@/lib/vehicle-image-upload";

const SUPPORTED_IMAGE_FORMAT_SET = new Set(SUPPORTED_IMAGE_FORMATS);

type CloudinaryAssetResource = {
  public_id?: string;
  secure_url?: string;
  format?: string;
  asset_folder?: string | null;
  filename?: string;
};

export type CloudinaryVehicleAsset = {
  publicId: string;
  secureUrl: string;
  assetFolder: string;
  filename: string;
};

export function buildVehicleImageUploadSignature(
  options: { assetFolder?: string; stockCode?: string } = {},
) {
  if (!hasCloudinaryConfig) {
    throw new Error("Cloudinary is not configured.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const assetFolder =
    options.assetFolder || getVehicleAssetFolder(options.stockCode);
  const signedParams = {
    allowed_formats: SUPPORTED_IMAGE_FORMATS.join(","),
    asset_folder: assetFolder,
    timestamp,
    unique_filename: true,
    use_filename: true,
  };
  const signature = cloudinary.utils.api_sign_request(
    signedParams,
    env.cloudinaryApiSecret,
  );

  return {
    allowedFormats: [...SUPPORTED_IMAGE_FORMATS],
    apiKey: env.cloudinaryApiKey,
    assetFolder,
    cloudName: env.cloudinaryCloudName,
    signature,
    timestamp,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/image/upload`,
  };
}

if (hasCloudinaryConfig) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
  });
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableCloudinaryError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const httpCode =
    typeof error === "object" && error !== null && "http_code" in error
      ? Number(error.http_code)
      : undefined;

  return (
    httpCode === 429 ||
    (httpCode !== undefined && httpCode >= 500) ||
    /rate limit|timed out|econnreset|socket hang up/i.test(message)
  );
}

async function withRetries<T>(
  task: () => Promise<T>,
  label: string,
  maxAttempts = 4,
) {
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      return await task();
    } catch (error) {
      if (!isRetryableCloudinaryError(error) || attempt >= maxAttempts) {
        throw error;
      }

      const delay = 500 * 2 ** (attempt - 1);
      console.warn(
        `[cloudinary] ${label} failed on attempt ${attempt}. Retrying in ${delay}ms.`,
      );
      await wait(delay);
    }
  }

  throw new Error(`Unable to complete ${label}.`);
}

function isSupportedImageAsset(resource: CloudinaryAssetResource) {
  return SUPPORTED_IMAGE_FORMAT_SET.has(
    String(resource.format || "").toLowerCase() as (typeof SUPPORTED_IMAGE_FORMATS)[number],
  );
}

function getAssetStem(resource: CloudinaryAssetResource) {
  return String(resource.public_id || "")
    .split("/")
    .pop() || "";
}

function parseLeadingNumber(value: string) {
  const match = value.match(/^\d+/);
  return match ? Number(match[0]) : Number.NaN;
}

function sortCloudinaryAssets(resources: CloudinaryAssetResource[]) {
  return [...resources].sort((left, right) => {
    const leftStem = getAssetStem(left);
    const rightStem = getAssetStem(right);
    const leftNumber = parseLeadingNumber(leftStem);
    const rightNumber = parseLeadingNumber(rightStem);

    if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
      return leftNumber - rightNumber;
    }

    const byName = leftStem.localeCompare(rightStem, undefined, {
      numeric: true,
      sensitivity: "base",
    });

    if (byName !== 0) {
      return byName;
    }

    return String(left.public_id || "").localeCompare(
      String(right.public_id || ""),
      undefined,
      { numeric: true, sensitivity: "base" },
    );
  });
}

function buildAssetFolderCandidates(stockCode: string) {
  const normalizedStockCode = normalizeStockCode(stockCode);
  const lowerStockCode = normalizedStockCode.toLowerCase();

  return [...new Set([
    normalizedStockCode,
    lowerStockCode,
    `cars/${normalizedStockCode}`,
    `cars/${lowerStockCode}`,
  ])].filter(Boolean);
}

async function listAssetsByAssetFolder(assetFolder: string) {
  const resources: CloudinaryAssetResource[] = [];
  let nextCursor: string | undefined;

  do {
    const result = await withRetries(
      () =>
        cloudinary.api.resources_by_asset_folder(assetFolder, {
          max_results: 500,
          next_cursor: nextCursor,
        }),
      `listing Cloudinary assets for ${assetFolder}`,
    );

    resources.push(...((result.resources || []) as CloudinaryAssetResource[]));
    nextCursor = result.next_cursor;
  } while (nextCursor);

  return sortCloudinaryAssets(resources)
    .filter(isSupportedImageAsset)
    .map((resource) => {
      if (!resource.public_id || !resource.secure_url) {
        throw new Error(
          `Cloudinary asset in "${assetFolder}" is missing public_id or secure_url.`,
        );
      }

      return {
        publicId: resource.public_id,
        secureUrl: resource.secure_url,
        assetFolder:
          resource.asset_folder || assetFolder,
        filename: resource.filename || getAssetStem(resource),
      } satisfies CloudinaryVehicleAsset;
    });
}

export async function listCloudinaryVehicleAssets(stockCode: string) {
  if (!hasCloudinaryConfig) {
    throw new Error("Cloudinary is not configured.");
  }

  const candidates = buildAssetFolderCandidates(stockCode);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const assets = await listAssetsByAssetFolder(candidate);

      if (assets.length) {
        return {
          assetFolder: candidate,
          assets,
        };
      }
    } catch (error) {
      lastError = error;
    }
  }

  const candidateLabel = candidates.join(", ");
  const detail =
    lastError instanceof Error ? ` ${lastError.message}` : "";

  throw new Error(
    `No Cloudinary images were found for stock code "${normalizeStockCode(
      stockCode,
    )}". Tried folders: ${candidateLabel}.${detail}`,
  );
}

export async function uploadVehicleImage(
  file: File,
  options: { stockCode?: string } = {},
) {
  if (!hasCloudinaryConfig) {
    throw new Error("Cloudinary is not configured.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  return new Promise<{ secureUrl: string; publicId: string }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          asset_folder: getVehicleAssetFolder(options.stockCode),
          resource_type: "image",
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error || !result) {
            reject(error || new Error("Upload failed."));
            return;
          }

          resolve({
            secureUrl: result.secure_url,
            publicId: result.public_id,
          });
        },
      );

      stream.end(buffer);
    },
  );
}

export async function uploadVehicleImageFromUrl(
  sourceUrl: string,
  options: { stockCode?: string } = {},
) {
  if (!hasCloudinaryConfig) {
    throw new Error("Cloudinary is not configured.");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    throw new Error("Use a valid image URL.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Use an http or https image URL.");
  }

  const result = await withRetries(
    () =>
      cloudinary.uploader.upload(parsedUrl.toString(), {
        asset_folder: getVehicleAssetFolder(options.stockCode),
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
      }),
    `importing Cloudinary image from ${parsedUrl.hostname}`,
  );

  if (!result.secure_url || !result.public_id) {
    throw new Error("Image import failed.");
  }

  return {
    secureUrl: result.secure_url,
    publicId: result.public_id,
  };
}

export async function deleteCloudinaryAssets(publicIds: string[]) {
  if (!hasCloudinaryConfig || !publicIds.length) {
    return {
      deletedCount: 0,
      missingCount: 0,
    };
  }

  let deletedCount = 0;
  let missingCount = 0;
  const uniqueIds = [...new Set(publicIds.filter(Boolean))];

  for (let index = 0; index < uniqueIds.length; index += 100) {
    const batch = uniqueIds.slice(index, index + 100);
    const result = await withRetries(
      () =>
        cloudinary.api.delete_resources(batch, {
          resource_type: "image",
          type: "upload",
        }),
      "deleting Cloudinary vehicle images",
    );
    const deletedMap = (result.deleted || {}) as Record<string, string>;

    for (const publicId of batch) {
      const status = deletedMap[publicId];

      if (status === "deleted") {
        deletedCount += 1;
        continue;
      }

      if (status === "not_found") {
        missingCount += 1;
        continue;
      }

      throw new Error(
        `Cloudinary could not remove asset "${publicId}". Status: ${status || "unknown"}.`,
      );
    }
  }

  return {
    deletedCount,
    missingCount,
  };
}
