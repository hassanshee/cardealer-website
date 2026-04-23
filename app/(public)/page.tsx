import Image from "next/image";
import Link from "next/link";
import {
  ArrowRightLeft,
  Check,
  CircleGauge,
  Cog,
  Fuel,
  Landmark,
  MapPin,
  Star,
} from "lucide-react";

import { JsonLd } from "@/components/layout/json-ld";
import { FloatingWhatsAppButton } from "@/components/marketing/floating-whatsapp-button";
import { SectionHeading } from "@/components/marketing/section-heading";
import { TestimonialsCarousel } from "@/components/marketing/testimonials-carousel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { homeStats, siteConfig } from "@/lib/config/site";
import {
  getAllVehicles,
  getHomepageCollections,
  getReviews,
} from "@/lib/data/repository";
import { buildBreadcrumbJsonLd } from "@/lib/seo";
import {
  buildVehicleUrl,
  buildWhatsAppUrl,
  cn,
} from "@/lib/utils";
import type { Vehicle } from "@/types/dealership";

type DeliveredFallbackSeed = {
  vehicleSlug: string;
  deliveryLabel: string;
};

type DeliveredVehicleCardData = {
  id: string;
  title: string;
  year: string;
  imageUrl: string | null;
  deliveryLabel: string;
};

const deliveredFallbackSeeds: DeliveredFallbackSeed[] = [
  {
    vehicleSlug: "2013-toyota-land-cruiser-prado",
    deliveryLabel: "Recently delivered in Mombasa",
  },
  {
    vehicleSlug: "2016-mazda-cx-5",
    deliveryLabel: "Collected from the showroom",
  },
  {
    vehicleSlug: "2014-toyota-fielder",
    deliveryLabel: "Delivered after financing approval",
  },
];

function getShowcaseStockLabel(vehicle: Vehicle) {
  switch (vehicle.stockCategory) {
    case "imported":
    case "available_for_importation":
      return "Imported";
    case "used":
    case "traded_in":
      return "Local Used";
    case "new":
    default:
      return "New Arrival";
  }
}

function getShowcaseEngineLabel(vehicle: Vehicle) {
  const engine = vehicle.engineCapacity?.trim();

  if (engine) {
    return /cc|l/i.test(engine) ? engine : `${engine} Cc`;
  }

  return `${Math.max(1, Math.round(vehicle.mileage / 1000))}k km`;
}

function getShowcasePrice(value: number) {
  return `KSh ${new Intl.NumberFormat("en-KE", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)}`;
}

function getShowcaseTitle(vehicle: Vehicle) {
  const matched = vehicle.title.trim().match(/^(\d{4})\s+(.+)$/);

  if (matched) {
    return {
      year: matched[1],
      title: matched[2],
    };
  }

  return {
    year: String(vehicle.year),
    title: vehicle.title,
  };
}

function mapVehicleToDeliveredCard(
  vehicle: Vehicle,
  deliveryLabel: string,
): DeliveredVehicleCardData {
  const displayTitle = getShowcaseTitle(vehicle);

  return {
    id: vehicle.id,
    title: displayTitle.title,
    year: displayTitle.year,
    imageUrl: vehicle.heroImageUrl || vehicle.images[0]?.imageUrl || null,
    deliveryLabel,
  };
}


function DeliveredVehicleCard({
  vehicle,
}: {
  vehicle: DeliveredVehicleCardData;
}) {
  return (
    <Card className="group relative aspect-[4/5] overflow-hidden rounded-[24px] border-border bg-surface shadow-[0_12px_30px_rgba(28,35,43,0.06)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(28,35,43,0.1)] sm:aspect-[4/3] lg:aspect-[4/5] xl:aspect-[4/4]">
      {vehicle.imageUrl ? (
        <Image
          src={vehicle.imageUrl}
          alt={`Delivered ${vehicle.title}`}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
        />
      ) : (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm font-medium text-text-secondary">
          Photo coming soon
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(28,35,43,0.82)] via-[rgba(28,35,43,0.28)] to-transparent transition-opacity duration-300 group-hover:opacity-95" />

      <div className="absolute left-4 top-4 rounded-full bg-success px-3 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-white shadow-[0_8px_18px_rgba(47,125,87,0.2)]">
        Delivered
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end p-5">
        <div className="mb-3">
          <p className="mb-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-white/76">
            {vehicle.year}
          </p>
          <h3 className="text-[1.15rem] font-semibold leading-tight text-white sm:text-[1.25rem]">
            {vehicle.title}
          </h3>
        </div>
        <div className="border-t border-white/12 pt-3">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/82">
            {vehicle.deliveryLabel}
          </p>
        </div>
      </div>
    </Card>
  );
}

function HeroSearchPanel({
  inventoryMakes,
  className,
}: {
  inventoryMakes: string[];
  className?: string;
}) {
  return (
    <form
      action="/inventory"
      className={cn(
        "flex flex-col items-stretch gap-2 rounded-[1.08rem] border border-border/90 bg-surface/96 p-3 shadow-[0_12px_26px_rgba(28,35,43,0.05)] transition-[border-color,box-shadow,background-color] duration-200 focus-within:border-accent/20 focus-within:shadow-[0_16px_34px_rgba(23,58,94,0.08)] sm:rounded-[1.5rem] md:gap-0 md:bg-surface/94 md:p-1.5 md:flex-row md:items-center md:rounded-[1.6rem]",
        className,
      )}
    >
      <div className="group relative flex flex-1 items-center rounded-[0.95rem] border border-border/70 bg-surface-elevated/45 px-3.5 py-2 transition-colors hover:bg-surface-elevated sm:px-5 sm:py-2 md:rounded-[1.05rem] md:border-transparent md:bg-transparent md:px-4 md:py-1.5">
        <div className="absolute inset-y-0 left-3.5 flex items-center sm:left-5 md:left-4">
          <svg className="h-5 w-5 text-text-secondary/70 transition-colors group-hover:text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="w-full pl-8 md:pl-8 sm:pl-9">
          <label className="block text-[0.58rem] font-bold uppercase tracking-[0.16em] text-text-secondary md:text-[0.6rem]">Keyword</label>
          <input
            name="q"
            placeholder="Search make or model"
            className="mt-0.5 min-w-0 w-full border-none bg-transparent p-0 text-[0.98rem] font-medium text-text-primary outline-none placeholder:font-medium placeholder:text-text-secondary/70 focus:ring-0 md:text-sm"
          />
        </div>
      </div>

      <div className="hidden h-8 w-px bg-border md:block" />

      <div className="group relative flex flex-1 cursor-pointer items-center rounded-[0.95rem] border border-border/70 bg-surface-elevated/45 px-3.5 py-2 transition-colors hover:bg-surface-elevated sm:px-5 sm:py-2 md:rounded-[1.05rem] md:border-transparent md:bg-transparent md:px-4 md:py-1.5">
        <div className="w-full pr-6">
          <label className="block text-[0.58rem] font-bold uppercase tracking-[0.16em] text-text-secondary md:text-[0.6rem]">Make</label>
          <select
            name="make"
            className="mt-0.5 w-full cursor-pointer appearance-none border-none bg-transparent p-0 text-[0.98rem] font-medium text-text-primary outline-none focus:ring-0 md:text-sm"
            defaultValue=""
          >
            <option value="">Any Make</option>
            {inventoryMakes.map((make) => (
              <option key={make} value={make}>
                {make}
              </option>
            ))}
          </select>
        </div>
        <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none sm:right-5 md:right-4">
          <svg className="h-4 w-4 text-text-secondary/70 transition-colors group-hover:text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <div className="hidden h-8 w-px bg-border md:block" />

      <div className="group relative flex flex-1 cursor-pointer items-center rounded-[0.95rem] border border-border/70 bg-surface-elevated/45 px-3.5 py-2 transition-colors hover:bg-surface-elevated sm:px-5 sm:py-2 md:rounded-[1.05rem] md:border-transparent md:bg-transparent md:px-4 md:py-1.5">
        <div className="w-full pr-6">
          <label className="block text-[0.58rem] font-bold uppercase tracking-[0.16em] text-text-secondary md:text-[0.6rem]">Condition</label>
          <select
            name="category"
            className="mt-0.5 w-full cursor-pointer appearance-none border-none bg-transparent p-0 text-[0.98rem] font-medium text-text-primary outline-none focus:ring-0 md:text-sm"
            defaultValue=""
          >
            <option value="">Any Condition</option>
            <option value="used">Local Used</option>
            <option value="new">Brand New</option>
            <option value="imported">Direct Import</option>
            <option value="traded-in">Traded-in</option>
          </select>
        </div>
        <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none sm:right-5 md:right-4">
          <svg className="h-4 w-4 text-text-secondary/70 transition-colors group-hover:text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <div className="w-full md:mt-0 md:w-auto md:px-0 md:pb-0">
        <Button
          type="submit"
          className="h-10 w-full rounded-[0.95rem] border-[#2C4F73] bg-[#2C4F73] px-4.5 text-[0.95rem] font-semibold text-white shadow-[0_8px_18px_rgba(44,79,115,0.1)] hover:border-[#254667] hover:bg-[#254667] md:h-10 md:w-auto md:min-w-[9.5rem] md:rounded-[1.05rem] md:border-accent md:bg-accent md:px-5 md:text-sm md:shadow-[0_10px_24px_rgba(23,58,94,0.16)]"
        >
          View Matches
        </Button>
      </div>
    </form>
  );
}

function HeroTrustRow({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-[0.95rem] border border-border/80 bg-surface/76 px-3 py-[0.85rem] text-[0.74rem] font-medium text-text-secondary shadow-[0_8px_18px_rgba(28,35,43,0.04)] sm:gap-x-3 sm:gap-y-2 sm:rounded-[1.1rem] sm:px-4 sm:py-2 sm:text-[0.72rem] md:justify-start",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <Star className="size-3.5 fill-[#fbbf24] text-[#fbbf24]" />
        4.8 Google Rating
      </span>
      <span className="hidden h-3.5 w-px bg-border sm:block" />
      <span className="inline-flex items-center gap-1.5">
        <Check className="size-3.5 text-accent" />
        Price and mileage shown upfront
      </span>
      <span className="hidden h-3.5 w-px bg-border sm:block" />
      <span className="inline-flex items-center gap-1.5">
        <MapPin className="size-3.5 text-accent" />
        Available in Mombasa
      </span>
    </div>
  );
}

export default async function Home() {
  const [collections, reviews, vehicles] = await Promise.all([
    getHomepageCollections(),
    getReviews(),
    getAllVehicles(),
  ]);

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([{ name: "Home", path: "/" }]);
  const homepageWhatsAppUrl = buildWhatsAppUrl(
    "Hi, I am ready to buy a car. Please share your best available options, prices, and the fastest next step on WhatsApp.",
    siteConfig.whatsappNumber,
  );
  const featuredShowcaseVehicles = [
    ...collections.featured,
    ...collections.latest,
  ].filter(
    (vehicle, index, vehicles) =>
      vehicles.findIndex((item) => item.id === vehicle.id) === index,
  );

  const deliveredShowcaseVehicles = collections.sold.length
    ? collections.sold
      .slice(0, 3)
      .map((vehicle) =>
        mapVehicleToDeliveredCard(vehicle, "Recently delivered in Mombasa"),
      )
    : deliveredFallbackSeeds
      .map((item) => {
        const matchedVehicle = vehicles.find(
          (vehicle) => vehicle.slug === item.vehicleSlug,
        );

        return matchedVehicle
          ? mapVehicleToDeliveredCard(matchedVehicle, item.deliveryLabel)
          : null;
      })
      .filter(
        (vehicle): vehicle is DeliveredVehicleCardData => vehicle !== null,
      );
  const publishedVehicles = vehicles.filter((vehicle) => vehicle.status === "published");
  const publishedVehicleCount = publishedVehicles.length;
  const inventoryMakes = Array.from(
    new Set(publishedVehicles.map((vehicle) => vehicle.make).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />

      <main className="homepage-flow">
        <section className="relative flex min-h-[19rem] w-full flex-col justify-center overflow-hidden pb-10 pt-4 md:min-h-[29rem] md:pb-5 md:pt-12 lg:min-h-[31rem] lg:pb-6 lg:pt-16">
          <div className="absolute inset-0 z-0">
            <Image
              src="https://res.cloudinary.com/dlyrnhpcn/image/upload/v1776860439/ChatGPT_Image_Apr_22_2026_03_17_49_PM_tplsjn.png"
              alt="Vehicles available at Ocean Motors in Mombasa"
              fill
              priority
              quality={75}
              className="object-cover object-[88%_5%] scale-[1.14] brightness-[0.93] contrast-[1.14] saturate-[0.98] md:object-[77%_33%] md:scale-100 lg:object-[79%_31%]"
              sizes="100vw"
            />
            <div className="absolute inset-0 z-10 bg-[linear-gradient(90deg,rgba(255,255,255,0.94)_0%,rgba(255,255,255,0.8)_40%,rgba(255,255,255,0.2)_70%,rgba(255,255,255,0)_100%)] md:bg-[linear-gradient(94deg,rgba(246,247,248,0.97)_4%,rgba(246,247,248,0.92)_22%,rgba(246,247,248,0.68)_45%,rgba(246,247,248,0.18)_69%,rgba(246,247,248,0.05)_100%)]" />
            <div className="absolute inset-0 z-10 bg-[linear-gradient(90deg,rgba(0,0,0,0)_54%,rgba(28,35,43,0.1)_76%,rgba(28,35,43,0.22)_100%)]" />
            <div className="absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(246,247,248,0.03)_0%,rgba(246,247,248,0.01)_46%,rgba(246,247,248,0.08)_100%)]" />
            <div className="absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(246,247,248,0)_0%,rgba(246,247,248,0)_72%,rgba(246,247,248,0.12)_88%,rgba(246,247,248,0.24)_100%)]" />
          </div>

          <div className="container-shell relative z-20 flex w-full flex-col px-1">
            <div className="max-w-3xl space-y-3 text-center animate-in fade-in zoom-in-95 slide-in-from-bottom-10 duration-1000 sm:space-y-4 md:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent/80">
                Available inventory
              </p>

              <h1 className="max-w-[18ch] text-balance text-[1.95rem] font-semibold leading-[0.96] tracking-[-0.03em] text-text-primary sm:text-[2.2rem] md:max-w-[17ch] md:text-[2.45rem] lg:text-[2.75rem]">
                Browse cars with price, mileage,
                <span className="block text-[0.9em] text-accent">
                  and condition shown upfront
                </span>
              </h1>

              <p className="mx-auto hidden max-w-[32rem] text-base leading-7 text-text-secondary md:mx-0 md:block md:max-w-[34rem] md:text-[1rem]">
                Review inspected stock online first, then visit our Mombasa showroom or message sales only when a car is worth viewing.
              </p>

              <div className="flex flex-col items-center justify-center gap-3 pt-1 sm:flex-row sm:pt-1.5 md:justify-start">
                <Button asChild className="group h-12 px-6 text-white hover:text-white">
                  <Link href="/inventory" className="flex items-center gap-2">
                    Browse Available Cars
                    <svg className="h-4 w-4 text-white transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </Button>
              </div>

            </div>
            <div className="relative mt-4 hidden w-full max-w-4xl animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-150 md:mx-0 md:mt-5 md:block lg:mt-5">
              <HeroSearchPanel inventoryMakes={inventoryMakes} />
              <HeroTrustRow className="mt-2.5" />
            </div>

          </div>
        </section>

        <div className="relative z-30 -mt-6 md:hidden">
          <div className="container-shell px-1">
            <HeroSearchPanel
              inventoryMakes={inventoryMakes}
              className="bg-surface shadow-[0_22px_42px_rgba(28,35,43,0.1)]"
            />
            <HeroTrustRow className="mt-1.5 justify-start" />
          </div>
        </div>

        <section className="section-shell pt-4 md:pt-16">
          <div className="container-shell space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-3">
                <SectionHeading
                  eyebrow="Inventory"
                  title={
                    collections.featured.length
                      ? "Compare available cars before you enquire"
                      : "Available vehicles to compare"
                  }
                  description="Open a listing for the gallery, specs, and next step before you speak to sales."
                />
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-accent/15 bg-accent/7 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-accent">
                    {publishedVehicleCount} live listings
                  </span>
                  <span className="rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                    Photos, price, and specs shown
                  </span>
                </div>
              </div>
              <Button asChild variant="secondary">
                <Link href="/inventory">Review Full Inventory</Link>
              </Button>
            </div>

            {featuredShowcaseVehicles.length ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
                {featuredShowcaseVehicles.slice(0, 8).map((vehicle) => {
                  const primaryImage =
                    vehicle.heroImageUrl || vehicle.images[0]?.imageUrl || null;
                  const detailsUrl = buildVehicleUrl(vehicle);
                  const whatsappUrl = buildWhatsAppUrl(
                    `Hi, I am ready to move on the ${vehicle.title}. Please confirm availability, best price, and the next step to reserve it.`,
                    siteConfig.whatsappNumber,
                  );
                  const displayTitle = getShowcaseTitle(vehicle);

                  return (
                    <article
                      key={vehicle.id}
                      className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-border bg-surface shadow-[0_12px_30px_rgba(28,35,43,0.05)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(28,35,43,0.08)]"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-surface-elevated">
                        {primaryImage ? (
                          <Image
                            src={primaryImage}
                            alt={vehicle.title}
                            fill
                            sizes="(min-width: 1280px) 353px, (min-width: 768px) 50vw, 100vw"
                            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center px-6 text-center text-sm font-medium text-text-secondary">
                            Gallery coming soon
                          </div>
                        )}

                        <div className="absolute left-4 top-4">
                          <span className="rounded-full border border-border/80 bg-surface/92 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-text-primary shadow-sm">
                            {getShowcaseStockLabel(vehicle)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col p-5 sm:p-6">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[0.75rem] font-bold uppercase tracking-[0.18em] text-text-secondary">
                              {displayTitle.year}
                            </p>
                            <h3 className="mt-1 line-clamp-2 text-lg font-semibold leading-tight text-text-primary sm:text-xl">
                              {displayTitle.title}
                            </h3>
                          </div>
                          <p className="shrink-0 text-right text-lg font-black text-accent sm:text-xl">
                            {getShowcasePrice(vehicle.price)}
                          </p>
                        </div>

                        <div className="mb-6 grid grid-cols-3 gap-2 border-t border-border/70 pt-5 text-sm font-medium text-text-secondary">
                          <div className="flex flex-col items-center gap-1.5 text-center">
                            <CircleGauge className="size-4 text-text-secondary/70" />
                            <span className="w-full truncate text-[0.75rem] leading-tight">{getShowcaseEngineLabel(vehicle)}</span>
                          </div>
                          <div className="flex flex-col items-center gap-1.5 border-l border-border/70 text-center">
                            <Cog className="size-4 text-text-secondary/70" />
                            <span className="w-full truncate text-[0.75rem] leading-tight">{vehicle.transmission}</span>
                          </div>
                          <div className="flex flex-col items-center gap-1.5 border-l border-border/70 text-center">
                            <Fuel className="size-4 text-text-secondary/70" />
                            <span className="w-full truncate text-[0.75rem] leading-tight">{vehicle.fuelType}</span>
                          </div>
                        </div>

                        <div className="mt-auto grid grid-cols-[1fr_auto] gap-2">
                          <Button asChild className="h-11 rounded-xl text-[0.85rem]">
                            <Link href={detailsUrl}>View Details</Link>
                          </Button>
                          <Button asChild variant="secondary" size="sm" className="size-11 rounded-xl px-0">
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Get price on WhatsApp for ${vehicle.title}`}
                            >
                              <WhatsAppIcon className="size-5 text-[#25D366]" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>

        <section className="section-shell">
          <div className="container-shell grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16 xl:gap-20">
            <div className="max-w-[420px]">
              <SectionHeading
                eyebrow="Delivered units"
                title="Cars already handed over to buyers"
                description={`Recent handovers plus ${homeStats.deliveredCount}+ deliveries show the stock and buying process are real.`}
              />
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {deliveredShowcaseVehicles.map((vehicle) => (
                <DeliveredVehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
          </div>
        </section>

        <section className="section-shell bg-surface/40">
          <div className="container-shell space-y-8">
            <SectionHeading
              eyebrow="Testimonials"
              title="What buyers say after viewing or enquiring"
              description="The pattern is consistent: accurate photos, fast confirmation, and a straightforward viewing process."
            />
            <TestimonialsCarousel reviews={reviews} />
            <div className="hidden gap-5 md:grid md:grid-cols-2 xl:grid-cols-3">
              {reviews.map((review) => (
                <Card key={review.id} className="rounded-[28px] p-6">
                  <p className="text-lg leading-8 text-text-secondary">&quot;{review.quote}&quot;</p>
                  <p className="mt-6 font-semibold text-text-primary">
                    {review.customerName}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {review.vehicleLabel}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="section-shell bg-surface/40">
          <div className="container-shell grid gap-6 lg:grid-cols-2">
            <Card className="group flex h-full flex-col justify-between rounded-[32px] p-8 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(28,35,43,0.08)] sm:p-10">
              <div className="flex flex-1 flex-col">
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-[20px] bg-accent/8 text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-white">
                  <Landmark className="size-7" />
                </div>
                <div>
                  <h3 className="mb-3 text-2xl font-semibold tracking-tight text-text-primary sm:text-[1.75rem]">
                    Vehicle Financing Available
                  </h3>
                  <p className="max-w-[85%] text-[0.95rem] leading-relaxed text-text-secondary">
                    Ask about deposit options, monthly payment plans, and the next steps before you commit to a vehicle.
                  </p>
                </div>
              </div>
              <div className="mt-10 pt-2">
                <Button asChild variant="secondary" className="h-12 rounded-xl px-6 text-[0.9rem] font-semibold">
                  <Link href="/financing">Ask About Financing</Link>
                </Button>
              </div>
            </Card>

            <Card className="group flex h-full flex-col justify-between rounded-[32px] p-8 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(28,35,43,0.08)] sm:p-10">
              <div className="flex flex-1 flex-col">
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-[20px] bg-accent/8 text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-white">
                  <ArrowRightLeft className="size-7" />
                </div>
                <div>
                  <h3 className="mb-3 text-2xl font-semibold tracking-tight text-text-primary sm:text-[1.75rem]">
                    Trade In Your Car
                  </h3>
                  <p className="max-w-[85%] text-[0.95rem] leading-relaxed text-text-secondary">
                    Upgrade seamlessly. Get a fair valuation on your current vehicle to put towards your next purchase.
                  </p>
                </div>
              </div>
              <div className="mt-10 pt-2">
                <Button asChild variant="secondary" className="h-12 rounded-xl px-6 text-[0.9rem] font-semibold">
                  <Link href="/trade-in">Value Your Trade</Link>
                </Button>
              </div>
            </Card>
          </div>
        </section>

        <section className="section-shell">
          <div className="container-shell">
            <Card className="rounded-[34px] bg-surface-elevated px-7 py-8 sm:px-8 sm:py-9">
              <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
                    Next step
                  </p>
                  <h2 className="mt-4 max-w-[14ch] text-balance text-4xl font-semibold tracking-tight text-text-primary">
                    See the cars first, then ask the right question.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary">
                    Browse the listings to narrow your shortlist. If one stands out, ask on WhatsApp for availability, a walk-around, or the fastest route to viewing.
                  </p>
                </div>
                <div className="flex flex-col items-start gap-3">
                  <Button asChild>
                    <Link href="/inventory">Browse Inventory</Link>
                  </Button>
                  <a
                    href={homepageWhatsAppUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
                  >
                    <WhatsAppIcon className="size-4 text-[#25D366]" />
                    Ask on WhatsApp after you shortlist a car
                  </a>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </main>

      <FloatingWhatsAppButton
        whatsappUrl={homepageWhatsAppUrl}
        label="Get Price on WhatsApp"
      />
    </>
  );
}
