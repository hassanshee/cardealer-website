"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { buildCloudinaryTransformedUrl } from "@/lib/cloudinary-images";
import { cn } from "@/lib/utils";
import type { VehicleImage } from "@/types/dealership";

type GalleryImage = VehicleImage;

const galleryCategoryMap = [
  {
    label: "Exterior",
    keywords: ["exterior", "front", "rear", "side", "outside"],
  },
  {
    label: "Interior",
    keywords: ["interior", "cabin", "inside", "rear seat", "door panel"],
  },
  {
    label: "Dashboard",
    keywords: ["dashboard", "screen", "console", "cluster", "steering"],
  },
  {
    label: "Seats",
    keywords: ["seat", "seats", "upholstery", "bench"],
  },
  {
    label: "Engine",
    keywords: ["engine", "bonnet", "hood"],
  },
  {
    label: "Documents",
    keywords: [
      "logbook",
      "document",
      "documents",
      "service book",
      "paperwork",
    ],
  },
] as const;

function normalizeGalleryImages(
  images: VehicleImage[],
  title: string,
  heroImageUrl?: string | null,
) {
  const sortedImages = [...images].sort((left, right) => {
    if (left.isHero !== right.isHero) {
      return Number(right.isHero) - Number(left.isHero);
    }

    return left.sortOrder - right.sortOrder;
  });

  const seededImages =
    heroImageUrl && !sortedImages.some((image) => image.imageUrl === heroImageUrl)
      ? [
          {
            id: `${title}-hero`,
            vehicleId: "",
            imageUrl: heroImageUrl,
            altText: `${title} hero image`,
            cloudinaryPublicId: null,
            sortOrder: -1,
            isHero: true,
            createdAt: "",
          } satisfies VehicleImage,
          ...sortedImages,
        ]
      : sortedImages;

  const seen = new Set<string>();

  return seededImages.filter((image) => {
    const key = image.cloudinaryPublicId || image.imageUrl;

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getGalleryAltText(image: GalleryImage, index: number, title: string) {
  return image.altText?.trim() || `${title} photo ${index + 1}`;
}

function getGalleryImageUrl(
  image: GalleryImage,
  variant: "hero" | "thumb" | "viewer",
) {
  if (variant === "viewer") {
    return buildCloudinaryTransformedUrl(image.imageUrl, {
      width: 2200,
    });
  }

  return buildCloudinaryTransformedUrl(image.imageUrl, {
    width: variant === "hero" ? 1600 : 360,
    height: variant === "hero" ? 1200 : 270,
    crop: "fill",
    gravity: "auto",
  });
}

function buildGalleryCategories(images: GalleryImage[], title: string) {
  const normalizedTitle = title.toLowerCase();

  return galleryCategoryMap.flatMap((category) => {
    const index = images.findIndex((image, imageIndex) => {
      const haystack = [
        getGalleryAltText(image, imageIndex, title),
        image.cloudinaryPublicId || "",
        image.imageUrl,
      ]
        .join(" ")
        .toLowerCase()
        .replace(normalizedTitle, "");

      return category.keywords.some((keyword) => haystack.includes(keyword));
    });

    return index >= 0 ? [{ label: category.label, index }] : [];
  });
}

export function VehicleGallery({
  images,
  heroImageUrl,
  title,
  compact = false,
}: {
  images: VehicleImage[];
  heroImageUrl?: string | null;
  title: string;
  compact?: boolean;
}) {
  const galleryImages = normalizeGalleryImages(images, title, heroImageUrl);
  const galleryCategories = buildGalleryCategories(galleryImages, title);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const activeImage = galleryImages[activeIndex] || galleryImages[0];
  const primaryImage = activeImage ? getGalleryImageUrl(activeImage, "hero") : null;
  const viewerImage = activeImage ? getGalleryImageUrl(activeImage, "viewer") : null;

  const showPrevious = () => {
    setActiveIndex(
      (current) => (current - 1 + galleryImages.length) % galleryImages.length,
    );
  };

  const showNext = () => {
    setActiveIndex((current) => (current + 1) % galleryImages.length);
  };

  const handleTouchStart = (clientX: number) => {
    touchStartX.current = clientX;
    didSwipe.current = false;
  };

  const handleTouchEnd = (clientX: number) => {
    if (touchStartX.current === null) {
      return;
    }

    const delta = clientX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(delta) < 40) {
      return;
    }

    didSwipe.current = true;

    if (delta > 0) {
      showPrevious();
      return;
    }

    showNext();
  };

  useEffect(() => {
    if (!isViewerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsViewerOpen(false);
      }

      if (galleryImages.length > 1 && event.key === "ArrowLeft") {
        setActiveIndex(
          (current) => (current - 1 + galleryImages.length) % galleryImages.length,
        );
      }

      if (galleryImages.length > 1 && event.key === "ArrowRight") {
        setActiveIndex((current) => (current + 1) % galleryImages.length);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [galleryImages.length, isViewerOpen]);

  if (!primaryImage) {
    return (
      <div
        className={cn(
          "rounded-[28px] border border-border bg-surface text-center shadow-[0_12px_30px_rgba(28,35,43,0.05)]",
          compact ? "p-8" : "p-10",
        )}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
          Photos coming soon
        </p>
        <h2 className="mt-4 text-3xl font-semibold text-text-primary">{title}</h2>
        <p className="mt-4 text-sm leading-7 text-text-secondary">
          We are still preparing the photo gallery for this vehicle. Contact
          sales for current photos, availability, and viewing details.
        </p>
      </div>
    );
  }

  return (
    <div className={cn(compact ? "space-y-2.5 sm:space-y-4" : "space-y-4")}>
      <div className="relative overflow-hidden rounded-[24px] border border-border bg-surface shadow-[0_12px_30px_rgba(28,35,43,0.05)] selection:bg-transparent sm:rounded-[28px]">
        <div
          className={cn(
            "relative overflow-hidden cursor-zoom-in",
            compact ? "aspect-[5/4] sm:aspect-[4/3] xl:aspect-[16/11]" : "aspect-[4/3]",
          )}
          role="button"
          tabIndex={0}
          aria-label={`Open ${title} photo ${activeIndex + 1} in full screen`}
          onClick={() => {
            if (didSwipe.current) {
              didSwipe.current = false;
              return;
            }

            setIsViewerOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setIsViewerOpen(true);
            }
          }}
          onTouchStart={(event) =>
            handleTouchStart(event.changedTouches[0]?.clientX ?? 0)
          }
          onTouchEnd={(event) =>
            handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)
          }
        >
          <Image
            src={primaryImage}
            alt={getGalleryAltText(activeImage, activeIndex, title)}
            fill
            priority
            sizes={
              compact
                ? "(min-width: 1280px) 34vw, (min-width: 1024px) 46vw, 100vw"
                : "(min-width: 1024px) 58vw, 100vw"
            }
            className="object-cover"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[rgba(17,24,33,0.35)] via-[rgba(17,24,33,0.1)] to-transparent sm:h-28" />
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 sm:inset-x-4 sm:bottom-4 sm:gap-3">
            <div className="rounded-full border border-white/60 bg-white/86 px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.06em] text-text-primary backdrop-blur-sm sm:px-3.5 sm:py-1.5 sm:text-xs sm:tracking-[0.08em]">
              {activeIndex + 1} / {galleryImages.length}
            </div>
            <button
              type="button"
              className="inline-flex items-center rounded-full border border-white/65 bg-white/86 px-3 py-1 text-[0.68rem] font-semibold tracking-[0.06em] text-text-primary shadow-[0_10px_24px_rgba(28,35,43,0.1)] backdrop-blur-sm transition-colors hover:bg-white sm:px-3.5 sm:py-1.5 sm:text-xs sm:tracking-[0.08em]"
              onClick={(event) => {
                event.stopPropagation();
                setIsViewerOpen(true);
              }}
            >
              View all photos
            </button>
            {galleryImages.length > 1 ? (
              <div className="hidden items-center gap-2 md:flex">
                <button
                  type="button"
                  className="inline-flex size-10 items-center justify-center rounded-full border border-white/65 bg-white/86 text-text-primary shadow-[0_10px_24px_rgba(28,35,43,0.1)] backdrop-blur-md transition-colors hover:bg-white"
                  aria-label="Show previous photo"
                  onClick={(event) => {
                    event.stopPropagation();
                    showPrevious();
                  }}
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex size-10 items-center justify-center rounded-full border border-white/65 bg-white/86 text-text-primary shadow-[0_10px_24px_rgba(28,35,43,0.1)] backdrop-blur-md transition-colors hover:bg-white"
                  aria-label="Show next photo"
                  onClick={(event) => {
                    event.stopPropagation();
                    showNext();
                  }}
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {galleryImages.length > 1 ? (
        <div className="space-y-3 px-0.5 pb-1 sm:px-1 sm:pb-2">
          {galleryCategories.length ? (
            <div className="hide-scrollbar flex gap-2 overflow-x-auto">
              {galleryCategories.map((category) => (
                <button
                  key={category.label}
                  type="button"
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    activeIndex === category.index
                      ? "bg-accent/10 text-accent"
                      : "bg-surface-elevated text-text-secondary hover:text-text-primary",
                  )}
                  onClick={() => setActiveIndex(category.index)}
                >
                  {category.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="hide-scrollbar flex gap-2 overflow-x-auto sm:gap-2.5">
            {galleryImages.map((image, index) => (
              <button
                key={image.id}
                type="button"
                className={cn(
                  "relative aspect-[4/3] shrink-0 overflow-hidden rounded-[12px] border-2 shadow-sm transition-all",
                  compact ? "w-24 sm:w-28 lg:w-32" : "w-28 sm:w-32",
                  activeImage?.id === image.id
                    ? "border-accent shadow-[0_10px_24px_rgba(23,58,94,0.12)]"
                    : "border-transparent hover:border-accent/50 hover:shadow-md",
                )}
                aria-label={`Show photo ${index + 1} of ${galleryImages.length}`}
                aria-pressed={activeImage?.id === image.id}
                onClick={() => setActiveIndex(index)}
              >
                <Image
                  src={getGalleryImageUrl(image, "thumb")}
                  alt={getGalleryAltText(image, index, title)}
                  fill
                  loading="lazy"
                  sizes="112px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {isViewerOpen && activeImage && viewerImage ? (
        <div
          className="fixed inset-0 z-50 bg-[rgba(17,24,33,0.94)] p-3 sm:p-5"
          onClick={() => setIsViewerOpen(false)}
        >
          <div
            className="flex h-full flex-col gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold tracking-[0.08em] text-white backdrop-blur-sm">
                {activeIndex + 1} / {galleryImages.length}
              </div>
              <button
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/15"
                aria-label="Close full screen gallery"
                onClick={() => setIsViewerOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>

            <div
              className="relative flex-1 overflow-auto rounded-[28px] bg-white/4"
              style={{ touchAction: "pan-x pan-y pinch-zoom" }}
              onTouchStart={(event) =>
                handleTouchStart(event.changedTouches[0]?.clientX ?? 0)
              }
              onTouchEnd={(event) =>
                handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)
              }
            >
              <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
                <Image
                  src={viewerImage}
                  alt={getGalleryAltText(activeImage, activeIndex, title)}
                  width={2200}
                  height={1650}
                  sizes="100vw"
                  className="h-auto max-h-full w-auto max-w-none rounded-[20px] object-contain"
                  priority
                />
              </div>

              {galleryImages.length > 1 ? (
                <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-4 md:flex">
                  <button
                    type="button"
                    className="pointer-events-auto inline-flex size-12 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/15"
                    aria-label="Show previous photo"
                    onClick={showPrevious}
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    className="pointer-events-auto inline-flex size-12 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/15"
                    aria-label="Show next photo"
                    onClick={showNext}
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </div>
              ) : null}
            </div>

            {galleryImages.length > 1 ? (
              <div className="hide-scrollbar flex gap-2.5 overflow-x-auto pb-1">
                {galleryImages.map((image, index) => (
                  <button
                    key={`${image.id}-viewer`}
                    type="button"
                    className={cn(
                      "relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-[12px] border-2 transition-all",
                      activeImage?.id === image.id
                        ? "border-accent shadow-[0_10px_24px_rgba(23,58,94,0.18)]"
                        : "border-transparent opacity-80 hover:border-white/30 hover:opacity-100",
                    )}
                    aria-label={`Show full screen photo ${index + 1}`}
                    onClick={() => setActiveIndex(index)}
                  >
                    <Image
                      src={getGalleryImageUrl(image, "thumb")}
                      alt={getGalleryAltText(image, index, title)}
                      fill
                      loading="lazy"
                      sizes="96px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
