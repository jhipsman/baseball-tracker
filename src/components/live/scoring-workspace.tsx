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

type Draft = {
  result: Result | null;
  details: PlayDetails;
  step: "result" | "location" | "runners";
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
  const previewBases = summary && !("error" in summary) ? summary.bases : p.bases;
  const resultLabel = draft?.result
    ? PA_RESULTS.find((r) => r.key === draft.result)?.long
    : "Runner advance";
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
        <div className={styles.scoringGrid}>
          <div>
            <BaseballDiamond
              bases={previewBases}
              known={p.basesKnown}
              name={name}
              disabled={locked}
              choosingLocation={draft?.step === "location"}
              location={draft?.details.location}
              onLocation={(location) =>
                setDraft((d) =>
                  d ? { ...d, step: "runners", details: { ...d.details, location } } : d,
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
            <div className={styles.pitcher}>
              <span className={styles.avatar}>{p.pitcher?.name.slice(0, 1) ?? "P"}</span>
              <div>
                <small>YOUR PITCHER</small>
                <b>{p.pitcher?.name ?? "Select a pitcher in game tools"}</b>
              </div>
              <strong>
                {p.pitches}
                <small>PITCHES</small>
              </strong>
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
                    Over the Pitch Smart daily max ({p.smart.dailyMax}, ages {p.smart.ages}).
                  </b>
                ) : (
                  <>
                    {p.smart.left} left today (max {p.smart.dailyMax}).{" "}
                    {p.smart.restNow === 0
                      ? "No rest needed if he stops now."
                      : `Stop now: ${p.smart.restNow} day${p.smart.restNow === 1 ? "" : "s"} rest.`}{" "}
                    {p.smart.untilMoreRest != null ? (
                      <b>
                        {p.smart.untilMoreRest} more → {p.smart.restAfterNext} day
                        {p.smart.restAfterNext === 1 ? "" : "s"} rest.
                      </b>
                    ) : null}
                  </>
                )}
              </p>
            )}
          </div>
          <div className={styles.controls}>
            {draft ? (
              <div className={styles.playCard}>
                <div className={styles.cardHeading}>
                  <div>
                    <small>BUILD A PLAY · NOTHING SAVED YET</small>
                    <h3>
                      {draft.step === "result"
                        ? "What happened?"
                        : draft.step === "location"
                          ? "Where was it fielded?"
                          : "Resolve the runners"}
                    </h3>
                  </div>
                  <button aria-label="Cancel play" onClick={() => setDraft(null)}>
                    ✕
                  </button>
                </div>
                <div className={styles.steps}>
                  <span className={styles.activeStep}>1 Result</span>
                  <span className={draft.step !== "result" ? styles.activeStep : ""}>
                    2 Location
                  </span>
                  <span className={draft.step === "runners" ? styles.activeStep : ""}>
                    3 Confirm
                  </span>
                </div>
                {draft.step === "result" ? (
                  <div className={styles.results}>
                    {PA_RESULTS.map((r) => (
                      <button
                        key={r.key}
                        disabled={
                          locked || (r.key === "DP" && (p.outs > 1 || !Object.keys(p.bases).length))
                        }
                        onClick={() => begin(r.key, draft.addPitch)}
                      >
                        <b>{r.label}</b>
                        <small>{r.long}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className={styles.selectedResult}>
                      <b>{resultLabel}</b>
                      {draft.details.location && <span>↗ {fieldZone(draft.details.location)}</span>}
                      <button onClick={() => setDraft((d) => (d ? { ...d, step: "result" } : d))}>
                        Change
                      </button>
                    </div>
                    {draft.step === "location" ? (
                      <>
                        <div className={styles.segment}>
                          {(["ground", "fly", "line", "bunt"] as Contact[]).map((contact) => (
                            <button
                              key={contact}
                              aria-pressed={draft.details.contact === contact}
                              onClick={() =>
                                setDraft((d) =>
                                  d ? { ...d, details: { ...d.details, contact } } : d,
                                )
                              }
                            >
                              {contact}
                            </button>
                          ))}
                        </div>
                        <p className={styles.help}>
                          Tap the diamond or a fielding position. You can also skip location if it
                          wasn’t recorded.
                        </p>
                        <button
                          className={styles.secondary}
                          onClick={() => setDraft((d) => (d ? { ...d, step: "runners" } : d))}
                        >
                          Continue without location →
                        </button>
                      </>
                    ) : (
                      <>
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
                        {p.outs + draft.details.moves.filter((m) => m.to === "out").length ===
                          3 && (
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
                                {summary.runs} run{summary.runs !== 1 ? "s" : ""} · {summary.outs}{" "}
                                out{summary.outs !== 1 ? "s" : ""}
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
                  </>
                )}
              </div>
            ) : (
              <>
                <div className={styles.atBat}>
                  <small>NOW BATTING{p.weBat ? ` · #${p.batterIdx + 1}` : ""}</small>
                  <h3>{batterName}</h3>
                  <p>
                    {p.balls} balls · {p.strikes} strikes{" "}
                    <span>{p.atBatPitches} pitches this at-bat</span>
                  </p>
                </div>
                {!p.basesKnown && (
                  <p className={styles.warning}>
                    This older game has no runner positions. Set the current bases to continue
                    scoring; its existing score stays intact.
                  </p>
                )}
                <div className={styles.pitchButtons}>
                  {[
                    ["ball", "Ball", "B"],
                    ["called", "Called strike", "Ꝁ"],
                    ["swinging", "Swinging strike", "K"],
                    ["foul", "Foul", "F"],
                  ].map(([kind, label, symbol]) => (
                    <button
                      key={kind}
                      disabled={locked || !p.basesKnown}
                      onClick={() =>
                        run(
                          () => p.actions.pitch(kind as Parameters<ScoringActions["pitch"]>[0]),
                          `${label} recorded`,
                        )
                      }
                    >
                      <b>{symbol}</b>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <button
                  className={styles.inPlay}
                  disabled={locked || !p.basesKnown}
                  onClick={() =>
                    setDraft({
                      result: "1B",
                      details: { version: 1, moves: [] },
                      step: "result",
                      addPitch: true,
                      seq: p.lastSeq,
                      unearned: 0,
                    })
                  }
                >
                  ⚾ Ball in play <span>Choose result → location → runners</span>
                </button>
                <div className={styles.sectionLabel}>RECORD AN AT-BAT RESULT</div>
                <div className={styles.quickResults}>
                  {PA_RESULTS.filter((r) =>
                    ["1B", "2B", "3B", "HR", "GO", "FO", "BB", "K"].includes(r.key),
                  ).map((r) => (
                    <button key={r.key} disabled={locked} onClick={() => begin(r.key)}>
                      <b>{r.label}</b>
                      <small>{r.long}</small>
                    </button>
                  ))}
                </div>
                <button
                  className={styles.secondary}
                  disabled={locked}
                  onClick={() => {
                    if (!p.basesKnown) {
                      setSnapshot({});
                      setPanel("bases");
                      return;
                    }
                    setDraft({
                      result: "1B",
                      details: { version: 1, moves: [] },
                      step: "result",
                      addPitch: false,
                      seq: p.lastSeq,
                      unearned: 0,
                    });
                  }}
                >
                  More results · error, sacrifice, fielder’s choice…
                </button>
                <div className={styles.recent}>
                  <small>LAST PLAY</small>
                  <p>{p.feed[0]?.text ?? "Ready for the first pitch."}</p>
                </div>
              </>
            )}
          </div>
        </div>
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
