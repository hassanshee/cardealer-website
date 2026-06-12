import { Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";

export function MobileCtaBar({
  whatsappUrl,
  phoneHref,
}: {
  whatsappUrl: string;
  phoneHref: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/96 px-0 py-2 shadow-[0_-12px_28px_rgba(28,35,43,0.08)] lg:hidden" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
      <div className="container-shell grid grid-cols-[1.8fr_1fr] gap-1.5">
        <Button
          asChild
          variant="whatsapp"
          className="h-11 w-full rounded-xl text-sm font-semibold shadow-[0_10px_24px_rgba(37,211,102,0.16)]"
        >
          <a href={whatsappUrl} target="_blank" rel="noreferrer">
            <WhatsAppIcon className="size-4" />
            WhatsApp
          </a>
        </Button>
        <Button
          asChild
          variant="secondary"
          className="h-11 w-full rounded-xl border-border/90 bg-surface text-sm font-semibold"
        >
          <a href={phoneHref}>
            <Phone className="size-4" />
            Call
          </a>
        </Button>
      </div>
    </div>
  );
}
