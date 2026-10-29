"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** While a game is live, re-fetch the page every `seconds` (and when the tab comes back). */
export function LiveRefresh({ live, seconds = 20 }: { live: boolean; seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!live) return;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [live, seconds, router]);
  return null;
}
