"use client";

import { cn } from "@/lib/utils";

interface OnlineIndicatorProps {
  online: boolean;
  className?: string;
  /** Size variant. default = 3 (12px) */
  size?: "sm" | "md";
}

/**
 * Green dot overlay on an avatar when the user is online.
 * Hidden when offline — no ugly hollow circle.
 * Position with `relative` on the parent.
 */
export function OnlineIndicator({
  online,
  className,
  size = "md",
}: OnlineIndicatorProps) {
  if (!online) return null;

  return (
    <span
      className={cn(
        "absolute bottom-0 right-0 block rounded-full ring-2 ring-background bg-emerald-500",
        size === "sm" ? "size-2.5" : "size-3.5",
        className,
      )}
      aria-label="Online"
    />
  );
}
