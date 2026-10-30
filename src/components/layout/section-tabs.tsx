"use client";

import Link from "next/link";
import { NavigationPending } from "./navigation-pending";
import { NAV, TabPill } from "./page-transition";
import { usePathname } from "next/navigation";
import { activeTab, COACH_SECTIONS, visibleTabs } from "@/constants/sections";
import { cn } from "@/lib/utils";

/** Tab bar shared by the pages of one coach section (hidden when only one tab is on). */
export function SectionTabs({
  section,
  modules,
  isAdmin = false,
}: {
  section: string;
  modules: string[];
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const def = COACH_SECTIONS.find((s) => s.key === section);
  const tabs = def ? visibleTabs(def, modules, isAdmin) : [];
  if (tabs.length < 2) return null;
  const active = activeTab(pathname, tabs);
  return (
    <nav
      data-section-tabs
      aria-label={def!.label}
      className="relative mr-auto! mb-6 ml-0! flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-surface p-1 ring-1 ring-zinc-200 print:hidden"
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t === active ? "page" : undefined}
          transitionTypes={NAV}
          className={cn(
            "relative shrink-0 rounded-full px-4 py-2 text-sm font-medium",
            t === active ? "text-zinc-950" : "text-zinc-500 hover:text-zinc-900",
          )}
        >
          {t === active ? (
            <TabPill
              name="section-pill"
              className="absolute inset-0 rounded-full bg-zinc-100 ring-1 ring-zinc-200"
            />
          ) : null}
          <span className="relative">{t.label}</span>
          <NavigationPending />
        </Link>
      ))}
    </nav>
  );
}
