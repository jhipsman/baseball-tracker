import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "overview", label: "Overview", href: "/roster" },
  { key: "manage", label: "Members & invites", href: "/roster/manage" },
  { key: "testing", label: "Testing day", href: "/roster/testing" },
] as const;

export function RosterTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav aria-label="Roster" className="mt-4 flex gap-1 overflow-x-auto border-b border-zinc-200">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium",
            t.key === active
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
