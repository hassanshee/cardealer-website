"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Plus, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { logoutAdminAction } from "@/lib/actions/admin-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminSession } from "@/types/dealership";

const baseNavItems = [
  {
    href: "/admin/vehicles",
    label: "Inventory",
    description: "Manage listings and publishing state.",
  },
  {
    href: "/admin/vehicles/new",
    label: "Create vehicle",
    description: "Add a new stock item.",
  },
  {
    href: "/admin/leads",
    label: "Lead inbox",
    description: "Respond to new enquiries quickly.",
  },
] as const;

type AdminNavItem = {
  href: string;
  label: string;
  description: string;
};

function getCurrentPageLabel(pathname: string) {
  if (pathname.startsWith("/admin/leads")) {
    return "Lead inbox";
  }

  if (pathname.startsWith("/admin/admins")) {
    return "Admins";
  }

  if (pathname === "/admin/vehicles/new") {
    return "Create vehicle";
  }

  if (/^\/admin\/vehicles\/[^/]+/.test(pathname)) {
    return "Vehicle editor";
  }

  if (pathname.startsWith("/admin/vehicles")) {
    return "Inventory";
  }

  return "Admin";
}

function NavLink({
  href,
  label,
  description,
  pathname,
  onNavigate,
}: {
  href: string;
  label: string;
  description: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive =
    href === "/admin/vehicles"
      ? pathname.startsWith("/admin/vehicles") && pathname !== "/admin/vehicles/new"
      : pathname === href;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "group rounded-[24px] border px-4 py-4 transition-colors",
        isActive
          ? "border-primary/30 bg-primary/8 text-stone-950"
          : "border-transparent bg-transparent text-stone-600 hover:border-border/60 hover:bg-white/70 hover:text-stone-950",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{label}</p>
        {isActive ? (
          <span className="rounded-full bg-primary px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white">
            Live
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs leading-5 text-stone-500 group-hover:text-stone-600">
        {description}
      </p>
    </Link>
  );
}

function NavigationPanel({
  pathname,
  session,
  navItems,
  onNavigate,
}: {
  pathname: string;
  session: AdminSession;
  navItems: ReadonlyArray<AdminNavItem>;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-[#f7f9fc] px-4 py-4 lg:border-r lg:border-border/70 lg:bg-[#f4f7fb] lg:px-5 lg:py-6">
      <div className="rounded-[28px] border border-white/80 bg-white px-5 py-5 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-stone-950 text-white">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Operations
            </p>
            <h1 className="text-xl font-semibold text-stone-950">Ocean Motors</h1>
          </div>
        </div>
        <div className="mt-4 rounded-[22px] bg-stone-950 px-4 py-4 text-stone-100">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-stone-400">
            Signed in
          </p>
          <p className="mt-2 text-sm font-semibold">{session.name}</p>
          <p className="mt-1 text-xs text-stone-400">
            {session.email} | {session.mode}
          </p>
        </div>
      </div>

      <div className="mt-5 flex-1 rounded-[28px] border border-border/70 bg-white/90 p-3 shadow-[0_18px_42px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between px-2 pb-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
            Workspace
          </p>
          <Link
            href="/admin/vehicles/new"
            onClick={onNavigate}
            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100"
          >
            <Plus className="size-3.5" />
            Add
          </Link>
        </div>
        <nav className="grid gap-2" aria-label="Admin navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              description={item.description}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </div>

      <form action={logoutAdminAction} className="mt-5">
        <Button variant="secondary" className="w-full justify-between rounded-[20px]">
          Sign out
          <LogOut className="size-4" />
        </Button>
      </form>
    </div>
  );
}

export function AdminNavigation({
  session,
  canManageAdmins = false,
}: {
  session: AdminSession;
  canManageAdmins?: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pageLabel = useMemo(() => getCurrentPageLabel(pathname), [pathname]);
  const showAdminsLink = canManageAdmins || session.mode === "demo";
  const navItems = useMemo(() => {
    if (!showAdminsLink) {
      return baseNavItems;
    }

    return [
      ...baseNavItems,
      {
        href: "/admin/admins",
        label: "Admins",
        description: "Manage admin access and passwords.",
      },
    ];
  }, [showAdminsLink]);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = mobileNavRef.current?.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
    );
    const first = focusables?.[0];
    const last = focusables?.[focusables.length - 1];

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      if (!focusables?.length || !first || !last) {
        event.preventDefault();
        return;
      }

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    first?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  return (
    <>
      <aside className="hidden lg:block">
        <NavigationPanel pathname={pathname} session={session} navItems={navItems} />
      </aside>

      <div className="sticky top-0 z-30 border-b border-border/70 bg-white/92 backdrop-blur lg:hidden">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary sm:tracking-[0.24em]">
              Admin
            </p>
            <p className="truncate text-base font-semibold text-stone-950">
              {pageLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="shrink-0 rounded-full px-3 py-2">
              <Link href="/admin/vehicles/new">
                <Plus className="size-4" />
                New
              </Link>
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="shrink-0 rounded-full px-3 py-2"
              onClick={() => setMobileOpen(true)}
              aria-expanded={mobileOpen}
              aria-controls="admin-mobile-nav"
            >
              <Menu className="size-4" />
              Menu
            </Button>
          </div>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-stone-950/40"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            id="admin-mobile-nav"
            ref={mobileNavRef}
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="absolute inset-y-0 left-0 flex w-[92vw] max-w-sm flex-col overflow-y-auto bg-[#f5f7fb] shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
          >
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary sm:tracking-[0.24em]">
                  Admin navigation
                </p>
                <p className="text-sm font-semibold text-stone-950">{pageLabel}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="rounded-full px-3 py-2"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-4" />
                Close
              </Button>
            </div>
            <NavigationPanel
              pathname={pathname}
              session={session}
              navItems={navItems}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
