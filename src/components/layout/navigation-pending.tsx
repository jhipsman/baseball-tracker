"use client";

import { useLinkStatus } from "next/link";

/** Feedback for a click while a route's prefetched shell is still unavailable. */
export function NavigationPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <>
      <span role="status" className="sr-only">
        Opening page…
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 bg-brand-600 motion-safe:animate-pulse"
      />
    </>
  );
}
