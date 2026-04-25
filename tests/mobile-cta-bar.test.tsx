import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MobileCtaBar } from "@/components/inventory/mobile-cta-bar";

describe("MobileCtaBar", () => {
  it("renders WhatsApp first and Call second", () => {
    render(
      <MobileCtaBar
        whatsappUrl="https://wa.me/254700000000?text=Hello"
        phoneHref="tel:+254700000000"
      />,
    );

    const links = screen.getAllByRole("link");

    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("WhatsApp");
    expect(links[1]).toHaveTextContent("Call");
  });
});
