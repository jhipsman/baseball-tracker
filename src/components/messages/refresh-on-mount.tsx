"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-renders once after mount. Used when a page marked things read while the
 * layout (bell / messages dot) was rendering in parallel with stale counts.
 */
export function RefreshOnMount() {
  const router = useRouter();
  useEffect(() => {
    router.refresh();
  }, [router]);
  return null;
}
