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

## Diamond scorer and team onboarding preview (2026-10-29)

This iteration is local and has NOT been pushed or deployed. It builds on `f92b422` without rewriting Claude's committed work. The interactive preview is `/workspace/diamond-preview/scoring-and-onboarding-preview.html`; it uses the actual scorer and import UI with fictional game data and a persistence stub. Preview confirmation never writes to Supabase.

The scorer now provides a diamond with durable runner identities, guided result/location/runner confirmation, runner-only plays, third-out force/timing rulings, base reconciliation, substitutions, lineup/feed views, and staged contact pitches. `play_details` is versioned and validated on the server; derived runs and outs override client totals. Legacy plays retain totals and require explicit base reconciliation until the next half. Apply `20261102000000_diamond_scorer.sql` before deploying code that selects `play_details`. Scoring still uses the existing insert → box sync → summary persistence sequence, so it does not provide a new transactional/offline scoring guarantee. Earned runs remain a scorer ruling; inherited-runner pitcher responsibility is not reconstructed.

New organizations land at `/imports`; existing admins can find it from Settings or Roster. Google Sheets/Excel/GameChanger/other sources use CSV or `.xlsx` exports, not direct account synchronization. The wizard matches columns, validates dates/times and stats, handles workbook sheets, previews rows/errors/within-file duplicates, and requires explicit confirmation. The `import_team_rows` RPC serializes imports per organization and atomically creates real scheduled games plus an import archive. Duplicate archive keys and matching manually entered games are skipped; existing records are never overwritten. Apply `20261103000000_team_imports.sql` before enabling imports.

Imported rosters are accountless archive entries, visible on `/imports`. They do **not** become auth profiles, roster memberships, or selectable live-scoring players automatically. Invitations remain a separate existing workflow; linking imported identities to accounts is future work. Historical stats are source/season/category snapshots, not merged into live-game-derived totals. Supported mapped metrics are shown in the wizard; unsupported metrics remain in the source file. Keep batting and pitching exports separate; a combined export needs unambiguous columns. The stat snapshot key includes batting/pitching/combined category. Dates accept ISO or US M/D/YYYY; the coach must normalize ambiguous international dates. Game times use the existing Games calendar's local-time convention.

Validation: 248 unit/server-action tests, typecheck, and lint; local PostgreSQL engine checked migrations, duplicate handling, real schedule inserts, authorization, and whole-batch rollback. Chromium tested confirm/cancel/undo, collision blocking, mobile layout, CSV review, and a real multi-sheet Excel workbook with date/time cells. A full Next production build remains blocked by the environment's Google Fonts access; the standalone Vite preview build succeeds. No production database migration, deployment, or external invitation was performed.


## Production publish preparation (2026-10-29)

User authorized publishing the scorer/import iteration and replacing Google Fonts to unblock the build. Removed `next/font/google` and set native system sans/monospace stacks in the existing Tailwind theme. There are no font downloads at build or runtime. The production branch was fetched again and still matched `f92b422`, preserving Claude's pushed commits. Publishing this change triggers the existing Vercel Git integration and the existing `Deploy database migrations` GitHub workflow. Remote build/migration completion must be verified independently; this environment has no Vercel/Supabase credentials and its network policy excludes the production URL and GitHub API.

## Claude follow-up review (2026-10-29)

Verified the published scorer/import/performance commits end to end: production deploy and the `Deploy database migrations` run for `f4cc337` succeeded; locally all migrations apply, `npm run build` passes, 252 unit tests pass, and 14 browser suites (every phase, games, stats, navigation, and a new diamond-scorer game) pass against a production build.

Changes made on top:

- **New teams land on the dashboard again**, not `/imports`. A brand-new coach usually has nothing to import and the import page had no way forward; the dashboard's Getting started card now links admins to "Import them →".
- **Pitch Smart in the diamond scorer** shows the forward-looking line again ("N more → D days rest"), larger and color-coded (green / amber within 5 pitches of the next rest day / red over the daily max). This line is a core differentiator.
- `src/types/database.ts` regenerated from the migrations (it had been hand-edited; contents equivalent).

Note for tests: with the new loading boundaries, a page that calls `notFound()` after streaming starts returns HTTP 200 with the not-found UI (standard Next.js streaming behavior). Access control is unchanged — outsiders see no data — but checks should look at the rendered content, not only the status code.
