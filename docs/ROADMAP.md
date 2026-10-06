# Roadmap notes

Product decisions and ideas captured along the way. They supplement the build phases in the project brief, which remain the source of truth for order.

## Positioning: why this beats a generic lifting app (Hevy, Boostcamp)

Generic apps log lifts. Diamond Program should know about **the throwing arm and the baseball calendar**:

- Throwing workload: pitch counts, long-toss distances, bullpen plans, arm-feel check-ins (Phase 5)
- Safety alerts: MLB Pitch Smart limits by age, acute:chronic workload spikes, multi-sport load (Phase 5)
- Season-aware programming: off-season → pre-season → in-season periodization (Phase 3 toggle, AI later)
- Swing and pitching video feedback from a coach or AI (Phase 6)
- Coach-run teams: one coach, many players, compliance at a glance (Phases 3–4)

Phase 5 is the strongest differentiator. Consider pulling it ahead of Phase 4 if needed.

## Video analysis (Phase 6)

Two review paths for every uploaded video (swing, pitching, fielding, exercise form):

1. **Coach review**
   - Frame-by-frame scrubbing and slow motion.
   - Drawing tools on the video: lines, **angles** (e.g. hip-shoulder separation, arm slot, knee flexion), circles, arrows, freehand.
   - **Voice-over** recorded while scrubbing and drawing, so the player gets a narrated breakdown.
   - Text notes, and side-by-side or overlay comparison with an earlier rep or a model video.
   - Annotated review sent back to the player with a notification.
2. **AI analysis (optional)**
   - Claude vision analysis of mechanics, with clear "AI, not a replacement for coaching eyes" framing.
   - Coach can accept, edit, or discard the AI notes before they reach the player ("AI assists, never overrides").

Storage: Supabase Storage buckets per org. Annotations stored as structured data (shape + timestamp + frame), not burned into the video, so they stay editable.

## Workout logging improvements (queued)

- **Tracking types per exercise** so each logs the right thing:
  - weight × reps
  - reps only
  - time (e.g. 60-yard sprint, 7.1 s)
  - distance
  - distance + time
  - Hide weight and RPE where they don't apply.
- **Demo videos on exercises:** `exercises.video_demo_url` already exists. Show an embedded YouTube or Vimeo player in the library, the builder, and the player's workout screen. Fill in links for the built-in library.

## Notifications

- Push workout reminders (Phase 2 leftover). Needs VAPID keys, a push-subscription table, and a scheduled job (Vercel Cron) now that the site is live on HTTPS.

## Native app (Phase 9)

- Capacitor wrapper for the App Store and Google Play.
- To pass Apple review: native push, camera capture for video, offline logging.
- In-app account deletion and a privacy policy (minors and COPPA).
- Bill organizations outside the app (Stripe) to avoid in-app purchase fees.
