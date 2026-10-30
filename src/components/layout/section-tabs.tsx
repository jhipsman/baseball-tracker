"use client";

import Link from "next/link";
import { NavigationPending } from "./navigation-pending";
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
      aria-label={def!.label}
      className="relative mr-auto! mb-6 ml-0! flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-surface p-1 ring-1 ring-zinc-200 print:hidden"
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t === active ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
            t === active
              ? "bg-zinc-100 text-zinc-950 ring-1 ring-zinc-200"
              : "text-zinc-500 hover:text-zinc-900",
          )}
        >
          {t.label}
          <NavigationPending />
        </Link>
      ))}
    </nav>
  );
}
