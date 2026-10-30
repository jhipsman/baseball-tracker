"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PA_RESULTS, type Result } from "@/lib/live/engine";
import {
  baseLabel,
  defaultRbi,
  fieldZone,
  isContactResult,
  opponentBatterId,
  proposeMoves,
  resolveRunnerPlay,
  runnerEntries,
  type Base,
  type Bases,
  type Contact,
  type Destination,
  type PlayDetails,
  type RunnerReason,
} from "@/lib/live/runners";
import type { ScorerProps, ScoringActions } from "./scoring-types";
import { BaseballDiamond } from "./baseball-diamond";
import styles from "./scoring-workspace.module.css";

const ordinalSlot = (n: number) =>
  `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
type Hit = "ground" | "line" | "fly" | "pop" | "bunt";
const HITS: { key: Hit; label: string; icon: string }[] = [
  { key: "ground", label: "Ground ball", icon: "⤵" },
  { key: "line", label: "Line drive", icon: "→" },
  { key: "fly", label: "Fly ball", icon: "⤴" },
  { key: "pop", label: "Pop up", icon: "↑" },
  { key: "bunt", label: "Bunt", icon: "↘" },
];
/** The results that can follow each kind of contact, most common first. */
const RESULTS_FOR: Record<Hit, Result[]> = {
  ground: ["1B", "GO", "E", "FC", "DP", "2B", "3B"],
  line: ["1B", "2B", "LO", "3B", "HR", "E", "DP"],
  fly: ["FO", "1B", "2B", "3B", "HR", "SF", "E"],
  pop: ["PO", "1B", "E"],
  bunt: ["SAC", "1B", "GO", "E", "FC", "PO"],
};
const PITCHES = [
  ["ball", "Ball", "B"],
  ["called", "Strike looking", "Ꝁ"],
  ["swinging", "Strike swinging", "K"],
  ["foul", "Foul", "F"],
] as const;

type Draft = {
  result: Result | null;
  details: PlayDetails;
  step: "contact" | "location" | "result" | "runners";
  /** Set when the play started from "In play": how the ball was hit. */
  hit?: Hit;
  showAll?: boolean;
  addPitch: boolean;
  seq: number;
  rbi?: number;
  unearned: number;
};
export function ScoringWorkspace(p: ScorerProps & { actions: ScoringActions }) {
  const [tab, setTab] = useState("score");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [panel, setPanel] = useState<"bases" | "tools" | null>(null);
  const [snapshot, setSnapshot] = useState<Bases>({});
  const [playerId, setPlayerId] = useState("");
  const [slot, setSlot] = useState(0);
  const [endRuns, setEndRuns] = useState(0);
  const [finishConfirm, setFinishConfirm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!panel) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), select, input, [tabindex="0"]',
        ) ?? [],
      );
    focusable()[0]?.focus();
    function keys(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPanel(null);
        return;
      }
      if (event.key !== "Tab") return;
      const targets = focusable(),
        first = targets[0],
        last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("keydown", keys);
      previous?.focus();
    };
  }, [panel]);

  const card = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const step = draft?.step;
  useEffect(() => {
    // Phones: keep the part being asked about on screen (the field when choosing where).
    if (!step) return;
    const target = step === "location" ? fieldRef.current : card.current;
    target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [step]);
  const name = (id: string) =>
    p.roster.find((r) => r.id === id)?.name ?? (id.startsWith("opponent:") ? "Opponent" : "Player");
  const batterId = p.weBat
    ? (p.lineup[p.batterIdx % p.lineup.length]?.id ?? "")
    : opponentBatterId(p.lastSeq + 1);
  const batterName = p.weBat ? name(batterId) : `${p.opponent} batter`;
  const summary =
    draft && draft.step === "runners"
      ? resolveRunnerPlay({
          bases: p.bases,
          batterId: draft.result ? batterId : null,
          result: draft.result,
          outsBefore: p.outs,
          details: draft.details,
        })
      : null;
  const locked = pending || p.final;
  function run(action: () => Promise<{ error?: string }>, success: string) {
    setError("");
    setNotice("");
    start(async () => {
      try {
        const result = await action();
        if (result.error) {
          setError(result.error);
          return;
        }
        setDraft(null);
        setPanel(null);
        setFinishConfirm(false);
        setNotice(success);
      } catch {
        setError("That did not save. Check your connection and try again.");
      }
    });
  }
  function begin(result: Result, addPitch = false) {
    setError("");
    if (!p.basesKnown) {
      setSnapshot({});
      setPanel("bases");
      return;
    }
    const contact: Contact = ["GO", "DP", "FC"].includes(result)
      ? "ground"
      : ["FO", "SF", "PO"].includes(result)
        ? "fly"
        : result === "SAC"
          ? "bunt"
          : "line";
    setDraft({
      result,
      details: {
        version: 1,
        moves: proposeMoves(p.bases, batterId, result),
        ...(isContactResult(result) ? { contact } : {}),
      },
      step: isContactResult(result) ? "location" : "runners",
      addPitch,
      seq: p.lastSeq,
      unearned: 0,
    });
  }
  function move(id: string, to: Destination) {
    setDraft((d) =>
      d
        ? {
            ...d,
            rbi: undefined,
            details: {
              ...d.details,
              moves: d.details.moves.map((m) => (m.id === id ? { ...m, to } : m)),
            },
          }
        : d,
    );
  }
  function runner(base: Base) {
    if (!p.basesKnown || !p.bases[base]) {
      setSnapshot({ ...p.bases });
      setPanel("bases");
      return;
    }
    setDraft({
      result: null,
      details: {
        version: 1,
        reason: "advance",
        moves: runnerEntries(p.bases).map((r) => ({
          id: r.id,
          from: r.base,
          to: r.base === base ? (base === 3 ? "home" : ((base + 1) as Base)) : r.base,
        })),
      },
      step: "runners",
      addPitch: false,
      seq: p.lastSeq,
      unearned: 0,
    });
  }
  /** "In play": how it was hit → where → what happened → runners. */
  function startInPlay() {
    setError("");
    if (!p.basesKnown) {
      setSnapshot({});
      setPanel("bases");
      return;
    }
    setDraft({
      result: null,
      details: { version: 1, moves: [] },
      step: "contact",
      addPitch: true,
      seq: p.lastSeq,
      unearned: 0,
    });
  }
  function chooseHit(hit: Hit) {
    setDraft((d) =>
      d
        ? {
            ...d,
            hit,
            showAll: false,
            step: "location",
            details: { ...d.details, contact: hit === "pop" ? "fly" : hit },
          }
        : d,
    );
  }
  function pickResult(result: Result) {
    if (!draft?.hit) return begin(result, draft?.addPitch);
    const { contact, location } = draft.details;
    setDraft({
      ...draft,
      result,
      rbi: undefined,
      step: "runners",
      details: {
        version: 1,
        moves: proposeMoves(p.bases, batterId, result),
        ...(isContactResult(result) ? { contact, ...(location ? { location } : {}) } : {}),
      },
    });
  }
  function back() {
    setDraft((d) => {
      if (!d) return d;
      if (d.step === "runners" && d.result) return { ...d, step: "result" };
      if (d.step === "result" && d.hit) return { ...d, step: "location" };
      if (d.step === "location") return { ...d, step: d.hit ? "contact" : "result" };
      return d;
    });
  }
  const hitLabel = HITS.find((h) => h.key === draft?.hit)?.label;
  const chosen = () => (
    <div className={styles.selectedResult}>
      <b>{[resultLabel, hitLabel].filter(Boolean).join(" · ")}</b>
      {draft?.details.location && <span>↗ {fieldZone(draft.details.location)}</span>}
      <button onClick={back}>← Back</button>
    </div>
  );
  const flowSteps: [Draft["step"], string][] = !draft
    ? []
    : draft.addPitch
      ? [
          ["contact", "How"],
          ["location", "Where"],
          ["result", "Result"],
          ["runners", "Runners"],
        ]
      : draft.result
        ? [
            ["result", "Result"],
            ["location", "Where"],
            ["runners", "Runners"],
          ]
        : [];
  const stepIndex = flowSteps.findIndex(([k]) => k === draft?.step);
  const previewBases = summary && !("error" in summary) ? summary.bases : p.bases;
  const resultLabel = draft?.result
    ? PA_RESULTS.find((r) => r.key === draft.result)?.long
    : draft?.step === "runners" && !draft.hit
      ? "Runner advance"
      : "";
  return (
    <section className={styles.workspace} aria-label="Live game scoring">
      <header className={styles.scoreboard}>
        <div className={styles.scoreTop}>
          <span className={styles.live}>{p.final ? "FINAL" : "● LIVE GAME"}</span>
          <span>
            {p.inningLabel} · {p.outs} out{p.outs !== 1 ? "s" : ""}
          </span>
          <button onClick={() => setPanel("tools")} aria-label="Game tools">
            •••
          </button>
        </div>
        <div className={styles.matchup}>
          <div>
            <span className={styles.teamBadge}>{p.teamName.slice(0, 2).toUpperCase()}</span>
            <h2>
              {p.teamName}
              <small>{p.weBat ? "AT BAT" : "IN THE FIELD"}</small>
            </h2>
            <strong>{p.us}</strong>
          </div>
          <span className={styles.vs}>vs</span>
          <div>
            <span className={`${styles.teamBadge} ${styles.awayBadge}`}>
              {p.opponent.slice(0, 2).toUpperCase()}
            </span>
            <h2>
              {p.opponent}
              <small>{p.weBat ? "IN THE FIELD" : "AT BAT"}</small>
            </h2>
            <strong>{p.them}</strong>
          </div>
        </div>
        <div className={styles.scoreBottom}>
          <div className={styles.lineScore}>
            <span>INN</span>
            {Array.from({ length: Math.max(7, p.lineScore.length) }, (_, i) => (
              <span key={i}>
                {i + 1}
                <b>{p.lineScore[i] ? `${p.lineScore[i].us}–${p.lineScore[i].them}` : "–"}</b>
              </span>
            ))}
          </div>
          <div className={styles.count}>
            {[
              ["B", p.balls, 3],
              ["S", p.strikes, 2],
              ["O", p.outs, 2],
            ].map(([label, value, max]) => (
              <span key={label}>
                {label}
                {Array.from({ length: Number(max) }, (_, i) => (
                  <i key={i} className={i < Number(value) ? styles.lit : ""} />
                ))}
              </span>
            ))}
          </div>
        </div>
      </header>
      <nav className={styles.tabs} aria-label="Scorer views">
        {[
          ["score", "Score game"],
          ["feed", "Play-by-play"],
          ["lineup", "Lineup"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
        <button
          className={styles.undo}
          disabled={pending || !p.lastSeq}
          onClick={() => run(p.actions.undo, "Last play undone")}
        >
          ↶ Undo
        </button>
      </nav>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.notice} role="status">
        {pending ? "Saving…" : notice}
      </div>
      {tab === "score" && (
        <>
          <div className={styles.duel}>
            <div>
              <small>
                AT BAT{p.weBat ? ` · ${ordinalSlot(p.batterIdx + 1)} in the order` : ""}
              </small>
              <b>{p.weBat ? batterName : "Their batter"}</b>
              <span aria-live="polite">
                {p.balls}–{p.strikes} count · {p.atBatPitches} pitch
                {p.atBatPitches === 1 ? "" : "es"}
              </span>
            </div>
            <div>
              <small>OUR PITCHER</small>
              <b>{p.pitcher?.name ?? "Not set"}</b>
              <span>
                <strong data-testid="pitch-total">{p.pitches}</strong> pitches today
              </span>
            </div>
          </div>
          {!p.hasBirthdate && p.pitcher && (
            <p className={styles.workload}>
              Add your pitcher’s birth date to see age-based Pitch Smart limits.
            </p>
          )}
          {p.smart && (
            <p
              className={`${styles.workload} ${styles.smart} ${
                p.smart.over
                  ? styles.smartOver
                  : p.smart.untilMoreRest != null && p.smart.untilMoreRest <= 5
                    ? styles.smartNear
                    : ""
              }`}
              data-testid="pitch-smart"
              role="status"
            >
              {p.smart.over ? (
                <b>
                  <span className={styles.smartIcon} aria-hidden="true">
                    ⛔
                  </span>
                  Over the Pitch Smart daily max ({p.smart.dailyMax}, ages {p.smart.ages}).
                </b>
              ) : (
                <>
                  <span className={styles.smartIcon} aria-hidden="true">
                    {p.smart.untilMoreRest != null && p.smart.untilMoreRest <= 5 ? "⚠" : "✓"}
                  </span>
                  {p.smart.left} left today (max {p.smart.dailyMax}).{" "}
                  {p.smart.restNow === 0
                    ? "Stop now: no rest needed."
                    : `Stop now: ${p.smart.restNow} day${p.smart.restNow === 1 ? "" : "s"} rest.`}{" "}
                  {p.smart.untilMoreRest != null ? (
                    <b className={styles.smartNext}>
                      {p.smart.untilMoreRest} more → {p.smart.restAfterNext} day
                      {p.smart.restAfterNext === 1 ? "" : "s"} rest.
                    </b>
                  ) : null}
                </>
              )}
            </p>
          )}
          <div className={`${styles.scoringGrid} ${draft ? styles.building : ""}`}>
            <div className={styles.fieldColumn} ref={fieldRef}>
              <BaseballDiamond
                bases={previewBases}
                known={p.basesKnown}
                name={name}
                disabled={locked}
                choosingLocation={draft?.step === "location"}
                location={draft?.details.location}
                onLocation={(location) =>
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          step: d.hit && !d.result ? "result" : "runners",
                          details: { ...d.details, location },
                        }
                      : d,
                  )
                }
                onBase={runner}
                provisional={!!draft && draft.step === "runners"}
              />
              <div className={styles.fieldFooter}>
                <span>◆ Tap a runner to advance or record an out</span>
                <button
                  disabled={locked}
                  onClick={() => {
                    setSnapshot({ ...p.bases });
                    setPanel("bases");
                  }}
                >
                  Set bases
                </button>
              </div>
            </div>
            <div className={styles.controls}>
              {draft ? (
                <div className={styles.playCard} ref={card}>
                  <div className={styles.cardHeading}>
                    <div>
                      <small>
                        {draft.addPitch ? "BALL IN PLAY" : "RECORD A PLAY"} · NOT SAVED YET
                      </small>
                      <h3>
                        {draft.step === "contact"
                          ? "How was it hit?"
                          : draft.step === "result"
                            ? "What happened?"
                            : draft.step === "location"
                              ? "Where did it go?"
                              : draft.result
                                ? "Where did everyone end up?"
                                : "Move a runner"}
                      </h3>
                    </div>
                    <button aria-label="Cancel play" onClick={() => setDraft(null)}>
                      ✕
                    </button>
                  </div>
                  {flowSteps.length ? (
                    <div className={styles.steps}>
                      {flowSteps.map(([key, label], i) => (
                        <span key={key} className={i <= stepIndex ? styles.activeStep : ""}>
                          {i + 1} {label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {draft.step === "contact" ? (
                    <div className={styles.results}>
                      {HITS.map((h) => (
                        <button key={h.key} disabled={locked} onClick={() => chooseHit(h.key)}>
                          <b aria-hidden="true">{h.icon}</b>
                          <small>{h.label}</small>
                        </button>
                      ))}
                    </div>
                  ) : draft.step === "location" ? (
                    <>
                      {chosen()}
                      <p className={styles.help}>Tap the field where the ball went.</p>
                      <button
                        className={styles.secondary}
                        onClick={() =>
                          setDraft((d) =>
                            d ? { ...d, step: d.hit && !d.result ? "result" : "runners" } : d,
                          )
                        }
                      >
                        Skip · not sure where →
                      </button>
                    </>
                  ) : draft.step === "result" ? (
                    <>
                      {draft.hit ? chosen() : null}
                      <div className={styles.results}>
                        {(draft.hit && !draft.showAll
                          ? RESULTS_FOR[draft.hit].map((k) => PA_RESULTS.find((r) => r.key === k)!)
                          : PA_RESULTS
                        ).map((r) => (
                          <button
                            key={r.key}
                            disabled={
                              locked ||
                              (r.key === "DP" && (p.outs > 1 || !Object.keys(p.bases).length))
                            }
                            onClick={() => pickResult(r.key)}
                          >
                            <b>{r.label}</b>
                            <small>{r.long}</small>
                          </button>
                        ))}
                      </div>
                      {draft.hit && !draft.showAll ? (
                        <button
                          className={styles.textButton}
                          onClick={() => setDraft((d) => (d ? { ...d, showAll: true } : d))}
                        >
                          Something else…
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {draft.result ? chosen() : null}
                      {!draft.result && (
                        <label className={styles.label}>
                          Reason
                          <select
                            value={draft.details.reason}
                            onChange={(e) =>
                              setDraft((d) =>
                                d
                                  ? {
                                      ...d,
                                      details: {
                                        ...d.details,
                                        reason: e.target.value as RunnerReason,
                                      },
                                    }
                                  : d,
                              )
                            }
                          >
                            {[
                              ["advance", "Advance"],
                              ["stolen_base", "Stolen base"],
                              ["caught_stealing", "Caught stealing"],
                              ["wild_pitch", "Wild pitch"],
                              ["passed_ball", "Passed ball"],
                              ["out", "Runner out"],
                            ].map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <p className={styles.help}>
                        Confirm where every runner finished. Suggested advances can be changed.
                      </p>
                      {draft.details.moves.map((m) => (
                        <label className={styles.runnerRow} key={m.id}>
                          <span>
                            <b>{name(m.id)}</b>
                            <small>{baseLabel(m.from)} →</small>
                          </span>
                          <select
                            aria-label={`Destination for ${name(m.id)} from ${baseLabel(m.from)}`}
                            value={m.to}
                            onChange={(e) =>
                              move(
                                m.id,
                                /^[123]$/.test(e.target.value)
                                  ? (Number(e.target.value) as Base)
                                  : (e.target.value as Destination),
                              )
                            }
                          >
                            {([1, 2, 3, "home", "out", "no_run"] as Destination[])
                              .filter((to) => typeof to !== "number" || to >= m.from)
                              .map((to) => (
                                <option key={to} value={to}>
                                  {typeof to === "number"
                                    ? `${baseLabel(to)} base`
                                    : to === "no_run"
                                      ? "No run (third out)"
                                      : to === "home"
                                        ? "Home · scores"
                                        : "Out"}
                                </option>
                              ))}
                          </select>
                        </label>
                      ))}
                      {p.outs + draft.details.moves.filter((m) => m.to === "out").length === 3 && (
                        <label className={styles.label}>
                          Third-out ruling
                          <select
                            value={draft.details.thirdOut ?? ""}
                            onChange={(e) =>
                              setDraft((d) =>
                                d
                                  ? {
                                      ...d,
                                      details: {
                                        ...d.details,
                                        thirdOut: e.target.value
                                          ? (e.target.value as "force" | "timing")
                                          : undefined,
                                      },
                                    }
                                  : d,
                              )
                            }
                          >
                            <option value="">Choose if runs crossed home</option>
                            <option value="force">Force / batter out · no runs count</option>
                            <option value="timing">
                              Timing play · only runners who scored before the out
                            </option>
                          </select>
                        </label>
                      )}
                      {summary && "error" in summary ? (
                        <p className={styles.error}>{summary.error}</p>
                      ) : (
                        summary && (
                          <div className={styles.playSummary}>
                            <b>
                              {summary.runs} run{summary.runs !== 1 ? "s" : ""} · {summary.outs} out
                              {summary.outs !== 1 ? "s" : ""}
                            </b>
                            <span>
                              After this play: {p.us + (p.weBat ? summary.runs : 0)}–
                              {p.them + (!p.weBat ? summary.runs : 0)}
                            </span>
                          </div>
                        )
                      )}
                      {summary && !("error" in summary) && summary.runs > 0 && (
                        <label className={styles.label}>
                          {p.weBat ? "Runs batted in" : "Unearned runs (scorer ruling)"}
                          <input
                            type="number"
                            min={0}
                            max={summary.runs}
                            value={
                              p.weBat
                                ? (draft.rbi ?? defaultRbi(draft.result, summary.runs))
                                : draft.unearned
                            }
                            onChange={(e) =>
                              setDraft((d) =>
                                d
                                  ? {
                                      ...d,
                                      ...(p.weBat
                                        ? { rbi: Number(e.target.value) }
                                        : { unearned: Number(e.target.value) }),
                                    }
                                  : d,
                              )
                            }
                          />
                        </label>
                      )}
                      <button
                        className={styles.primary}
                        disabled={locked || !summary || "error" in summary}
                        onClick={() =>
                          run(
                            () =>
                              p.actions.record({
                                kind: draft.result ? "pa" : "runner",
                                result: draft.result,
                                details: draft.details,
                                expectedSeq: draft.seq,
                                addPitch: draft.addPitch,
                                rbi: draft.rbi,
                                unearned: draft.unearned,
                              }),
                            "Play recorded",
                          )
                        }
                      >
                        ✓ Confirm play{draft.addPitch ? " + contact pitch" : ""}
                      </button>
                      {draft.details.location && (
                        <button
                          className={styles.textButton}
                          onClick={() => setDraft((d) => (d ? { ...d, step: "location" } : d))}
                        >
                          Edit field location
                        </button>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <>
                  {!p.basesKnown && (
                    <p className={styles.warning}>
                      This older game has no runner positions. Set the current bases to continue
                      scoring; its existing score stays intact.
                    </p>
                  )}
                  <div className={styles.pitchButtons} role="group" aria-label="Pitch result">
                    {PITCHES.map(([kind, label, symbol]) => (
                      <button
                        key={kind}
                        disabled={locked || !p.basesKnown}
                        onClick={() => run(() => p.actions.pitch(kind), `${label} recorded`)}
                      >
                        <b aria-hidden="true">{symbol}</b>
                        <span>{label}</span>
                      </button>
                    ))}
                    <button
                      className={styles.inPlay}
                      disabled={locked || !p.basesKnown}
                      onClick={startInPlay}
                    >
                      <b aria-hidden="true">⚾</b>
                      <span>In play</span>
                    </button>
                  </div>
                  <button
                    className={styles.textButton}
                    disabled={locked}
                    onClick={() => {
                      if (!p.basesKnown) {
                        setSnapshot({});
                        setPanel("bases");
                        return;
                      }
                      setDraft({
                        result: null,
                        details: { version: 1, moves: [] },
                        step: "result",
                        addPitch: false,
                        seq: p.lastSeq,
                        unearned: 0,
                      });
                    }}
                  >
                    Other: hit by pitch, intentional walk, error…
                  </button>
                  <div className={styles.recent}>
                    <small>LAST PLAY</small>
                    <p>{p.feed[0]?.text ?? "Ready for the first pitch."}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
      {tab === "feed" && (
        <div className={styles.feed}>
          <h3>Game story</h3>
          {p.feed.length ? (
            p.feed.map((play) => (
              <article key={play.seq}>
                <span>{play.label}</span>
                <p>{play.text}</p>
                <small>#{play.seq}</small>
              </article>
            ))
          ) : (
            <p>No plays yet.</p>
          )}
        </div>
      )}
      {tab === "lineup" && (
        <div className={styles.feed}>
          <h3>{p.teamName} · Batting order</h3>
          {p.lineup.map((player, i) => (
            <article key={`${i}-${player.id}`}>
              <span>{i + 1}</span>
              <p>{player.name}</p>
              {i === p.batterIdx && <small>UP NEXT</small>}
            </article>
          ))}
          <button className={styles.secondary} onClick={() => setPanel("tools")}>
            Manage substitutions
          </button>
        </div>
      )}
      {panel && (
        <div className={styles.overlay}>
          <section
            className={styles.sheet}
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label={panel === "bases" ? "Set current bases" : "Game tools"}
          >
            <div className={styles.cardHeading}>
              <h3>{panel === "bases" ? "Set current bases" : "Game tools"}</h3>
              <button
                aria-label="Close tools"
                disabled={pending}
                onClick={() => {
                  setPanel(null);
                  setFinishConfirm(false);
                }}
              >
                ✕
              </button>
            </div>
            {panel === "bases" ? (
              <>
                <p className={styles.help}>
                  Match the diamond to the field. This saves a correction without changing runs,
                  outs, or batting order.
                </p>
                {([1, 2, 3] as Base[]).map((base) => (
                  <label key={base} className={styles.label}>
                    {baseLabel(base)} base
                    {p.weBat ? (
                      <select
                        value={snapshot[base] ?? ""}
                        onChange={(e) =>
                          setSnapshot((s) => {
                            const next = { ...s };
                            if (e.target.value) next[base] = e.target.value;
                            else delete next[base];
                            return next;
                          })
                        }
                      >
                        <option value="">Empty</option>
                        {p.roster.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="checkbox"
                        checked={!!snapshot[base]}
                        onChange={(e) =>
                          setSnapshot((s) => {
                            const next = { ...s };
                            if (e.target.checked)
                              next[base] = `opponent:base:${p.lastSeq + 1}:${base}`;
                            else delete next[base];
                            return next;
                          })
                        }
                      />
                    )}
                  </label>
                ))}
                <button
                  className={styles.primary}
                  disabled={
                    locked ||
                    new Set(Object.values(snapshot)).size !== Object.values(snapshot).length
                  }
                  onClick={() =>
                    run(
                      () =>
                        p.actions.record({
                          kind: "bases",
                          expectedSeq: p.lastSeq,
                          details: { version: 1, moves: [], snapshot },
                        }),
                      "Bases updated",
                    )
                  }
                >
                  Confirm bases
                </button>
              </>
            ) : (
              <>
                <label className={styles.label}>
                  Player
                  <select value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
                    <option value="">Choose a player</option>
                    {p.roster.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.label}>
                  Substitution
                  <select value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
                    <option value={0}>Pitcher</option>
                    {p.lineup.map((r, i) => (
                      <option key={i} value={i + 1}>
                        Batting #{i + 1} · {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className={styles.secondary}
                  disabled={locked || !playerId}
                  onClick={() =>
                    run(
                      () =>
                        p.actions.record({
                          kind: "sub",
                          playerId,
                          slot: slot || null,
                          expectedSeq: p.lastSeq,
                        }),
                      "Substitution recorded",
                    )
                  }
                >
                  Save substitution
                </button>
                <div className={styles.sectionLabel}>COUNT CORRECTION</div>
                <div className={styles.segment}>
                  {[
                    ["minus", "Undo pitch"],
                    ["plus", "Add pitch"],
                    ["reset", "Reset B/S"],
                  ].map(([kind, label]) => (
                    <button
                      key={kind}
                      disabled={locked}
                      onClick={() =>
                        run(
                          () => p.actions.pitch(kind as Parameters<ScoringActions["pitch"]>[0]),
                          "Count updated",
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className={styles.sectionLabel}>END THIS HALF</div>
                <label className={styles.label}>
                  Additional runs not yet recorded
                  <input
                    min={0}
                    max={30}
                    type="number"
                    value={endRuns}
                    onChange={(e) => setEndRuns(Number(e.target.value))}
                  />
                </label>
                <button
                  className={styles.secondary}
                  disabled={locked}
                  onClick={() =>
                    run(
                      () =>
                        p.actions.record({
                          kind: "half_end",
                          runs: endRuns,
                          expectedSeq: p.lastSeq,
                        }),
                      "Half ended",
                    )
                  }
                >
                  End half · clear bases
                </button>
                {finishConfirm ? (
                  <>
                    <p className={styles.warning}>
                      Finish at {p.us}–{p.them}? The game will be marked final.
                    </p>
                    <button
                      className={styles.primary}
                      disabled={locked}
                      onClick={() => run(p.actions.finish, "Game marked final")}
                    >
                      Confirm final score
                    </button>
                  </>
                ) : (
                  <button
                    className={styles.textButton}
                    disabled={locked}
                    onClick={() => setFinishConfirm(true)}
                  >
                    Finish game…
                  </button>
                )}
              </>
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
