"use client";

import { useEffect, useState } from "react";

export function MobileOnly({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);

    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, []);

  // Return null during hydration to prevent mismatch
  // Once hydrated, conditionally render based on actual media query
  if (isMobile === null) {
    return null;
  }

  return isMobile ? <>{children}</> : null;
}
