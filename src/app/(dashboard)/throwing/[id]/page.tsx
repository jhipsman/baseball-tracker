import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { formatGameDate } from "@/lib/games";
import { addDays } from "@/lib/schedule";
import { loadHealth } from "@/lib/health-data";
import { ageOn, dailySeries, pitchSmartBand } from "@/lib/workload";
import { ARM_FEEL } from "@/constants/throwing";
import { ThrowsChart } from "@/components/throwing/throws-chart";
import { ThrowLogForm } from "@/components/throwing/throw-log-form";
import { BirthDateForm, ThrowingList } from "@/components/throwing/status";
import { HandleAlert } from "@/components/health/alert-actions";
import { PlanChecklist, StatusEditor } from "@/components/health/status-editor";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Player Health" };

const HEADLINE = {
  out: { icon: "⛔", word: "Out", tone: "bg-red-50 text-red-900 ring-red-200" },
  limited: { icon: "◐", word: "Limited", tone: "bg-orange-50 text-orange-950 ring-orange-300" },
  attention: { icon: "⚠", word: "Needs a look", tone: "bg-amber-50 text-amber-950 ring-amber-200" },
  resting: { icon: "⏸", word: "Can't pitch today", tone: "bg-sky-50 text-sky-900 ring-sky-200" },
  ready: { icon: "✓", word: "Ready", tone: "bg-brand-50 text-brand-900 ring-brand-200" },
} as const;

export default async function PlayerHealthPage({ params }: PageProps<"/throwing/[id]">) {
  const { id } = await params;
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/player/throwing");
  const { today } = await playerToday();

  const { data: member } = await supabase
    .from("org_memberships")
    .select("profile_id, role, position, jersey_number, profile:profiles (full_name, email)")
    .eq("org_id", org.id)
    .eq("profile_id", id)
    .maybeSingle();
  if (!member || member.role !== "player") notFound();
  const name = member.profile.full_name || member.profile.email;

  const { health, rows, births } = await loadHealth(supabase, org.id, [{ id, name }], today);
  const h = health[0];
  const mine = rows.filter((r) => r.playerId === id);
  const birth = births.get(id) ?? null;
  const age = birth ? ageOn(birth, today) : null;
  const head = HEADLINE[h.lane];
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((d) => ({
    date: d,
    feel: mine.find((r) => r.date === d && r.armFeel)?.armFeel ?? null,
  }));

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/throwing" className="text-sm font-medium text-brand-700 hover:underline">
          ← Player Health
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
            {member.jersey_number != null ? (
              <span className="mr-2 text-zinc-400">#{member.jersey_number}</span>
            ) : null}
            {name}
          </h1>
          <span className="text-sm text-zinc-500">
            {[member.position, age != null ? `age ${age}` : null].filter(Boolean).join(" · ")}
          </span>
          <Link href={`/roster/${id}`} className="text-sm font-medium text-brand-700">
            Full profile →
          </Link>
        </div>
      </div>

      <section
        aria-label="Today"
        className={cn("rounded-2xl p-4 ring-1 sm:p-5", head.tone)}
        data-testid="health-headline"
      >
        <p className="flex items-center gap-2 text-xl font-semibold">
          <span aria-hidden>{head.icon}</span>
          {head.word}
        </p>
        <p className="mt-1">{h.detail}</p>
        {h.lane !== "resting" && h.avail.state === "resting" ? (
          <p className="mt-1 text-sm">⏸ Pitch Smart rest until {formatGameDate(h.avail.until)}</p>
        ) : null}
        <div className="mt-4">
          <p className="text-xs font-semibold tracking-wide uppercase opacity-80">
            Arm, last 7 days
          </p>
          <ol className="mt-2 grid grid-cols-7 gap-1">
            {week.map((d) => (
              <li key={d.date} className="text-center">
                <span className="block text-[11px] opacity-80">
                  {new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-US", {
                    weekday: "narrow",
                    timeZone: "UTC",
                  })}
                </span>
                <span
                  className={cn(
                    "mt-1 block truncate rounded-md px-0.5 py-1 text-[11px] font-semibold",
                    d.feel ? ARM_FEEL[d.feel].className : "bg-surface text-zinc-400",
                  )}
                  title={d.feel ? ARM_FEEL[d.feel].label : "No check-in"}
                >
                  {d.feel ? ARM_FEEL[d.feel].label : "—"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {h.open.length || h.handled.length ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Alerts</h2>
          <ul className="space-y-2">
            {h.open.map((a) => (
              <li
                key={a.key}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ring-1",
                  a.level === "critical"
                    ? "bg-red-50 text-red-900 ring-red-200"
                    : "bg-amber-50 text-amber-950 ring-amber-200",
                )}
              >
                <span>
                  {a.level === "critical" ? "⛔ " : "⚠ "}
                  {a.message}
                </span>
                <HandleAlert playerId={id} alertKey={a.key} />
              </li>
            ))}
          </ul>
          {h.handled.length ? (
            <details className="rounded-xl bg-surface px-3 py-2 ring-1 ring-zinc-200">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-zinc-700">
                Handled ({h.handled.length})
              </summary>
              <ul className="space-y-2 pb-2">
                {h.handled.map((a) => (
                  <li
                    key={a.key}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-600"
                  >
                    <span>✓ {a.message}</span>
                    <HandleAlert playerId={id} alertKey={a.key} handled />
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 sm:p-5">
          <h2 className="text-lg font-semibold">Status</h2>
          <StatusEditor playerId={id} current={h.status} />
        </section>
        {h.status.plan.length ? (
          <section className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 sm:p-5">
            <h2 className="text-lg font-semibold">Return to throw</h2>
            <PlanChecklist playerId={id} plan={h.status.plan} />
          </section>
        ) : (
          <section className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 sm:p-5">
            <h2 className="text-lg font-semibold">Log for {name.split(" ")[0]}</h2>
            <ThrowLogForm players={[{ id, name }]} defaultType="bullpen" />
          </section>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Throwing, last 4 weeks</h2>
        <div className="rounded-2xl bg-surface p-4 ring-1 ring-zinc-200">
          <ThrowsChart
            days={dailySeries(mine, addDays(today, -27), today)}
            dailyMax={age != null ? pitchSmartBand(age).dailyMax : null}
          />
        </div>
        <ThrowingList rows={mine.slice(0, 10)} canDelete={() => true} />
        {h.status.plan.length ? (
          <details className="rounded-2xl bg-surface p-4 ring-1 ring-zinc-200">
            <summary className="cursor-pointer text-sm font-semibold">
              Log for {name.split(" ")[0]}
            </summary>
            <div className="mt-3">
              <ThrowLogForm players={[{ id, name }]} defaultType="bullpen" />
            </div>
          </details>
        ) : null}
        <details className="rounded-2xl bg-surface p-4 ring-1 ring-zinc-200" open={!birth}>
          <summary className="cursor-pointer text-sm font-semibold">
            Birthdate {birth ? "" : "· needed for Pitch Smart limits"}
          </summary>
          <div className="mt-3">
            <BirthDateForm playerId={id} current={birth} label="Birthdate" />
          </div>
        </details>
      </section>
    </div>
  );
}
