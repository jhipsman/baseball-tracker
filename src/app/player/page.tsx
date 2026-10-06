import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveOrg } from "@/lib/org";
import {
  loadPlayerAssignments,
  playerToday,
  type PlayerAssignment,
  type PlayerDay,
} from "@/lib/player";
import { DAY_OF_WEEK_LABELS, SESSION_LABELS } from "@/constants";
import { dayOfWeek } from "@/lib/schedule";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Today" };

const STATUS_CHIP = {
  completed: { label: "Done", className: "bg-brand-700 text-white" },
  partial: { label: "Partial", className: "bg-amber-400 text-amber-950" },
  skipped: { label: "Skipped", className: "bg-zinc-300 text-zinc-700" },
} as const;

export default async function PlayerTodayPage({ searchParams }: PageProps<"/player">) {
  const { supabase, user, org } = await requireActiveOrg();
  const { today } = await playerToday();
  const { saved } = await searchParams;
  const assignments = await loadPlayerAssignments(supabase, user.id, org.id, today);

  const firstName = (user.user_metadata?.full_name as string | undefined)?.split(" ")[0];
  const dateLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500">{dateLabel}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstName ? `Let's go, ${firstName}` : "Today"}
        </h1>
      </div>

      {saved ? (
        <p
          role="status"
          className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-900"
        >
          {saved === "skipped" ? "Workout marked as skipped." : "Workout saved. Nice work!"}
        </p>
      ) : null}

      {assignments.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-zinc-200">
          <p className="font-medium">No program assigned yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            When your coach assigns you a program, today&apos;s workout shows up here.
          </p>
        </div>
      ) : (
        assignments.map((a) => <AssignmentCard key={a.id} assignment={a} today={today} />)
      )}
    </div>
  );
}

function AssignmentCard({ assignment: a, today }: { assignment: PlayerAssignment; today: string }) {
  const s = a.schedule;
  const allDays = a.weeks.flatMap((w) => w.days);
  const findDay = (id: string | null) => allDays.find((d) => d.id === id);
  const logHref = (day: PlayerDay) => `/player/log/${a.id}/${day.id}`;

  let hero: React.ReactNode;
  if (s.state === "upcoming") {
    hero = (
      <HeroMessage
        title={`Starts in ${s.startsInDays} day${s.startsInDays === 1 ? "" : "s"}`}
        body={`First workout on ${a.startDate}.`}
      />
    );
  } else if (s.state === "finished") {
    hero = (
      <HeroMessage
        title="Program complete"
        body="Great work. Your coach will assign what's next."
      />
    );
  } else {
    const todayDay = findDay(s.todayDayId);
    if (todayDay) {
      hero = (
        <TodayWorkout
          day={todayDay}
          href={logHref(todayDay)}
          week={s.weekIndex + 1}
          totalWeeks={a.weeks.length}
        />
      );
    } else if (s.weekComplete) {
      hero = <HeroMessage title="Week complete 🎉" body="Every workout this week is logged." />;
    } else {
      hero = <HeroMessage title="Rest day" body="Nothing scheduled today. Recover well." />;
    }
  }

  const catchUp = s.state === "active" ? findDay(s.catchUpDayId) : undefined;
  const week = s.state === "active" ? a.weeks[s.weekIndex] : undefined;
  const todayDow = dayOfWeek(today);

  return (
    <section className="space-y-3" aria-label={a.programName}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="truncate text-sm font-semibold text-zinc-700">{a.programName}</h2>
        {s.state === "active" ? (
          <span className="shrink-0 text-xs text-zinc-500">
            Week {s.weekIndex + 1} of {a.weeks.length}
            {week?.label ? ` · ${week.label}` : ""}
          </span>
        ) : null}
      </div>

      {hero}

      {catchUp ? (
        <Link
          href={logHref(catchUp)}
          className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3 text-sm ring-1 ring-amber-200"
        >
          <span>
            Missed <strong>{catchUp.name}</strong>? Log it now.
          </span>
          <span aria-hidden>→</span>
        </Link>
      ) : null}

      {week ? (
        <ol className="grid grid-cols-1 gap-2">
          {week.days.map((d) => {
            const chip = d.log ? STATUS_CHIP[d.log.status] : null;
            const isToday = s.state === "active" && d.id === s.todayDayId;
            return (
              <li key={d.id}>
                <Link
                  href={logHref(d)}
                  className={cn(
                    "flex min-h-14 items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1",
                    isToday ? "ring-2 ring-brand-600" : "ring-zinc-200",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{d.name}</span>
                    <span className="block text-xs text-zinc-500">
                      {SESSION_LABELS[d.sessionType]} · {d.exerciseCount} exercise
                      {d.exerciseCount === 1 ? "" : "s"}
                      {d.dayOfWeek != null
                        ? ` · ${DAY_OF_WEEK_LABELS[d.dayOfWeek]}${d.dayOfWeek === todayDow ? " (today)" : ""}`
                        : ""}
                    </span>
                  </span>
                  {chip ? (
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        chip.className,
                      )}
                    >
                      {chip.label}
                    </span>
                  ) : (
                    <span aria-hidden className="text-zinc-400">
                      →
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

function TodayWorkout({
  day,
  href,
  week,
  totalWeeks,
}: {
  day: PlayerDay;
  href: string;
  week: number;
  totalWeeks: number;
}) {
  return (
    <div className="rounded-2xl bg-zinc-900 p-5 text-white">
      <p className="text-xs font-semibold tracking-wide text-brand-100 uppercase">
        Today · Week {week}/{totalWeeks}
      </p>
      <h3 className="mt-1 text-2xl font-semibold">{day.name}</h3>
      <p className="mt-1 text-sm text-zinc-300">
        {SESSION_LABELS[day.sessionType]} · {day.exerciseCount} exercise
        {day.exerciseCount === 1 ? "" : "s"}
      </p>
      <Link
        href={href}
        className="mt-4 flex h-14 items-center justify-center rounded-xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600"
      >
        {day.log ? "View / edit log" : "Start workout"}
      </Link>
    </div>
  );
}

function HeroMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-zinc-600">{body}</p>
    </div>
  );
}
