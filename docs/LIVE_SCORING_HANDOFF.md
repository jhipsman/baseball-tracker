# Live scoring: pitch-entry increment

Built on `b133c613366cea24e0c662dabe04bd20634bfe29` from
`claude/laughing-knuth-4iwh0e`. The four commits after the original cloud checkout
were fast-forwarded before editing. Claude's launch, consent, account, billing,
and landing-page files were left unchanged.

## Result

The existing live game log now supports in-play pitches, foul bunts, and foul tips.
Ordinary fouls at two strikes keep the at-bat alive; foul bunts/tips complete a
strikeout. In-play increments workload once and leaves the scorer to choose the
plate-appearance result.

Pitch accounting also preserves work that previously could disappear:

- Reset count clears balls/strikes without deleting pitches already thrown.
- A pitching change keeps the batter's count and banks the outgoing pitcher's
  pending pitches on the substitution play. The incoming pitcher starts his own
  segment, so neither gets the other's pitches.
- A half ended manually or by caught stealing retains pending pitches.
- Finalization retains an unfinished at-bat's count/pitches for later resumption.
- Each pitch uses the existing box-score RPC, whose existing trigger updates the
  game's Throwing log. Previously only the viewer summary changed during the
  at-bat.

`games.live_state.pitchHistory` is optional JSON used to restore the count when
removing a newly recorded pitch. Old games without history remain readable.
History is cleared at count reset, pitching changes, and completed at-bats/halves.

## Storage compatibility

No migration or generated database-type change is needed. Existing
`game_plays.pitches` is now also used on a pitching-substitution row to store the
outgoing pitcher's segment. Replay attributes that segment to the previous active
pitcher; the row's `pitcher_id` continues to name the incoming pitcher. Existing
substitution rows have zero pitches and keep their previous behavior.

Undoing a pitching change restores its banked pitches. If the incoming pitcher
has already thrown, the scorer must remove those pitches first; they are not
silently reassigned to the outgoing pitcher.

Use the updated actions and replay engine together. Older application versions
do not understand this additional meaning of substitution pitch counts.

## Verification

- Baseline before edits: 197 existing tests and TypeScript passed.
- Updated suite: 226 tests passed, including pure count/replay tests and server
  action tests with an in-memory Supabase transport.
- TypeScript passed; ESLint passed after removing unused mock parameters.
- Production build attempted normally and with network access. Both attempts
  were blocked fetching the existing Geist fonts. A direct configured-proxy
  request to `fonts.googleapis.com` returned HTTP 403. The font configuration was
  not changed; build verification remains incomplete in this environment.

The server-action tests execute the actual action/replay code and inspect RPC
payloads and persisted summaries. They do not execute PostgreSQL/RLS/triggers or
replace a real browser/device smoke test. No production database was accessed or
changed.

## Remaining scoring work

This is the first increment on Claude's existing log, not a full GameChanger
feature implementation. Runner-by-runner resolution, bases, historical play
editing, automatic earned-run reconstruction, inherited-pitcher responsibility,
and offline reconciliation remain separate work. The existing manual runs/RBI/
unearned workflow stays in place. Pitch Smart's existing age-band display was not
redesigned to aggregate every outside-team workload source.

The existing per-at-bat storage limit is still 40 pitches. The action now reports
that limit rather than silently accepting a pitch without increasing the total.
Game totals, box-score stat limits, and concurrent scorekeeper behavior retain
their existing constraints.

Before adding runner resolution, keep pitch recording, provisional play state,
committed plays, and pitcher responsibility separate. Preserve old games and
their manual box-score path when introducing richer events.
