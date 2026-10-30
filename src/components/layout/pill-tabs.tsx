import Link from "next/link";
import { cn } from "@/lib/utils";
import { NAV, TabPill } from "./page-transition";

/** Small segmented tabs for phone pages (e.g. Schedule | Games & results). */
export function PillTabs({
  tabs,
  active,
  label,
}: {
  tabs: { href: string; label: string }[];
  active: string;
  label: string;
}) {
  if (tabs.length < 2) return null;
  return (
    <nav
      aria-label={label}
      className="flex gap-1 rounded-full bg-zinc-100 p-1 ring-1 ring-zinc-200"
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href.split("?")[0] === active ? "page" : undefined}
          transitionTypes={NAV}
          className={cn(
            "relative flex-1 rounded-full px-3 py-2 text-center text-sm font-medium",
            t.href.split("?")[0] === active ? "text-zinc-900" : "text-zinc-600 hover:text-zinc-900",
          )}
        >
          {t.href.split("?")[0] === active ? (
            <TabPill
              name={`pill-tabs-${label}`.replace(/\W+/g, "-")}
              className="absolute inset-0 rounded-full bg-surface-solid shadow-sm"
            />
          ) : null}
          <span className="relative">{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
