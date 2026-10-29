"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeTab, COACH_SECTIONS, visibleTabs } from "@/constants/sections";
import { cn } from "@/lib/utils";

/** Tab bar shared by the pages of one coach section (hidden when only one tab is on). */
export function SectionTabs({ section, modules }: { section: string; modules: string[] }) {
  const pathname = usePathname();
  const def = COACH_SECTIONS.find((s) => s.key === section);
  const tabs = def ? visibleTabs(def, modules) : [];
  if (tabs.length < 2) return null;
  const active = activeTab(pathname, tabs);
  return (
    <nav
      aria-label={def!.label}
      className="mb-6 flex max-w-7xl gap-1 overflow-x-auto border-b border-zinc-200 print:hidden"
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t === active ? "page" : undefined}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium",
            t === active
              ? "border-brand-700 text-brand-900"
              : "border-transparent text-zinc-500 hover:text-zinc-800",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
