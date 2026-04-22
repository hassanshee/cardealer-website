import type { Metadata } from "next";

import { AdminManagement } from "@/components/admin/admin-management";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminUnavailableState } from "@/components/admin/admin-unavailable-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAdminSession } from "@/lib/auth";
import {
  env,
  hasAdminDefaultPasswordConfig,
  hasAdminSuperEmailConfig,
  hasSupabaseSecretConfig,
} from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Admins",
  description: "View who can access the admin workspace.",
};

type AdminProfileRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
};

async function fetchBannedLookup(
  adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  userIds: string[],
) {
  const bannedLookup = new Map<string, string | null>();
  const targetIds = new Set(userIds);

  if (!targetIds.size) {
    return bannedLookup;
  }

  let page = 1;
  const perPage = 200;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(error.message || "Unable to fetch admin status.");
    }

    const users = data?.users ?? [];

    users.forEach((user) => {
      if (targetIds.has(user.id)) {
        bannedLookup.set(user.id, user.banned_until ?? null);
      }
    });

    if (users.length < perPage || bannedLookup.size === targetIds.size) {
      break;
    }

    page += 1;
  }

  return bannedLookup;
}

export default async function AdminAdminsPage() {
  const session = await requireAdminSession();

  if (session.mode === "demo") {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          eyebrow="Admin access"
          title="Admins"
          description="Demo mode has a single shared admin session. Connect Supabase to manage real admin accounts."
        />

        <Card className="rounded-[28px] border border-border/70 bg-white/95 p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-stone-950">Demo Admin</p>
              <p className="text-sm text-stone-600">{session.email}</p>
            </div>
            <Badge variant="accent">Current session</Badge>
          </div>
        </Card>

        <Card className="rounded-[28px] border border-border/70 bg-white/95 p-5 text-sm text-stone-700 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
          <p className="font-semibold text-stone-950">Need to add/remove admins?</p>
          <p className="mt-2">
            Demo mode uses one shared account. Connect Supabase and add
            <code>admin_profiles</code> entries to enable real admin management.
          </p>
        </Card>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <AdminUnavailableState
        title="Admins are unavailable"
        description="Supabase is not configured. Connect your database to view admin accounts."
        retryHref="/admin/admins"
        backHref="/admin/vehicles"
      />
    );
  }

  if (!hasAdminSuperEmailConfig) {
    return (
      <AdminUnavailableState
        title="Admins are unavailable"
        description="Set ADMIN_SUPER_EMAIL to enable admin access management."
        retryHref="/admin/admins"
        backHref="/admin/vehicles"
      />
    );
  }

  if (!hasAdminDefaultPasswordConfig) {
    return (
      <AdminUnavailableState
        title="Admins are unavailable"
        description="Set ADMIN_DEFAULT_PASSWORD to enable admin account creation."
        retryHref="/admin/admins"
        backHref="/admin/vehicles"
      />
    );
  }

  const isSuperAdmin =
    session.email.toLowerCase() === env.adminSuperEmail.toLowerCase();

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          eyebrow="Admin access"
          title="Admins"
          description="Only the super admin can manage access for this workspace."
        />
        <Card className="rounded-[28px] border border-border/70 bg-white/95 p-5 text-sm text-stone-700 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
          <p className="font-semibold text-stone-950">Access restricted</p>
          <p className="mt-2">
            You are signed in as <span className="font-semibold">{session.email}</span>.
            Only <span className="font-semibold">{env.adminSuperEmail}</span> can add,
            disable, or remove admin accounts.
          </p>
        </Card>
      </div>
    );
  }

  if (!hasSupabaseSecretConfig) {
    return (
      <AdminUnavailableState
        title="Admins are unavailable"
        description="Add the Supabase service key to enable admin management."
        retryHref="/admin/admins"
        backHref="/admin/vehicles"
      />
    );
  }

  const adminClient = createSupabaseAdminClient();

  if (!adminClient) {
    return (
      <AdminUnavailableState
        title="Admins are unavailable"
        description="Supabase admin client could not be created."
        retryHref="/admin/admins"
        backHref="/admin/vehicles"
      />
    );
  }

  const { data, error } = await supabase
    .from("admin_profiles")
    .select("user_id, email, full_name")
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <AdminUnavailableState
        title="Admins are unavailable"
        description={error.message}
        retryHref="/admin/admins"
        backHref="/admin/vehicles"
      />
    );
  }

  const adminRows = (data || []) as AdminProfileRow[];
  const userIds = adminRows.map((row) => String(row.user_id));

  let bannedLookup = new Map<string, string | null>();

  try {
    bannedLookup = await fetchBannedLookup(adminClient, userIds);
  } catch (error) {
    return (
      <AdminUnavailableState
        title="Admins are unavailable"
        description={
          error instanceof Error
            ? error.message
            : "Unable to fetch admin status right now."
        }
        retryHref="/admin/admins"
        backHref="/admin/vehicles"
      />
    );
  }

  const admins = adminRows.map((admin) => {
    const bannedUntil = bannedLookup.get(String(admin.user_id)) ?? null;

    return {
      userId: String(admin.user_id),
      email: admin.email ? String(admin.email) : "No email",
      fullName: admin.full_name ? String(admin.full_name) : null,
      isCurrent: session.userId === admin.user_id,
      isSuper:
        admin.email?.toLowerCase() === env.adminSuperEmail.toLowerCase(),
      isDisabled: Boolean(bannedUntil),
      bannedUntil,
    };
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Admin access"
        title="Admins"
        description="Add, disable, or remove admin access for your team."
      />
      <Card className="rounded-[28px] border border-border/70 bg-white/95 p-5 text-sm text-stone-700 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
        <p className="font-semibold text-stone-950">Super admin controls</p>
        <p className="mt-2">
          You are signed in as the super admin <span className="font-semibold">{env.adminSuperEmail}</span>.
          Use this screen to add admins with a temporary password, disable access, or remove accounts.
        </p>
      </Card>
      <AdminManagement
        admins={admins}
        defaultPassword={env.adminDefaultPassword}
      />
    </div>
  );
}
