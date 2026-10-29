# Dashboard and navigation performance

## Changes (2026-10-29)

The dashboard previously awaited four groups of independent reads in sequence. Its team loader additionally loaded group memberships and up to 1,000 historical workout rows that the dashboard never displayed. `loadDashboard` now starts independent reads together and opts out of those two unused queries. The original team-loader defaults remain intact for roster/calendar callers. Health, video, and practice reads are skipped when the corresponding module is disabled. Getting-started checks fetch at most one assignment/assessment instead of requesting full exact counts.

Dashboard greetings and the navigation shell stream before dashboard metrics finish. Notification/message links render immediately; their unread badges fill in separately. Root, coach, player, and parent loading boundaries allow Next's automatic partial prefetching and show an immediate fallback during navigation. Primary navigation and section tabs also show pending feedback when a destination hasn't been prefetched. Authentication, membership checks, RLS, and request freshness were preserved; no personal/team data is cached across users or requests.

## Validation

- Production build, lint, and 252 tests passed. Regression tests ensure all independent reads start before any finishes, disabled modules issue no optional reads, workload errors propagate, and skipping unused roster reads preserves compliance/calendar data.
- Chromium exercised the real production Next server with fictional auth/team data and a local Supabase-shaped API: auth calls delayed 80 ms, database reads 300 ms, notification counts 2,000 ms. Cold dashboard greeting appeared at 0.942 seconds, dashboard metrics at 1.276 seconds, and navigation loading feedback at 0.082 seconds. These are controlled local observations, not production latency claims or a before/after speedup measurement. No browser runtime errors were observed.
- Local test fixtures/results are in `/workspace/performance-check/`; fixture credentials are fake and are not committed. Vercel uses its own existing Supabase environment variables when rebuilding.

The live website and GitHub status API are blocked by this cloud environment's outbound policy, so remote function region, database latency, cold starts, and deployment completion still need production observation. This change addresses verified application waterfalls and missing loading boundaries; it does not assert those are the only sources of latency.
