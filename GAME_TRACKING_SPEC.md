# Independent live-game tracking specification for Diamond Program

This is a proposed behavioral specification informed by the analysis. It is not GameChanger source code, an implementation plan approved for execution, or a claim about Diamond Program's current code. Nothing here has been implemented. Keep it outside the project until work is explicitly authorized.

## Product behavior

A scorekeeper should be able to prepare both teams, record a game pitch by pitch, resolve each runner's outcome, fix mistakes, and finish with consistent team/player statistics. Spectators should see a coherent committed game state. A scorekeeper should be able to continue with pending local changes when connectivity drops, subject to an explicit ownership/version policy.

## State responsibilities

| Responsibility | Information to retain |
| --- | --- |
| Game identity | Teams, home/away designation, sport, game/stream version, rule settings, lifecycle status |
| Current situation | Inning/half, balls, strikes, outs, score, occupied bases |
| Active participants | Batter, pitcher, fielders, batting order/index, special roles |
| Scoring history | Identifiable ordered events, grouped play identity, correction relationships, timestamps |
| Provisional play | Starting state, proposed events, unresolved runners/defenders, ability to cancel |
| Derived outputs | Line score, play-by-play, box score, pitching/fielding stats, spray charts |
| Synchronization | Pending/confirmed changes, active scorer ownership, synchronization status, divergent versions |

This separation is the recommendation. The exact database schema, frontend framework, and storage technology are deliberately unspecified.

## Scorekeeper workflow

### Prepare

Set game rules and home/away teams. Select or create both lineups, place defensive players, and identify pitchers. Allow an incomplete opponent roster only if the product has an explicit placeholder-player policy. Validate the active batter before accepting pitches.

Treat batting slots, defensive assignments, and occupied bases as separate concepts. A courtesy runner must not inadvertently replace the player's batting slot. Define pinch runners, re-entry, DH, and DP/Flex rules explicitly before enabling them.

### Record pitches

Offer ball, looking/swinging strike, foul, ball in play, and applicable special actions. Collect velocity/type only when enabled. Keep pitch count distinct from count advancement. After an ordinary foul at two strikes, retain two strikes while incrementing pitches thrown.

Calculate which actions are available from game state and the selected rule policy. Menu gating and event validation should be separate so external callers or restored data cannot silently bypass important invariants.

### Record contact and resolve the play

Collect contact type and outcome separately. Add defenders and optional field location as needed. Present provisional advancement, then resolve any runners who advance farther, remain behind, are retired, or require a scoring explanation.

Retain movement reasons such as steal, wild pitch, passed ball, error, defensive indifference, tag-up, and advancement on the same play. They can produce different stats despite identical final bases.

A play remains provisional until necessary decisions are complete. Commit all its events together. Cancel restores the pre-play count, score, bases, active participants, and derived values.

### Handle inning-ending plays

Clearly distinguish force outs, batter-runner outs, and timing/tag plays. Determine which runs count before committing the play. Do not infer run validity solely from the order in which a scorer tapped runners or from a provisional score.

The analyzed engine exposes decisions that can be combined inconsistently through its raw API. Diamond Program should define its own validation and adjudication requirements rather than assuming raw event acceptance proves legality.

### Correct mistakes

Provide distinct operations:

- Undo/redo the last scorekeeping action.
- Change an earlier play's outcome or participant.
- Adjust the current situation when recovering from an external scoring error.
- Edit a statistic when the product explicitly permits an override.

Historical changes should update affected subsequent state and derived stats. Preserve enough history to explain what changed. A manual scoreboard override should not silently pretend that all underlying player stats were recomputed from a play that never occurred.

### Finish or suspend

Separate regulation game length from game lifecycle. Define extra innings, ties, walk-offs, run limits, suspension, and resumption as product rules. Preserve scorer control where league rules vary.

Collect pitcher decisions where needed and validate eligibility against the chosen policy. Define what happens to those decisions after a finalized game is reopened or corrected.

## Statistics

Store pitching outs as integers and derive real innings as outs divided by three. Format baseball innings notation only for display/input. For ERA, use an explicit regulation-length setting rather than assuming nine innings.

Calculate rate stats from aggregated base counts. Distinguish an undefined rate from a valid zero. Specify rounding and zero-denominator output deliberately.

Earned runs require a reconstruction of the inning and pitcher responsibility; marking every run after an error unearned is insufficient. Include inherited runners, errors that extend innings, passed balls versus wild pitches, and placed-runner policy in the specification.

Define product metrics such as quality at-bats explicitly. GameChanger's criteria are a reference for comparison, not an official scoring requirement.

## Offline and spectator behavior

Choose a policy for who owns a game stream before enabling several scoring devices. The inspected app's resources describe one scoring party per shared stream and separate versions when parties score independently. Its client code does not establish a general-purpose concurrent merge algorithm.

Display pending synchronization and recovery status. Keep retries from creating duplicate scoring actions. Spectator updates should represent a coherent committed play; any provisional/live display should be clearly defined.

Server synchronization, deduplication, authentication, and spectator transport need their own design and tests. The reverse-engineered JavaScript does not supply a verified implementation of those services.

## Reports and exports

A scorebook should derive from the same history as the live score and box score. Include player substitutions, inning columns, contact/out symbols, and pagination. Generate it from a structured scorebook model plus roster/game metadata.

Spray charts need contact type/outcome and location; pitch reports need per-pitch pitcher/type/velocity records. Add those inputs to the scoring workflow only when their reporting benefit justifies the scorer's effort.

## Acceptance scenarios for future implementation

The retained analysis harness is a reference for observed behavior, not a production test suite for Diamond Program. Future implementation should have independent tests for:

- Loaded-base walks and forced movement with gaps.
- Ordinary two-strike fouls versus foul bunts/tips.
- Dropped-third-strike eligibility and safe/out outcomes.
- Double/triple plays with run-timing and force-out decisions.
- Canceling a multi-runner provisional play without side effects.
- Undoing a whole play and replacing an old play that changes later state.
- Courtesy/pinch runners and batting/defensive substitutions.
- Pitcher changes mid-count and inherited run responsibility.
- Error-extended innings, passed balls, wild pitches, and manually placed runners.
- Fractional innings and rate-stat aggregation/undefined values.
- Offline retries, duplicate delivery, reconnection, and version conflicts.
- Finalization, reopening, and correction of pitcher decisions.

These acceptance areas extend beyond the 48 scenarios exercised against each uploaded bundle. No repository edits, migrations, or application tests are authorized or performed by this document.
