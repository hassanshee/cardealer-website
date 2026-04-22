"use client";

import { Share2 } from "lucide-react";

type Props = {
    title: string;
    price: string;
};

export function ShareButton({ title, price }: Props) {
    const handleShare = async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title,
                    text: `${title} — ${price}`,
                    url: window.location.href,
                });
            } else {
                await navigator.clipboard.writeText(window.location.href);
            }
        } catch (err) {
            console.error("Share failed:", err);
        }
    };

    return (
        <button
            type="button"
            onClick={handleShare}
            aria-label="Share vehicle"
            className="rounded-md p-2 hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
            <Share2 className="size-[1rem]" />
        </button>
    );
}