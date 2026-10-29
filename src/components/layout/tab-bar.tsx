"use client";

import Link from "next/link";
import { NavigationPending } from "./navigation-pending";
import { usePathname, useSearchParams } from "next/navigation";
import { isUnder } from "@/constants/sections";
import { cn } from "@/lib/utils";

export type TabItem = {
  href: string;
  label: string;
  icon: string;
  /** Other paths that count as this tab (exact href always counts). */
  match?: string[];
  /** Only active on the exact href (plus `match`), e.g. a home tab. */
  exact?: boolean;
};

export const ICONS = {
  home: "M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  schedule:
    "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 2v4M16 2v4",
  // heart with a pulse line
  health:
    "M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9zM3.5 12h4l1.5-3 3 6 1.5-3h7",
  videos: "M3 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 10l5-3v10l-5-3",
  me: "M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 21a8 8 0 0 1 16 0",
  progress: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  messages: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
} as const;

/** Phone bottom navigation. `keepParam` carries a query param (e.g. ?player=) across tabs. */
export function TabBar({
  items,
  label,
  keepParam,
}: {
  items: TabItem[];
  label: string;
  keepParam?: string;
}) {
  const pathname = usePathname();
  const kept = useSearchParams().get(keepParam ?? "");
  const withParam = (href: string) =>
    keepParam && kept ? `${href}?${keepParam}=${encodeURIComponent(kept)}` : href;
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {items.map((item) => {
          const paths = [item.href, ...(item.match ?? [])];
          const active = paths.some((p) =>
            item.exact && p === item.href ? pathname === p : isUnder(pathname, p),
          );
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={withParam(item.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  active ? "text-brand-700" : "text-zinc-500",
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={item.icon} />
                </svg>
                {item.label}
                <NavigationPending />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
