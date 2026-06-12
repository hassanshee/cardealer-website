import type { Metadata } from "next";
import Link from "next/link";

import { AdminListPagination } from "@/components/admin/admin-list-pagination";
import { AdminUnavailableState } from "@/components/admin/admin-unavailable-state";
import { LeadInbox } from "@/components/admin/lead-inbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAdminSession } from "@/lib/auth";
import { isRepositoryUnavailableError } from "@/lib/data/errors";
import { getLeadInbox } from "@/lib/data/repository";
import { cn } from "@/lib/utils";
import {
  leadInboxFilters,
  leadWorkflowStatuses,
  type LeadInboxFilter,
  type LeadInboxStatusFilter,
} from "@/types/dealership";

export const metadata: Metadata = {
  title: "Lead inbox",
  description: "Triage customer enquiries, viewing requests, and trade-in conversations.",
};

const filters = leadInboxFilters;

function parsePositivePage(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function humanizeLeadFilter(filter: LeadInboxFilter) {
  if (filter === "all") {
    return "All leads";
  }

  if (filter === "test_drive") {
    return "Viewing";
  }

  if (filter === "trade_in") {
    return "Trade-in";
  }

  return filter.charAt(0).toUpperCase() + filter.slice(1);
}

function humanizeWorkflowStatus(status: LeadInboxStatusFilter) {
  if (status === "all") {
    return "All statuses";
  }

  if (status === "follow_up") {
    return "Follow up";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusCount(
  summary: Awaited<ReturnType<typeof getLeadInbox>>["summary"],
  status: LeadInboxStatusFilter,
) {
  if (status === "all") {
    return summary.total;
  }

  if (status === "new") {
    return summary.newCount;
  }

  if (status === "contacted") {
    return summary.contactedCount;
  }

  if (status === "follow_up") {
    return summary.followUpCount;
  }

  return summary.closedCount;
}

function buildLeadsHref({
  filter,
  page = 1,
  q,
  status,
}: {
  filter: LeadInboxFilter;
  page?: number;
  q?: string;
  status: LeadInboxStatusFilter;
}) {
  const params = new URLSearchParams();

  if (filter !== "all") {
    params.set("filter", filter);
  }

  if (status !== "all") {
    params.set("status", status);
  }

  if (q?.trim()) {
    params.set("q", q.trim());
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();
  return queryString ? `/admin/leads?${queryString}` : "/admin/leads";
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdminSession();
  const params = await searchParams;
  const activeFilter =
    typeof params.filter === "string" &&
    filters.includes(params.filter as LeadInboxFilter)
      ? (params.filter as LeadInboxFilter)
      : "all";
  const activeStatus =
    typeof params.status === "string" &&
    (["all", ...leadWorkflowStatuses] as const).includes(
      params.status as LeadInboxStatusFilter,
    )
      ? (params.status as LeadInboxStatusFilter)
      : "all";
  const searchQuery = typeof params.q === "string" ? params.q : "";
  const activePage = parsePositivePage(params.page);
  const notice = typeof params.notice === "string" ? params.notice : "";

  let inbox: Awaited<ReturnType<typeof getLeadInbox>> | null = null;
  let unavailableDescription: string | null = null;

  try {
    inbox = await getLeadInbox(
      {
        type: activeFilter,
        status: activeStatus,
        q: searchQuery,
        page: activePage,
      },
      {
        forceDemo: session.mode === "demo",
      },
    );
  } catch (error) {
    if (isRepositoryUnavailableError(error)) {
      unavailableDescription = error.message;
    } else {
      throw error;
    }
  }

  if (unavailableDescription) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Lead operations
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-stone-950">
              Lead inbox
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-stone-600">
              Work the newest enquiries first, keep the queue truthful, and keep
              handoff friction low on mobile.
            </p>
          </div>
        </div>

        <AdminUnavailableState
          title="Lead inbox is unavailable"
          description={unavailableDescription}
          retryHref={buildLeadsHref({
            filter: activeFilter,
            status: activeStatus,
            q: searchQuery,
            page: activePage,
          })}
          backHref="/admin/vehicles"
        />
      </div>
    );
  }

  const statusFilters: Array<{
    label: string;
    value: LeadInboxStatusFilter;
  }> = [
    { label: "All", value: "all" },
    ...leadWorkflowStatuses.map((status) => ({
      label: humanizeWorkflowStatus(status),
      value: status,
    })),
  ];

  return (
    <div className="space-y-5">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Lead operations
            </p>
            <h1 className="mt-1 text-[1.85rem] font-semibold text-stone-950">
              Lead inbox
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-stone-600">
              Keep the queue short, obvious, and easy to work one lead at a time.
            </p>
          </div>

          <Button asChild variant="secondary" size="sm">
            <Link
              href={buildLeadsHref({
                filter: activeFilter,
                status: activeStatus,
                q: inbox!.filters.q,
                page: inbox!.page,
              })}
            >
              Refresh
            </Link>
          </Button>
        </div>

        {notice ? (
          <div
            className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
            role="status"
          >
            {notice}
          </div>
        ) : null}

        <form className="flex flex-col gap-2 sm:flex-row" action="/admin/leads">
          <input type="hidden" name="filter" value={activeFilter} />
          <input type="hidden" name="status" value={activeStatus} />
          <input type="hidden" name="page" value="1" />
          <div className="flex-1">
            <label htmlFor="lead-search" className="sr-only">
              Search leads
            </label>
            <Input
              id="lead-search"
              name="q"
              defaultValue={inbox!.filters.q}
              placeholder="Search customer, phone, vehicle, or message"
              className="h-10 rounded-full"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Search
            </Button>
            {inbox!.filters.q ? (
              <Button asChild size="sm" variant="secondary">
                <Link
                  href={buildLeadsHref({
                    filter: activeFilter,
                    status: activeStatus,
                  })}
                >
                  Clear
                </Link>
              </Button>
            ) : null}
          </div>
        </form>

        <div className="flex flex-wrap gap-2">
          {statusFilters.map((status) => {
            const isActive = status.value === activeStatus;

            return (
              <Link
                key={status.value}
                href={buildLeadsHref({
                  filter: activeFilter,
                  status: status.value,
                  q: inbox!.filters.q,
                })}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                  isActive
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-white text-stone-700 hover:bg-stone-50",
                )}
              >
                <span>{status.label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    isActive ? "bg-white/15 text-white" : "bg-stone-100 text-stone-700",
                  )}
                >
                  {getStatusCount(inbox!.scopedSummary, status.value)}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => {
            const isActive = filter === activeFilter;

            return (
              <Link
                key={filter}
                href={buildLeadsHref({
                  filter,
                  status: activeStatus,
                  q: inbox!.filters.q,
                })}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                  isActive
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-white text-stone-700 hover:bg-stone-50",
                )}
              >
                <span>{humanizeLeadFilter(filter)}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    isActive ? "bg-white/15 text-white" : "bg-stone-100 text-stone-700",
                  )}
                >
                  {inbox!.typeCounts[filter]}
                </span>
              </Link>
            );
          })}
        </div>

        <p className="text-sm text-stone-600">
          {inbox!.totalItems} matching {inbox!.totalItems === 1 ? "enquiry" : "enquiries"} in{" "}
          {humanizeLeadFilter(activeFilter).toLowerCase()}.
        </p>
      </section>

      <LeadInbox items={inbox!.items} />

      <AdminListPagination
        ariaLabel="Lead inbox pages"
        basePath="/admin/leads"
        itemLabel={inbox!.totalItems === 1 ? "lead" : "leads"}
        page={inbox!.page}
        pageSize={inbox!.pageSize}
        query={{
          filter: activeFilter !== "all" ? activeFilter : undefined,
          status: activeStatus !== "all" ? activeStatus : undefined,
          q: inbox!.filters.q || undefined,
        }}
        totalItems={inbox!.totalItems}
        totalPages={inbox!.totalPages}
      />
    </div>
  );
}
