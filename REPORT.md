# GameChanger scoring: reverse-engineering findings

Updated October 29, 2026. Analysis only; Diamond Program's repository is unchanged.

The uploaded JavaScript contains the baseball rules engines, not just Android wrappers. I recovered the scoring architecture, event/state contracts, contextual menu rules, provisional runner workflow, historical corrections, statistics, earned-run tracking, and scorebook generation.

**Validation:** 48 synthetic scenarios passed in each baseball bundle: **96/96 scenario/bundle checks**. The PDF bundle also generated a valid **two-page scorebook** from a synthetic game. These are JavaScript engine checks, not tests of the installed Android app, real network synchronization, or every baseball edge case.

## Read the results

- [Detailed scoring rules and behavior](RULES_AND_BEHAVIOR.md)
- [Independent feature specification for Diamond Program](GAME_TRACKING_SPEC.md)
- [Validation cases, results, and reproduction instructions](validation/README.md)
- [Synthetic scorebook PDF](validation/sample-scorebook.pdf)
- [Function and module locations](function-map.json)
- [Recovered Android event/state declarations](engine-models.json)

Earlier DEX-only findings are preserved in [DEX analysis history](DEX_ANALYSIS_HISTORY.md). Statements there about needing JavaScript assets describe that earlier stage; the current findings below supersede them.

## The main findings

### A game is an event history with several derived views

The controller maintains separate engines for count/inning state, lineups, defenders, baserunners, action eligibility, earned runs, stats, play-by-play, per-inning data, pitch data, spray charts, and participation history. They share scoring events and depend on one another's state.

The event compactor separates the input history from its effective output stream. It supports insert, delete, replace, edit groups, transactions, undo, and redo. Its component streams are concatenated in **head → main → tail** order. Historical changes roll affected projections back so subsequent reads can recompute state.

This is the central design idea to carry into Diamond Program: store what happened, including corrections, and derive the scoreboard and stats consistently from that history.

### One play can require several scoring decisions

The UI stages a pitch/contact and subsequent runner decisions in scratch state. The engine provides provisional bases, score, animations, and follow-up events. The caller applies follow-ups and ultimately commits the play as a transaction or cancels it.

A single provisionally moves existing runners one base; a double moves them two. The scorer can then record additional advancement, outs, or a runner remaining behind. A sacrifice bunt can require the resolver to emit the batter's out as a separate event. Taking only the first state returned would miss part of the play.

**Third-out timing needs particular care.** In a synthetic double-play sequence, the direct API honored an explicit “runner scored” decision even though a force-out interpretation would require no run. The corresponding no-score/send-back decision removed the provisional run and closed the inning correctly. This establishes that these APIs are not a universal validator of every scorer-supplied combination. It does not establish what the complete Android UI permits.

### Pitch options are calculated from state

Recovered conditions include:

| Option | Engine condition |
| --- | --- |
| Dropped third strike | Two strikes and either two outs or first base unoccupied |
| Infield fly | Fewer than two outs, first and second occupied |
| Sacrifice fly | Fewer than two outs and third occupied |
| Sacrifice bunt | Fewer than two outs and at least one runner |
| Double play | Fewer than two outs and at least one runner |
| Triple play | No outs and at least two runners |
| Balk | Baseball with at least one runner |
| Place batter | No balls, strikes, outs, or runners |

These are menu/context conditions. They do not prove that every invalid raw event is rejected by the engine.

### Earned runs use a separate reconstruction of the inning

Runner records track responsible pitcher, actual out status, qualification, hypothetical earned base, and score/retraction indices. The engine tracks effective outs separately from the visible scoreboard's outs. Errors and passed balls can change this reconstruction without changing the actual score in the same way.

Executed examples included a clean home run, error followed by home run, passed-ball versus wild-pitch advances, and a pitcher change at a 2–0 count. In that last case the outgoing pitcher retained responsibility for the ensuing walk.

### The two baseball bundles differ

Both `entrypoint.js` and `bats_entrypoint.js` export baseball compactor controllers. The recovered Android `Bridge` explicitly loads `assets/entrypoint.js`. That proves a loader path, not which implementation every feature/session uses.

A concrete difference was verified:

| Manually placed runner subsequently scores | entrypoint.js | bats_entrypoint.js |
| --- | ---: | ---: |
| Team score increases | 1 | 1 |
| Pitcher's runs allowed increase | 1 | 0 |
| Pitcher's earned runs increase | 0 | 0 |

The first bundle records the responsible pitcher and a `placed` flag; the other does not assign that runner a pitcher. Their matching results on the other selected cases do not prove general equivalence, and no release chronology was inferred from filenames.

### Statistics are derived from base counts

The recovered formulas include AVG, OBP, SLG, OPS, BABIP, WHIP, ERA, fielding percentage, pitch-type rates, and quality at-bats. Innings pitched are **outs ÷ 3**, not baseball display notation such as `4.2` stored as a decimal. ERA is **configured innings per game × ER ÷ IP**. Undefined/nonfinite derived stats are omitted from the output.

Quality at-bat counting is once per plate appearance and includes pitch-count, two-strike-pitch, good-play, and hard-contact conditions. These rules and the limits of their validation are detailed in the rules document.

### Scorebook export is a separate renderer

`generateScorebookPdf(scorebook, gameInfo)` consumes derived scorebook data plus team/player metadata and returns **raw base64 PDF content**, or an `Error:` string. Its renderer uses portrait A4 pages, separate team sections, and pagination for lineup rows and inning columns.

The generated sample contains synthetic teams and players. It passed PDF structural inspection and text extraction. Rendering was exercised; the Android share/download flow was not.

## Other capabilities identified

The bundles also contain game-announcement text templates, season-stat aggregation, spray charts, pitch-type/velocity records, lineup and defensive-position history, and additional sport controllers. The Android files identify pitch alerts, QR lineup sharing, Pocket Radar hooks, game-version selection, and offline queues.

Local announcement text generation does not establish the implementation of audio playback or a speech service. Video streaming, automatic highlights, payments, authentication, and remote APIs were not reverse engineered in comparable depth.

## What this gives Diamond Program

The [feature specification](GAME_TRACKING_SPEC.md) translates the findings into an independent description of scoring behavior, data responsibilities, correction flows, and acceptance scenarios. It can be handed to Claude without adding files to the project. It contains no application implementation or database migration.

## Evidence and limits

Eleven uploaded inputs were fingerprinted: six DEX files, manifest, resource table, and three JavaScript bundles. All six DEX files passed internal length/checksum checks. Fingerprints are in `input-integrity.json`; these checks do not authenticate the publisher.

The JavaScript was parsed with Node's bundled Acorn parser. Source locations use zero-based UTF-16 code-unit offsets in the original uploaded files. Readable working copies were checked for equivalent parsed ASTs. Behavioral tests executed the original uploaded bundles in memory, with timeouts and without exposing Node file/network APIs to the bundle context.

The initial harness needed corrections for undefined base-map entries and JSON-encoded error messages. The PDF fixture needed jersey numbers supplied as strings. These were analysis-fixture corrections; none changed the uploaded bundles. Initial harness results and notes are retained with the final passing results.

Remaining unknowns include complete Android interaction behavior, exhaustive force/tag/appeal and earned-run edge cases, every league-rule variant, real-device persistence, server deduplication/conflict handling, and real-time spectator transport. The 96 checks establish the selected behaviors only.

No project source, dependencies, lockfiles, tests, Git state, or environment settings were changed. No GameChanger production API was contacted. All reports and validation artifacts are outside `/workspace/baseball-tracker`.
