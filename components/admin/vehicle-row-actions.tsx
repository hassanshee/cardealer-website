"use client";

import { ChevronDown, MoreHorizontal, Star, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  deleteVehicleAction,
  setVehicleStatusAction,
  toggleVehicleFeaturedAction,
} from "@/lib/actions/admin-actions";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionState, VehicleStatus } from "@/types/dealership";

const initialState: ActionState = {
  success: false,
  message: "",
};

export function VehicleRowActions({
  featured,
  status,
  vehicleId,
  compact = false,
}: {
  featured: boolean;
  status: VehicleStatus;
  vehicleId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  const [featureState, featureAction] = useActionState(
    toggleVehicleFeaturedAction,
    initialState,
  );
  const [statusState, statusAction] = useActionState(
    setVehicleStatusAction,
    initialState,
  );
  const [deleteState, deleteAction] = useActionState(
    deleteVehicleAction,
    initialState,
  );

  const hasSuccessfulAction =
    featureState.success || statusState.success || deleteState.success;

  const menuPanelClass = compact
    ? "absolute md:right-0 top-[calc(100%+0.5rem)] z-20 w-56 rounded-xl border border-border/70 bg-white p-2 shadow-[0_20px_48px_rgba(15,23,42,0.14)]"
    : "absolute md:right-0 top-[calc(100%+0.75rem)] z-20 w-72 max-h-[70vh] overflow-y-auto rounded-[24px] border border-border/70 bg-white p-3 shadow-[0_20px_48px_rgba(15,23,42,0.14)]";
  const actionButtonClass = compact
    ? "h-8 w-full justify-start rounded-md px-2 text-xs"
    : "w-full justify-start rounded-2xl";
  const deleteButtonClass = compact
    ? "h-8 bg-red-600 px-2 text-xs hover:bg-red-700"
    : "bg-red-600 px-3 py-2 hover:bg-red-700";

  function closeActionMenu() {
    setMenuOpen(false);
    setConfirmDelete(false);
  }

  // Closes menu and refreshes layout ONLY after server actions succeed
  useEffect(() => {
    if (hasSuccessfulAction) {
      closeActionMenu();
      router.refresh();
    }
  }, [hasSuccessfulAction, router]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        closeActionMenu();
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handlePointerDown);
    }

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [menuOpen]);

  const errorMessage =
    (!deleteState.success && deleteState.message) ||
    (!statusState.success && statusState.message) ||
    (!featureState.success && featureState.message) ||
    "";

  return (
    <div className="space-y-1">
      <div className="relative" ref={menuRef}>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={compact ? "h-8 rounded-md px-2 text-xs" : "rounded-full"}
          onClick={() => setMenuOpen((current) => !current)}
          aria-expanded={menuOpen}
          aria-controls={`vehicle-row-actions-${vehicleId}`}
          aria-haspopup="menu"
        >
          <MoreHorizontal className="size-4" />
          Actions
          <ChevronDown className="size-3.5" />
        </Button>

        {menuOpen ? (
          <div
            id={`vehicle-row-actions-${vehicleId}`}
            className={menuPanelClass}
          >
            <div className="space-y-1">
              {!compact ? (
                <p className="px-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Listing actions
                </p>
              ) : null}

              <form action={featureAction}>
                <input type="hidden" name="id" value={vehicleId} />
                <SubmitButton
                  size="sm"
                  variant="ghost"
                  className={actionButtonClass}
                >
                  <Star className="size-4" />
                  {featured ? "Unfeature" : "Feature"}
                </SubmitButton>
              </form>

              {status !== "published" ? (
                <form action={statusAction}>
                  <input type="hidden" name="id" value={vehicleId} />
                  <input type="hidden" name="status" value="published" />
                  <SubmitButton
                    size="sm"
                    variant="ghost"
                    className={actionButtonClass}
                  >
                    Publish
                  </SubmitButton>
                </form>
              ) : (
                <form action={statusAction}>
                  <input type="hidden" name="id" value={vehicleId} />
                  <input type="hidden" name="status" value="unpublished" />
                  <SubmitButton
                    size="sm"
                    variant="ghost"
                    className={actionButtonClass}
                  >
                    Unpublish
                  </SubmitButton>
                </form>
              )}

              {status !== "sold" ? (
                <form action={statusAction}>
                  <input type="hidden" name="id" value={vehicleId} />
                  <input type="hidden" name="status" value="sold" />
                  <SubmitButton
                    size="sm"
                    variant="ghost"
                    className={actionButtonClass}
                  >
                    Mark sold
                  </SubmitButton>
                </form>
              ) : null}
            </div>

            <div className="mt-2 border-t border-border/70 pt-2">
              {!compact ? (
                <p className="px-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-red-700">
                  Danger zone
                </p>
              ) : null}

              {!confirmDelete ? (
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  className={`${actionButtonClass} text-red-700 hover:bg-red-50 hover:text-red-800`}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                  Delete vehicle
                </Button>
              ) : (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
                    Confirm delete
                  </p>
                  <p className="mt-1 text-xs leading-5 text-red-800">
                    This permanently deletes the vehicle listing and removes all associated images from Cloudinary. This action cannot be undone.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <form action={deleteAction}>
                      <input type="hidden" name="id" value={vehicleId} />
                      <SubmitButton
                        size="sm"
                        className={deleteButtonClass}
                      >
                        Confirm delete
                      </SubmitButton>
                    </form>
                    <Button
                      size="sm"
                      variant="secondary"
                      type="button"
                      className="h-8 px-2 text-xs"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}