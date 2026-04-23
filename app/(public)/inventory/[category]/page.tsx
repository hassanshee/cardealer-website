import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/layout/json-ld";
import { InventoryFilterBar } from "@/components/inventory/inventory-filter-bar";
import { VehicleCard } from "@/components/inventory/vehicle-card";
import { SectionHeading } from "@/components/marketing/section-heading";
import {
  buildBreadcrumbJsonLd,
  buildItemListJsonLd,
  buildMetadata,
} from "@/lib/seo";
import { listInventory } from "@/lib/data/repository";
import { parseInventoryQuery } from "@/lib/validation/inventory";

const categoryMap = {
  new: {
    title: "New Cars",
    description:
      "Showroom-ready stock with cleaner presentation and financing follow-up.",
  },
  used: {
    title: "Used Cars",
    description:
      "Used inventory organised for quick comparison, enquiries, and viewing bookings.",
  },
  imported: {
    title: "Imported Units",
    description:
      "Imported and available-for-importation vehicles grouped into one buyer-friendly path.",
  },
  "traded-in": {
    title: "Traded-in Cars",
    description:
      "Trade-in stock positioned for buyers focused on value and practicality.",
  },
} as const;

type Category = keyof typeof categoryMap;

function isCategory(value: string): value is Category {
  return value in categoryMap;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;

  if (!isCategory(category)) {
    return buildMetadata({
      title: "Inventory",
      description: "Inventory category",
      path: "/inventory",
      noIndex: true,
    });
  }

  return buildMetadata({
    title: categoryMap[category].title,
    description: categoryMap[category].description,
    path: `/inventory/${category}`,
  });
}

export default async function InventoryCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { category } = await params;

  if (!isCategory(category)) {
    notFound();
  }

  const query = parseInventoryQuery(await searchParams);
  const result = await listInventory({
    ...query,
    category,
  });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Inventory", path: "/inventory" },
    { name: categoryMap[category].title, path: `/inventory/${category}` },
  ]);
  const itemListJsonLd = buildItemListJsonLd(
    result.items,
    categoryMap[category].title,
  );

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={itemListJsonLd} />
      <section className="section-shell">
        <div className="container-shell space-y-6 sm:space-y-10">
          <SectionHeading
            as="h1"
            eyebrow="Category inventory"
            title={categoryMap[category].title}
            description={categoryMap[category].description}
          />
          <InventoryFilterBar
            actionPath={`/inventory/${category}`}
            query={{ ...query, category }}
            facets={result.facets}
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {result.items.length ? (
              result.items.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))
            ) : (
              <div className="rounded-[28px] border border-dashed border-border bg-surface/75 p-8 text-text-secondary lg:col-span-3">
                No vehicles are currently available in this category with the chosen
                filters.
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
