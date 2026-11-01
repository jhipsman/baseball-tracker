"use client";

import Link from "next/link";
import { NavigationPending } from "./navigation-pending";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { isUnder } from "@/constants/sections";
import { cn } from "@/lib/utils";
import { NAV, TabPill } from "./page-transition";

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
  team: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  training: "M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11",
  more: "M4 7h16M4 12h16M4 17h16",
} as const;

/** The last tab: opens a sheet with everything that doesn't fit in the bar. */
export type MoreTab = { label: string; match: string[]; content: React.ReactNode };

/** Phone bottom navigation. `keepParam` carries a query param (e.g. ?player=) across tabs. */
export function TabBar({
  items,
  label,
  keepParam,
  more,
}: {
  items: TabItem[];
  label: string;
  keepParam?: string;
  more?: MoreTab;
}) {
  const pathname = usePathname();
  const kept = useSearchParams().get(keepParam ?? "");
  const withParam = (href: string) =>
    keepParam && kept ? `${href}?${keepParam}=${encodeURIComponent(kept)}` : href;
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-30 print:hidden"
    >
      <ul className="glass relative mx-auto flex max-w-md rounded-full p-1">
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
                transitionTypes={NAV}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-xs font-semibold",
                  active ? "text-brand-700" : "text-zinc-500 hover:text-zinc-900",
                )}
              >
                {active ? (
                  <TabPill
                    name={`tabbar-pill`}
                    className="absolute inset-0 rounded-full bg-zinc-900/[0.07]"
                  />
                ) : null}
                <TabIcon d={item.icon} />
                <span className="relative">{item.label}</span>
                <NavigationPending />
              </Link>
            </li>
          );
        })}
        {more ? <MoreButton more={more} pathname={pathname} /> : null}
      </ul>
    </nav>
  );
}

function TabIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="relative size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

function MoreButton({ more, pathname }: { more: MoreTab; pathname: string }) {
  const sheet = useRef<HTMLDivElement>(null);
  const active = more.match.some((p) => isUnder(pathname, p));
  // Close the sheet once a link in it has taken you somewhere.
  useEffect(() => {
    const el = sheet.current;
    if (el?.matches(":popover-open")) el.hidePopover();
  }, [pathname]);
  return (
    <li className="flex-1">
      <button
        type="button"
        popoverTarget="more-sheet"
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-full text-xs font-semibold",
          active ? "text-brand-700" : "text-zinc-500 hover:text-zinc-900",
        )}
      >
        {active ? (
          <span className="absolute inset-0 rounded-full bg-zinc-900/[0.07]" aria-hidden />
        ) : null}
        <TabIcon d={ICONS.more} />
        <span className="relative">{more.label}</span>
      </button>
      <div
        ref={sheet}
        id="more-sheet"
        popover="auto"
        aria-label={more.label}
        className="fixed inset-x-3 top-auto bottom-[calc(env(safe-area-inset-bottom)+5rem)] m-0 mx-auto max-h-[75dvh] w-auto max-w-md overflow-y-auto rounded-3xl bg-surface p-4 text-zinc-900 shadow-2xl ring-1 ring-zinc-200 backdrop:bg-zinc-950/30"
      >
        {more.content}
      </div>
    </li>
  );
}
