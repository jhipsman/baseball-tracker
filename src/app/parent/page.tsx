import type { Metadata } from "next";
import Link from "next/link";
import { loadChildEntries, loadChildPractices, pickChild, requireParent } from "@/lib/parent";
import { hasModule, type ModuleKey } from "@/constants/modules";
import { NextPracticeCard } from "@/components/practice/next-practice-card";
import { loadNextGame, loadPlayerGroupIds } from "@/lib/games";
import { NextGameCard } from "@/components/games/game-ui";
import { playerToday } from "@/lib/player";
import { addDays, weekStartOf } from "@/lib/schedule";
import { complianceOf } from "@/lib/compliance";
import { loadThrowing } from "@/lib/throwing";
import { availability, throwingAlerts } from "@/lib/workload";
import { loadAssessments, seriesByMetric } from "@/lib/assessments";
import { METRICS } from "@/constants/metrics";
import { PITCH_SMART_NOTE, THROW_TYPE_LABEL } from "@/constants/throwing";
import { VIDEO_TYPE_LABEL } from "@/constants/video";
import { MetricTile } from "@/components/charts/stat-tile";
import { AlertList, ArmFeelChip, AvailabilityBadge } from "@/components/throwing/status";
import { ThrowLogForm } from "@/components/throwing/throw-log-form";
import {
  Card,
  ChildSwitcher,
  fmtDay,
  NoLinkedPlayer,
  PrivacyNote,
  StatusChip,
  withPlayer,
} from "./parent-ui";

export const metadata: Metadata = { title: "Home" };

const COMPETITIVE = new Set(["game", "bullpen", "live_abs"]);

export default async function ParentHomePage({ searchParams }: PageProps<"/parent">) {
  const sp = await searchParams;
  const { supabase, org, children: kids } = await requireParent();
  const child = pickChild(kids, sp.player);
  if (!child) return <NoLinkedPlayer />;

  const { today } = await playerToday();
  const weekStart = weekStartOf(today);
  const weekEnd = addDays(weekStart, 6);
  const from28 = addDays(today, -27);

  const [
    { entries },
    throwing,
    { data: prof },
    { data: videos },
    assessments,
    [nextPractice],
    nextGame,
  ] = await Promise.all([
    loadChildEntries(supabase, org.id, child.id, from28, weekEnd > today ? weekEnd : today, today),
    loadThrowing(supabase, org.id, addDays(today, -60), child.id),
    supabase.from("profiles").select("birth_date").eq("id", child.id).maybeSingle(),
    supabase
      .from("videos")
      .select("id, title, video_type, reviewed_at, review_summary, created_at")
      .eq("org_id", org.id)
      .eq("player_id", child.id)
      .eq("status", "reviewed")
      .order("reviewed_at", { ascending: false })
      .limit(3),
    loadAssessments(supabase, org.id, child.id),
    loadChildPractices(supabase, org.id, child.id, today, null, 1),
    loadPlayerGroupIds(supabase, child.id).then((groups) =>
      loadNextGame(supabase, org.id, today, groups),
    ),
  ]);

  const has = (key: ModuleKey) => hasModule(org.modules, key);
  const name = child.firstName;
  const c28 = complianceOf(entries.filter((e) => e.date >= from28 && e.date <= today));
  const week = entries.filter((e) => e.date >= weekStart && e.date <= weekEnd);
  const todays = week.filter((e) => e.date === today);
  const weekDone = week.filter((e) => e.status === "completed" || e.status === "partial").length;
  const weekMissed = week.filter((e) => e.status === "missed").length;
  const weekLeft = week.filter((e) => e.status === "today" || e.status === "upcoming").length;

  const birth = prof?.birth_date ?? null;
  const avail = availability(throwing, birth, today);
  const alerts = throwingAlerts(throwing, birth, today).filter((a) => a.level !== "info");
  const painAlert = alerts.find((a) => a.message.startsWith("Reported arm pain"));
  const otherAlerts = alerts.filter((a) => a !== painAlert);
  const recentPitching = throwing.filter((r) => COMPETITIVE.has(r.type)).slice(0, 5);
  const latestFeel = throwing.find((r) => r.armFeel);

  const series = seriesByMetric(assessments);
  const metrics = METRICS.filter((m) => series.has(m.key));
  const href = (path: string) => withPlayer(path, kids, child);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">How {name} is doing</h1>
        <ChildSwitcher kids={kids} selected={child} basePath="/parent" />
      </div>

      {has("games") && nextGame ? (
        <NextGameCard game={nextGame} today={today} href={href(`/parent/games/${nextGame.id}`)} />
      ) : null}

      {has("practices") && nextPractice ? (
        <NextPracticeCard
          practice={nextPractice}
          today={today}
          href={`/parent/practices/${nextPractice.id}`}
        />
      ) : null}

      {has("health") && painAlert ? (
        <section
          role="alert"
          className="rounded-2xl bg-red-50 p-4 text-red-950 ring-1 ring-red-200"
        >
          <p className="font-semibold">⛔ {name} reported arm pain recently</p>
          <p className="mt-1 text-sm">
            Please talk to the coach or an athletic trainer before {name} throws again. Rest is the
            safe choice until someone qualified has checked in.
          </p>
        </section>
      ) : null}

      {has("health") ? (
        <Card title="Throwing & arm health">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-zinc-600">Pitching today</p>
            <AvailabilityBadge a={avail} />
          </div>
          {avail.state === "unknown_age" ? (
            <p className="text-xs text-zinc-500">
              Ask the coach to add {name}&apos;s birthday so pitch limits and rest days can be
              checked for their age.
            </p>
          ) : null}
          {latestFeel ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
              Last arm check: <ArmFeelChip feel={latestFeel.armFeel} />
              <span className="text-xs text-zinc-500">{fmtDay(latestFeel.date)}</span>
            </p>
          ) : null}
          <AlertList alerts={otherAlerts} />
          {recentPitching.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-zinc-700">Recent pitch counts</p>
              <ul className="mt-1 divide-y divide-zinc-100 text-sm">
                {recentPitching.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-1.5">
                    <span className="w-24 shrink-0 text-zinc-500 tabular-nums">
                      {fmtDay(r.date)}
                    </span>
                    <span className="flex-1">{THROW_TYPE_LABEL[r.type]}</span>
                    <span className="font-semibold tabular-nums">{r.pitches} pitches</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No pitching logged in the last 60 days.</p>
          )}

          <details className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
            <summary className="cursor-pointer text-sm font-semibold text-brand-800">
              Log a game pitch count or arm check-in
            </summary>
            <p className="mt-2 text-sm text-zinc-600">
              Pitched for a travel or other team? Add it here. Pitch Smart limits count{" "}
              <strong>every</strong> game, so the coach needs the full picture to plan safe rest
              days. The coach sees what you log.
            </p>
            <div className="mt-3">
              <ThrowLogForm key={child.id} forPlayerId={child.id} defaultType="game" compact />
            </div>
          </details>
          <p className="text-xs text-zinc-500">{PITCH_SMART_NOTE}</p>
        </Card>
      ) : null}

      <Card
        title="This week"
        action={
          <Link href={href("/parent/schedule")} className="text-sm font-medium text-brand-700">
            Schedule →
          </Link>
        }
      >
        {week.length === 0 ? (
          <p className="text-sm text-zinc-600">
            No workouts scheduled this week. When the coach assigns a program, it shows up here.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Done", value: weekDone },
                { label: "Missed", value: weekMissed },
                { label: "Still to go", value: weekLeft },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-zinc-50 py-2">
                  <dt className="text-xs text-zinc-500">{s.label}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{s.value}</dd>
                </div>
              ))}
            </dl>
            <div>
              <p className="text-sm font-medium text-zinc-700">Today</p>
              {todays.length === 0 ? (
                <p className="text-sm text-zinc-500">Nothing scheduled today. Rest day! 😌</p>
              ) : (
                <ul className="mt-1 space-y-1.5">
                  {todays.map((e) => (
                    <li key={e.key} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{e.dayName}</span>
                      <span className="text-zinc-500">{e.programName}</span>
                      <StatusChip status={e.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {weekDone > 0 && weekMissed === 0 ? (
              <p className="text-sm text-brand-800">Nice work: {name} is on track this week. 💪</p>
            ) : null}
          </>
        )}
      </Card>

      <Card title="Consistency, last 28 days">
        <div className="flex items-end gap-3">
          <p className="text-4xl font-semibold tabular-nums">
            {c28.rate == null ? "—" : `${Math.round(c28.rate * 100)}%`}
          </p>
          <p className="pb-1 text-sm text-zinc-600">
            {c28.due ? `${c28.logged} of ${c28.due} workouts done` : "No workouts were due yet"}
          </p>
        </div>
        {c28.rate != null ? (
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100" aria-hidden>
            <div
              className="h-full rounded-full bg-brand-600"
              style={{ width: `${Math.round(c28.rate * 100)}%` }}
            />
          </div>
        ) : null}
        {c28.rate != null ? (
          <p className="text-xs text-zinc-500">
            {c28.rate >= 0.8
              ? "Great consistency. That's how progress happens."
              : c28.rate >= 0.5
                ? "Solid. A little encouragement goes a long way."
                : "Every workout counts. A gentle nudge can help get back on track."}
          </p>
        ) : null}
      </Card>

      {has("videos") ? (
        <Card
          title="Coach feedback on videos"
          action={
            <Link href={href("/parent/videos")} className="text-sm font-medium text-brand-700">
              All videos →
            </Link>
          }
        >
          {!videos || videos.length === 0 ? (
            <p className="text-sm text-zinc-600">
              No reviewed videos yet. When the coach reviews one of {name}&apos;s videos, the
              feedback shows up here.
            </p>
          ) : (
            <ul className="space-y-2">
              {videos.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/parent/videos/${v.id}`}
                    className="block rounded-xl p-3 ring-1 ring-zinc-200 hover:ring-brand-500"
                  >
                    <p className="font-medium">{v.title}</p>
                    <p className="text-xs text-zinc-500">
                      {VIDEO_TYPE_LABEL[v.video_type]} ·{" "}
                      {fmtDay((v.reviewed_at ?? v.created_at).slice(0, 10))}
                    </p>
                    {v.review_summary ? (
                      <p className="mt-1 line-clamp-3 text-sm text-zinc-700">
                        “{v.review_summary}”
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <Card title="Testing numbers">
        {metrics.length === 0 ? (
          <p className="text-sm text-zinc-600">
            No testing results yet. After the team&apos;s next testing day, {name}&apos;s numbers
            and progress show up here.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {metrics.map((m) => (
                <MetricTile key={m.key} metricKey={m.key} points={series.get(m.key)!} />
              ))}
            </div>
            <p className="text-xs text-zinc-500">
              Latest result, with the change since the test before.
            </p>
          </>
        )}
      </Card>

      <PrivacyNote />
    </div>
  );
}
