import Link from "next/link";
import type { Child } from "@/lib/parent";
import { cn } from "@/lib/utils";
import { hasModule, type ModuleKey } from "@/constants/modules";
import { PillTabs } from "@/components/layout/pill-tabs";

/** Pill links to switch between linked players (only when there's more than one). */
export function ChildSwitcher({
  kids,
  selected,
  basePath,
}: {
  kids: Child[];
  selected: Child;
  basePath: string;
}) {
  if (kids.length < 2) return null;
  return (
    <nav aria-label="Choose player" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {kids.map((c) => {
        const on = c.id === selected.id;
        return (
          <Link
            key={c.id}
            href={`${basePath}?player=${c.id}`}
            aria-current={on ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset",
              on ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-700 ring-zinc-300",
            )}
          >
            {c.firstName}
          </Link>
        );
      })}
    </nav>
  );
}

export function Card({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PrivacyNote() {
  return (
    <p className="px-1 pt-2 text-center text-xs text-zinc-500">
      🔒 Parents see their own player only. Teammates&apos; workouts, videos, and numbers stay
      private.
    </p>
  );
}

export function NoLinkedPlayer() {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-zinc-200">
        <p className="text-3xl" aria-hidden>
          ⚾
        </p>
        <h1 className="mt-2 text-lg font-semibold">No player linked yet</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Your account isn&apos;t connected to a player on this team right now. Ask the coach (or
          your player) to send you a new parent invite.
        </p>
      </div>
      <PrivacyNote />
    </div>
  );
}

export const fmtDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export const withPlayer = (href: string, kids: Child[], child: Child) =>
  kids.length > 1 ? `${href}?player=${child.id}` : href;

const STATUS_CHIP = {
  completed: { label: "✓ Done", className: "bg-brand-50 text-brand-900" },
  partial: { label: "◐ Partly done", className: "bg-amber-50 text-amber-900" },
  skipped: { label: "Skipped", className: "bg-zinc-100 text-zinc-600" },
  missed: { label: "Missed", className: "bg-zinc-100 text-zinc-700" },
  today: { label: "Today", className: "bg-sky-50 text-sky-900" },
  upcoming: { label: "Planned", className: "bg-white text-zinc-600 ring-1 ring-zinc-200" },
} as const;

export function StatusChip({ status }: { status: keyof typeof STATUS_CHIP }) {
  const s = STATUS_CHIP[status];
  return (
    <span
      className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", s.className)}
    >
      {s.label}
    </span>
  );
}

/** Sub-tabs inside the parent's Schedule and Progress tabs (keeps ?player=). */
export function ParentSectionTabs({
  section,
  active,
  modules,
  kids,
  child,
}: {
  section: "schedule" | "progress";
  active: string;
  modules: string[];
  kids: Child[];
  child: Child;
}) {
  const on = (key: ModuleKey) => hasModule(modules, key);
  const tabs =
    section === "schedule"
      ? [
          { href: "/parent/schedule", label: "Next 2 weeks" },
          ...(on("games") ? [{ href: "/parent/games", label: "Games & results" }] : []),
        ]
      : [
          ...(on("games") ? [{ href: "/parent/stats", label: "Stats" }] : []),
          ...(on("videos") ? [{ href: "/parent/videos", label: "Videos" }] : []),
        ];
  return (
    <PillTabs
      label={section === "schedule" ? "Schedule" : "Progress"}
      active={active}
      tabs={tabs.map((t) => ({ ...t, href: withPlayer(t.href, kids, child) }))}
    />
  );
}
