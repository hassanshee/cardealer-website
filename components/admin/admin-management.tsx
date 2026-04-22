"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import {
  createAdminAccountAction,
  disableAdminAccountAction,
  enableAdminAccountAction,
  removeAdminAccountAction,
} from "@/lib/actions/admin-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionState } from "@/types/dealership";

type AdminSummary = {
  userId: string;
  email: string;
  fullName: string | null;
  isCurrent: boolean;
  isSuper: boolean;
  isDisabled: boolean;
  bannedUntil?: string | null;
};

const initialState: ActionState = { success: false, message: "" };

export function AdminManagement({
  admins,
  defaultPassword,
}: {
  admins: AdminSummary[];
  defaultPassword: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [createState, createAction] = useActionState(
    createAdminAccountAction,
    initialState,
  );
  const [disableState, disableAction] = useActionState(
    disableAdminAccountAction,
    initialState,
  );
  const [enableState, enableAction] = useActionState(
    enableAdminAccountAction,
    initialState,
  );
  const [removeState, removeAction] = useActionState(
    removeAdminAccountAction,
    initialState,
  );

  useEffect(() => {
    if (
      createState.success ||
      disableState.success ||
      enableState.success ||
      removeState.success
    ) {
      router.refresh();
    }
  }, [createState, disableState, enableState, removeState, router]);

  useEffect(() => {
    if (createState.success) {
      formRef.current?.reset();
    }
  }, [createState.success]);

  const actionMessage =
    (!createState.success && createState.message) ||
    (!disableState.success && disableState.message) ||
    (!enableState.success && enableState.message) ||
    (!removeState.success && removeState.message) ||
    "";

  const successMessage =
    (createState.success && createState.message) ||
    (disableState.success && disableState.message) ||
    (enableState.success && enableState.message) ||
    (removeState.success && removeState.message) ||
    "";

  return (
    <div className="space-y-6">
      <Card className="rounded-[28px] border border-border/70 bg-white/95 p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            Add admin
          </p>
          <p className="text-sm text-stone-600">
            New admins receive a temporary password and must reset it on first
            login.
          </p>
        </div>
        <form ref={formRef} action={createAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="admin-email">Admin email</Label>
            <Input
              id="admin-email"
              name="email"
              type="email"
              placeholder="admin@example.com"
              required
            />
          </div>
          <div>
            <Label htmlFor="admin-name">Full name (optional)</Label>
            <Input
              id="admin-name"
              name="fullName"
              type="text"
              placeholder="Admin Name"
            />
          </div>
          <div className="sm:col-span-2 rounded-[20px] border border-border/70 bg-stone-50 px-4 py-3 text-xs text-stone-600">
            Default password: <span className="font-semibold">{defaultPassword}</span>
          </div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <SubmitButton className="w-full sm:w-auto">Add admin</SubmitButton>
          </div>
        </form>

        {actionMessage ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {actionMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p className="mt-3 text-sm text-emerald-700">{successMessage}</p>
        ) : null}
      </Card>

      <Card className="rounded-[28px] border border-border/70 bg-white/95 p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          Admin accounts
        </p>
        <div className="mt-4 space-y-3">
          {admins.map((admin) => {
            const cannotManage = admin.isCurrent || admin.isSuper;

            return (
              <div
                key={admin.userId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-stone-50/80 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-stone-950">
                    {admin.fullName || "Unnamed admin"}
                  </p>
                  <p className="text-sm text-stone-600">{admin.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {admin.isSuper ? <Badge variant="accent">Super admin</Badge> : null}
                    {admin.isCurrent ? (
                      <Badge variant="accent">Current session</Badge>
                    ) : null}
                    {admin.isDisabled ? <Badge variant="muted">Disabled</Badge> : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {admin.isDisabled ? (
                    <form action={enableAction}>
                      <input type="hidden" name="userId" value={admin.userId} />
                      <input type="hidden" name="email" value={admin.email} />
                      <SubmitButton size="sm" variant="secondary" disabled={cannotManage}>
                        Enable
                      </SubmitButton>
                    </form>
                  ) : (
                    <form action={disableAction}>
                      <input type="hidden" name="userId" value={admin.userId} />
                      <input type="hidden" name="email" value={admin.email} />
                      <SubmitButton size="sm" variant="secondary" disabled={cannotManage}>
                        Disable
                      </SubmitButton>
                    </form>
                  )}
                  <form action={removeAction}>
                    <input type="hidden" name="userId" value={admin.userId} />
                    <input type="hidden" name="email" value={admin.email} />
                    <SubmitButton
                      size="sm"
                      variant="ghost"
                      className="text-red-700 hover:bg-red-50 hover:text-red-800"
                      disabled={cannotManage}
                      onClick={(event) => {
                        if (
                          !confirm(
                            "Remove this admin? This deletes their account and cannot be undone.",
                          )
                        ) {
                          event.preventDefault();
                        }
                      }}
                    >
                      Remove
                    </SubmitButton>
                  </form>
                </div>
              </div>
            );
          })}

          {admins.length === 0 ? (
            <p className="text-sm text-stone-600">
              No admins found. Add one above to grant access.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
