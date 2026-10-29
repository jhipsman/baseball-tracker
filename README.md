# Diamond Program

A training platform for baseball coaches, strength trainers, and facilities: build programs with a drag-and-drop workout builder, assign them to players, and track the work.

**Stack:** Next.js 16 (App Router) · Tailwind CSS v4 · Supabase (Postgres + RLS, Auth, Storage) · TypeScript

> Next.js 16 renamed `middleware.ts` to `proxy.ts`. The auth session refresh lives in `src/proxy.ts` → `src/lib/supabase/middleware.ts`.

## Getting started

Requires Node 20+ and Docker (for local Supabase).

```bash
npm install
npm run db:start            # starts local Supabase, applies migrations + seed
cp .env.example .env.local  # fill in the URL + anon key printed by db:start
npm run dev
```

Open http://localhost:3000, create an account, and create your organization. Email confirmation is off locally, so sign-up logs you straight in.

### Opening it from another device (laptop, phone) on the same network

```bash
npm run dev:lan
```

Then browse to `http://<this-computer's-IP>:3000` from the other device. On Windows, find the IP with `ipconfig` (the "IPv4 Address", e.g. `192.168.1.20`), and allow Node.js through Windows Defender Firewall when prompted (Private networks). Only the computer running the app needs Supabase/Docker; other devices just need the browser.

Common home/office address ranges are already allowed in `next.config.ts`. For anything else (e.g. a tunnel hostname), set `DEV_ALLOWED_ORIGINS=host1,host2` in `.env.local`.

### Deploying (Vercel + hosted Supabase)

Step-by-step guide: **[docs/DEPLOY.md](docs/DEPLOY.md)**.

### Using a hosted Supabase project

```bash
npx supabase link --project-ref <ref>
npx supabase db push                          # apply migrations
psql "$DATABASE_URL" -f supabase/seed/exercises.sql   # seed the global exercise library
```

In the dashboard, set **Auth → URL Configuration → Redirect URLs** to include `https://<your-domain>/auth/callback`. Set `NEXT_PUBLIC_SITE_URL` in production so confirmation links point to your domain.

## Scripts

| Script                               | What it does                                                |
| ------------------------------------ | ----------------------------------------------------------- |
| `npm run dev`                        | Next.js dev server                                          |
| `npm run build`                      | Production build                                            |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript                                         |
| `npm test`                           | Unit tests (Vitest), e.g. the workout builder's state logic |
| `npm run format`                     | Prettier                                                    |
| `npm run db:start` / `db:stop`       | Start / stop local Supabase                                 |
| `npm run db:reset`                   | Recreate the local DB from migrations + seed                |
| `npm run db:types`                   | Regenerate `src/types/database.ts` from the local DB        |

## Database

All schema changes go through migrations in `supabase/migrations/`. After changing the schema, run `npm run db:reset && npm run db:types`.

**Phase 1 tables:** `profiles`, `organizations`, `org_memberships`, `org_invitations`, `exercises`, `programs`, `program_weeks`, `program_days`, `program_exercises`, `program_assignments`.

- A `profiles` row is created automatically for each new auth user (trigger on `auth.users`).
- Organizations are created with the `create_organization(p_name, p_slug)` RPC, which also makes the caller the org's admin in one transaction.
- People join an org only by accepting an invitation (`accept_invitation(token)`), and only when signed in with the verified email it was sent to. Admins can't add members directly. The org owner can't be removed or demoted.
- The workout builder saves through `save_program_structure(program_id, weeks)`. It upserts weeks, days and exercises by id and deletes anything missing, all in one transaction under RLS. `duplicate_program(id, name, is_template)` deep-copies a program, which powers "Save as template" and "Use template".
- `exercises.org_id = null` means a global library exercise (read-only to everyone). Org-created exercises have `is_custom = true`.
- `muscle_groups` and `equipment` are checked against fixed lists. The lists are mirrored in `src/constants/index.ts`. Equipment adds baseball-specific items to the brief's list: `trap_bar`, `landmine`, `sled`, `foam_roller`, `pull_up_bar`, `baseball`, `weighted_ball`, `bat`, `tee`.

### Row Level Security

Every table has RLS enabled. Policies call `SECURITY DEFINER` helpers in a `private` schema (not exposed through the API), so they never recurse through `org_memberships`.

| Who                               | Can do                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Any member                        | See their org, its members, teammates' profiles, global and org exercises                                 |
| Admin                             | Update the org; invite, update, and remove members (not the owner)                                        |
| Admin / coach / trainer ("staff") | Create and edit org exercises and programs (weeks, days, exercises); assign programs to the org's players |
| Player                            | See only the programs assigned to them and their own assignments                                          |
| Anyone                            | No access to another org's data                                                                           |

Program exercises may reference only global exercises or the program org's own custom exercises.

### Seed data

`supabase/seed/exercises.sql` holds 130 global exercises across all nine categories: strength, power, plyometric, mobility, arm care (including the Jaeger band routine), conditioning, speed, throwing, and hitting. It's idempotent (`on conflict do nothing`), so it is safe to re-run against a hosted DB.

## Project layout

```
src/
├── app/
│   ├── (auth)/login, signup     # public auth pages
│   ├── auth/callback, confirm   # email-link / PKCE handlers
│   ├── onboarding/              # create your first org or accept an invite
│   ├── invite/[token]/          # invitation accept page
│   └── (dashboard)/             # signed-in app (requires an org)
│       ├── page.tsx             # dashboard home
│       ├── exercises/           # library browser + custom exercise CRUD
│       ├── programs/            # list, new, detail/assign, [id]/builder
│       └── roster/              # members + invitations
├── components/
│   ├── ui/, layout/
│   └── workout-builder/         # drag-and-drop builder (dnd-kit) + pure reducer
├── constants/                   # enums, muscle groups, equipment, labels
├── lib/
│   ├── supabase/{client,server,middleware}.ts
│   ├── auth/actions.ts          # login / signup / sign-out server actions
│   └── org.ts                   # requireUser / requireActiveOrg helpers
├── proxy.ts                     # session refresh + auth gate
└── types/database.ts            # generated by `npm run db:types`
```

## Workout builder

`/programs/[id]/builder` (coaches, trainers and admins only):

- **Library panel:** instant search across name, muscle and equipment, plus category chips and an equipment filter. Drag a card into a day, or tap **+** to add it to the selected day.
- **Days:** drag the ⋮⋮ handle to reorder within a day or move between days. Click an exercise to set sets, reps, intensity, tempo, rest and notes.
- **Supersets and circuits:** tick two or more exercises in a day and choose Superset, Circuit, EMOM or AMRAP. Exercises are labeled A1/A2, B, C… An exercise dragged out of a group leaves it; one dropped between two members joins it.
- **Weeks:** add, duplicate, label (e.g. "Deload") or delete weeks. Days can be copied.
- **Saving:** changes autosave about a second after you stop editing, or press Ctrl/Cmd+S. The page warns before you leave with unsaved changes.
- **On phones:** **+ Add exercise** opens the library as a bottom sheet. Day columns stack, and items still drag by their handle with a press-and-hold.

The state logic lives in `src/components/workout-builder/reducer.ts` and is covered by `reducer.test.ts`.

## Player app (Phase 2)

Players land on `/player`, a phone-first app with bottom tabs:

- **Today:** today's workout for each active program, the current week's days with done/partial/skipped status, and a nudge to catch up on a missed day.
  - Weeks run in 7-day blocks from the assignment's start date.
  - Days pinned to a weekday in the builder are scheduled on that weekday. Other days are done in order.
  - "Today" uses the player's own time zone.
- **Log a workout:** sets are prefilled from the prescription (reps) and from last time (weight), with a "Last time: 185×8, …" hint. Players tap ✓ per set and enter reps, weight and RPE, then add overall RPE, duration and notes. Finishing saves as _completed_ or _partial_, or they can _Skip_. In-progress entries survive a page reload. Re-opening a logged day edits it.
- **History** and **Profile** (name, team details, sign out).
- **Install:** the app ships a web manifest and icons, so "Add to Home Screen" gives it an app icon.

Coaches see each assignment's progress ("3/12 logged · last 2026-10-05") on the program page.

Logs are stored in `workout_logs` and `exercise_logs` and saved atomically by `save_workout_log(...)`. Players can only write their own logs for days of programs assigned to them. Coaches can read logs in their org but not change them. Logs survive program edits, because a deleted day or exercise leaves the log intact.

## Planning views (Phase 3)

- **Calendar** (`/calendar`, coaches):
  - **Week view:** players × days. Each workout is colored _done / partial / skipped / missed / today / upcoming_, with "3/4 logged" per player.
  - **Month view:** team totals per day, e.g. "Lower ×12 · 9✓ · 2 missed".
  - Filter by group.
  - Weekday-pinned days sit on their weekday. Flexible days are spread evenly through each program week. Logged workouts show on the day they were actually done.
- **Season toggle** in the sidebar (off, pre, in, post). Programs built for the current season are starred and listed first, new programs default to it, and the Programs and Templates lists filter by type and season.
- **Groups** (Roster → Groups): saved sets of players like "Pitchers" or "JV".
- **Bulk assign:** on a program, quick-select by group, by position, or all players, then assign in one click.

Docs: [docs/ROADMAP.md](docs/ROADMAP.md) keeps product notes for later phases: video review with coach drawing, angles and voice-over or AI analysis, exercise tracking types, demo videos, and the native app.

## Player profiles & assessments (Phase 4)

- **Roster → Overview** (`/roster`): every player at a glance.
  - 7- and 28-day compliance meters, last workout, active programs, and latest FB velo, exit velo and 60 time.
  - Injured/inactive badges, and a **⚠ Needs attention** flag (under 50% logged or 2+ misses in 7 days). Flagged players are sorted to the top.
  - Filter by group.
- **Player profile** (`/roster/[id]`): compliance, active programs, and metric tiles (latest value, change vs the previous test, sparkline).
  - A line chart for the selected metric, with a hover/keyboard crosshair tooltip.
  - Assessment history table, plus add or delete assessments.
  - Recent workouts that expand to every set (weight × reps @ RPE).
- **Testing day** (`/roster/testing`): pick the tests and a group, then enter results for the whole team in one grid. Each box shows the player's last result as a hint.
- **Metrics:** FB velo, position throw velo, pop time, exit velo, bat speed, 60 yd, home-to-first, squat, deadlift, bench, broad jump, vertical, bodyweight, height. They're defined in `src/constants/metrics.ts` and stored in `assessments.data` (JSON), so adding a metric needs no migration.
- **Coach dashboard:** team compliance for the last 7 days, the needs-attention list, and a feed of recent workouts.
- **Player Profile tab:** 28-day consistency and their own metric tiles and chart (read-only).
- **Member status:** Active, Injured or Inactive, set on Members & invites.

## Throwing & arm care (Phase 5)

- **Throwing logs** (`throwing_logs`): long toss (throws + max distance), flat ground, bullpen, live ABs, game, or an **arm check-in** (no throwing, just arm feel). Each log has a pitch count, intensity, optional pitch mix (FB/CB/SL/CH/Other), arm feel (great → pain), and notes. Players log their own sessions. Coaches log for any player, e.g. game pitch counts after a game.
- **Pitch Smart** (`src/lib/workload.ts`, unit-tested): daily max and required rest days by age, applied to games and live ABs.
  - Players set their birthday, or coaches set it on the player's profile.
  - Shows each player's status: **Available (N left today) / Rest until …** for games and live ABs.
- **Alerts:**
  - Reported arm pain.
  - Repeated soreness or a tired arm.
  - Over the daily max.
  - Pitched before the required rest was up.
  - A throwing volume spike (acute:chronic ratio over 1.5× once a player has 3+ weeks of logs).
  - Critical alerts show as a red banner on the coach dashboard.
- **Coach `/throwing`:** alerts, a team board (age, today's availability, last outing, 7-day throws, vs usual, latest arm feel), and a "Log pitch counts" panel.
- **Player Throwing tab:** pitching status, week volume, alerts, quick log or check-in, a 28-day chart, and recent sessions.
- **Player profile (coach):** throwing section with status, alerts, a 28-day chart, sessions, and birthdate.
- **Starter templates** (Programs → Templates): Long Toss Build-up (6 wk), Bullpen Progression (4 wk), Daily Arm Care (J-Bands).

Also in this pass: **Forgot password** flow, a **Getting started** checklist for new coaches, and the "Parent" invite role is hidden until the parent dashboard exists. See [docs/PRODUCT_REVIEW.md](docs/PRODUCT_REVIEW.md) for the full product review and prioritized gaps.

## Video review & AI analysis (Phase 6)

- **Upload** (players from the phone's Videos tab, coaches for any player at `/videos`): MP4, MOV, or WebM up to 50 MB, tagged hitting / pitching / fielding / catching / exercise form / other, with a note for the coach. The browser makes a thumbnail and reads the duration, then uploads straight to Supabase Storage with a progress bar.
- **Storage:** private `videos` bucket, files at `{org_id}/{player_id}/{video_id}/…`. Storage policies check the path (staff of the org, or the player themself); pages use short-lived signed URLs. Nothing is public.
- **Coach review queue** (`/videos`): Needs review / Reviewed / All, filter by player; "Videos to review" count on the dashboard; a Videos section on each player's profile.
- **Reviewer** (`/videos/[id]`):
  - Frame-by-frame stepping (buttons or ← →), ¼× / ½× / 1× speed, scrubber with markers where drawings are.
  - Drawing tools: line, arrow, **angle** (tap end → joint → end; shows degrees, corrected for the frame's aspect ratio), circle, freehand, plus timestamped notes and per-drawing comments. Stored as data (`video_annotations`, normalized coordinates), so they stay editable.
  - **Voice-over breakdown:** records the video, drawings, and the coach's microphone while they play, pause, step, and draw (`canvas.captureStream` + `MediaRecorder`), up to 5 minutes; preview, then save.
  - Written feedback + **Send review**. Players see drawings, notes, the breakdown, and feedback only after it's sent.
- **AI analysis (optional):** the coach marks a window (e.g. load → follow-through) and frame count; the browser grabs still frames and `/api/videos/[id]/analyze` sends them to Claude (`claude-opus-5-5`, adaptive thinking, JSON-schema output, server-side refusal fallbacks). The result is a **staff-only draft** (`video_ai_analyses`): summary, phases with timestamps, strengths, up to 3 fixes with a cue and a drill, confidence, and limits. The coach edits it and chooses to share it; players see it labeled "AI-assisted notes, reviewed by your coach." Turned on by setting `ANTHROPIC_API_KEY`; without it the panel explains how to enable it.

## Tracking types & demo videos (Phase 7)

- **How it's tracked** (`exercises.tracking_type`): weight × reps, reps only, time, distance, or distance + time. Coaches pick it on custom exercises ("How it's tracked", with a one-line hint). The built-in library is set by migration `20261028000100_exercise_tracking_defaults.sql` (also appended to the seed): sprints, shuttles, and holds → time; carries, sleds, and long toss → distance; rowing → distance + time; bodyweight work, plyos, med ball, bands, throwing, and hitting → reps; lifts stay weight × reps.
- **Player workout screen** shows only the inputs that apply: seconds with decimals for sprints (with a "New best" callout against last time), distance with a ft / yd / m unit, reps without weight. New keys (`time_s`, `distance`, `distance_unit`) are stored in the same `sets_completed` objects, so older logs still read fine. Drafts and "Last time" hints work for every type.
- **Summaries** come from one helper, `src/lib/sets-format.ts` ("3 × 7.1 s (best 6.9 s)", "185 lb × 5, 5, 4", "3 × 10"). History and the coach's player profile use it. Builder and program prescriptions read naturally ("4 × 60 yd", "3 × 30 s").
- **Demo videos** (`exercises.video_demo_url`): a YouTube (watch, youtu.be, Shorts, embed; `t`/`start` kept) or Vimeo link, or an https `.mp4`, checked on the server by `src/lib/exercise-video.ts`. Only rebuilt embed URLs on `youtube-nocookie.com` / `player.vimeo.com` are ever put in an iframe. "▶ Demo" opens a pop-up player (loaded only on tap) in the library, the builder, program pages, and the player's workout screen. Exercises without a video show "Find a demo", a YouTube search in a new tab. The app ships no hard-coded video links.

## Parent dashboard (Phase 7)

- **Inviting parents:** Roster → Manage has a "Parent / guardian" role that asks which player they follow. Coaches and trainers can invite parents (other roles stay admin-only). Each player's profile has a **Parents & guardians** section (linked parents, pending invites with copy-link, invite, unlink), and players can invite their own parent from their Profile tab. Pending invites and members read "Parent of Pete Player". Accepting links the parent to that player (`parent_links`) and lands them on `/parent`.
- **`/parent` (phone-first, read-only):** this week's workouts (done / missed / still to go) and today's, 28-day consistency, throwing status (Pitch Smart availability, recent pitch counts, alerts; arm pain shows a prominent "talk to the coach or an athletic trainer" banner), recent coach feedback on reviewed videos, and latest testing numbers vs the previous test. Parents linked to several players switch with `?player=`.
- **Logging for their child:** parents can add a game pitch count (e.g. travel ball) or an arm check-in, because Pitch Smart counts every game. `logThrowing` checks the parent link on the server; RLS enforces it too. It shows up on the coach's Throwing board.
- **`/parent/schedule`** (next 14 days of workouts), **`/parent/videos`** and **`/parent/videos/[id]`**: reviewed videos only, with drawings, notes, breakdown, feedback, and shared AI notes. Everything else returns 404.
- **Privacy:** parents see only their linked player (RLS: `private.is_parent_of`), never teammates; every parent page says so.

## Practice plans (Phase 7)

- **Coach `/practices`:** Upcoming / Past / Templates. Start a new practice blank or from a template (title, date, start time, location, whole team or one group, notes).
- **Builder** (`/practices/[id]`): add blocks by kind (warm-up, throwing, defense, hitting, pitching, baserunning, conditioning, team, other; each has a color), set minutes with ±5 steppers, add details and concurrent **stations** (name, coach, what they're doing). Reorder by drag handle or Move up/down. A running clock shows each block's time ("3:30–3:45"), plus the total and end time. Autosaves through the `save_practice_blocks` RPC (⌘/Ctrl+S saves now). Works at the field on a phone.
- **Publish to team** (`setPracticePublished` in `src/lib/practice-actions.ts`): drafts are staff-only. Publishing shows the plan to players and parents (whole team, or only the plan's group) and the `practice_plans_notify` trigger notifies them. Also: Duplicate to a new date, Save as template, Delete.
- **Print** (`/practices/[id]/print`): one-page plan with a time column, blocks, stations/coaches, and notes. Print CSS hides the app chrome.
- **Starter templates** (Practices → Templates → Add templates): Standard 2-hour practice, Pre-game routine, Pitchers & catchers day.
- **Calendar:** practices show in week and month views next to workouts and link to the plan. Drafts are marked "Draft".
- **Players & parents:** a "Next practice" card on the player Today page; read-only timelines at `/player/practices/[id]` and `/parent/practices/[id]` (shared `PracticeView`). RLS hides drafts and other groups' plans, and those pages return 404.
- Time math (`blockTimes`, `practiceRange`, …) is in `src/lib/practices.ts` and unit-tested.

## Messaging & notifications (Phase 7)

- **Coach `/messages`:** Conversations and Announcements tabs.
  - **Announcements:** to the whole team or one player group, "Also send to parents" (on by default), pin. Staff see "12 of 18 read" (players + copied parents). `?a=<id>` scrolls to and highlights one.
  - **Conversations:** unread dots, last-message preview, and **New message** (`/messages/new`): pick players, parents ("Parent of X"), or staff, with quick-pick by group. The `start_thread` RPC enforces the rules: everyone is on the team, a coach is always included (no player-to-player DMs), and linked parents are copied on threads with their player.
- **Player `/player/messages`, parent `/parent/messages`:** team announcements (marked read when shown) and conversations, plus **Message a coach**. Threads live at `…/messages/[id]` (read marker updates on view). The player header's chat icon shows a dot for unread conversations.
- **Notifications:** DB triggers create them; the bell links to `/notifications` (list, "Mark all read"). Each item goes through `/n/[id]`, which marks it read, switches to that team, and redirects to the right page for the viewer's role (`hrefForRole` in `src/lib/notifications.ts`; only relative links).
- **Web push (optional):** `public/sw.js` + "Turn on phone notifications" on `/notifications`, with per-kind mutes (`profiles.push_muted`). `dispatchPush()` (`src/lib/push.ts`) sends unpushed notifications from the last 15 minutes with `web-push`, using the role-mapped link, and removes expired subscriptions. Call it with `after(() => dispatchPush())` at the end of a server action. Needs `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (see [docs/DEPLOY.md](docs/DEPLOY.md)); without them it does nothing.

## Stats

Box scores and season stats, built on `game_batting` / `game_pitching` (see `supabase/migrations/20261029000000_games_stats.sql`).

- **Box score entry, `/games/[id]/stats` (coaches only):** batting grid (quick-add players or "Add everyone", batting order, position, AB R H 2B 3B HR RBI BB SO HBP SB CS SAC SF E) and pitchers in order (IP typed `4.2`, H R ER BB SO HBP HR, pitches, strikes, W/L/S/H). On a laptop it's a table you tab across (arrow keys step numbers). On a phone each player gets a card with big −/+ steppers. Errors that match the DB checks (H ≤ AB, H + SO ≤ AB, 2B+3B+HR ≤ H, ER ≤ R, strikes ≤ pitches, valid IP, one W/L/S) block saving. Mismatches with the final score only warn. Save calls the `save_box_score` RPC, which replaces the whole box score in one transaction.
- **Pitch counts feed Throwing:** a DB trigger copies each pitcher's pitches into `throwing_logs` (type game, linked by `game_id`), so Pitch Smart rest and availability update by themselves. The entry page warns when a pitcher goes over the daily max for their age (counting other pitches logged that day), and flags a hand-logged game entry on the same date so it isn't counted twice.
- **`<BoxScore gameId />`** (`src/components/games/box-score.tsx`): newspaper-style batting and pitching tables, with 2B/3B/HR/SB/E and pitches–strikes footnotes. Staff get an enter/edit link. **`<PlayerSeasonLine playerId orgId />`** (`src/components/stats/player-season-line.tsx`) shows AVG/OBP/SLG/HR/RBI/SB, plus ERA/IP/SO/WHIP for pitchers.
- **Coach `/stats`:** season (calendar year) picker, "Include scrimmages" toggle (off by default), leaders (AVG, HR, RBI, SB, ERA, SO), and sortable team batting and pitching tables. To lead a rate stat, a player needs 2 PA or 1 IP per team game. ERA and K are scaled to the most common game length (`ERA (7 inn)`).
- **Who sees stats (`organizations.stats_visibility`):** "Whole team" (default) or "Each family sees only their own player". This is enforced by RLS on the stat tables. Staff always see everything. Only admins can change it, because organizations are admin-updatable.
- **Player `/player/stats`, parent `/parent/stats?player=`:** season line, game log, and the team tables when the team shares stats. Linked from the player profile, the coach's player profile ("Game stats"), and from box scores.
- Math lives in `src/lib/stats.ts` (pure, unit-tested). Loaders are in `src/lib/stats-data.ts`.

## Games & tournaments

- **Coach `/games`:** season record in the header (W–L–T over final games this year; scrimmages don't count) and Upcoming / Results / Tournaments tabs. **Add game** (opponent, date, start and arrive-by times, home / away / neutral, type: league, non-league, scrimmage, tournament, playoff, whole team or one group, location, address, notes, tournament, innings). **Quick season entry** (`/games/quick`) adds a whole schedule at once: one row per game (date, time, opponent, home/away, location), with type, group, tournament, and "arrive N minutes early" applied to every row.
- **Game page** (`/games/[id]`): details, **Directions** (Google Maps search from the address or location, new tab), **Add to calendar**, Postpone / Cancel / Back on schedule, **Reschedule** (new date, time, place; the arrival time moves with the start time), Edit, Duplicate to a date, Delete. Postponing, canceling, moving a scheduled game, and going final notify players and parents (`games_after_update` trigger, pushed with `dispatchPush()`).
- **Live scoring** (phone-sized, in the dugout): Start game → big + / − run buttons for each side in the current inning, previous / next inning, a line score with run totals. Taps show at once and save in the background (taps made during a save are batched). **End game** sets the final score (defaults to the line totals, editable) and marks it final; "Edit final score" and "Resume scoring" fix mistakes. The box score (stats track) plugs in under the scoring panel, with **Enter box score** → `/games/[id]/stats`.
- **Tournaments** (`/games/tournaments/[id]`): dates (up to 31 days), location / address, bracket link, notes, record within the tournament, and pool / bracket games added inline (they inherit the tournament's place and group).
- **Players `/player/games`, parents `/parent/games`** (phone-first, read-only): upcoming games with time, arrive-by, opponent, home/away, location; tournaments grouped with their date range and bracket link; postponed / canceled games marked; results with W/L chips. Detail pages show the line score and, while a game is live, a LIVE badge and refresh every 20 seconds. Group-only games are hidden from other players and their parents (RLS; their pages return 404). Parents follow one child at a time (`?player=`).
- **Next game** cards on the player Today page and the parent Home page; games appear in the parent's 14-day schedule and on the coach **Calendar** (week and month: opponent and time, or W/L and score when final; tournaments span their days).
- **Add to calendar:** `/games/[id]/ics` returns a single-event `.ics` for anyone who can see the game (floating local time, two-hour event or all-day without a time, escaped text, arrival time and notes in the description, a link to the viewer's game page).
- Helpers (`src/lib/games.ts`: results, records, line-score validation and totals, labels, times, `.ics`) are unit-tested; actions are in `src/lib/game-actions.ts`.

## Live game log

- **Scorer** (`/games/[id]/live`, coach, phone-first): set the batting order (defaults to the last game's) and starting pitcher, then tap the result of each at-bat (1B…HR, BB, HBP, K / Ꝁ, GO/FO/LO/PO, E, FC, SAC, SF, DP). Runs, RBI, who scored, and extra outs on the bases are steppers above the buttons. Also: stolen bases, caught stealing, substitutions, pitching changes, "End this half" with a run total (for innings you didn't log), undo last play, end game.
- **Pitch-by-pitch is optional** (our pitcher only): Ball / Called strike / Swinging strike / Foul / In play / Foul bunt / Foul tip; ball four and strike three record the walk or strikeout automatically. An ordinary foul stays alive at two strikes; a foul bunt or foul tip can strike the batter out. In play adds a pitch before you choose the result below.
- **Pitch counts stay attached to the pitcher:** resetting the count keeps pitches thrown; mid-at-bat pitching changes preserve the count and bank the outgoing pitcher's pitches. Pending pitches update the box score and Throwing workload on every tap, and survive closing a half or ending the game. For newly recorded pitches, −1 pitch also restores the previous count; old games without pitch history keep the existing count-correction behavior.
- **Pitch Smart live:** the pitcher card shows pitches, how many are left today for his age, the rest he needs if pulled now, and how many pitches until the next rest day kicks in (amber within 5, red over the max).
- **One source of truth:** plays live in `game_plays`; situation, line score, score, box score (`save_box_score`), season stats, and Throwing pitch counts are derived from them (`src/lib/live/engine.ts`, unit-tested), so undo is just deleting the last play. Ending the game sends players and parents the final.
- **Everyone follows along:** game pages show a live game log (situation + play-by-play, refreshing every 10 s). The feed respects the team's stats privacy (`game_plays` RLS).
- **Development:** player profiles and stats pages show **Recent at-bats** (results by game, on-base and strikeout rates vs the 20 before).

## Navigation & team features

- **Coach sidebar (7 sections):** Dashboard · Schedule (Calendar, Games, Practices) · Training (Programs, Exercise library) · Team (Roster, Members & invites, Testing day, Stats) · Player Health (throwing & arm care; more health tools later) · Videos · Messages, plus **Settings** for admins. Sections share a tab bar (`src/constants/sections.ts`, `src/components/layout/section-tabs.tsx`).
- **Features per team** (`organizations.modules`): Player Health, Games & stats, Practice plans, Video review, Messages can each be turned off in Settings. Off sections vanish from every menu and their pages return 404 (segment layouts call `requireModule`); nothing is deleted. Setup asks the team type (high school, college, travel, youth, facility) and picks sensible defaults (`src/constants/modules.ts`).
- **Phone tabs:** players get Today · Schedule · Health · Videos · Me (profile, workout history, stats); parents get Home · Schedule (next 2 weeks, games & results) · Progress (stats, videos) · Messages.

See the project brief for the full roadmap. Phases 1–7 are complete. Phone push notifications are optional and need the keys described in docs/DEPLOY.md.
