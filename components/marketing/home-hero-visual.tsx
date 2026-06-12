"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export type HeroMobileItem = {
  title: string;
  year: string;
  priceLabel: string;
  detailsUrl: string;
  stockLabel: string;
};

const zoneTwoClipPath = "polygon(24% 0, 100% 0, 100% 100%, 0 100%)";
const zoneTwoBorderPath = "M 24 0 H 100 V 100 H 0 Z";

export function HomeHeroVisual({
  mobileItem,
  backgroundImages,
}: {
  mobileItem: HeroMobileItem | null;
  backgroundImages: string[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const rotatingImages = backgroundImages;
  const activeBackgroundImage = rotatingImages.length
    ? rotatingImages[activeIndex % rotatingImages.length]
    : null;

  useEffect(() => {
    setIsHydrated(true);

    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncMediaState = () => {
      setIsDesktop(desktopQuery.matches);
      setPrefersReducedMotion(reducedMotionQuery.matches);
    };

    syncMediaState();

    desktopQuery.addEventListener("change", syncMediaState);
    reducedMotionQuery.addEventListener("change", syncMediaState);

    return () => {
      desktopQuery.removeEventListener("change", syncMediaState);
      reducedMotionQuery.removeEventListener("change", syncMediaState);
    };
  }, []);

  useEffect(() => {
    if (!isDesktop || prefersReducedMotion || rotatingImages.length <= 1) {
      return;
    }

    const rotation = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % rotatingImages.length);
    }, 5000);

    return () => window.clearInterval(rotation);
  }, [isDesktop, prefersReducedMotion, rotatingImages.length]);

  return (
    <div className="relative mx-auto w-full max-w-[780px]">
      <div className="relative min-h-[320px] sm:min-h-[370px] lg:min-h-[500px]">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 overflow-hidden bg-[linear-gradient(135deg,rgba(229,222,213,0.98),rgba(205,196,184,0.9))] shadow-[0_24px_48px_rgba(61,39,14,0.14)]"
            style={{ clipPath: zoneTwoClipPath }}
          >
            {activeBackgroundImage ? (
              <Image
                key={activeBackgroundImage}
                src={activeBackgroundImage}
                alt={`Ocean Motors hero background ${activeIndex + 1}`}
                fill
                priority={activeIndex === 0}
                sizes="(min-width: 1280px) 560px, (min-width: 1024px) 44vw, 100vw"
                className={`object-cover object-center transition-transform duration-[5000ms] ${
                  isDesktop && !prefersReducedMotion ? "scale-[1.03]" : "scale-100"
                }`}
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_32%,rgba(255,255,255,0.4),transparent_22%),linear-gradient(125deg,rgba(230,223,214,0.95),rgba(193,183,170,0.92))]" />
            )}

            <div className="absolute inset-0 bg-[linear-gradient(92deg,rgba(242,235,227,0.78)_0%,rgba(242,235,227,0.26)_25%,rgba(15,12,10,0.42)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_28%,rgba(255,255,255,0.26),transparent_28%),radial-gradient(circle_at_82%_78%,rgba(255,255,255,0.14),transparent_22%),linear-gradient(135deg,rgba(255,255,255,0.14),transparent_44%,rgba(255,255,255,0.04)_72%,transparent_100%)]" />
          </div>

          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <path
              d={zoneTwoBorderPath}
              fill="none"
              stroke="rgba(41, 37, 36, 0.34)"
              strokeWidth="0.7"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {rotatingImages.length > 1 ? (
            <div className="absolute bottom-5 right-4 z-20 hidden items-center gap-2 lg:flex">
              {rotatingImages.map((imageUrl) => {
                const isActive = activeBackgroundImage === imageUrl;

                return (
                  <span
                    key={imageUrl}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      isActive ? "w-7 bg-white/92" : "w-2.5 bg-white/40"
                    }`}
                  />
                );
              })}
            </div>
          ) : null}
        </div>

      </div>

      {mobileItem ? (
        <Link
          href={mobileItem.detailsUrl}
          className="mt-4 flex items-center justify-between gap-3 rounded-[24px] border border-white/75 bg-white/92 px-4 py-3 shadow-[0_14px_28px_rgba(61,39,14,0.08)] backdrop-blur lg:hidden"
        >
          <div className="min-w-0">
            <p className="text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-primary">
              {mobileItem.stockLabel}
            </p>
            <h3 className="mt-1 text-sm font-semibold leading-tight text-stone-950">
              {mobileItem.year} {mobileItem.title}
            </h3>
          </div>
          <p className="shrink-0 text-sm font-bold text-stone-900">
            {mobileItem.priceLabel}
          </p>
        </Link>
      ) : null}
    </div>
  );
}
