"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const TZ_COOKIE = "dp_tz";

/** Stores the browser's time zone in a cookie so the server knows the player's "today". */
export function TimezoneSync({ current }: { current?: string }) {
  const router = useRouter();
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== current) {
      document.cookie = `${TZ_COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [current, router]);
  return null;
}
