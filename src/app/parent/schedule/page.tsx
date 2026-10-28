import type { Metadata } from "next";
import { loadChildEntries, loadChildPractices, pickChild, requireParent } from "@/lib/parent";
import { practiceRange } from "@/lib/practices";
import Link from "next/link";
import { playerToday } from "@/lib/player";
import { addDays } from "@/lib/schedule";
import { SESSION_LABELS } from "@/constants";
import type { Enums } from "@/types/database";
import type { CalendarEntry } from "@/lib/calendar";
import { ChildSwitcher, fmtDay, NoLinkedPlayer, PrivacyNote, StatusChip } from "../parent-ui";

export const metadata: Metadata = { title: "Schedule" };

const DAYS = 14;

const sessionLabel = (t: string | null) =>
  t && t in SESSION_LABELS ? SESSION_LABELS[t as Enums<"session_type">] : null;

export default async function ParentSchedulePage({ searchParams }: PageProps<"/parent/schedule">) {
  const sp = await searchParams;
  const { supabase, org, children: kids } = await requireParent();
  const child = pickChild(kids, sp.player);
  if (!child) return <NoLinkedPlayer />;

  const { today } = await playerToday();
  const to = addDays(today, DAYS - 1);
  const [{ entries }, practices] = await Promise.all([
    loadChildEntries(supabase, org.id, child.id, today, to, today),
    loadChildPractices(supabase, org.id, child.id, today, to),
  ]);
  const practicesByDate = new Map<string, typeof practices>();
  for (const p of practices) {
    if (p.date) practicesByDate.set(p.date, [...(practicesByDate.get(p.date) ?? []), p]);
  }

  const byDate = new Map<string, CalendarEntry[]>();
  for (const e of entries) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  const dates = Array.from({ length: DAYS }, (_, i) => addDays(today, i));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{child.firstName}&apos;s schedule</h1>
        <p className="text-sm text-zinc-600">Practices and workouts for the next two weeks.</p>
        <ChildSwitcher kids={kids} selected={child} basePath="/parent/schedule" />
      </div>

      {entries.length === 0 && practices.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-zinc-600 ring-1 ring-zinc-200">
          Nothing scheduled for the next two weeks. When the coach assigns {child.firstName} a
          program, the workouts show up here.
        </p>
      ) : (
        <ol className="divide-y divide-zinc-100 rounded-2xl bg-white ring-1 ring-zinc-200">
          {dates.map((d) => {
            const list = byDate.get(d) ?? [];
            const pr = practicesByDate.get(d) ?? [];
            return (
              <li key={d} className="flex gap-3 px-4 py-3">
                <div className="w-20 shrink-0">
                  <p className={d === today ? "text-sm font-semibold text-brand-800" : "text-sm"}>
                    {d === today ? "Today" : fmtDay(d).split(",")[0]}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {fmtDay(d).split(", ").slice(1).join(", ")}
                  </p>
                </div>
                {list.length === 0 && pr.length === 0 ? (
                  <p className="text-sm text-zinc-400">Rest day</p>
                ) : (
                  <ul className="min-w-0 flex-1 space-y-2">
                    {pr.map((p) => (
                      <li key={p.id} className="text-sm">
                        <Link
                          href={`/parent/practices/${p.id}`}
                          className="font-medium text-brand-800 hover:underline"
                        >
                          ⚾ {p.title}
                        </Link>
                        <p className="truncate text-xs text-zinc-500">
                          {[practiceRange(p.startTime, p.totalMin) ?? "Practice", p.location]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </li>
                    ))}
                    {list.map((e) => (
                      <li key={e.key} className="text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{e.dayName}</span>
                          <StatusChip status={e.status} />
                        </div>
                        <p className="truncate text-xs text-zinc-500">
                          {[sessionLabel(e.sessionType), e.programName].filter(Boolean).join(" · ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <PrivacyNote />
    </div>
  );
}
