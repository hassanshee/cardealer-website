import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base text-text-primary outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-text-secondary/70 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/15 sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}
