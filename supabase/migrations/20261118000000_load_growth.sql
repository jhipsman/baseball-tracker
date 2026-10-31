-- Whole-athlete health, part 4: total training load and growth.
-- * The daily check-in can record today's team practice or game (minutes and
--   effort 1–10); with logged workouts this gives session load (minutes × effort).
-- * Heights (monthly) to spot growth spurts, when injury risk goes up.

alter table public.body_checkins
  add column session_minutes smallint check (session_minutes between 0 and 300),
  add column session_rpe     smallint check (session_rpe between 1 and 10),
  add constraint body_checkins_session_pair
    check ((session_minutes is null) = (session_rpe is null));

create table public.growth_measurements (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  player_id   uuid not null references public.profiles (id) on delete cascade,
  measured_on date not null,
  height_in   numeric(4, 1) not null check (height_in between 36 and 90),
  logged_by   uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (org_id, player_id, measured_on)
);
create index growth_measurements_player_idx
  on public.growth_measurements (org_id, player_id, measured_on desc);
alter table public.growth_measurements enable row level security;

create policy "Staff, the player, and their parents see heights"
  on public.growth_measurements for select to authenticated
  using (
    private.is_org_staff(org_id)
    or (player_id = (select auth.uid()) and private.is_org_member(org_id))
    or private.is_parent_of(org_id, player_id)
  );
create policy "Staff, the player, or a parent add a height"
  on public.growth_measurements for insert to authenticated
  with check (
    logged_by = (select auth.uid())
    and measured_on <= current_date + 1
    and private.is_player_in_org(org_id, player_id)
    and (private.is_org_staff(org_id) or player_id = (select auth.uid())
         or private.is_parent_of(org_id, player_id))
  );
create policy "Staff, the player, or a parent correct a height"
  on public.growth_measurements for update to authenticated
  using (private.is_org_staff(org_id) or player_id = (select auth.uid())
         or private.is_parent_of(org_id, player_id))
  with check (
    logged_by = (select auth.uid())
    and (private.is_org_staff(org_id) or player_id = (select auth.uid())
         or private.is_parent_of(org_id, player_id))
  );
create policy "Staff, the player, or a parent remove a height"
  on public.growth_measurements for delete to authenticated
  using (private.is_org_staff(org_id) or player_id = (select auth.uid())
         or private.is_parent_of(org_id, player_id));
