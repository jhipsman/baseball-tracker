-- =============================================================================
-- Phase 5: throwing workload & arm care
-- =============================================================================

-- Age drives MLB Pitch Smart limits.
alter table public.profiles add column birth_date date
  check (birth_date is null or birth_date between '1940-01-01' and current_date);

-- Coaches can set a player's birthdate (players set their own via profile update).
create or replace function public.set_player_birth_date(p_org_id uuid, p_player_id uuid, p_birth_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_org_staff(p_org_id) or not private.is_player_in_org(p_org_id, p_player_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.profiles set birth_date = p_birth_date where id = p_player_id;
end;
$$;

revoke execute on function public.set_player_birth_date(uuid, uuid, date) from public, anon;
grant execute on function public.set_player_birth_date(uuid, uuid, date) to authenticated;

create type public.throwing_type as enum (
  'long_toss', 'flat_ground', 'bullpen', 'live_abs', 'game', 'check_in'
);
create type public.throwing_intensity as enum ('low', 'moderate', 'high', 'max_effort');
create type public.arm_feel as enum ('great', 'good', 'okay', 'tired', 'sore', 'pain');

create table public.throwing_logs (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  player_id        uuid not null references public.profiles (id) on delete cascade,
  logged_by        uuid references public.profiles (id) on delete set null,
  date             date not null default current_date,
  throwing_type    public.throwing_type not null,
  -- Total throws/pitches in the session (0 for an arm check-in).
  pitch_count      smallint not null default 0 check (pitch_count between 0 and 400),
  max_distance_ft  smallint check (max_distance_ft between 0 and 500),
  intensity        public.throwing_intensity,
  -- e.g. {"fastball": 30, "slider": 15}
  pitches_by_type  jsonb check (pitches_by_type is null or jsonb_typeof(pitches_by_type) = 'object'),
  arm_feel         public.arm_feel,
  notes            text,
  created_at       timestamptz not null default now(),
  check (throwing_type <> 'check_in' or (pitch_count = 0 and arm_feel is not null))
);

create index throwing_logs_org_player_date_idx
  on public.throwing_logs (org_id, player_id, date desc);

alter table public.throwing_logs enable row level security;

create policy "Players see their throwing; staff see their org's"
  on public.throwing_logs for select to authenticated
  using (
    private.is_org_staff(org_id)
    or (player_id = (select auth.uid()) and private.is_org_member(org_id))
  );

-- Players log their own sessions; staff can log for their players (e.g. game pitch counts).
create policy "Players and staff log throwing"
  on public.throwing_logs for insert to authenticated
  with check (
    logged_by = (select auth.uid())
    and private.is_player_in_org(org_id, player_id)
    and (player_id = (select auth.uid()) or private.is_org_staff(org_id))
  );

create policy "Authors and staff edit throwing logs"
  on public.throwing_logs for update to authenticated
  using (logged_by = (select auth.uid()) or private.is_org_staff(org_id))
  with check (
    private.is_player_in_org(org_id, player_id)
    and (player_id = (select auth.uid()) or private.is_org_staff(org_id))
  );

create policy "Authors and staff delete throwing logs"
  on public.throwing_logs for delete to authenticated
  using (logged_by = (select auth.uid()) or private.is_org_staff(org_id));
