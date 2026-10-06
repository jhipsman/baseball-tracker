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

### Using a hosted Supabase project

```bash
npx supabase link --project-ref <ref>
npx supabase db push                          # apply migrations
psql "$DATABASE_URL" -f supabase/seed/exercises.sql   # seed the global exercise library
```

In the dashboard, set **Auth → URL Configuration → Redirect URLs** to include `https://<your-domain>/auth/callback`. Set `NEXT_PUBLIC_SITE_URL` in production so confirmation links point to your domain.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit tests (Vitest), e.g. the workout builder's state logic |
| `npm run format` | Prettier |
| `npm run db:start` / `db:stop` | Start / stop local Supabase |
| `npm run db:reset` | Recreate the local DB from migrations + seed |
| `npm run db:types` | Regenerate `src/types/database.ts` from the local DB |

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

| Who | Can do |
| --- | --- |
| Any member | See their org, its members, teammates' profiles, global and org exercises |
| Admin | Update the org; invite, update, and remove members (not the owner) |
| Admin / coach / trainer ("staff") | Create and edit org exercises and programs (weeks, days, exercises); assign programs to the org's players |
| Player | See only the programs assigned to them and their own assignments |
| Anyone | No access to another org's data |

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

See the project brief for the full roadmap. Phase 1 (foundation + workout builder) is complete.
