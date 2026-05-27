import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/auth";
import { buildVehicleImageUploadSignature } from "@/lib/cloudinary";
import { isRepositoryUnavailableError } from "@/lib/data/errors";
import { resolveVehicleIdentifiers } from "@/lib/data/filters";
import { getAdminVehicles } from "@/lib/data/repository";
import { buildVehicleDraftIdentifiers } from "@/lib/vehicle-form";

const requestSchema = z.object({
  id: z.string().trim().optional(),
  draftUploadId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9-]+$/)
    .max(64)
    .optional(),
  make: z.string().trim().default(""),
  model: z.string().trim().default(""),
  title: z.string().trim().default(""),
  year: z.coerce.number().int().min(0).default(0),
});

function getDraftAssetFolder(draftUploadId?: string) {
  if (!draftUploadId) {
    return undefined;
  }

  return `vehicle-drafts/${draftUploadId.toLowerCase().slice(0, 32)}`;
}

export async function POST(request: Request) {
  const session = await requireAdminSession();

  try {
    const payload = requestSchema.parse(await request.json());
    const draftIdentifiers = buildVehicleDraftIdentifiers(payload);
    const vehicles = await getAdminVehicles({
      forceDemo: session.mode === "demo",
    });
    const resolvedIdentifiers = resolveVehicleIdentifiers(
      {
        id: payload.id,
        title: payload.title,
        stockCode: draftIdentifiers.stockCode,
        slug: draftIdentifiers.slug,
      },
      vehicles,
    );
    const signature = buildVehicleImageUploadSignature({
      assetFolder:
        resolvedIdentifiers.stockCode === "AUTO-STOCK"
          ? getDraftAssetFolder(payload.draftUploadId)
          : undefined,
      stockCode: resolvedIdentifiers.stockCode,
    });

    return NextResponse.json({
      ...signature,
      slug: resolvedIdentifiers.slug,
      stockCode: resolvedIdentifiers.stockCode,
    });
  } catch (error) {
    if (isRepositoryUnavailableError(error)) {
      return NextResponse.json(
        { message: error.message },
        { status: 503 },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Upload preparation payload is invalid." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to prepare the Cloudinary upload request.",
      },
      { status: 500 },
    );
  }
}
