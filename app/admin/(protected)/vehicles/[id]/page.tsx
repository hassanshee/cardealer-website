import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminUnavailableState } from "@/components/admin/admin-unavailable-state";
import { CloudinarySyncCard } from "@/components/admin/cloudinary-sync-card";
import { VehicleForm } from "@/components/admin/vehicle-form";
import { requireAdminSession } from "@/lib/auth";
import { isRepositoryUnavailableError } from "@/lib/data/errors";
import { getAdminLocations, getVehicleById } from "@/lib/data/repository";

export const metadata: Metadata = {
  title: "Vehicle editor",
  description: "Edit an existing vehicle listing and keep the gallery, publishing state, and content in sync.",
};

export default async function AdminEditVehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdminSession();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const saved = resolvedSearchParams.saved === "1";
  let locations: Awaited<ReturnType<typeof getAdminLocations>> = [];
  let vehicle: Awaited<ReturnType<typeof getVehicleById>> = null;
  let unavailableDescription: string | null = null;

  try {
    [locations, vehicle] = await Promise.all([
      getAdminLocations({
        forceDemo: session.mode === "demo",
      }),
      getVehicleById(id, {
        forceDemo: session.mode === "demo",
      }),
    ]);
  } catch (error) {
    if (isRepositoryUnavailableError(error)) {
      unavailableDescription = error.message;
    } else {
      throw error;
    }
  }

  if (unavailableDescription) {
    return (
      <div className="space-y-6">
        <AdminUnavailableState
          title="Vehicle editor is unavailable"
          description={unavailableDescription}
          retryHref={`/admin/vehicles/${id}`}
          backHref="/admin/vehicles"
        />
      </div>
    );
  }

  if (!vehicle) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <VehicleForm
        locations={locations}
        vehicle={vehicle}
        initialNotice={saved ? "Vehicle created successfully." : undefined}
      />
      <CloudinarySyncCard vehicleId={vehicle.id} stockCode={vehicle.stockCode} />
    </div>
  );
}
