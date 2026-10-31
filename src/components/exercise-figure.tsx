"use client";

import { useEffect, useRef, useState } from "react";
import { figureFor, type Figure, type Prop, type Segment } from "@/lib/figures/library";
import { GROUND, joints, mixPose, place, type Joints, type Point } from "@/lib/figures/skeleton";
import { cn } from "@/lib/utils";
import { ViewButton } from "@/components/ui/view-button";

const MOVE = 1100,
  HOLD = 450;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Where we are in the loop: start → … → end → … → start, holding at each pose. */
function frameAt(fig: Figure, ms: number) {
  const n = fig.frames.length;
  const path = [...fig.frames.keys(), ...[...fig.frames.keys()].reverse().slice(1, -1)];
  const leg = MOVE + HOLD;
  // The first animation frame can be stamped a hair before the start; never index below zero.
  const total = leg * path.length;
  const t = ((Math.max(0, ms) % total) + total) % total;
  const i = Math.floor(t / leg),
    local = t % leg;
  const a = fig.frames[path[i]],
    b = fig.frames[path[(i + 1) % path.length]];
  return n === 1 || local < HOLD ? a : mixPose(a, b, ease((local - HOLD) / MOVE));
}

const line = (a: Point, b: Point) => `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`;
const path = (...pts: Point[]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join("");

function Body({ j, fig, ghost }: { j: Joints; fig: Figure; ghost?: boolean }) {
  const on = (s: Segment) => fig.focus.includes(s);
  const limb = (s: Segment, far: boolean) =>
    cn(
      on(s)
        ? far
          ? "stroke-brand-300"
          : "stroke-brand-600"
        : far
          ? "stroke-zinc-300"
          : "stroke-zinc-700",
    );
  const front = fig.view === "front";
  const side = (i: 0 | 1, far: boolean) => (
    <g key={i}>
      <path d={path(j.hips[i], j.knee[i], j.ankle[i])} className={limb("thigh", far)} />
      <path d={line(j.knee[i], j.ankle[i])} className={limb("shin", far)} />
      <path
        d={line(j.ankle[i], j.toe[i])}
        className={far ? "stroke-zinc-300" : "stroke-zinc-700"}
      />
    </g>
  );
  const arm = (i: 0 | 1, far: boolean) => (
    <g key={`a${i}`}>
      <path d={line(j.shoulders[i], j.elbow[i])} className={limb("upper", far)} />
      <path d={line(j.elbow[i], j.hand[i])} className={limb("fore", far)} />
    </g>
  );
  return (
    <g
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={5.5}
      opacity={ghost ? 0.18 : 1}
    >
      {front ? null : (
        <>
          {side(1, true)}
          {arm(1, true)}
        </>
      )}
      <path
        d={front ? path(j.shoulders[0], j.shoulders[1]) : line(j.hip, j.neck)}
        className={limb("torso", false)}
        strokeWidth={front ? 5.5 : 8}
      />
      {front ? (
        <>
          <path d={line(j.hip, j.neck)} className={limb("torso", false)} strokeWidth={9} />
          <path d={path(j.hips[0], j.hips[1])} className={limb("torso", false)} />
          {side(1, false)}
          {side(0, false)}
          {arm(1, false)}
          {arm(0, false)}
        </>
      ) : (
        <>
          {side(0, false)}
          {arm(0, false)}
        </>
      )}
      <circle cx={j.head[0]} cy={j.head[1]} r={5.5} className="fill-zinc-700 stroke-none" />
    </g>
  );
}

function Props({ props, j }: { props: Prop[]; j: Joints }) {
  const hold = (at: string): Point =>
    at === "back"
      ? j.back
      : at === "nearHand"
        ? j.hand[0]
        : at === "farHand"
          ? j.hand[1]
          : [(j.hand[0][0] + j.hand[1][0]) / 2, (j.hand[0][1] + j.hand[1][1]) / 2];
  return (
    <>
      {props.map((p, i) => {
        switch (p.kind) {
          case "bench":
          case "box":
            return (
              <g key={i} className="fill-zinc-300">
                <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={1.5} />
                {p.kind === "bench" ? (
                  <>
                    <rect x={p.x + 4} y={p.y + p.h} width={3} height={GROUND - p.y - p.h} />
                    <rect x={p.x + p.w - 7} y={p.y + p.h} width={3} height={GROUND - p.y - p.h} />
                  </>
                ) : null}
              </g>
            );
          case "bar":
            return (
              <path
                key={i}
                d={`M${p.x1} ${p.y}H${p.x2}`}
                className="stroke-zinc-500"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            );
          case "post":
            return (
              <path
                key={i}
                d={`M${p.x} ${GROUND}V${p.top}`}
                className="stroke-zinc-400"
                strokeWidth={3}
                strokeLinecap="round"
              />
            );
          case "band": {
            const from =
              p.from === "hands"
                ? [j.hand[0], j.hand[1]]
                : [p.from === "nearHand" ? j.hand[0] : j.hand[1]];
            const d = p.to ? from.map((h) => line(h, p.to!)).join("") : line(j.hand[0], j.hand[1]);
            return (
              <path
                key={i}
                d={d}
                className="stroke-amber-500"
                strokeWidth={2}
                strokeLinecap="round"
                fill="none"
              />
            );
          }
          default: {
            const [x, y] = hold(p.at);
            if (p.kind === "barbell")
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r={7.5} className="fill-zinc-800" />
                  <circle cx={x} cy={y} r={1.6} className="fill-zinc-300" />
                </g>
              );
            if (p.kind === "dumbbell")
              return (
                <rect
                  key={i}
                  x={x - 4}
                  y={y - 2.5}
                  width={8}
                  height={5}
                  rx={1.5}
                  className="fill-zinc-800"
                />
              );
            if (p.kind === "kettlebell")
              return <circle key={i} cx={x} cy={y + 3} r={4.5} className="fill-zinc-800" />;
            if (p.kind === "medball")
              return <circle key={i} cx={x} cy={y} r={5} className="fill-zinc-800" />;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={2.2}
                className="fill-zinc-50 stroke-zinc-500"
                strokeWidth={0.8}
              />
            );
          }
        }
      })}
    </>
  );
}

export function FigureSvg({ fig, ms, still }: { fig: Figure; ms: number; still?: boolean }) {
  const pose = still ? fig.frames.at(-1)! : frameAt(fig, ms);
  const j = place(joints(pose, fig.view), fig.anchor);
  const start =
    still && fig.frames.length > 1 ? place(joints(fig.frames[0], fig.view), fig.anchor) : null;
  const behind = (fig.props ?? []).filter(
    (p) => p.kind === "bench" || p.kind === "box" || p.kind === "post" || p.kind === "bar",
  );
  const inFront = (fig.props ?? []).filter((p) => !behind.includes(p));
  return (
    <svg viewBox="0 0 120 100" className="h-full w-full" role="presentation">
      <path
        d={`M6 ${GROUND}H114`}
        className="stroke-zinc-200"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Props props={behind} j={j} />
      {start ? <Body j={start} fig={fig} ghost /> : null}
      <Body j={j} fig={fig} />
      <Props props={inFront} j={j} />
    </svg>
  );
}

/** Animated diagram for an exercise (by name), or nothing when there isn't one yet. */
export function ExerciseFigure({
  name,
  className,
  animate = true,
}: {
  name: string;
  className?: string;
  animate?: boolean;
}) {
  const fig = figureFor(name);
  const [ms, setMs] = useState(0);
  const [reduce, setReduce] = useState(false);
  const raf = useRef(0);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!fig || !animate || reduce) return;
    const t0 = performance.now();
    const tick = (t: number) => {
      setMs(Math.max(0, t - t0));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [fig, animate, reduce]);
  if (!fig) return null;
  return (
    <figure className={cn("aspect-[6/5] rounded-2xl bg-surface ring-1 ring-zinc-200", className)}>
      <FigureSvg fig={fig} ms={ms} still={!animate || reduce} />
      <figcaption className="sr-only">
        Diagram of {name}. {fig.cue}
      </figcaption>
    </figure>
  );
}

/**
 * Small still drawing that opens the animated diagram and its cue right below
 * (one moving at a time keeps phones cool). Renders nothing without a diagram.
 */
export function ExerciseFigureToggle({ name, className }: { name: string; className?: string }) {
  const fig = figureFor(name);
  const [open, setOpen] = useState(false);
  if (!fig) return null;
  return (
    <div className={cn("contents", className)}>
      <ViewButton
        aria-expanded={open}
        aria-label={open ? `Hide ${name} diagram` : `Show how to do ${name}`}
        onPress={() => setOpen((o) => !o)}
        className={cn(
          "block size-14 shrink-0 cursor-pointer overflow-hidden rounded-xl bg-surface ring-1 ring-zinc-200 hover:ring-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600",
          open && "ring-2 ring-brand-600",
        )}
      >
        <FigureSvg fig={fig} ms={0} still />
      </ViewButton>
      {open ? (
        <div className="col-span-full mt-2 w-full basis-full space-y-1">
          <ExerciseFigure name={name} className="mx-auto max-w-xs" />
          {fig.cue ? <p className="text-center text-sm text-zinc-600">{fig.cue}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
