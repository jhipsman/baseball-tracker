# Roadmap notes

Product decisions and ideas captured along the way. They supplement the build phases in the project brief, which remain the source of truth for order.

## Positioning: why this beats a generic lifting app (Hevy, Boostcamp)

Generic apps log lifts. 9D should know about **the throwing arm and the baseball calendar**:

- Throwing workload: pitch counts, long-toss distances, bullpen plans, arm-feel check-ins (Phase 5)
- Safety alerts: MLB Pitch Smart limits by age, acute:chronic workload spikes, multi-sport load (Phase 5)
- Season-aware programming: off-season → pre-season → in-season periodization (Phase 3 toggle, AI later)
- Swing and pitching video feedback from a coach or AI, with drawings, angles, and voice-over (Phase 6)
- Coach-run teams: one coach, many players, compliance at a glance (Phases 3–4)

Phase 5 is the strongest differentiator. Consider pulling it ahead of Phase 4 if needed.

## Video analysis (Phase 6, built)

Built: upload, coach queue, frame stepping and slow motion, line/arrow/angle/circle/freehand drawings and timestamped notes, voice-over breakdown recording, written feedback, and optional Claude analysis that the coach edits before sharing.

Still to do:

- Side-by-side or overlay comparison with an earlier rep or a model video.
- Notify the player when a review is sent (needs push notifications).
- Player replies on a review (a short thread per video).
- Larger uploads: compress in the browser or use resumable uploads (TUS) on a paid Supabase plan.
- Clean up storage files when a whole org or player is deleted (today files are removed when a video is deleted).
- Pose estimation (joint tracking) to measure angles automatically and give the AI real measurements, not just frames.

## Workout logging improvements (built in Phase 7)

- **Tracking types per exercise** (built): weight × reps, reps only, time (e.g. 60-yard sprint, 7.1 s), distance, and distance + time. The player's workout screen shows only the inputs that apply, and the built-in library has sensible defaults.
- **Demo videos on exercises** (built): coaches add a YouTube or Vimeo link to a custom exercise. Players watch it in a pop-up during the workout; it also shows in the library, the builder, and program pages. Exercises without a video get a "Find a demo" YouTube search.
- Still open: curated demo links for the built-in library (needs someone to pick and vet real videos), and letting coaches set a tracking type or video on a global exercise for their org only.

## Health section (grows out of Arm care)

"Arm care" becomes a **Health** section: throwing workload and arm check-ins are its first parts. Other parts aren't decided yet. Ideas to choose from:

- **Daily readiness check-in** (10 seconds): sleep, energy, soreness, stress → a readiness score the coach sees before practice.
- **Soreness body map:** tap where it hurts (shoulder, elbow, back, hamstring…); repeated spots raise an alert.
- **Injury log and return-to-play:** who's injured, what, since when, cleared by whom; a step-by-step return-to-throw plan (e.g. long-toss distances by week) with the player's status shown on the roster and Throwing board.
- **Arm health testing:** shoulder internal/external rotation range, grip strength, and other screens tracked over the season (fits the existing testing/assessments feature).
- **Multi-sport and outside load:** other sports' practices and games so total workload is honest.
- **Concussion protocol tracking.**
- **Athletic trainer notes** with tighter privacy (medical info visible only to staff the player or parent allows; check FERPA/HIPAA implications before storing medical detail).
- **Sleep, hydration, nutrition** habits (light-touch, optional).

Keep the tone "talk to your coach or athletic trainer," never diagnostic.

## Live game scoring (built)

- **Live pitch counter** for our pitcher (ball / strike / in play), feeding Pitch Smart in real time with dugout warnings before limits.
- **At-bat-by-at-bat scoring** (result per plate appearance, outs, auto-advancing lineup) that fills in the box score automatically; parents follow live with a last-play feed.
- Built: live pitch counter with Pitch Smart, at-bat scoring that fills the box score, parent live feed, recent at-bats on profiles.
- Later, if asked: full runner-by-runner scoring (base state, earned-run logic), spray charts, importing GameChanger stats, tournament-weekend pitcher availability planner.

## From the Phase 5 product review

See [PRODUCT_REVIEW.md](PRODUCT_REVIEW.md) for the full list. Highlights:

- Link throwing program days to throwing logs (prompt "log your throws" when a throwing day is finished)
- Workload across teams: a player's throwing history should follow them between orgs
- Pitch Smart annual limits (innings per year, months off from overhead throwing)
- Privacy policy, terms, and parental consent for under-13 players

## Notifications

- Push workout reminders (Phase 2 leftover). Needs VAPID keys, a push-subscription table, and a scheduled job (Vercel Cron) now that the site is live on HTTPS.

## Native app (Phase 9)

- Capacitor wrapper for the App Store and Google Play.
- To pass Apple review: native push, camera capture for video, offline logging.
- In-app account deletion and a privacy policy (minors and COPPA).
- Bill organizations outside the app (Stripe) to avoid in-app purchase fees.
