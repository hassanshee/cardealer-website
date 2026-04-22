import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/layout/json-ld";
import { VehicleEnquiryForm } from "@/components/forms/vehicle-enquiry-form";
import { MobileCtaBar } from "@/components/inventory/mobile-cta-bar";
import { SpecGrid } from "@/components/inventory/spec-grid";
import { VehicleCard } from "@/components/inventory/vehicle-card";
import { VehicleGallery } from "@/components/inventory/vehicle-gallery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { siteConfig } from "@/lib/config/site";
import {
  getSimilarVehicles,
  getVehicleBySlug,
} from "@/lib/data/repository";
import {
  buildBreadcrumbJsonLd,
  buildMetadata,
  buildVehicleJsonLd,
} from "@/lib/seo";
import {
  buildWhatsAppUrl,
  formatCurrency,
  formatMileage,
  humanizeStockCategory,
} from "@/lib/utils";

/* -------------------------
   Helper builders (kept mostly as-is)
   ------------------------- */

function buildSummarySpecs(
  vehicle: NonNullable<Awaited<ReturnType<typeof getVehicleBySlug>>>,
) {
  return [
    {
      label: "Mileage",
      value: vehicle.mileage > 0 ? formatMileage(vehicle.mileage) : "On request",
    },
    {
      label: "Transmission",
      value: vehicle.transmission,
    },
    {
      label: "Fuel",
      value: vehicle.fuelType,
    },
  ];
}

function buildBuyerSummary(
  vehicle: NonNullable<Awaited<ReturnType<typeof getVehicleBySlug>>>,
  photoCount: number,
) {
  return [
    vehicle.condition
      ? `Presented as ${vehicle.condition}.`
      : "Condition details are available on request.",
    photoCount
      ? `${photoCount} photo${photoCount === 1 ? "" : "s"} included so you can review the car before speaking to sales.`
      : "Fresh photos can be shared directly on WhatsApp while the gallery is being updated.",
    `Available for viewing at ${vehicle.location?.name || "our Mombasa showroom"}.`,
    vehicle.negotiable
      ? "There is room for a serious offer after viewing."
      : "Ask sales for the best next step on price or payment.",
    `Quote ref ${vehicle.stockCode} when you call or message for faster help.`,
  ];
}

function buildOverviewHighlights(
  vehicle: NonNullable<Awaited<ReturnType<typeof getVehicleBySlug>>>,
) {
  return [
    vehicle.bodyType
      ? `${vehicle.bodyType} comfort with ${vehicle.transmission === "Automatic"
        ? "easy automatic driving"
        : `${vehicle.transmission.toLowerCase()} control`
      }.`
      : `${vehicle.transmission === "Automatic"
        ? "Easy automatic driving"
        : `${vehicle.transmission} drive`
      } with ${vehicle.fuelType.toLowerCase()} power.`,
    vehicle.engineCapacity
      ? `Strong ${vehicle.engineCapacity} power for confident town driving and longer trips.`
      : `${vehicle.fuelType} power for buyers who want an easy everyday drive.`,
    vehicle.mileage > 0 ? `Shown at ${formatMileage(vehicle.mileage)} on the listing.` : null,
    vehicle.condition ? `Presented as ${vehicle.condition}.` : null,
    `Available for viewing at ${vehicle.location?.name || "our Mombasa showroom"}.`,
  ].filter((value): value is string => Boolean(value));
}

function buildDetailBadges(
  vehicle: NonNullable<Awaited<ReturnType<typeof getVehicleBySlug>>>,
) {
  const stockLabel = (() => {
    switch (vehicle.stockCategory) {
      case "available_for_importation":
        return "Ready to import";
      case "traded_in":
        return "Trade-in offer";
      default:
        return humanizeStockCategory(vehicle.stockCategory);
    }
  })();

  return [
    vehicle.featured
      ? {
        label: "Featured",
        variant: "default" as const,
        className: "",
      }
      : null,
    vehicle.negotiable
      ? {
        label: "Negotiable",
        variant: "muted" as const,
        className: "",
      }
      : null,
    {
      label: stockLabel,
      variant: "muted" as const,
      className: "",
    },
  ].filter(
    (
      value,
    ): value is {
      label: string;
      variant: "default" | "muted";
      className: string;
    } => Boolean(value),
  );
}

/* -------------------------
   Metadata generation (unchanged)
   ------------------------- */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);

  if (!vehicle) {
    return buildMetadata({
      title: "Vehicle not found",
      description: "The requested vehicle is not available.",
      path: `/cars/${slug}`,
      noIndex: true,
    });
  }

  return buildMetadata({
    title: `${vehicle.year} ${vehicle.make} ${vehicle.model} for Sale in ${vehicle.location?.city || "Mombasa"
      }`,
    description: vehicle.description,
    path: `/cars/${vehicle.slug}`,
    image: vehicle.heroImageUrl,
  });
}

/* -------------------------
   Page component - improved UX & structure
   ------------------------- */

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);

  if (!vehicle) {
    notFound();
  }

  const similarVehicles = await getSimilarVehicles(vehicle, 3);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Inventory", path: "/inventory" },
    { name: vehicle.title, path: `/cars/${vehicle.slug}` },
  ]);
  const vehicleJsonLd = buildVehicleJsonLd(vehicle);
  const whatsappUrl = buildWhatsAppUrl(
    `Hi, is ${vehicle.title} still available?`,
    siteConfig.whatsappNumber,
  );
  const photoCount = vehicle.images.length || (vehicle.heroImageUrl ? 1 : 0);
  const summarySpecs = buildSummarySpecs(vehicle);
  const buyerSummary = buildBuyerSummary(vehicle, photoCount);
  const buyerHighlights = buyerSummary.slice(0, 4);
  const overviewHighlights = buildOverviewHighlights(vehicle);
  const detailBadges = buildDetailBadges(vehicle);
  const baseVehiclePath = `/cars/${vehicle.slug}`;

  // quick destructure for cleaner markup
  const {
    title,
    id,
    heroImageUrl,
    images,
    description,
    stockCode,
    location,
    price,
  } = vehicle;

  return (
    <>
      {/* JSON-LD for SEO */}
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={vehicleJsonLd} />

      <main className="section-shell pb-24">
        <div className="container-shell space-y-8">
          {/* Visible breadcrumb */}
          <nav aria-label="Breadcrumb" className="text-sm">
            <ol className="flex flex-wrap items-center gap-2 text-text-secondary">
              <li>
                <Link href="/" className="hover:text-accent">Home</Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/inventory" className="hover:text-accent">Inventory</Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-text-primary font-semibold">{title}</li>
            </ol>
          </nav>

          {/* Top area: gallery + sticky aside */}
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <article className="min-w-0">
              <VehicleGallery
                key={id}
                images={images}
                heroImageUrl={heroImageUrl}
                title={title}
              />

              {/* Title + quick facts */}
              <header className="mt-5">
                <h1 className="text-[2rem] font-semibold leading-tight tracking-tight text-text-primary break-words sm:text-[2.35rem] lg:text-[2.6rem]">
                  {title}
                </h1>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-[0.9rem] text-text-secondary">
                  <div className="inline-flex items-center gap-2 rounded-full bg-surface-elevated px-3 py-1.5">
                    <MapPin className="size-[1.05rem] text-text-secondary/70" aria-hidden />
                    <span>{location?.name || "Mombasa showroom"}</span>
                  </div>

                  <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.14em]">
                    Ref {stockCode}
                  </span>
                </div>

                {/* Key facts (quick scannable row) */}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {summarySpecs.map((spec) => (
                    <div key={spec.label} className="flex-shrink-0 rounded-md border border-border/80 bg-[#FBFCFD] px-3 py-2">
                      <p className="text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                        {spec.label}
                      </p>
                      <p className="mt-1 text-[0.95rem] font-bold text-text-primary">{spec.value}</p>
                    </div>
                  ))}
                </div>
              </header>

              {/* Description & full specs */}
              <section id="description" className="mt-8 space-y-6">
                <Card className="rounded-[24px] p-6">
                  <h2 className="text-lg font-semibold text-text-primary">Overview</h2>
                  <p className="mt-3 text-sm leading-7 text-text-secondary">
                    {description || "No description provided. Contact sales for more details."}
                  </p>

                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-text-primary">Full specification</h3>
                    <div className="mt-3">
                      <SpecGrid vehicle={vehicle} />
                    </div>
                  </div>
                </Card>
              </section>
            </article>

            {/* Aside - price + CTAs + highlights (sticky on desktop) */}
            <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
              <Card className="rounded-[24px] p-6 lg:p-7">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.75rem] font-bold uppercase tracking-[0.14em] text-text-secondary">Price</p>
                    <div className="mt-1">
                      <p className="text-[clamp(1.6rem,6vw,2.6rem)] font-extrabold leading-tight text-accent">
                        {formatCurrency(price)}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-text-secondary">Contact us for the best available offer and finance options.</p>
                  </div>
                </div>

                {/* CTAs */}
                <div className="mt-6 grid gap-3">
                  <Button
                    asChild
                    variant="whatsapp"
                    size="lg"
                    className="h-12 w-full rounded-2xl text-base font-bold"
                    aria-label={`Message about ${title} on WhatsApp`}
                  >
                    <a href={whatsappUrl} target="_blank" rel="noreferrer">
                      <WhatsAppIcon className="mr-2 size-[1.05rem]" aria-hidden />
                      Message on WhatsApp
                    </a>
                  </Button>

                  <Button
                    asChild
                    variant="secondary"
                    className="h-12 w-full rounded-2xl text-base font-semibold"
                    aria-label={`Call about ${title}`}
                  >
                    <a href={siteConfig.phoneHref}>
                      <Phone className="mr-2 size-[1rem]" aria-hidden />
                      Call About This Car
                    </a>
                  </Button>

                  <div className="mt-1 flex flex-wrap items-center justify-center gap-3 px-2 text-[0.875rem] font-medium text-text-secondary">
                    <Link
                      href={`${baseVehiclePath}?intent=viewing#contact-panel`}
                      className="transition-colors hover:text-accent"
                      aria-label="Book a visit or test drive"
                    >
                      Book a Visit / Test Drive
                    </Link>

                    <span className="hidden h-1 w-1 rounded-full bg-border md:inline-block" />

                    <Link
                      href={`${baseVehiclePath}?intent=financing#contact-panel`}
                      className="transition-colors hover:text-accent"
                      aria-label="See payment options"
                    >
                      See Payment Options
                    </Link>

                    <span className="hidden h-1 w-1 rounded-full bg-border md:inline-block" />

                    <Link
                      href={`/trade-in?vehicle=${vehicle.slug}`}
                      className="transition-colors hover:text-accent"
                      aria-label="Value your trade-in"
                    >
                      Value Your Trade
                    </Link>
                  </div>
                </div>

                {/* Badges & quick buyer highlights */}
                <div className="mt-6 border-t border-border/80 pt-5">
                  <div className="flex flex-wrap gap-2">
                    {detailBadges.map((badge) => (
                      <Badge key={badge.label} variant={badge.variant} className={badge.className}>
                        {badge.label}
                      </Badge>
                    ))}
                  </div>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Why buyers move quickly</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">
                    {buyerHighlights.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-1 inline-flex size-2 shrink-0 rounded-full bg-accent/70" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>

              {/* Enquiry form (small) - keep visible on desktop */}
              <div id="contact-panel" className="mt-6">
                <VehicleEnquiryForm
                  vehicleId={id}
                  vehicleTitle={title}
                  source="Vehicle detail page"
                  phoneHref={siteConfig.phoneHref}
                  phoneDisplay={siteConfig.phoneDisplay}
                  whatsappUrl={whatsappUrl}
                />
              </div>
            </aside>
          </div>

          {/* More detail: Why this one stands out + similar */}
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <section>
              <Card className="rounded-[24px] p-6">
                <h2 className="text-lg font-semibold text-text-primary">Why this one stands out</h2>
                <ul className="mt-4 space-y-2.5 text-sm leading-7 text-text-secondary">
                  {overviewHighlights.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 inline-flex size-2 shrink-0 rounded-full bg-border" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <p className="pt-4 text-sm font-medium text-text-primary">
                  Mention ref <span className="font-bold">{stockCode}</span> when you call or message and sales will move faster.
                </p>
              </Card>

              {/* Similar vehicles */}
              {similarVehicles.length ? (
                <div className="mt-6 space-y-5">
                  <h3 className="text-xl font-semibold text-text-primary">Similar vehicles</h3>
                  <div className="mt-3 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {similarVehicles.map((item) => (
                      <VehicleCard key={item.id} vehicle={item} />
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            {/* Small contact CTA card on the right for desktop */}
            <aside className="min-w-0">
              <Card className="rounded-[24px] p-6">
                <h4 className="text-sm font-semibold text-text-primary">Need help?</h4>
                <p className="mt-2 text-sm text-text-secondary">Talk to our sales team for availability, finance options, or to request more photos.</p>

                <div className="mt-4 grid gap-3">
                  <Button asChild variant="whatsapp" className="h-12 rounded-2xl" size="md">
                    <a href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="Message on WhatsApp">
                      <WhatsAppIcon className="mr-2 size-[1rem]" aria-hidden />
                      Message
                    </a>
                  </Button>
                  <Button asChild variant="secondary" className="h-12 rounded-2xl" size="md">
                    <a href={siteConfig.phoneHref} aria-label="Call sales">
                      <Phone className="mr-2 size-[1rem]" aria-hidden />
                      Call
                    </a>
                  </Button>
                </div>
              </Card>
            </aside>
          </div>
        </div>
      </main>

      <MobileCtaBar whatsappUrl={whatsappUrl} phoneHref={siteConfig.phoneHref} />
    </>
  );
} 