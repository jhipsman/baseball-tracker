"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FeedItem, LiveSnapshot, RunnerDot } from "@/lib/live/snapshot";
import { cn } from "@/lib/utils";

/** Field geometry (same coordinates as the scorer's field, so hit locations line up). */
const HOME = { x: 320, y: 444 };
const BASE_XY = { 1: { x: 444, y: 314 }, 2: { x: 320, y: 190 }, 3: { x: 196, y: 314 } } as const;
const PATH = [HOME, BASE_XY[1], BASE_XY[2], BASE_XY[3], HOME];

type Celebration = { key: number; title: string; tone: "run" | "hr" | "k" };

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The live game view (parents, players, staff): a broadcast score bar, the field
 * with runners and the ball's path, the current at-bat pitch by pitch, and the
 * play-by-play. Updates the moment the scorer saves (Supabase Realtime on the
 * game row), with a short poll as a fallback.
 */
export function LiveGame({
  gameId,
  initial,
  teamName,
  opponent,
}: {
  gameId: string;
  initial: LiveSnapshot;
  teamName: string;
  opponent: string;
}) {
  const [snap, setSnap] = useState(initial);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [connected, setConnected] = useState(false);
  const prev = useRef(initial);
  const [firstSeq] = useState(initial.lastSeq);
  const live = snap.status === "live";

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}/live`, { cache: "no-store" });
      if (res.ok) setSnap(await res.json());
    } catch {
      // Offline for a moment: the next tick tries again.
    }
  }, [gameId]);

  // Instant updates from the scorer...
  useEffect(() => {
    if (!live) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let stopped = false;
    void (async () => {
      // Sign the live connection in first; anonymously, row security (rightly) sends nothing.
      const { data } = await supabase.auth.getSession();
      if (stopped || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`game-${gameId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
          () => void refresh(),
        )
        .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    })();
    return () => {
      stopped = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [gameId, live, refresh]);

  // ...and a poll as a safety net (fast until the live connection is up).
  useEffect(() => {
    if (!live) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(tick, connected ? 20_000 : 4_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [live, refresh, connected]);

  // Celebrate new big moments (not ones already on screen when the page opened).
  useEffect(() => {
    const before = prev.current;
    prev.current = snap;
    const fresh = snap.feed.filter((f) => f.seq > before.lastSeq && f.seq > firstSeq);
    const big =
      fresh.find((f) => f.tag === "hr") ??
      fresh.find((f) => f.tag === "run") ??
      fresh.find((f) => f.tag === "k");
    if (!big || prefersReducedMotion()) return;
    const title =
      big.tag === "hr"
        ? "HOME RUN!"
        : big.tag === "run"
          ? big.runs > 1
            ? `${big.runs} RUNS SCORE!`
            : "RUN SCORES!"
          : "STRIKEOUT";
    const tone = big.tag === "hr" ? "hr" : big.tag === "run" ? "run" : "k";
    const key = big.seq;
    setCelebration({ key, title, tone });
    const t = setTimeout(() => setCelebration((c) => (c?.key === key ? null : c)), 1900);
    return () => clearTimeout(t);
  }, [snap, firstSeq]);

  const lastBall = snap.spray.at(-1);
  const newBall = lastBall && lastBall.seq > firstSeq ? lastBall : null;

  return (
    <section aria-label="Live game" className="space-y-3">
      <ScoreBar snap={snap} teamName={teamName} opponent={opponent} />
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="relative overflow-hidden rounded-2xl bg-[#112a1d] ring-1 ring-zinc-200">
          <Field snap={snap} newBallSeq={newBall?.seq ?? null} />
          {celebration ? (
            <div
              key={celebration.key}
              role="status"
              className={cn(
                "live-celebrate pointer-events-none absolute inset-0 grid place-items-center",
                celebration.tone === "k" && "live-celebrate-quiet",
              )}
            >
              <span
                className={cn(
                  "font-wordmark text-5xl italic sm:text-6xl",
                  celebration.tone === "k" ? "text-[#f5b83c]" : "text-[#3ddc84]",
                )}
                style={{
                  textShadow: "0 0 40px rgb(61 220 132 / 0.6), 0 4px 20px rgb(0 0 0 / 0.6)",
                }}
              >
                {celebration.title}
              </span>
            </div>
          ) : null}
        </div>
        <div className="space-y-3">
          <AtBat snap={snap} />
          <Feed items={snap.feed} firstSeq={firstSeq} />
        </div>
      </div>
    </section>
  );
}

function Dots({ n, on, color, label }: { n: number; on: number; color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${on} ${label}`}>
      <span className="mr-0.5 text-[11px] font-bold text-white/60">{label[0].toUpperCase()}</span>
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className="size-2.5 rounded-full transition-colors duration-300"
          style={{ background: i < on ? color : "rgb(255 255 255 / 0.18)" }}
        />
      ))}
    </span>
  );
}

function MiniBases({ snap }: { snap: LiveSnapshot }) {
  const on = (b: 1 | 2 | 3) => !!snap.bases[b];
  const sq = (x: number, y: number, lit: boolean) => (
    <rect
      x={x - 5}
      y={y - 5}
      width={10}
      height={10}
      transform={`rotate(45 ${x} ${y})`}
      fill={lit ? "#f5b83c" : "rgb(255 255 255 / 0.2)"}
      className="transition-[fill] duration-300"
    />
  );
  const desc = ([1, 2, 3] as const).filter(on).map((b) => ["first", "second", "third"][b - 1]);
  return (
    <svg
      viewBox="0 0 40 30"
      className="h-7 w-9"
      role="img"
      aria-label={desc.length ? `Runners on ${desc.join(", ")}` : "Bases empty"}
    >
      {sq(20, 7, on(2))}
      {sq(33, 19, on(1))}
      {sq(7, 19, on(3))}
    </svg>
  );
}

/** Broadcast-style strip: score, inning, count, outs and runners; bumps on change. */
function ScoreBar({
  snap,
  teamName,
  opponent,
}: {
  snap: LiveSnapshot;
  teamName: string;
  opponent: string;
}) {
  const live = snap.status === "live";
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3 text-white shadow-lg ring-1 ring-white/10"
      style={{ background: "linear-gradient(90deg, #14231b, #0c0f0e 70%)" }}
      data-testid="live-scorebar"
    >
      <span
        className={cn(
          "flex items-center gap-1.5 text-xs font-extrabold tracking-wider",
          live ? "text-[#f5b83c]" : "text-white/60",
        )}
      >
        {live ? <span className="live-dot" aria-hidden /> : null}
        {live ? "LIVE" : "FINAL"}
      </span>
      <Team name={teamName} score={snap.us} ours />
      <Team name={opponent} score={snap.them} />
      {live ? (
        <>
          <span className="text-sm font-bold whitespace-nowrap">{snap.halfLabel}</span>
          <span className="flex items-center gap-3">
            <Dots n={3} on={snap.balls} color="#3ddc84" label="balls" />
            <Dots n={2} on={snap.strikes} color="#f5b83c" label="strikes" />
            <Dots n={2} on={snap.outs} color="#ff5d5d" label="outs" />
          </span>
          <MiniBases snap={snap} />
        </>
      ) : null}
    </div>
  );
}

function Team({ name, score, ours = false }: { name: string; score: number; ours?: boolean }) {
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span
        className={cn(
          "max-w-[9rem] truncate text-sm font-bold",
          ours ? "text-white" : "text-white/70",
        )}
      >
        {name}
      </span>
      <span
        key={score}
        className="live-bump text-2xl font-extrabold tabular-nums"
        data-testid={ours ? "live-us" : "live-them"}
      >
        {score}
      </span>
    </span>
  );
}

/** The field: runners slide base to base, the last ball's flight is drawn, every ball in play stays as a dot. */
function Field({ snap, newBallSeq }: { snap: LiveSnapshot; newBallSeq: number | null }) {
  const runnerEls = useRef(new Map<string, SVGGElement>());
  const placed = useRef(new Map<string, number>()); // runner id → base (1..3)

  useLayoutEffect(() => {
    const reduce = prefersReducedMotion();
    const next = new Map<string, number>();
    for (const b of [1, 2, 3] as const) {
      const r = snap.bases[b];
      if (r) next.set(r.id, b);
    }
    for (const [id, base] of next) {
      const el = runnerEls.current.get(id);
      if (!el) continue;
      const from = placed.current.get(id) ?? 0; // new runners come from home
      const stops = from < base ? PATH.slice(from, base + 1) : [PATH[base]];
      if (reduce || stops.length < 2) {
        el.setAttribute("transform", `translate(${PATH[base].x} ${PATH[base].y})`);
        continue;
      }
      el.animate(
        stops.map((p) => ({ transform: `translate(${p.x}px, ${p.y}px)` })),
        {
          duration: 380 * (stops.length - 1),
          easing: "cubic-bezier(0.45, 0, 0.2, 1)",
          fill: "forwards",
        },
      );
    }
    placed.current = next;
  }, [snap.bases]);

  const runners = ([1, 2, 3] as const).flatMap((b) =>
    snap.bases[b] ? [[b, snap.bases[b]!] as const] : [],
  );
  const lastBall = newBallSeq ? snap.spray.find((s) => s.seq === newBallSeq) : null;

  return (
    <svg
      viewBox="0 120 640 380"
      className="block w-full"
      role="img"
      aria-label="Field with runners and balls in play"
    >
      <defs>
        <radialGradient id="lg-grass" cx="50%" cy="100%" r="90%">
          <stop offset="0" stopColor="#2f7049" />
          <stop offset="1" stopColor="#173826" />
        </radialGradient>
      </defs>
      <path
        d="M320 461 25 180A381 381 0 0 1 615 180Z"
        fill="url(#lg-grass)"
        stroke="rgb(255 255 255 / 0.25)"
        strokeWidth="2"
      />
      <path d="M320 444 166 290Q320 130 474 290Z" fill="#a57c55" opacity="0.9" />
      <path d="m320 408-112-112 112-111 112 111Z" fill="#2f7049" />
      <circle cx="320" cy="329" r="18" fill="#a57c55" />
      <path d="M320 444 30 180M320 444 610 180" stroke="rgb(255 255 255 / 0.65)" strokeWidth="2" />
      {snap.spray.map((b) => (
        <circle
          key={b.seq}
          cx={b.x * 640}
          cy={b.y * 500}
          r={7}
          fill={b.hit ? "#5ee89c" : "rgb(255 255 255 / 0.55)"}
          opacity={b.weBat ? 0.9 : 0.4}
          className={b.seq === newBallSeq ? "live-dot-land" : undefined}
        />
      ))}
      {lastBall ? (
        <path
          key={`arc-${lastBall.seq}`}
          d={`M${HOME.x} ${HOME.y - 6} Q ${(HOME.x + lastBall.x * 640) / 2} ${Math.min(HOME.y, lastBall.y * 500) - 120} ${lastBall.x * 640} ${lastBall.y * 500}`}
          fill="none"
          stroke="#f5b83c"
          strokeWidth="5"
          strokeLinecap="round"
          pathLength={1}
          className="live-ball-path"
          style={{ filter: "drop-shadow(0 0 6px #f5b83c)" }}
        />
      ) : null}
      {[HOME, BASE_XY[1], BASE_XY[2], BASE_XY[3]].map((p, i) => (
        <rect
          key={i}
          x={p.x - 9}
          y={p.y - 9}
          width={18}
          height={18}
          transform={`rotate(45 ${p.x} ${p.y})`}
          fill="#fff"
        />
      ))}
      {runners.map(([b, r]) => (
        <Runner
          key={r.id}
          runner={r}
          base={b}
          refEl={(el) => {
            if (el) runnerEls.current.set(r.id, el);
            else runnerEls.current.delete(r.id);
          }}
        />
      ))}
    </svg>
  );
}

function Runner({
  runner,
  base,
  refEl,
}: {
  runner: RunnerDot;
  base: 1 | 2 | 3;
  refEl: (el: SVGGElement | null) => void;
}) {
  const p = BASE_XY[base];
  return (
    <g ref={refEl} transform={`translate(${p.x} ${p.y})`} data-testid={`runner-${base}`}>
      <circle r={22} fill={runner.ours ? "#12b76a" : "#3b3f45"} stroke="#fff" strokeWidth={3} />
      <text
        textAnchor="middle"
        dy={6}
        fontSize={16}
        fontWeight={800}
        fill={runner.ours ? "#04140b" : "#fff"}
      >
        {runner.initials}
      </text>
      <title>{`${runner.name} on ${["first", "second", "third"][base - 1]}`}</title>
    </g>
  );
}

/** Who's up and the at-bat so far, pitch by pitch. */
function AtBat({ snap }: { snap: LiveSnapshot }) {
  if (snap.status !== "live") return null;
  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-zinc-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-sm">
          <span className="text-zinc-500">{snap.weBat ? "At bat" : "Pitching"} </span>
          <strong>{snap.weBat ? snap.batter : snap.pitcher}</strong>
        </p>
        {!snap.weBat && snap.pitcherPitches ? (
          <span className="text-xs font-semibold text-zinc-500 tabular-nums">
            {snap.pitcherPitches} pitches
          </span>
        ) : null}
      </div>
      {snap.atBat.length ? (
        <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="Pitches this at-bat">
          {snap.atBat.map((c) => (
            <li
              key={c.n}
              className={cn(
                "live-slide-in rounded-full px-2.5 py-1 text-xs font-bold",
                c.label === "Ball"
                  ? "bg-brand-50 text-brand-800"
                  : c.label === "Strike"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-zinc-100 text-zinc-700",
              )}
            >
              {c.label} <span className="font-medium opacity-70">{c.count}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">First pitch coming up.</p>
      )}
    </div>
  );
}

const TAG_STYLE: Record<NonNullable<FeedItem["tag"]>, { label: string; cls: string }> = {
  hr: { label: "HOME RUN", cls: "bg-brand-100 text-brand-900 ring-brand-300" },
  run: { label: "RUN", cls: "bg-brand-50 text-brand-900 ring-brand-200" },
  hit: { label: "HIT", cls: "bg-amber-50 text-amber-900 ring-amber-200" },
  k: { label: "K", cls: "bg-zinc-100 text-zinc-800 ring-zinc-200" },
  walk: { label: "WALK", cls: "bg-sky-50 text-sky-900 ring-sky-200" },
  out: { label: "OUT", cls: "bg-zinc-100 text-zinc-600 ring-zinc-200" },
};

/** Play-by-play, newest first; new plays slide in and big moments stand out. */
function Feed({ items, firstSeq }: { items: FeedItem[]; firstSeq: number }) {
  if (!items.length)
    return (
      <p className="rounded-2xl bg-surface p-4 text-sm text-zinc-500 ring-1 ring-zinc-200">
        No plays yet.
      </p>
    );
  return (
    <ol className="space-y-1.5" aria-label="Play by play" data-testid="live-feed">
      {items.map((f) => {
        const tag = f.tag ? TAG_STYLE[f.tag] : null;
        const big = f.tag === "hr" || f.tag === "run";
        return (
          <li
            key={f.seq}
            className={cn(
              "flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm ring-1",
              f.seq > firstSeq && "live-slide-in",
              big ? "bg-brand-50 ring-brand-200" : "bg-surface ring-zinc-200",
            )}
          >
            <span className="w-12 shrink-0 pt-0.5 text-xs text-zinc-500">{f.when}</span>
            <span
              className={cn(
                "min-w-0 flex-1",
                f.weBat ? "text-zinc-900" : "text-zinc-600",
                big && "font-semibold",
              )}
            >
              {f.text}
            </span>
            {tag ? (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold ring-1",
                  tag.cls,
                )}
              >
                {tag.label}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
