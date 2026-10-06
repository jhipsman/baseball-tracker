-- =============================================================================
-- Phase 4: player assessments (testing numbers over time)
--
-- data is a flat JSON object of metric key -> number, e.g.
--   { "fastball_velo": 87, "exit_velo": 95, "sixty_time": 6.8, "height_in": 73 }
-- Metric definitions (labels, units, better-direction) live in the app
-- (src/constants/metrics.ts) so new metrics need no migration.
-- =============================================================================

create table public.assessments (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  player_id        uuid not null references public.profiles (id) on delete cascade,
  assessed_by      uuid references public.profiles (id) on delete set null,
  assessment_date  date not null default current_date,
  data             jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  notes            text,
  created_at       timestamptz not null default now()
);

create index assessments_org_player_date_idx
  on public.assessments (org_id, player_id, assessment_date desc);

alter table public.assessments enable row level security;

create policy "Staff see their org's assessments; players see their own"
  on public.assessments for select to authenticated
  using (
    private.is_org_staff(org_id)
    or (player_id = (select auth.uid()) and private.is_org_member(org_id))
  );

create policy "Staff record assessments for their org's players"
  on public.assessments for insert to authenticated
  with check (
    private.is_org_staff(org_id)
    and private.is_player_in_org(org_id, player_id)
  );

create policy "Staff edit their org's assessments"
  on public.assessments for update to authenticated
  using (private.is_org_staff(org_id))
  with check (
    private.is_org_staff(org_id)
    and private.is_player_in_org(org_id, player_id)
  );

create policy "Staff delete their org's assessments"
  on public.assessments for delete to authenticated
  using (private.is_org_staff(org_id));
