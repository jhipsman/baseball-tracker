# Product review: through Phase 5

A pass over the whole app as a **coach** (desktop, plus a phone at the field) and as a **player** (phone). It asks two questions: is it still a viable product, and what's missing before real teams use it?

## Verdict

**Viable, and now clearly differentiated.** Through Phase 4 the app was a solid team-training tool, but one a determined coach could approximate with Hevy plus a spreadsheet. Phase 5 adds the part generic apps don't have: **a pitcher's arm workload tied to Pitch Smart, arm-feel check-ins that alert the coach, and an at-a-glance "who can pitch today" board.** That's the wedge for baseball coaches, high school programs, and facilities.

The core loop works end to end and is covered by automated browser tests:

> Coach builds a program, assigns it to a group, the player logs on their phone, and the coach sees compliance, numbers, and arm health.

## What's strong

- **The coach's daily questions have one-click answers:**
  - Who's doing the work? → Roster overview and dashboard
  - Who can pitch? → Throwing
  - Who's hurting? → Alerts banner
- **The player side is genuinely phone-first:** big tap targets, prefilled sets, the "last time" hint, and draft recovery.
- **Data safety:** every table has org-level row security, tested per phase. Players can't see each other's numbers, and other teams see nothing.
- **Onboarding:** invite links, a "Getting started" checklist, and starter templates. A new coach is productive in minutes.

## Fixed in this pass

| Issue | Why it mattered | Fix |
| --- | --- | --- |
| No "Forgot password" | A locked-out player can't get back in, which blocks real use | Full reset flow (email link → new password) plus an email template in DEPLOY.md |
| "Parent" could be invited | Parents landed on an empty coach dashboard | Hidden until the parent dashboard (Phase 7), and enforced on the server too |
| Blank slate for new coaches | No guidance on what to do first | "Getting started" checklist on the dashboard |
| Building throwing programs from scratch | Too slow to set up | One-click starter templates: Long Toss Build-up, Bullpen Progression, Daily J-Band Arm Care |
| `npm run db:types` could wipe the types file | A broken build if the DB was stopped | Script only writes on success (works on Windows too) |

## Open gaps, in priority order

### Before inviting a real team

1. **Email sending.** Supabase's built-in email is rate-limited to a few per hour. Connect a real SMTP provider (e.g. Resend, free tier) before onboarding a roster. *(Setup, not code; see DEPLOY.md.)*
2. **Privacy policy, terms, and minors.** Many players are under 18, and some are under 13 (COPPA). Needs a privacy page, terms, and a decision on parental consent for under-13s. Pairs naturally with parent accounts (Phase 7).

### Next product improvements

3. **Exercise tracking types:** time or distance for sprints and conditioning instead of weight × reps × RPE. *(Queued "quick win".)*
4. **Demo videos** on exercises, shown in the player's workout. *(Queued "quick win"; the field already exists.)*
5. **Link throwing programs to throwing logs.** Today, finishing a throwing *program day* and logging *throws* are separate. Finishing a throwing day should prompt "log your throws" with the prescription prefilled.
6. **Workload across teams.** Throwing logs belong to one org. A player on a high school team *and* a travel team has two separate workloads, so Pitch Smart can undercount. Longer term, let players carry their own throwing history across the orgs they belong to.
7. **Push reminders** (workout today, arm check-in). Needs the scheduled job mentioned in ROADMAP.md.
8. **Annual limits:** Pitch Smart also recommends yearly innings caps and months off from overhead throwing. Track innings per outing and a "days off from throwing" counter.

### Already planned (later phases)

- Video review with coach drawing, angles, and voice-over, or AI analysis (Phase 6)
- Practice plans, messaging, and the parent dashboard (Phase 7)
- Billing and plan tiers (Phase 8)
- Native app (Phase 9)

## Risks to keep an eye on

- **Liability framing.** Pitch Smart output is guidance. The app says so everywhere limits appear, and alerts say "talk to your coach or athletic trainer" rather than diagnosing. Keep that tone in every AI feature, too.
- **Coach effort.** The value depends on players logging. Push reminders (#7) and compliance flags are the levers; watch real compliance numbers once a team is live.
