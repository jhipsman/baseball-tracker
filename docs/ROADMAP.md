# 9D roadmap

The working plan for 9D (legal name 9D Systems): what's built, what's next, and the rules any contributor (human, Claude or ChatGPT/Codex) should follow. Keep this file current: move items to **Built** when they ship.

Last updated: October 31, 2026.

---

## 1. What 9D is

A baseball team app for **coaches and clubs, players, and parents**, live at **https://9dbsbl.app**. Its edge over generic lifting apps (Hevy, Boostcamp) and game apps (GameChanger) is that it knows **the throwing arm, the whole athlete, and the baseball season**, all in one place: schedule, training, health, live scoring, registration, payments and documents.

**Pricing:** every team gets a 30-day free trial with no card. After that it's $19/month or $190/year per team, and coach pages go view-only until someone subscribes. Discount codes are Stripe promotion codes. Players and parents never pay. Prices live in `src/constants/pricing.ts`.

---

## 2. How to work in this repo (read before changing anything)

- **Stack:**
  - Next.js 16 (App Router, server actions), React, Tailwind v4, Supabase (Postgres, Auth, Storage, RLS), Stripe, Resend for email
  - Deployed on Vercel
  - This Next.js has breaking changes compared with older versions: read `node_modules/next/dist/docs/` before using an API (see `AGENTS.md`).
- **Branch:** work on `claude/laughing-knuth-4iwh0e` (the default branch; pushes deploy). Several agents push here, so **always fetch and merge before pushing**.
- **Database:**
  - Add a new file in `supabase/migrations/` (timestamped, after the latest one). The "Deploy database migrations" GitHub Action applies it to production on push.
  - Never edit a migration that has already shipped.
  - Every table needs RLS. Use the `private.*` helpers: `is_org_staff`, `is_org_member`, `is_parent_of`, `is_player_in_org`, `has_org_role`.
  - Types are hand-maintained: update `src/types/database.ts` (tables) and `src/types/team-operations.ts` (RPCs and team-operations tables).
- **New routes:** run `npx next typegen` so `PageProps<"/path">` exists.
- **Day / Night theme (required):** every screen must work in both modes.
  - Use `bg-surface` for panels and `text-on-brand` on brand fills.
  - Use `bg-zinc-900 text-zinc-50` for inverted chips.
  - Add no new hex colors in components, and use only color shades that already have a Night version (`src/app/theme-coverage.test.ts` checks this).
  - Full rules: `.claude/agents/design.md`.
- **Phones first:**
  - Tap targets are at least 44px and nothing scrolls sideways at 375px.
  - "View as player/parent" preview disables every `<button>`. Anything that only opens or shows something should use `ViewButton` (`src/components/ui/view-button.tsx`).
- **Privacy:**
  - Health data about minors is visible only to the team's staff, the player and that player's parents.
  - Notification and email text stays vague ("Coach update"); details stay in the app.
- **Secrets:** never put a secret in a `NEXT_PUBLIC_` variable, never commit keys, and never ask for keys to be pasted into a chat.
- **Licensing:**
  - Don't copy code or assets from GameChanger, Hevy or any AGPL project. PDFCraft was only a reference; Documents uses pdf-lib (MIT) and PDF.js (Apache-2.0).
  - Anything an AI feature reads must be public domain, openly licensed, or the team's own document.
- **Checks before pushing:** `npx tsc --noEmit`, `npx eslint src`, `npx vitest run`, and Prettier on changed files.
- **Writing style for UI copy:** short and plain. No dashes inside sentences, no jargon, and "talk to your coach or athletic trainer" rather than anything diagnostic.

---

## 3. Built

**Training**
- Programs, assignments, workout logging with tracking types (weight × reps, time, distance)
- Demo videos, plus our own animated exercise diagrams (SVG figures in `src/lib/figures/`). Long toss and flat ground have none on purpose; Blender versions are planned later.

**Team**
- Roster and invites by link and email; parents linked to players
- Messages, schedule and RSVPs, practices, notifications (in-app, push and email)

**Games**
- Box scores and stats
- **Live scoring:**
  - start flow: pitcher cards with health status, batting order, who bats first
  - five-button pitch pad and a guided "in play" flow
  - fielders' names on the field; opponent lineup by batting spot
  - undo; phone focus mode
  - parent live feed

**Player Health**
- **Today board** (`/throwing`): needs a look / out / limited / resting / ready, plus alerts you can mark handled
- **Pitch Smart** limits and rest days; arm check-in; throwing volume spikes
- **Injuries:** where (body map) and what; return plans by injury; injury history
- **Concussion protocol:** a 7-step plan; can't return to Full without a doctor's written clearance (the database enforces this); families upload the note
- **Daily body check-in:** feel, sore spots, sleep, and team-session minutes × effort. Alerts for feeling rough, new soreness and lingering soreness.
- **Training load** (minutes × effort) spikes
- **Growth tab:** monthly heights and growth-spurt flags
- **Pitched and caught on the same day** alert (from the box score)
- **Medical tab:** allergies, medications, emergency contacts with tap-to-call, the team's field emergency plan, print

**Team operations**
- **Registration links:** waiver signing, installment plans, automatic payment reminders (daily Vercel cron)
- **Team dues via Stripe Connect:** each team's own Stripe account; ACH supported
- **Documents:**
  - families sign PDFs on their phone; the server stamps a signature page with an audit trail
  - upload-back requests
  - staff certifications with expiry

**Switching to 9D** (`/imports`)
- Upload a GameChanger, TeamSnap, LeagueApps or SportsEngine export as it is (CSV, Excel, or a calendar `.ics` file or link), or paste spreadsheet cells. Step-by-step export guides per platform.
- Finds the header row under titles, reads GameChanger's Batting/Pitching sections, matches headers loosely (parent emails, team/division, birthdays), many date/time formats, Excel date cells, positions ("Shortstop" → SS), "Last, First" names.
- Roster: players are created with no login needed ("roster-only"), groups from the team column, cancelled/withdrawn/staff rows skipped, duplicate rows per parent merged; parents invited (siblings share one invite), players with an email get a "set up your login" link (`/claim/[token]`).
- Schedule: games and practices; Home team / Away team files ask which team is yours; duplicates skipped.
- Stats: batting and pitching lines matched to roster players.
- Every import can be undone. Roster → Manage also adds players by name, and a player's page has "Give them a login".
- Formats were built from typical exports; real files from each platform are the best test. Send any file that doesn't import cleanly.

**Staff time & pay** (opt-in feature switch in Settings; `src/lib/staff-*.ts`, `/staff`)
- Pay setup per coach, per team: hourly, per session, season stipend (split into N payments) or volunteer
- My time: clock in/out, add hours by hand or tap "I worked this" on a recent practice/game, send for approval
- Timesheets (admin): approve or send back with a reason; the amount is fixed at approval
- Pay (admin): pick a period, see what each coach is owed, export CSV, mark paid (payroll, check, cash, app…)
- 9D tracks and totals only; it doesn't move money or run payroll. Later: direct payouts or a payroll integration (Gusto/Check)

**9D Leagues, step 1** (public, `/leagues`; `src/lib/league*.ts`, `src/app/leagues`)
- Anyone with an account can add a free public team page: schedule, results, record, runs, streak, share link
- Pages linked to a 9D team are "On 9D" (verified) and show its games and live scores automatically, via `public_team_games` (schedule/score columns only; nothing about players)
- Other teams enter games and scores on their manage page, one at a time or the whole season at once (CSV, Excel, .ics file, pasted cells or a calendar link; reuses the 9D import parser, skips duplicates and other teams' games)
- Team logos: owners upload PNG/JPG/WebP, cropped to a 512px square WebP in the browser; public `team-logos` bucket, owner-only writes
- 9D Leagues home: live now, today, recent results, coming up, team search, new teams
- **Leagues** (`/leagues/l/...`, `src/lib/league-standings.ts`, `league-admin-actions.ts`): anyone starts a league; divisions; add existing team pages or create new ones; schedule by file/paste (Home/Away team columns) or one game at a time
- League scores: the admin's score always wins; otherwise each game is matched to the two teams' own games (date + loose name match, doubleheaders by start time). One final report counts, two that agree count, two that disagree are "disputed" and left out of standings until the admin settles it. Teams on 9D report from live scoring
- Standings per division: W, L, T, PCT, GB, RF, RA, DIFF, STRK. A team's owner can leave a league (its league games go with it)
- **Shared games** (`report_public_game`): when adding a game, pick the opponent's team page and it shows on both schedules (flipped), linked to each other. Either team enters the score: the second team's same score confirms it, a different one marks it "disputed" on both pages (out of records and standings) until one side agrees. Once the other team has a say, nobody can wipe the score; no double entries (a team can't re-add a game the opponent already added, imports skip it, and copies are hidden when a team has its own entry)
- Next: claiming team pages, then brackets, then opt-in rosters and stat leaders
- Later: recruiting profiles (videos, verified stats, share link; parents always copied on messages with minors; NCAA contact dates), then verified college coach accounts and paid "9D Recruit"

**9D business**
- Marketing site: home, For coaches / players / parents, six feature pages, pricing
- Privacy and Terms pages; demo team; branded loading animation
- Subscriptions (trial, Checkout, customer portal, webhook)
- **Email (Resend):** invites, reminders and notifications, with per-kind opt-out

**Deploy notes:** `docs/DEPLOY.md`.

---

## 4. Next up (in this order)

### 4.1 Tryouts and one-click offers

The goal: run a tryout and turn the players you want into registered, paid team members without spreadsheets.

1. **Tryout events:**
   - a public sign-up link (like registration links) collecting player, age, positions and parent contact, plus an optional fee and waiver
   - check-in at the field with tryout numbers
2. **Grading clipboard (phone-first):**
   - coaches grade each player on the 20–80 scouting scale by category: arm, hit, power, run, field, pitching velo, catcher pop time; plus notes
   - several evaluators can grade at once; their scores are averaged
   - works offline-tolerant (save as you go)
3. **Rankings:** sort by overall or by category; filter by position or age; compare two players side by side.
4. **Send offer:**
   - one click sends an email and an in-app offer that leads into the existing **registration** flow
   - the flow includes the waiver and required forms from **Documents** and a **Stripe deposit** (team payments)
   - the offer has an expiry date
5. **Offer tracker:**
   - statuses: sent / viewed / accepted / declined / expired
   - automatic reminders through the existing cron and email
   - a waitlist that moves up when someone declines
6. Families who accept become roster players with parents linked (reuse `link_registration_player`).

### 4.2 "Ask the trainer": a recovery and performance assistant

An assistant for players (and parents) that answers **only from a curated library of approved sources** and cites a source with every answer.

**Status: a first preview ("Ask 9D") is built** at `/player/ask` (linked from Me), added by Codex.
- **What it does:**
  - answers from editorial summaries of two public sources (Driveline exit-velocity education, MLB Pitch Smart)
  - uses context the player types in and asks follow-up questions
  - checks that cited source IDs are real
  - can draft a plan for the player to discuss with their coach
- **Setup:** needs `ANTHROPIC_API_KEY`; `ASK_9D_MODEL` optionally overrides the model.
- **What it doesn't do yet:**
  - search the web, read health records or assigned workouts
  - save conversations or send plans to coaches
- **Still to build:**
  - a reviewed source library, including recovery sources
  - saved conversations with coach review
  - the player's real injury, plan and workload as context (with the guardrails below)
  - per-player usage limits before a broad rollout
- **Approach:** retrieval over approved documents with the Claude API (the app already uses it for video analysis). We do not train a model.
- **Recovery mode:**
  - It knows the player's current injury, return-plan step and recent check-ins.
  - It explains the plan and suggests safe things to work on meanwhile (e.g. legs and core during an elbow injury).
  - Example questions: "Why can't I throw yet?", "What does step 4 mean?"
- **Performance mode:** strength, speed and explosiveness, answered with exercises from 9D's own exercise library (with diagrams). It can draft a program for the coach to approve.
- **Guardrails:**
  - It never changes the coach's status, plan or the concussion lock.
  - It never diagnoses.
  - Warning signs (numbness, pain getting worse, headache after a hit, any concussion symptom) get "stop and tell your coach or parent", and the coach is alerted.
  - If the library has no source for a question, it says so instead of guessing.
  - Coaches can see their players' questions.
- **Library sources:**
  - public, citable material: MLB/USA Baseball Pitch Smart, CDC HEADS UP, open-access research on PubMed Central, and freely published position statements after a license check
  - the team's own uploaded protocols, used for that team only
  - every source is approved before use, and each is stored with its title, publisher, link and license

### 4.3 Small scorer additions

- Dropped third strike, catcher's interference, runner's interference.
- A recorded "override rest" confirmation when a coach picks a pitcher who should be resting under Pitch Smart.

### 4.4 Health leftovers

- **Catching outside games:** log bullpen and practice catching (innings or pitches received) so "pitched and caught" and catcher load include them. This needs a new throwing type and an innings field in the throw log form.
- **Heat and lightning:** needs a weather API. Heat index guidance and lightning-distance warnings on practice and game days.
- Parents can do the body check-in for younger players. The database already allows it; it needs a UI on the parent home.
- Arm health testing (shoulder internal/external rotation range, grip strength) in Testing.
- Pitch Smart annual limits (innings per year, months off from overhead throwing).

---

## 5. Later / ideas

- **Video:** side-by-side compare with an earlier rep or a model video; player replies on reviews; bigger uploads (resumable); pose estimation for automatic angles.
- **Exercise library:** curated demo videos for built-in exercises; Blender-rendered diagrams; per-team overrides of global exercises.
- **Workload:** a player's throwing history follows them between teams; link throwing program days to throw logs.
- **Live scoring:** full runner-by-runner scoring with earned runs, spray charts, GameChanger stat import, a tournament-weekend pitcher planner.
- **Clubs:** multi-team club accounts with club pricing (discount from 5 teams).
- **Native app:**
  - Capacitor wrapper for the App Store and Google Play: native push, camera capture, offline logging, in-app account deletion
  - Bill outside the app to avoid in-app purchase fees.
- **Compliance:** parental consent for under-13 players (COPPA); review FERPA/HIPAA questions before storing more medical detail.

---

## 6. Owner to-dos (setup outside the code)

Steps for each are in `docs/DEPLOY.md`.

- [ ] **Resend:** verify the 9dbsbl.app domain, then add `RESEND_API_KEY` in Vercel and redeploy.
- [ ] **Supabase:** turn on custom SMTP through Resend, so login and password-reset emails come from 9dbsbl.app.
- [ ] **Stripe billing:** add the second webhook (`/api/billing/webhook`) and `STRIPE_WEBHOOK_SECRET`, then save the Customer portal settings.
- [ ] **Stripe live mode:** enable Accounts v1 support there too, then swap the test keys for live ones.
- [ ] Match the Vercel and Supabase regions, and consider paid plans before teams rely on it (Supabase free projects pause after a week idle; the keep-awake Action covers this for now).
