"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { saveBoxScore, type SaveResult } from "@/lib/stats-actions";
import {
  BATTING_LABELS,
  BATTING_MAX,
  DECISIONS,
  emptyBatting,
  formatIP,
  parseIP,
  validateBoxScore,
  type BattingField,
  type BattingLine,
  type Decision,
  type PitchingErrorKey,
} from "@/lib/stats";
import { pitchSmartBand } from "@/lib/workload";
import { cn } from "@/lib/utils";

export type RosterPlayer = {
  id: string;
  name: string;
  short: string;
  jersey: number | null;
  position: string | null;
  /** Age on game day (null when no birthdate). */
  age: number | null;
  /** Other competitive pitches logged in Throwing on the game date (not from this game). */
  otherPitches: number;
  /** A manually logged "game" throwing entry on this date, if any (possible double count). */
  manualGameLog: number | null;
};

export type InitialBatter = BattingLine & {
  playerId: string;
  battingOrder: number | null;
  position: string | null;
};
export type InitialPitcher = {
  playerId: string;
  outs: number;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  hbp: number;
  hr: number;
  pitches: number | null;
  strikes: number | null;
  decision: Decision | null;
};

type Batter = { playerId: string; order: number | null; position: string; v: BattingLine };
const PITCH_NUMS = ["h", "r", "er", "bb", "so", "hbp", "hr"] as const;
type PitchNum = (typeof PITCH_NUMS)[number];
type Pitcher = {
  playerId: string;
  ip: string;
  v: Record<PitchNum, number>;
  pitches: number | null;
  strikes: number | null;
  decision: Decision | "";
};

const POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "EH", "PH", "PR"];
const MAIN: BattingField[] = ["ab", "r", "h", "rbi", "bb", "so"];
const MORE: BattingField[] = ["doubles", "triples", "hr", "hbp", "sb", "cs", "sac", "sf", "e"];
const ALL_BAT: BattingField[] = [
  ...MAIN.slice(0, 3),
  "doubles",
  "triples",
  "hr",
  "rbi",
  "bb",
  "so",
  "hbp",
  "sb",
  "cs",
  "sac",
  "sf",
  "e",
];
const PITCH_LABEL: Record<PitchNum, string> = {
  h: "H",
  r: "R",
  er: "ER",
  bb: "BB",
  so: "SO",
  hbp: "HBP",
  hr: "HR",
};

const cellBase =
  "block h-10 rounded-md border-0 bg-white px-1 text-center text-base tabular-nums ring-1 ring-inset focus:ring-2 focus:ring-brand-600 sm:text-sm";

/** Digits-only number box; ArrowUp/ArrowDown step it. Empty = null when allowed. */
function NumInput({
  value,
  onChange,
  max,
  label,
  invalid,
  allowEmpty,
  className,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  max: number;
  label: string;
  invalid?: boolean;
  allowEmpty?: boolean;
  className?: string;
}) {
  return (
    <input
      inputMode="numeric"
      autoComplete="off"
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={value == null ? "" : String(value)}
      placeholder={allowEmpty ? "—" : "0"}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const t = e.target.value.replace(/\D/g, "").slice(0, 3);
        onChange(t === "" ? (allowEmpty ? null : 0) : Number(t));
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const d = e.key === "ArrowUp" ? 1 : -1;
          onChange(Math.min(max, Math.max(0, (value ?? 0) + d)));
        }
      }}
      className={cn(
        cellBase,
        invalid ? "bg-red-50 ring-red-500" : "ring-zinc-300",
        "placeholder:text-zinc-300",
        className ?? "w-full",
      )}
    />
  );
}

/** Phone control: big − / + buttons around the number. */
function Stepper(props: Parameters<typeof NumInput>[0] & { short: string }) {
  const { value, onChange, max, short, invalid } = props;
  const btn =
    "flex size-11 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xl font-semibold text-zinc-800 active:bg-zinc-200 disabled:opacity-40";
  return (
    <div className={cn("rounded-lg p-1.5 ring-1", invalid ? "ring-red-400" : "ring-zinc-200")}>
      <p className="text-center text-[11px] font-semibold tracking-wide text-zinc-500">{short}</p>
      <div className="mt-1 flex items-center gap-1">
        <button
          type="button"
          className={btn}
          aria-label={`${props.label} minus one`}
          disabled={(value ?? 0) <= 0}
          onClick={() => onChange(Math.max(0, (value ?? 0) - 1))}
        >
          −
        </button>
        <NumInput {...props} className="h-11 min-w-0 flex-1 px-0" />
        <button
          type="button"
          className={btn}
          aria-label={`${props.label} plus one`}
          disabled={(value ?? 0) >= max}
          onClick={() => onChange(Math.min(max, (value ?? 0) + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function BoxScoreForm({
  gameId,
  teamScore,
  opponentScore,
  roster,
  initialBatting,
  initialPitching,
}: {
  gameId: string;
  teamScore: number | null;
  opponentScore: number | null;
  roster: RosterPlayer[];
  initialBatting: InitialBatter[];
  initialPitching: InitialPitcher[];
}) {
  const byId = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);
  const [batters, setBatters] = useState<Batter[]>(() =>
    initialBatting.map((b) => ({
      playerId: b.playerId,
      order: b.battingOrder,
      position: b.position ?? "",
      v: Object.fromEntries(
        Object.keys(emptyBatting()).map((k) => [k, b[k as BattingField]]),
      ) as BattingLine,
    })),
  );
  const [pitchers, setPitchers] = useState<Pitcher[]>(() =>
    initialPitching.map((p) => ({
      playerId: p.playerId,
      ip: formatIP(p.outs),
      v: { h: p.h, r: p.r, er: p.er, bb: p.bb, so: p.so, hbp: p.hbp, hr: p.hr },
      pitches: p.pitches,
      strikes: p.strikes,
      decision: p.decision ?? "",
    })),
  );
  const [result, setResult] = useState<SaveResult>({});
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  const nameOf = (id: string) => byId.get(id)?.short ?? "Player";
  const touch = () => {
    setDirty(true);
    setResult({});
  };

  // ---- derived validation -------------------------------------------------
  const outs = pitchers.map((p) => parseIP(p.ip));
  const check = validateBoxScore({
    batting: batters.map((b) => ({ ...b.v, player_id: b.playerId, batting_order: b.order })),
    pitching: pitchers.map((p, i) => ({
      ...p.v,
      outs: outs[i] ?? 0,
      pitches: p.pitches,
      strikes: p.strikes,
      decision: p.decision || null,
      player_id: p.playerId,
    })),
    teamScore,
    opponentScore,
  });
  const pitchErrors: Partial<Record<PitchingErrorKey, string>>[] = check.pitching.map((e, i) =>
    outs[i] == null
      ? { ...e, ip: "IP looks like 4, 4.1 or 4.2 (the digit after the dot is outs)." }
      : e,
  );
  const canSave = check.ok && outs.every((o) => o != null);

  // ---- mutations -----------------------------------------------------------
  const addBatter = (id: string) => {
    touch();
    setBatters((bs) =>
      bs.some((b) => b.playerId === id)
        ? bs
        : [
            ...bs,
            {
              playerId: id,
              order: Math.min(30, Math.max(0, ...bs.map((b) => b.order ?? 0)) + 1),
              position: byId.get(id)?.position ?? "",
              v: emptyBatting(),
            },
          ],
    );
  };
  const addAll = () => {
    touch();
    setBatters((bs) => {
      let n = Math.max(0, ...bs.map((b) => b.order ?? 0));
      const add = roster
        .filter((p) => !bs.some((b) => b.playerId === p.id))
        .map((p) => ({
          playerId: p.id,
          order: n < 30 ? ++n : null,
          position: p.position ?? "",
          v: emptyBatting(),
        }));
      return [...bs, ...add];
    });
  };
  const setBat = (i: number, patch: Partial<Batter>) => {
    touch();
    setBatters((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  };
  const setBatV = (i: number, f: BattingField, n: number | null) => {
    touch();
    setBatters((bs) => bs.map((b, j) => (j === i ? { ...b, v: { ...b.v, [f]: n ?? 0 } } : b)));
  };
  const removeBatter = (i: number) => {
    touch();
    setBatters((bs) => bs.filter((_, j) => j !== i));
  };
  const sortByOrder = () => {
    setBatters((bs) => bs.toSorted((a, b) => (a.order ?? 99) - (b.order ?? 99)));
  };

  const addPitcher = (id: string) => {
    if (!id) return;
    touch();
    setPitchers((ps) =>
      ps.some((p) => p.playerId === id)
        ? ps
        : [
            ...ps,
            {
              playerId: id,
              ip: "",
              v: { h: 0, r: 0, er: 0, bb: 0, so: 0, hbp: 0, hr: 0 },
              pitches: null,
              strikes: null,
              decision: "",
            },
          ],
    );
  };
  const setPit = (i: number, patch: Partial<Pitcher>) => {
    touch();
    setPitchers((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  };
  const movePitcher = (i: number, d: -1 | 1) => {
    touch();
    setPitchers((ps) => {
      const j = i + d;
      if (j < 0 || j >= ps.length) return ps;
      const next = [...ps];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const removePitcher = (i: number) => {
    touch();
    setPitchers((ps) => ps.filter((_, j) => j !== i));
  };

  const save = () => {
    if (!canSave) return;
    startTransition(async () => {
      const res = await saveBoxScore(gameId, {
        batting: batters.map((b) => ({
          ...b.v,
          player_id: b.playerId,
          batting_order: b.order,
          position: b.position || null,
        })),
        pitching: pitchers.map((p, i) => ({
          ...p.v,
          outs: outs[i] ?? 0,
          pitches: p.pitches,
          strikes: p.strikes,
          decision: p.decision || null,
          player_id: p.playerId,
        })),
      });
      setResult(res);
      if (!res.error) setDirty(false);
    });
  };

  const notInLineup = roster.filter((p) => !batters.some((b) => b.playerId === p.id));
  const notPitching = roster.filter((p) => !pitchers.some((q) => q.playerId === p.id));
  const errText = (e: object) => Object.values(e).filter(Boolean) as string[];

  // ---- Pitch Smart notes per pitcher --------------------------------------
  const pitchNotes = (p: Pitcher) => {
    const info = byId.get(p.playerId);
    const notes: { tone: "warn" | "info"; text: string }[] = [];
    if (!info) return notes;
    if (info.manualGameLog != null)
      notes.push({
        tone: "warn",
        text: `Throwing already has a manually logged game (${info.manualGameLog} pitches) for ${info.short} on this date. If it's this game, delete that entry so it isn't counted twice.`,
      });
    if (p.pitches != null && p.pitches > 0) {
      if (info.age == null) {
        notes.push({
          tone: "info",
          text: `No birthdate for ${info.short}, so Pitch Smart limits can't be checked. Add it on their profile.`,
        });
      } else {
        const band = pitchSmartBand(info.age);
        const total = p.pitches + info.otherPitches;
        if (total > band.dailyMax)
          notes.push({
            tone: "warn",
            text: `Over Pitch Smart: ${info.short} (age ${info.age}) threw ${total} pitches${info.otherPitches ? ` (${info.otherPitches} logged elsewhere today)` : ""}. Daily max for ages ${band.ages} is ${band.dailyMax}.`,
          });
      }
    }
    return notes;
  };

  const noteList = (p: Pitcher) => {
    const notes = pitchNotes(p);
    if (!notes.length) return null;
    return (
      <ul className="space-y-1">
        {notes.map((n) => (
          <li
            key={n.text}
            role={n.tone === "warn" ? "alert" : undefined}
            className={cn(
              "rounded-md px-2 py-1.5 text-xs",
              n.tone === "warn" ? "bg-amber-50 text-amber-900" : "bg-zinc-100 text-zinc-700",
            )}
          >
            {n.tone === "warn" ? "⚠ " : ""}
            {n.text}
          </li>
        ))}
      </ul>
    );
  };

  const errList = (items: string[]) =>
    items.length ? (
      <ul className="space-y-0.5 text-xs text-red-700">
        {[...new Set(items)].map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    ) : null;

  const positionSelect = (b: Batter, i: number, className?: string) => (
    <select
      aria-label={`${nameOf(b.playerId)} position`}
      value={b.position}
      onChange={(e) => setBat(i, { position: e.target.value })}
      className={cn(
        "h-10 rounded-md border-0 bg-white px-1 text-base ring-1 ring-inset ring-zinc-300 sm:text-sm",
        className,
      )}
    >
      <option value="">—</option>
      {[...new Set([...POSITIONS, ...(b.position ? [b.position] : [])])].map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------- Batting */}
      <section className="space-y-3" aria-labelledby="batting-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="batting-h" className="text-lg font-semibold">
            Batting
          </h2>
          {batters.length > 1 ? (
            <button
              type="button"
              onClick={sortByOrder}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Sort by batting order
            </button>
          ) : null}
        </div>

        {batters.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
            Add the players who batted. Leave out anyone who didn&apos;t play.
          </p>
        ) : (
          <>
            {/* Laptop: one row per batter, tab across. */}
            <div className="hidden overflow-x-auto rounded-xl bg-white ring-1 ring-zinc-200 md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                    <th className="w-12 px-2 py-2 font-medium">#</th>
                    <th className="px-2 py-2 text-left font-medium">Player</th>
                    <th className="w-16 px-1 py-2 font-medium">Pos</th>
                    {ALL_BAT.map((f) => (
                      <th key={f} className="w-11 px-0.5 py-2 font-medium">
                        {BATTING_LABELS[f]}
                      </th>
                    ))}
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {batters.map((b, i) => {
                    const e = check.batting[i] ?? {};
                    const items = errText(e);
                    return (
                      <Fragment key={b.playerId}>
                        <tr className={cn(items.length ? "" : "border-b border-zinc-100")}>
                          <td className="px-1 py-1">
                            <NumInput
                              label={`${nameOf(b.playerId)} batting order`}
                              value={b.order}
                              allowEmpty
                              max={30}
                              onChange={(n) => setBat(i, { order: n })}
                            />
                          </td>
                          <th
                            scope="row"
                            className="px-2 py-1 text-left font-medium whitespace-nowrap"
                          >
                            {byId.get(b.playerId)?.jersey != null ? (
                              <span className="mr-1 text-zinc-400">
                                #{byId.get(b.playerId)!.jersey}
                              </span>
                            ) : null}
                            {nameOf(b.playerId)}
                          </th>
                          <td className="px-0.5 py-1">{positionSelect(b, i, "w-16")}</td>
                          {ALL_BAT.map((f) => (
                            <td key={f} className="px-0.5 py-1">
                              <NumInput
                                label={`${nameOf(b.playerId)} ${BATTING_LABELS[f]}`}
                                value={b.v[f]}
                                max={BATTING_MAX[f]}
                                invalid={Boolean(e[f])}
                                onChange={(n) => setBatV(i, f, n)}
                              />
                            </td>
                          ))}
                          <td className="px-1">
                            <button
                              type="button"
                              onClick={() => removeBatter(i)}
                              aria-label={`Remove ${nameOf(b.playerId)} from the lineup`}
                              className="size-8 rounded-md text-lg text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                        {items.length ? (
                          <tr className="border-b border-zinc-100">
                            <td />
                            <td colSpan={ALL_BAT.length + 3} className="px-2 pb-2">
                              {errList(items)}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phone: a card per batter with big steppers. */}
            <ol className="space-y-3 md:hidden">
              {batters.map((b, i) => {
                const e = check.batting[i] ?? {};
                const moreErr = MORE.some((f) => e[f]);
                const moreSet = MORE.filter((f) => b.v[f] > 0);
                return (
                  <li
                    key={b.playerId}
                    className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-zinc-200"
                  >
                    <div className="flex items-center gap-2">
                      <NumInput
                        label={`${nameOf(b.playerId)} batting order`}
                        value={b.order}
                        allowEmpty
                        max={30}
                        className="w-11 shrink-0"
                        onChange={(n) => setBat(i, { order: n })}
                      />
                      <p className="min-w-0 flex-1 truncate font-semibold">{nameOf(b.playerId)}</p>
                      {positionSelect(b, i, "w-16 shrink-0")}
                      <button
                        type="button"
                        onClick={() => removeBatter(i)}
                        aria-label={`Remove ${nameOf(b.playerId)} from the lineup`}
                        className="size-10 shrink-0 rounded-md text-xl text-zinc-400 active:bg-zinc-100"
                      >
                        ×
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-3">
                      {MAIN.map((f) => (
                        <Stepper
                          key={f}
                          short={BATTING_LABELS[f]}
                          label={`${nameOf(b.playerId)} ${BATTING_LABELS[f]}`}
                          value={b.v[f]}
                          max={BATTING_MAX[f]}
                          invalid={Boolean(e[f])}
                          onChange={(n) => setBatV(i, f, n)}
                        />
                      ))}
                    </div>
                    <details open={moreErr || undefined} className="group">
                      <summary className="cursor-pointer text-sm font-medium text-brand-700">
                        2B, 3B, HR, HBP, SB, more
                        {moreSet.length ? (
                          <span className="ml-1 font-normal text-zinc-500">
                            ({moreSet.map((f) => `${b.v[f]} ${BATTING_LABELS[f]}`).join(", ")})
                          </span>
                        ) : null}
                      </summary>
                      <div className="mt-2 grid grid-cols-2 gap-2 min-[380px]:grid-cols-3">
                        {MORE.map((f) => (
                          <Stepper
                            key={f}
                            short={BATTING_LABELS[f]}
                            label={`${nameOf(b.playerId)} ${BATTING_LABELS[f]}`}
                            value={b.v[f]}
                            max={BATTING_MAX[f]}
                            invalid={Boolean(e[f])}
                            onChange={(n) => setBatV(i, f, n)}
                          />
                        ))}
                      </div>
                    </details>
                    {errList(errText(e))}
                  </li>
                );
              })}
            </ol>
          </>
        )}

        {notInLineup.length > 0 ? (
          <div className="rounded-xl bg-white p-3 ring-1 ring-zinc-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Add to lineup
              </p>
              <button
                type="button"
                onClick={addAll}
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                Add everyone
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {notInLineup.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addBatter(p.id)}
                  className="h-9 rounded-full bg-white px-3 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
                >
                  + {p.jersey != null ? `#${p.jersey} ` : ""}
                  {p.short}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* ------------------------------------------------------------ Pitching */}
      <section className="space-y-3" aria-labelledby="pitching-h">
        <div>
          <h2 id="pitching-h" className="text-lg font-semibold">
            Pitching
          </h2>
          <p className="text-sm text-zinc-600">
            In the order they pitched. Type innings like <strong>4.2</strong> (4 innings and 2
            outs).
          </p>
        </div>

        {pitchers.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto rounded-xl bg-white ring-1 ring-zinc-200 md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                    <th className="px-2 py-2 text-left font-medium">Pitcher</th>
                    <th className="w-16 px-0.5 py-2 font-medium">IP</th>
                    {PITCH_NUMS.map((f) => (
                      <th key={f} className="w-11 px-0.5 py-2 font-medium">
                        {PITCH_LABEL[f]}
                      </th>
                    ))}
                    <th className="w-14 px-0.5 py-2 font-medium">Pitches</th>
                    <th className="w-14 px-0.5 py-2 font-medium">Strikes</th>
                    <th className="w-16 px-0.5 py-2 font-medium">Dec</th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody>
                  {pitchers.map((p, i) => {
                    const e = pitchErrors[i] ?? {};
                    const items = errText(e);
                    const notes = pitchNotes(p);
                    return (
                      <Fragment key={p.playerId}>
                        <tr
                          className={cn(
                            items.length || notes.length ? "" : "border-b border-zinc-100",
                          )}
                        >
                          <th
                            scope="row"
                            className="px-2 py-1 text-left font-medium whitespace-nowrap"
                          >
                            {nameOf(p.playerId)}
                          </th>
                          <td className="px-0.5 py-1">
                            <IPInput
                              p={p}
                              i={i}
                              invalid={Boolean(e.ip)}
                              name={nameOf(p.playerId)}
                              onChange={setPit}
                            />
                          </td>
                          {PITCH_NUMS.map((f) => (
                            <td key={f} className="px-0.5 py-1">
                              <NumInput
                                label={`${nameOf(p.playerId)} pitching ${PITCH_LABEL[f]}`}
                                value={p.v[f]}
                                max={60}
                                invalid={Boolean(e[f])}
                                onChange={(n) => setPit(i, { v: { ...p.v, [f]: n ?? 0 } })}
                              />
                            </td>
                          ))}
                          <td className="px-0.5 py-1">
                            <NumInput
                              label={`${nameOf(p.playerId)} pitches`}
                              value={p.pitches}
                              allowEmpty
                              max={250}
                              invalid={Boolean(e.pitches)}
                              onChange={(n) => setPit(i, { pitches: n })}
                            />
                          </td>
                          <td className="px-0.5 py-1">
                            <NumInput
                              label={`${nameOf(p.playerId)} strikes`}
                              value={p.strikes}
                              allowEmpty
                              max={250}
                              invalid={Boolean(e.strikes)}
                              onChange={(n) => setPit(i, { strikes: n })}
                            />
                          </td>
                          <td className="px-0.5 py-1">
                            <DecisionSelect
                              p={p}
                              i={i}
                              name={nameOf(p.playerId)}
                              onChange={setPit}
                            />
                          </td>
                          <td className="px-1 text-right whitespace-nowrap">
                            <MoveButtons
                              i={i}
                              n={pitchers.length}
                              name={nameOf(p.playerId)}
                              move={movePitcher}
                              remove={removePitcher}
                            />
                          </td>
                        </tr>
                        {items.length || notes.length ? (
                          <tr className="border-b border-zinc-100">
                            <td colSpan={PITCH_NUMS.length + 6} className="space-y-1 px-2 pb-2">
                              {errList(items)}
                              {noteList(p)}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ol className="space-y-3 md:hidden">
              {pitchers.map((p, i) => {
                const e = pitchErrors[i] ?? {};
                return (
                  <li
                    key={p.playerId}
                    className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-zinc-200"
                  >
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate font-semibold">{nameOf(p.playerId)}</p>
                      <MoveButtons
                        i={i}
                        n={pitchers.length}
                        name={nameOf(p.playerId)}
                        move={movePitcher}
                        remove={removePitcher}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="block">
                        <span className="block text-center text-[11px] font-semibold text-zinc-500">
                          IP
                        </span>
                        <IPInput
                          p={p}
                          i={i}
                          invalid={Boolean(e.ip)}
                          name={nameOf(p.playerId)}
                          onChange={setPit}
                          className="mt-1 h-11 w-full"
                        />
                      </label>
                      <label className="block">
                        <span className="block text-center text-[11px] font-semibold text-zinc-500">
                          Pitches
                        </span>
                        <NumInput
                          label={`${nameOf(p.playerId)} pitches`}
                          value={p.pitches}
                          allowEmpty
                          max={250}
                          invalid={Boolean(e.pitches)}
                          onChange={(n) => setPit(i, { pitches: n })}
                          className="mt-1 h-11 w-full"
                        />
                      </label>
                      <label className="block">
                        <span className="block text-center text-[11px] font-semibold text-zinc-500">
                          Strikes
                        </span>
                        <NumInput
                          label={`${nameOf(p.playerId)} strikes`}
                          value={p.strikes}
                          allowEmpty
                          max={250}
                          invalid={Boolean(e.strikes)}
                          onChange={(n) => setPit(i, { strikes: n })}
                          className="mt-1 h-11 w-full"
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-3">
                      {PITCH_NUMS.map((f) => (
                        <Stepper
                          key={f}
                          short={PITCH_LABEL[f]}
                          label={`${nameOf(p.playerId)} pitching ${PITCH_LABEL[f]}`}
                          value={p.v[f]}
                          max={60}
                          invalid={Boolean(e[f])}
                          onChange={(n) => setPit(i, { v: { ...p.v, [f]: n ?? 0 } })}
                        />
                      ))}
                      <label className="block rounded-lg p-1.5 ring-1 ring-zinc-200">
                        <span className="block text-center text-[11px] font-semibold text-zinc-500">
                          Decision
                        </span>
                        <DecisionSelect
                          p={p}
                          i={i}
                          name={nameOf(p.playerId)}
                          onChange={setPit}
                          className="mt-1 h-11 w-full"
                        />
                      </label>
                    </div>
                    {errList(errText(e))}
                    {noteList(p)}
                  </li>
                );
              })}
            </ol>
          </>
        ) : null}

        {notPitching.length > 0 ? (
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-zinc-800">Add pitcher</span>
            <select
              value=""
              onChange={(e) => addPitcher(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-lg border-0 bg-white px-3 text-base ring-1 ring-inset ring-zinc-300 sm:max-w-xs sm:flex-none sm:text-sm"
            >
              <option value="">Choose a player…</option>
              {notPitching.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jersey != null ? `#${p.jersey} ` : ""}
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Pitch counts here are logged to Throwing automatically — don&apos;t log this game twice.
          They count toward each pitcher&apos;s Pitch Smart rest and availability.
        </p>
      </section>

      {/* -------------------------------------------------------------- Save */}
      <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        {errList(check.errors)}
        {check.warnings.length ? (
          <ul className="space-y-0.5 text-xs text-amber-800">
            {check.warnings.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        ) : null}
        <FormMessage state={result} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={save} disabled={!canSave || pending}>
            {pending ? "Saving…" : "Save box score"}
          </Button>
          {!canSave ? (
            <span className="text-sm text-red-700">Fix the boxes in red to save.</span>
          ) : dirty ? (
            <span className="text-sm text-zinc-500">Unsaved changes</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function IPInput({
  p,
  i,
  name,
  invalid,
  onChange,
  className,
}: {
  p: Pitcher;
  i: number;
  name: string;
  invalid: boolean;
  onChange: (i: number, patch: Partial<Pitcher>) => void;
  className?: string;
}) {
  return (
    <input
      inputMode="decimal"
      autoComplete="off"
      aria-label={`${name} innings pitched`}
      aria-invalid={invalid || undefined}
      placeholder="0.0"
      value={p.ip}
      onChange={(e) => onChange(i, { ip: e.target.value.slice(0, 5) })}
      className={cn(
        cellBase,
        invalid ? "bg-red-50 ring-red-500" : "ring-zinc-300",
        "placeholder:text-zinc-300",
        className ?? "w-full",
      )}
    />
  );
}

function DecisionSelect({
  p,
  i,
  name,
  onChange,
  className,
}: {
  p: Pitcher;
  i: number;
  name: string;
  onChange: (i: number, patch: Partial<Pitcher>) => void;
  className?: string;
}) {
  return (
    <select
      aria-label={`${name} decision`}
      value={p.decision}
      onChange={(e) => onChange(i, { decision: e.target.value as Decision | "" })}
      className={cn(
        "h-10 rounded-md border-0 bg-white px-1 text-base ring-1 ring-inset ring-zinc-300 sm:text-sm",
        className ?? "w-16",
      )}
    >
      <option value="">—</option>
      {DECISIONS.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
    </select>
  );
}

function MoveButtons({
  i,
  n,
  name,
  move,
  remove,
}: {
  i: number;
  n: number;
  name: string;
  move: (i: number, d: -1 | 1) => void;
  remove: (i: number) => void;
}) {
  const b = "size-9 rounded-md text-zinc-500 hover:bg-zinc-100 disabled:opacity-30";
  return (
    <span className="inline-flex shrink-0 items-center">
      <button
        type="button"
        className={b}
        disabled={i === 0}
        onClick={() => move(i, -1)}
        aria-label={`Move ${name} up`}
      >
        ↑
      </button>
      <button
        type="button"
        className={b}
        disabled={i === n - 1}
        onClick={() => move(i, 1)}
        aria-label={`Move ${name} down`}
      >
        ↓
      </button>
      <button
        type="button"
        className={cn(b, "text-lg hover:text-red-600")}
        onClick={() => remove(i)}
        aria-label={`Remove ${name} from pitching`}
      >
        ×
      </button>
    </span>
  );
}
