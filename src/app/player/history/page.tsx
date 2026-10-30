import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveOrg } from "@/lib/org";
import { formatSets } from "@/lib/sets-format";
import { formatGameDate } from "@/lib/games";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "History" };

const STATUS = {
  completed: { label: "Completed", className: "bg-brand-50 text-brand-900" },
  partial: { label: "Partial", className: "bg-amber-50 text-amber-800" },
  skipped: { label: "Skipped", className: "bg-zinc-100 text-zinc-600" },
} as const;

export default async function HistoryPage() {
  const { supabase, user } = await requireActiveOrg();

  const { data: logs, error } = await supabase
    .from("workout_logs")
    .select(
      `id, date_completed, status, overall_rpe, duration_minutes, day_name, program_day_id,
       program_assignment_id,
       assignment:program_assignments (program:programs (name)),
       exercise_logs (sort_order, sets_completed, exercise:exercises (name, tracking_type))`,
    )
    .eq("player_id", user.id)
    .order("date_completed", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const completedCount = logs.filter((l) => l.status === "completed").length;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/player/profile" className="text-sm font-medium text-zinc-500">
          ← Me
        </Link>
        <h1 className="mt-1 text-2xl font-medium tracking-tight sm:text-3xl">History</h1>
        <p className="text-sm text-zinc-500">
          {logs.length} workout{logs.length === 1 ? "" : "s"} logged · {completedCount} completed
        </p>
      </div>

      {logs.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-center text-sm text-zinc-500 ring-1 ring-zinc-200">
          Workouts you log will show up here. Start one from the Today tab.
        </p>
      ) : (
        <ul className="space-y-2">
          {logs.map((l) => {
            const sets = l.exercise_logs.flatMap((e) =>
              Array.isArray(e.sets_completed) ? (e.sets_completed as { done?: boolean }[]) : [],
            );
            const doneSets = sets.filter((s) => s.done !== false).length;
            const lines = l.exercise_logs
              .toSorted((a, b) => a.sort_order - b.sort_order)
              .map((e) => ({
                name: e.exercise?.name ?? "Exercise",
                text: formatSets(e.sets_completed, e.exercise?.tracking_type),
              }))
              .filter((e) => e.text);
            const shown = lines.slice(0, 4);
            const body = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.day_name || "Workout"}</p>
                    <p className="truncate text-xs text-zinc-500">{l.assignment.program.name}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                      STATUS[l.status].className,
                    )}
                  >
                    {STATUS[l.status].label}
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-500 tabular-nums">
                  {formatGameDate(l.date_completed)}
                  {l.status !== "skipped" ? ` · ${doneSets} sets` : ""}
                  {l.duration_minutes != null ? ` · ${l.duration_minutes} min` : ""}
                  {l.overall_rpe != null ? ` · RPE ${l.overall_rpe}` : ""}
                </p>
                {shown.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 text-sm">
                    {shown.map((e, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="min-w-0 truncate text-zinc-700">{e.name}</span>
                        <span className="ml-auto shrink-0 text-zinc-500 tabular-nums">
                          {e.text}
                        </span>
                      </li>
                    ))}
                    {lines.length > shown.length ? (
                      <li className="text-xs text-zinc-400">+{lines.length - shown.length} more</li>
                    ) : null}
                  </ul>
                ) : null}
              </>
            );
            return (
              <li key={l.id}>
                {l.program_day_id ? (
                  <Link
                    href={`/player/log/${l.program_assignment_id}/${l.program_day_id}`}
                    className="block rounded-xl bg-surface p-4 ring-1 ring-zinc-200 active:bg-zinc-50"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="rounded-xl bg-surface p-4 ring-1 ring-zinc-200">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
