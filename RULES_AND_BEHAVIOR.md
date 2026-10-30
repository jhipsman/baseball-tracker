# Recovered scoring rules and behavior

This describes the uploaded GameChanger client engines. It is not an implementation for Diamond Program or a complete baseball rulebook. **Executed** means a specific synthetic scenario ran successfully against the original bundle. **Source-confirmed** means code was inspected but the full behavior was not exercised. **Unknown** marks remaining gaps.

Both baseball bundles were tested. Where they differ, the filename is stated. Function locations are indexed in [function-map.json](function-map.json) using original-source UTF-16 offsets. The Webpack module numbers below refer to `bats_entrypoint.js`; minified class names refer to `entrypoint.js`.

## 1. Engine composition and event history

**Source-confirmed:** baseball controller initialization constructs engines for situation, plays, fielders, lineup, spray charts, pitch data, baserunners, action context, earned runs, play-by-play, stat events, per-inning data, stats, and history. Shared events are the input to multiple projections; some projections consult the pre-event and post-event state of other engines. [Module 4]

The compactor keeps an input stream and an effective output stream. An undo remains in input history while changing effective output. A historical replacement can similarly replace the effective events without merely editing the latest scoreboard. [Modules 6, 44]

The three component streams are ordered **head, main, tail**. A change in an earlier component invalidates the following part of the combined output. The controller rolls dependent engines back to the relevant event boundary. Versioned engines discard later stored states; snapshot-based engines restore an earlier snapshot and process forward. [Modules 6, 7, 44; `Lr.reconcileOutStreamWithChanges`]

This is stronger evidence than the original DEX-only inference about replay. Exact performance on long games was not benchmarked.

**Executed:** grouped pitch/contact undo, simple undo/redo, replacing an earlier single with a double, and canceling provisional scoring all restored/recomputed the checked count, base, batter, and hit-stat values.

## 2. Count and inning transitions

**Source-confirmed and executed:**

- Four count-advancing balls reset count, record a walk, put the batter on first, and advance the batting index.
- Three strikes reset count and retire the batter.
- Ordinary foul balls stop increasing strikes at two. Foul bunts and foul tips can produce strike three.
- Three outs reset count/outs, clear bases, and switch halves. Bottom-to-top advances the inning number.
- A pitch with `advancesCount: false` still increments pitches thrown, while the visible count does not advance.
- Innings can continue beyond the configured regulation length. A synthetic one-inning game advanced to inning two; the engine did not automatically freeze it at regulation.

[Module 13; `qc.reconcileSituation`, `qc.handlePitch`; tests `four-balls`, `third-strike`, `two-strike-foul`, `two-strike-foul-bunt`, `two-strike-foul-tip`, `three-outs`, `two-halves`, `pitch-without-count`, `no-regulation-stop`]

**Important boundary:** the supplied material does not establish complete walk-off, mercy-rule, suspension, or automatic finalization policy. A regulation-length setting also scales some stats; it is not itself evidence of a game-stop rule.

The situation engine retains resulting-count information as well as the next live count. This allows a completed at-bat to be described even after count resets. Whether every Android screen consumes those values correctly was not tested.

## 3. Contextual actions

**Source-confirmed:** the pitch menu receives these calculated flags. Let R be the number of runners on base.

| Flag | Condition |
| --- | --- |
| Fielder's choice | R > 0 |
| Dropped third strike | strikes = 2 and (outs = 2 or first unoccupied) |
| Double play | outs < 2 and R > 0 |
| Fielder's-choice double play | outs < 2 and R ≥ 2 |
| Triple play | outs = 0 and R ≥ 2 |
| Fielder's-choice triple play | outs = 0 and R = 3 |
| Infield fly | outs < 2 and first/second occupied |
| Sacrifice fly | outs < 2 and third occupied |
| Sacrifice bunt | outs < 2 and R > 0 |
| Foul tip / foul-bunt batter-out option | strikes = 2 |
| Balk | baseball and R > 0 |
| Place batter | balls = strikes = outs = R = 0 |

[Module 24; `Oo.pitchActionContext`, original offset 112882]

The illegal-pitch context is separately configured. In the inspected context transformation, youth baseball enables it; prep/college/adult baseball disable it. Softball enables it. Enabled context is `ball` with no runners, `balk_one` with one, and `balk_many` with more. The original caller still supplies the event to score.

**Executed:** dropped-third-strike eligibility at empty/occupied first and with two outs; infield fly; sacrifice fly; adult baseball and adult softball illegal-pitch context.

**Unknown:** exhaustive league-specific options. A disabled context flag is not a proof that a raw event will be rejected.

## 4. Provisional movement and runner decisions

**Source-confirmed:** result configuration initially supplies bases gained, whether the batter is out, and whether the result is an error. The baserunner engine then produces provisional movement. [Modules 11, 22; `Iu.ballInPlay`]

- Singles advance existing runners one base; doubles advance them two; triples three; home runs four.
- A walk forces only the contiguous occupied bases starting at first. An isolated runner on second stays on second.
- HBP and catcher interference also use forced first-base placement.
- Balk advances existing runners one base without placing the batter.
- A caught-stealing event retires/removes that runner and adds an out.
- Runner replacement changes the runner identity without necessarily changing the batting lineup.

**Executed:** single, double with runner on first, bases-loaded home run, loaded walk, gapped-base walk, HBP, balk, steal, caught stealing, and runner replacement.

These provisional advances are starting points. A scorer can record an additional advance, out, return, error, or a different explanation of the movement. The reason matters even when the occupied bases end up identical.

### Caller/engine protocol

1. Stage events with `pushBatchToScratchAndFetch`.
2. Inspect the returned state, animations, and generated events.
3. Resolve indicated runners with safe/out/sent-back/violation choices.
4. Apply returned follow-up events to scratch state and continue until resolved.
5. Commit the grouped play or cancel scratch state.

The resolver returns events; callers must not discard them. **Executed:** a sacrifice bunt generated an `out_on_last_play` event for the batter at first. Applying it recorded the out and sacrifice. Canceling a staged single restored the prior batter/bases. Sending a provisionally scored runner back to third removed the run. [Modules 58–71; `xd.pushBatchToScratchAndFetch`]

### Third outs and force-play caution

A direct synthetic sequence with one out, runners at first/third, and a double-play result provisionally scored the third-base runner. An explicit no-score/send-back decision generated corrections and ended the half with no run. That path was asserted in both bundles.

An exploratory call choosing “safe/scored” instead retained the run when the following runner-out event ended the half. This is preserved in `validation/additional-observations.json`. The direct API honored the supplied adjudication; it did not universally reject an incompatible force-play interpretation.

Do not treat raw engine acceptance as proof that a play complies with every baseball rule. The full Android prompt sequence was not exercised, so this is not presented as a confirmed app UI bug. Force/tag/appeal timing requires additional dedicated coverage in any future implementation.

## 5. Earned-run reconstruction and pitcher responsibility

**Source-confirmed:** earned-run state is separate from actual bases and score. Each runner record tracks qualification, hypothetical earned base, responsible pitcher, actual out status, whether the runner scored/did not score, and event indices for scoring/retraction/effective outs. `entrypoint.js` additionally tracks manually placed runners with `placed`. [Module 25; modern classes `Su`, `Au`]

The engine maintains effective team and pitcher outs capped at three. It advances hypothetical earned bases for qualifying actions and can mark an error-related runner effectively out even when the actual player reaches base. Passed balls and errors are treated differently from ordinary earned advancement. Catcher interference has separate handling; reducing all reaches-on-error to one flag would lose information.

**Executed examples in both bundles:**

| Scenario | Observed result |
| --- | --- |
| Clean solo homer | 1 actual run; 1 earned run |
| Reach on error, then homer | 2 actual runs; 1 earned run |
| Single, then three passed-ball advances home | 1 actual run; 0 earned runs; 3 passed balls to catcher |
| Single, then three wild-pitch advances home | 1 actual run; 1 earned run; 3 wild pitches |
| Pitcher replaced at 2–0; batter walks; next batter homers | Outgoing pitcher: BB 1, R 1, ER 1; incoming pitcher: BB 0, R 1, ER 1 |

The inspected walk-owner rule remembers a pitcher once the count has reached at least two balls and balls exceed strikes, subject to an unset-owner check and reset at a fresh at-bat. This is source behavior, not a replacement for independently specifying all official count-inheritance cases.

**Verified bundle difference:** manually placing a runner on third and scoring him increased pitcher R by 1 in `entrypoint.js` and by 0 in `bats_entrypoint.js`; ER remained 0 in both. The former gives the runner a pitcher and `placed: true`, while the latter uses an undefined pitcher for manual placement.

**Unknown:** exhaustive earned/unearned reconstruction across all sequences, reliever responsibility exceptions, appeals, and unusual lineup events.

## 6. RBI and quality at-bats

**Source-confirmed:** RBI uses scoring changes across the current play, not simply team-score increases. Walk/HBP/interference, eligible ball-in-play results, same-play runner corrections, and forced-out double plays have distinct paths. Ground-play forced-out bookkeeping can reverse previously credited RBI. [Modules 39, 42; `Td.incrementRBIStats`]

**Executed:** loaded walk credited one RBI; grand slam credited four. The no-score double-play path was checked for score/inning state, not every RBI attribution field. Exact RBI behavior for every error/double-play/appeal combination remains unverified.

Quality at-bat state tracks pitches after two strikes, six-plus pitches, good-play and hard-hit conditions, and whether a qualifying increment was already applied. It prevents repeated qualifying pitches from incrementing QAB repeatedly during the same plate appearance. [Module 42; `kd.updateQABForPlay`]

**Executed:** two strikes followed by five fouls produced one QAB, one three-after-two count, and one six-plus count. Source-defined good-play and hard-hit subconditions were inspected but not all executed. QAB should therefore be treated as an explicitly defined product metric, not a universal official stat.

## 7. Derived stats and missing values

**Source-confirmed formulas:** [Modules 39, 40; `Ad.renderOffensiveStats`, `Ad.renderDefensiveStats`]

| Metric | Formula |
| --- | --- |
| H | 1B + 2B + 3B + HR |
| PA | AB + BB + HBP + sacrifice bunts + sacrifice flies + catcher interference |
| AVG | H / AB |
| Total bases | 1B + 2×2B + 3×3B + 4×HR |
| SLG | Total bases / AB |
| OBP | (H + BB + HBP) / (AB + BB + HBP + sacrifice flies) |
| OPS | OBP + SLG |
| BABIP | (H − HR) / (AB − SO − HR + sacrifice flies) |
| IP | Pitching outs / 3 |
| WHIP | (BB + H) / IP |
| ERA | Configured innings per game × ER / IP |
| Fielding percentage | (Putouts + assists) / (putouts + assists + errors) |
| Strike percentage | Total strikes / pitches |

Innings are real fractions internally: one out = 1/3. Baseball notation such as `4.2` means four innings and two outs and must be formatted separately.

A seven-inning fixture with one earned run in one inning returned ERA 7. One recorded out returned IP 0.3333333333333333. Derived stats with undefined/nonfinite values are removed, rather than universally emitted as zero. A missing AVG before a valid denominator was checked.

FIP uses sport/age-dependent coefficients. The context includes a constant, home-run weight, walk weight, strikeout weight, an HBP-inclusion flag, and game length. The formula is constant plus game length times the weighted expression divided by IP. This was recovered statically and was not independently validated as a complete FIP specification.

Percent/rate values are ratios; formatting into percentages or rounded baseball displays belongs to presentation. No exhaustive rounding/formatting comparison with Android was performed.

## 8. Pitch data, spray charts, and announcements

**Source-confirmed:** pitch data is grouped by team/pitcher and records inning, pitch result, style, and velocity. Spray-chart projections retain ball-in-play events for the batter and opposing pitcher, excluding certain non-contact strikeout/foul-tip categories. Defender records can include position, error, and XY location. [Modules 19, 20]

The API exposes game/season stat aggregation and player/play histories. The announcement module builds text for count, situation, score, inning introduction/end, batter introduction, and game end. [Module 52]

These findings explain useful inputs/outputs. Pitch-location tracking beyond inspected fields, video synchronization, TTS/audio delivery, and radar-device connection behavior were not validated.

## 9. PDF/scorebook generation

**Source-confirmed and exercised:** `generateScorebookPdf(scorebook, gameInfo)` consumes scorebook histories/progress/at-bat slots plus team metadata and returns raw base64 PDF text. It returns an `Error:` string when required arguments are absent or generation throws. [PDF class `ScorebookGenerator`, original offset 1852903]

Input scorebook includes batting histories, fielding histories, at-bat progress map, and at-bats grouped by inning/column/slot. Game info includes home/away team IDs/names/player maps and a start time. In the exercised renderer, jersey numbers needed string values.

The renderer uses portrait A4, away-team pages followed by home-team pages, 11 lineup rows per page segment, and nine inning columns per segment. Batting around can use additional columns. The inspected player section displays up to three active player entries within a lineup row; this is a drawing choice, not an engine-wide roster limit.

A sample single and strikeout generated a 425,675-byte PDF with two pages. `pdfinfo` identified PDF 1.3 and jsPDF 2.2.0; `pdftotext` found the synthetic team headers. No interactive PDF JavaScript was reported. [Sample](validation/sample-scorebook.pdf)

## 10. What the tests do not establish

The harness uses synthetic teams, complete nine-player lineups, and deterministic caller-supplied event IDs. It tests the exported JavaScript compactor path, not the legacy transcoder's full migration behavior or every controller. A portable rerun passed all 96 selected checks.

Real-device UI, storage/process death, remote queues, multi-device races, subscription gates, camera/video features, pitcher decision eligibility, all DH/DP/Flex variants, every official scoring exception, and server-side behavior remain outside the executed coverage. Source presence and a passing selected scenario should not be generalized beyond those boundaries.
