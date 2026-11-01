"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isUnder } from "@/constants/sections";
import { cn } from "@/lib/utils";
import { ICONS, TabBar, type TabItem } from "./tab-bar";

export type CoachNavItem = { key: string; href: string; label: string; match: string[] };

const ICON_FOR: Record<string, string> = {
  dashboard: ICONS.home,
  schedule: ICONS.schedule,
  team: ICONS.team,
  health: ICONS.health,
  messages: ICONS.messages,
  training: ICONS.training,
  videos: ICONS.videos,
  settings: ICONS.me,
};
/** Which sections earn a spot in the phone bar, in order; the rest go under More. */
const PRIMARY = ["dashboard", "schedule", "team", "health", "messages", "training", "videos"];
const SHORT: Record<string, string> = { dashboard: "Home", health: "Health" };

/** Phone navigation for coaches: four tabs plus More (the sidebar covers larger screens). */
export function CoachNav({ items, extras }: { items: CoachNavItem[]; extras: React.ReactNode }) {
  const pathname = usePathname();
  const ordered = PRIMARY.flatMap((k) => items.filter((i) => i.key === k));
  const primary = ordered.slice(0, 4);
  const rest = items.filter((i) => !primary.includes(i));
  const tabs: TabItem[] = primary.map((i) => ({
    href: i.href,
    label: SHORT[i.key] ?? i.label,
    icon: ICON_FOR[i.key] ?? ICONS.home,
    match: i.match,
    exact: i.href === "/",
  }));
  return (
    <div className="md:hidden" data-app-nav>
      <TabBar
        items={tabs}
        label="Coach"
        more={{
          label: "More",
          match: rest.flatMap((i) => i.match),
          content: (
            <div className="space-y-4">
              <ul className="grid grid-cols-2 gap-2">
                {rest.map((i) => {
                  const active = i.match.some((h) => isUnder(pathname, h));
                  return (
                    <li key={i.key}>
                      <Link
                        href={i.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-14 items-center gap-3 rounded-2xl px-4 text-sm font-semibold ring-1",
                          active
                            ? "bg-brand-50 text-brand-800 ring-brand-200"
                            : "bg-zinc-50 text-zinc-800 ring-zinc-200",
                        )}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="size-5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d={ICON_FOR[i.key] ?? ICONS.more} />
                        </svg>
                        {i.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {extras}
            </div>
          ),
        }}
      />
    </div>
  );
}
