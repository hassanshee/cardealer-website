"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useMemo, useState, useTransition } from "react";

import { VehicleRowActions } from "@/components/admin/vehicle-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  bulkVehicleAction,
  type BulkVehicleActionState,
} from "@/lib/actions/admin-actions";
import { cn, formatCurrency, formatMileage, humanizeStatus } from "@/lib/utils";
import type { Vehicle, VehicleStatus } from "@/types/dealership";

type BulkInventoryAction = "publish" | "unpublish" | "sold" | "delete";
type RowBadge = {
  label: string;
  variant: "default" | "success" | "muted" | "accent";
};

type InventoryRowViewModel = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  metadata: string;
  badges: RowBadge[];
  priceLabel: string;
  mileageLabel: string;
  fuelLabel: string;
  updatedLabel: string;
  status: VehicleStatus;
  featured: boolean;
};

const initialBulkState: BulkVehicleActionState = {
  success: false,
  message: "",
};

function getStatusBadge(status: VehicleStatus): RowBadge {
  if (status === "published") {
    return { label: "Published", variant: "success" };
  }

  if (status === "sold") {
    return { label: "Sold", variant: "default" };
  }

  return { label: humanizeStatus(status), variant: "muted" };
}

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildVehicleRowModel(vehicle: Vehicle): InventoryRowViewModel {
  const badges: RowBadge[] = [getStatusBadge(vehicle.status)];

  if (vehicle.featured) {
    badges.push({ label: "Featured", variant: "accent" });
  }

  if (vehicle.stockCategory === "traded_in") {
    badges.push({ label: "Trade-in", variant: "muted" });
  } else if (
    vehicle.stockCategory === "imported" ||
    vehicle.stockCategory === "available_for_importation"
  ) {
    badges.push({ label: "Import", variant: "muted" });
  }

  const metadataParts = [
    vehicle.stockCode,
    String(vehicle.year),
    vehicle.transmission,
    vehicle.location?.name,
  ].filter(Boolean);

  return {
    id: vehicle.id,
    title: vehicle.title,
    thumbnailUrl: vehicle.heroImageUrl || vehicle.images[0]?.imageUrl || null,
    metadata: metadataParts.join(" - "),
    badges: badges.slice(0, 3),
    priceLabel: formatCurrency(vehicle.price),
    mileageLabel: formatMileage(vehicle.mileage),
    fuelLabel: vehicle.fuelType,
    updatedLabel: formatUpdatedAt(vehicle.updatedAt),
    status: vehicle.status,
    featured: vehicle.featured,
  };
}

export function AdminVehicleInventoryTable({
  items,
  viewKey,
}: {
  items: Vehicle[];
  viewKey: string;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<
    BulkInventoryAction | null
  >(null);
  const [bulkState, runBulkAction] = useActionState(
    bulkVehicleAction,
    initialBulkState,
  );
  const [isPending, startTransition] = useTransition();
  const rows = useMemo(() => items.map(buildVehicleRowModel), [items]);

  const selectedCount = selectedIds.length;
  const allSelected = rows.length > 0 && selectedCount === rows.length;
  const confirmationTitle =
    pendingConfirmation === "delete"
      ? "Confirm bulk delete"
      : pendingConfirmation === "sold"
        ? "Confirm mark sold"
        : pendingConfirmation === "publish"
          ? "Confirm bulk publish"
          : "Confirm bulk unpublish";
  const confirmationDescription =
    pendingConfirmation === "delete"
      ? `Delete ${selectedCount} selected vehicle${selectedCount === 1 ? "" : "s"} from inventory?`
      : pendingConfirmation === "sold"
        ? `Mark ${selectedCount} selected vehicle${selectedCount === 1 ? "" : "s"} as sold?`
        : pendingConfirmation === "publish"
          ? `Publish ${selectedCount} selected vehicle${selectedCount === 1 ? "" : "s"}?`
          : `Unpublish ${selectedCount} selected vehicle${selectedCount === 1 ? "" : "s"}?`;
  const confirmationButtonLabel =
    pendingConfirmation === "delete"
      ? "Confirm delete"
      : pendingConfirmation === "sold"
        ? "Confirm mark sold"
        : pendingConfirmation === "publish"
          ? "Confirm publish"
          : "Confirm unpublish";

  function toggleRow(id: string, checked: boolean) {
    setPendingConfirmation(null);
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id];
      }

      return current.filter((item) => item !== id);
    });
  }

  function toggleAll(checked: boolean) {
    setPendingConfirmation(null);
    setSelectedIds(checked ? rows.map((row) => row.id) : []);
  }

  function submitBulk(action: BulkInventoryAction) {
    startTransition(() => {
      const formData = new FormData();
      formData.append("action", action);
      selectedIds.forEach((id) => formData.append("ids", id));
      runBulkAction(formData);
    });
    setPendingConfirmation(null);
    setSelectedIds([]);
  }

  function runBulk(action: BulkInventoryAction) {
    if (!selectedIds.length) {
      return;
    }

    setPendingConfirmation(action);
  }

  return (
    <div className="space-y-2.5" data-view-key={viewKey}>
      {selectedCount > 0 ? (
        <div className="rounded-xl border border-border bg-stone-50 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-stone-800">{selectedCount} selected</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() => runBulk("publish")}
              >
                Publish
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() => runBulk("unpublish")}
              >
                Unpublish
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() => runBulk("sold")}
              >
                Mark sold
              </Button>
              <Button
                size="sm"
                disabled={isPending}
                className="bg-red-600 hover:bg-red-700"
                onClick={() => runBulk("delete")}
              >
                Delete
              </Button>
            </div>
          </div>

          {pendingConfirmation ? (
            <div className="mt-2.5 rounded-lg border border-border bg-white px-3 py-3">
              <p className="text-sm font-semibold text-stone-950">
                {confirmationTitle}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {confirmationDescription}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={isPending}
                  variant={pendingConfirmation === "delete" ? undefined : "default"}
                  className={
                    pendingConfirmation === "delete"
                      ? "bg-red-600 hover:bg-red-700"
                      : undefined
                  }
                  onClick={() => submitBulk(pendingConfirmation)}
                >
                  {confirmationButtonLabel}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isPending}
                  onClick={() => setPendingConfirmation(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {bulkState.message ? (
        <p
          className={cn(
            "text-sm",
            bulkState.success ? "text-emerald-700" : "text-amber-700",
          )}
          role="status"
        >
          {bulkState.message}
        </p>
      ) : null}

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-stone-100/95 text-left text-xs uppercase tracking-[0.16em] text-stone-500">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all visible rows"
                  checked={allSelected}
                  onChange={(event) => toggleAll(event.currentTarget.checked)}
                />
              </th>
              <th className="px-2 py-2">Photo</th>
              <th className="px-2 py-2">Vehicle</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Price</th>
              <th className="px-2 py-2">Mileage</th>
              <th className="px-2 py-2">Fuel</th>
              <th className="px-2 py-2">Updated</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isChecked = selectedIds.includes(row.id);

              return (
                <tr key={row.id} className="border-b border-border align-top">
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.title}`}
                      checked={isChecked}
                      onChange={(event) =>
                        toggleRow(row.id, event.currentTarget.checked)
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="relative h-10 w-14 overflow-hidden rounded bg-stone-100">
                      {row.thumbnailUrl ? (
                        <Image
                          src={row.thumbnailUrl}
                          alt={row.title}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] uppercase text-stone-400">
                          None
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="max-w-[280px] px-2 py-1.5">
                    <p className="truncate text-sm font-medium text-stone-900">
                      {row.title}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {row.metadata}
                    </p>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {row.badges.map((badge) => (
                        <Badge
                          key={badge.label}
                          variant={badge.variant}
                          className="px-2 py-0.5 text-[9px]"
                        >
                          {badge.label}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-medium text-stone-900">
                    {row.priceLabel}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5">
                    {row.mileageLabel}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5">{row.fuelLabel}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-xs text-stone-500">
                    {row.updatedLabel}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <Button asChild size="sm" className="h-7 px-2 text-xs">
                        <Link href={`/admin/vehicles/${row.id}`}>Edit</Link>
                      </Button>
                      <VehicleRowActions
                        vehicleId={row.id}
                        featured={row.featured}
                        status={row.status}
                        compact
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 lg:hidden">
        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded-lg border border-border bg-white px-3 py-2"
          >
            <div className="flex items-start gap-3">
              <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded bg-stone-100">
                {row.thumbnailUrl ? (
                  <Image
                    src={row.thumbnailUrl}
                    alt={row.title}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] uppercase text-stone-400">
                    None
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-stone-900">
                  {row.title}
                </p>
                <p className="truncate text-xs text-stone-500">{row.metadata}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {row.badges.map((badge) => (
                    <Badge
                      key={badge.label}
                      variant={badge.variant}
                      className="px-2 py-0.5 text-[9px]"
                    >
                      {badge.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-700">
              <span className="font-semibold">{row.priceLabel}</span>
              <span>{row.mileageLabel}</span>
              <span>{row.fuelLabel}</span>
              <span className="text-stone-500">Updated {row.updatedLabel}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <Button asChild size="sm" className="h-7 px-2 text-xs">
                <Link href={`/admin/vehicles/${row.id}`}>Edit</Link>
              </Button>
              <VehicleRowActions
                vehicleId={row.id}
                featured={row.featured}
                status={row.status}
                compact
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
