import { ARM_FEEL, PITCH_TYPES, THROW_TYPE_LABEL } from "@/constants/throwing";
import { deleteThrowing, setBirthDate } from "@/lib/throwing-actions";
import type { ThrowingRow } from "@/lib/throwing";
import type { Alert, Availability } from "@/lib/workload";
import { cn } from "@/lib/utils";

const fmt = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** Pitch Smart availability: icon + label, never color alone. */
export function AvailabilityBadge({ a, size = "sm" }: { a: Availability; size?: "sm" | "lg" }) {
  const big = size === "lg";
  if (a.state === "unknown_age") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-zinc-100 font-medium text-zinc-600",
          big ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs",
        )}
      >
        ? Age needed
      </span>
    );
  }
  if (a.state === "resting") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 font-medium text-amber-900",
          big ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs",
        )}
      >
        ⏸ Rest until {fmt(a.until)}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-brand-100 font-medium text-brand-900",
        big ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs",
      )}
    >
      ✓ Available{a.pitchesToday > 0 ? ` · ${a.remainingToday} left today` : ` · max ${a.dailyMax}`}
    </span>
  );
}

const ALERT_STYLE = {
  critical: { icon: "⛔", className: "bg-red-50 text-red-900 ring-red-200", label: "Critical" },
  warning: { icon: "⚠", className: "bg-amber-50 text-amber-950 ring-amber-200", label: "Warning" },
  info: { icon: "ℹ", className: "bg-zinc-50 text-zinc-700 ring-zinc-200", label: "Info" },
} as const;

export function AlertList({ alerts, who }: { alerts: Alert[]; who?: string }) {
  if (alerts.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {alerts.map((a, i) => (
        <li
          key={i}
          className={cn(
            "flex gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-inset",
            ALERT_STYLE[a.level].className,
          )}
        >
          <span aria-hidden>{ALERT_STYLE[a.level].icon}</span>
          <span>
            <span className="sr-only">{ALERT_STYLE[a.level].label}: </span>
            {who ? <strong>{who}: </strong> : null}
            {a.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ArmFeelChip({ feel }: { feel: ThrowingRow["armFeel"] }) {
  if (!feel) return null;
  const f = ARM_FEEL[feel];
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", f.className)}>
      {f.label}
    </span>
  );
}

export function ThrowingList({
  rows,
  canDelete,
}: {
  rows: ThrowingRow[];
  canDelete: (r: ThrowingRow) => boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl bg-white p-4 text-sm text-zinc-500 ring-1 ring-zinc-200">
        No throwing logged yet.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-zinc-100 rounded-xl bg-white ring-1 ring-zinc-200">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
          <span className="w-24 shrink-0 text-zinc-500 tabular-nums">{fmt(r.date)}</span>
          <span className="font-medium">{THROW_TYPE_LABEL[r.type]}</span>
          {r.type !== "check_in" ? (
            <span className="text-zinc-600 tabular-nums">
              {r.pitches}{" "}
              {r.type === "long_toss" || r.type === "flat_ground" ? "throws" : "pitches"}
              {r.maxDistance ? ` · ${r.maxDistance} ft` : ""}
              {r.intensity ? ` · ${r.intensity.replace("_", " ")}` : ""}
            </span>
          ) : null}
          <ArmFeelChip feel={r.armFeel} />
          {r.pitchesByType ? (
            <span className="text-xs text-zinc-500">
              {PITCH_TYPES.filter((p) => r.pitchesByType?.[p.key])
                .map((p) => `${p.label} ${r.pitchesByType![p.key]}`)
                .join(" · ")}
            </span>
          ) : null}
          {r.notes ? (
            <span className="w-full text-xs text-zinc-500 italic">“{r.notes}”</span>
          ) : null}
          {canDelete(r) ? (
            <form action={deleteThrowing} className="ml-auto">
              <input type="hidden" name="id" value={r.id} />
              <button
                type="submit"
                className="text-xs font-semibold text-zinc-400 hover:text-red-600"
              >
                Delete
              </button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function BirthDateForm({
  playerId,
  current,
  label,
}: {
  playerId?: string;
  current: string | null;
  label: string;
}) {
  return (
    <form action={setBirthDate} key={current ?? "none"} className="flex flex-wrap items-end gap-2">
      {playerId ? <input type="hidden" name="player_id" value={playerId} /> : null}
      <label className="text-sm font-medium text-zinc-800">
        {label}
        <input
          type="date"
          name="birth_date"
          defaultValue={current ?? ""}
          required
          className="mt-1 block h-10 rounded-lg border-0 bg-white px-3 ring-1 ring-inset ring-zinc-300"
        />
      </label>
      <button
        type="submit"
        className="h-10 rounded-lg bg-zinc-900 px-3 text-sm font-semibold text-white"
      >
        Save
      </button>
    </form>
  );
}
