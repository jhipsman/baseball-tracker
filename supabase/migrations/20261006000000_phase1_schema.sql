-- =============================================================================
-- Diamond Program — Phase 1 schema
--
-- Tables: profiles, organizations, org_memberships, exercises, programs,
--         program_weeks, program_days, program_exercises, program_assignments
--
-- Every table has RLS enabled. Org isolation is enforced through a small set of
-- SECURITY DEFINER helper functions (in the `private` schema, not exposed via
-- the API) so policies never recurse through org_memberships' own RLS.
-- =============================================================================

create extension if not exists pgcrypto;

create schema if not exists private;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

create type public.org_role as enum ('admin', 'coach', 'trainer', 'player', 'parent');
create type public.member_status as enum ('active', 'inactive', 'injured');
create type public.player_position as enum ('P', 'C', '1B', '2B', 'SS', '3B', 'OF', 'DH', 'UTIL');
create type public.plan_tier as enum ('free', 'pro', 'enterprise');
create type public.exercise_category as enum (
  'strength', 'power', 'mobility', 'arm_care', 'conditioning',
  'plyometric', 'speed', 'throwing', 'hitting'
);
create type public.program_type as enum ('strength', 'throwing', 'arm_care', 'hitting', 'conditioning', 'hybrid');
create type public.season_phase as enum ('off_season', 'pre_season', 'in_season', 'post_season');
create type public.session_type as enum ('strength', 'throwing', 'hitting', 'conditioning', 'recovery', 'practice', 'off');
create type public.exercise_group_type as enum ('superset', 'circuit', 'emom', 'amrap');
create type public.assignment_status as enum ('active', 'completed', 'paused');

-- -----------------------------------------------------------------------------
-- Shared trigger: updated_at
-- -----------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- -----------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- Create a profile row whenever a new auth user signs up.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- organizations
-- -----------------------------------------------------------------------------

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  owner_id    uuid not null references public.profiles (id) on delete restrict,
  sport       text not null default 'baseball',
  settings    jsonb not null default '{}'::jsonb,
  plan_tier   public.plan_tier not null default 'free',
  created_at  timestamptz not null default now()
);

create index organizations_owner_id_idx on public.organizations (owner_id);

-- -----------------------------------------------------------------------------
-- org_memberships
-- -----------------------------------------------------------------------------

create table public.org_memberships (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  role           public.org_role not null,
  jersey_number  smallint check (jersey_number between 0 and 99),
  position       public.player_position,
  status         public.member_status not null default 'active',
  created_at     timestamptz not null default now(),
  unique (org_id, profile_id),
  -- jersey number and position only make sense for players
  check (role = 'player' or (jersey_number is null and position is null))
);

create index org_memberships_profile_id_idx on public.org_memberships (profile_id);

-- -----------------------------------------------------------------------------
-- RLS helper functions
-- SECURITY DEFINER so they can read org_memberships without triggering its RLS.
-- -----------------------------------------------------------------------------

create or replace function private.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.org_memberships m
    where m.org_id = p_org_id
      and m.profile_id = (select auth.uid())
  );
$$;

create or replace function private.has_org_role(p_org_id uuid, p_roles public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.org_memberships m
    where m.org_id = p_org_id
      and m.profile_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

-- Staff = anyone who builds/assigns programs: admin, coach, trainer.
create or replace function private.is_org_staff(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_org_role(p_org_id, array['admin', 'coach', 'trainer']::public.org_role[]);
$$;

-- True when the current user shares at least one org with p_profile_id.
create or replace function private.shares_org_with(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.org_memberships mine
    join public.org_memberships theirs on theirs.org_id = mine.org_id
    where mine.profile_id = (select auth.uid())
      and theirs.profile_id = p_profile_id
  );
$$;

create or replace function private.is_player_in_org(p_org_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.org_memberships m
    where m.org_id = p_org_id
      and m.profile_id = p_profile_id
      and m.role = 'player'
  );
$$;

-- -----------------------------------------------------------------------------
-- exercises
-- org_id null = global/default library entry (read-only to everyone).
-- -----------------------------------------------------------------------------

create table public.exercises (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references public.organizations (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 120),
  description     text,
  category        public.exercise_category not null,
  muscle_groups   text[] not null default '{}',
  equipment       text[] not null default '{}',
  video_demo_url  text,
  instructions    text,
  created_by      uuid references public.profiles (id) on delete set null,
  is_custom       boolean not null default false,
  created_at      timestamptz not null default now(),

  constraint exercises_is_custom_matches_org check (is_custom = (org_id is not null)),
  constraint exercises_muscle_groups_valid check (
    muscle_groups <@ array[
      'quads', 'hamstrings', 'glutes', 'chest', 'back',
      'shoulders', 'arms', 'core', 'full_body'
    ]::text[]
  ),
  constraint exercises_equipment_valid check (
    equipment <@ array[
      'barbell', 'dumbbell', 'kettlebell', 'band', 'cable', 'bodyweight',
      'machine', 'med_ball', 'plyo_box',
      -- baseball-specific additions
      'trap_bar', 'landmine', 'sled', 'foam_roller', 'pull_up_bar',
      'baseball', 'weighted_ball', 'bat', 'tee'
    ]::text[]
  )
);

-- Names are unique within the global library and within each org's library.
create unique index exercises_global_name_key on public.exercises (lower(name)) where org_id is null;
create unique index exercises_org_name_key on public.exercises (org_id, lower(name)) where org_id is not null;
create index exercises_org_id_idx on public.exercises (org_id);
create index exercises_category_idx on public.exercises (category);
create index exercises_muscle_groups_idx on public.exercises using gin (muscle_groups);
create index exercises_equipment_idx on public.exercises using gin (equipment);

-- -----------------------------------------------------------------------------
-- programs → program_weeks → program_days → program_exercises
-- -----------------------------------------------------------------------------

create table public.programs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 200),
  description     text,
  program_type    public.program_type not null default 'strength',
  season_phase    public.season_phase,
  duration_weeks  smallint check (duration_weeks between 1 and 104),
  created_by      uuid references public.profiles (id) on delete set null,
  is_template     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index programs_org_id_idx on public.programs (org_id);

create trigger programs_set_updated_at
  before update on public.programs
  for each row execute function private.set_updated_at();

create table public.program_weeks (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references public.programs (id) on delete cascade,
  week_number  smallint not null check (week_number >= 1),
  label        text,
  notes        text,
  unique (program_id, week_number)
);

create table public.program_days (
  id               uuid primary key default gen_random_uuid(),
  program_week_id  uuid not null references public.program_weeks (id) on delete cascade,
  day_of_week      smallint check (day_of_week between 0 and 6),
  day_number       smallint not null check (day_number >= 1),
  name             text not null default '',
  session_type     public.session_type not null default 'strength',
  notes            text,
  sort_order       integer not null default 0
);

create index program_days_week_id_idx on public.program_days (program_week_id, sort_order);

create table public.program_exercises (
  id              uuid primary key default gen_random_uuid(),
  program_day_id  uuid not null references public.program_days (id) on delete cascade,
  exercise_id     uuid not null references public.exercises (id) on delete restrict,
  sort_order      integer not null default 0,
  group_id        uuid,
  group_type      public.exercise_group_type,
  sets            smallint check (sets between 0 and 100),
  reps            varchar(32),
  intensity       varchar(32),
  tempo           varchar(16),
  rest_seconds    integer check (rest_seconds between 0 and 3600),
  notes           text,
  -- a group type requires a group and vice versa
  check ((group_id is null) = (group_type is null))
);

create index program_exercises_day_id_idx on public.program_exercises (program_day_id, sort_order);
create index program_exercises_exercise_id_idx on public.program_exercises (exercise_id);

-- -----------------------------------------------------------------------------
-- program_assignments
-- -----------------------------------------------------------------------------

create table public.program_assignments (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references public.programs (id) on delete cascade,
  player_id    uuid not null references public.profiles (id) on delete cascade,
  assigned_by  uuid references public.profiles (id) on delete set null,
  start_date   date not null default current_date,
  status       public.assignment_status not null default 'active',
  created_at   timestamptz not null default now()
);

create index program_assignments_program_id_idx on public.program_assignments (program_id);
create index program_assignments_player_id_idx on public.program_assignments (player_id);

-- -----------------------------------------------------------------------------
-- Program-level helpers (defined after the tables they read)
-- -----------------------------------------------------------------------------

create or replace function private.program_org_id(p_program_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select org_id from public.programs where id = p_program_id;
$$;

-- Staff in the program's org, or a player the program is assigned to.
create or replace function private.can_view_program(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_org_staff(private.program_org_id(p_program_id))
      or exists (
        select 1 from public.program_assignments a
        where a.program_id = p_program_id
          and a.player_id = (select auth.uid())
      );
$$;

create or replace function private.can_edit_program(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_org_staff(private.program_org_id(p_program_id));
$$;

create or replace function private.week_program_id(p_week_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select program_id from public.program_weeks where id = p_week_id;
$$;

create or replace function private.day_program_id(p_day_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select w.program_id
  from public.program_days d
  join public.program_weeks w on w.id = d.program_week_id
  where d.id = p_day_id;
$$;

-- An exercise may be used in a program if it is global or belongs to the program's org.
create or replace function private.exercise_usable_in_program(p_exercise_id uuid, p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exercises e
    where e.id = p_exercise_id
      and (e.org_id is null or e.org_id = private.program_org_id(p_program_id))
  );
$$;

-- -----------------------------------------------------------------------------
-- RPC: create an organization and make the caller its admin, atomically.
-- -----------------------------------------------------------------------------

create or replace function public.create_organization(p_name text, p_slug text)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org public.organizations;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  insert into public.organizations (name, slug, owner_id)
  values (trim(p_name), lower(trim(p_slug)), v_uid)
  returning * into v_org;

  insert into public.org_memberships (org_id, profile_id, role)
  values (v_org.id, v_uid, 'admin');

  return v_org;
end;
$$;

revoke execute on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table public.profiles            enable row level security;
alter table public.organizations       enable row level security;
alter table public.org_memberships     enable row level security;
alter table public.exercises           enable row level security;
alter table public.programs            enable row level security;
alter table public.program_weeks       enable row level security;
alter table public.program_days        enable row level security;
alter table public.program_exercises   enable row level security;
alter table public.program_assignments enable row level security;

grant usage on schema private to authenticated;

-- profiles --------------------------------------------------------------------

create policy "Users can view their own profile and teammates"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_org_with(id));

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- organizations ---------------------------------------------------------------
-- Inserts go through create_organization(); no direct insert policy.

create policy "Members can view their orgs"
  on public.organizations for select to authenticated
  using (private.is_org_member(id));

create policy "Admins can update their org"
  on public.organizations for update to authenticated
  using (private.has_org_role(id, array['admin']::public.org_role[]))
  with check (private.has_org_role(id, array['admin']::public.org_role[]));

create policy "Owners can delete their org"
  on public.organizations for delete to authenticated
  using (owner_id = (select auth.uid()));

-- org_memberships -------------------------------------------------------------

create policy "Members can view memberships in their orgs"
  on public.org_memberships for select to authenticated
  using (private.is_org_member(org_id));

create policy "Admins can add members"
  on public.org_memberships for insert to authenticated
  with check (private.has_org_role(org_id, array['admin']::public.org_role[]));

create policy "Admins can update members"
  on public.org_memberships for update to authenticated
  using (private.has_org_role(org_id, array['admin']::public.org_role[]))
  with check (private.has_org_role(org_id, array['admin']::public.org_role[]));

create policy "Admins can remove members; members can leave"
  on public.org_memberships for delete to authenticated
  using (
    private.has_org_role(org_id, array['admin']::public.org_role[])
    or profile_id = (select auth.uid())
  );

-- exercises -------------------------------------------------------------------

create policy "Users can view global exercises and their org's exercises"
  on public.exercises for select to authenticated
  using (org_id is null or private.is_org_member(org_id));

create policy "Staff can create org exercises"
  on public.exercises for insert to authenticated
  with check (org_id is not null and private.is_org_staff(org_id));

create policy "Staff can update org exercises"
  on public.exercises for update to authenticated
  using (org_id is not null and private.is_org_staff(org_id))
  with check (org_id is not null and private.is_org_staff(org_id));

create policy "Staff can delete org exercises"
  on public.exercises for delete to authenticated
  using (org_id is not null and private.is_org_staff(org_id));

-- programs --------------------------------------------------------------------

create policy "Staff and assigned players can view programs"
  on public.programs for select to authenticated
  using (private.can_view_program(id));

create policy "Staff can create programs"
  on public.programs for insert to authenticated
  with check (private.is_org_staff(org_id));

create policy "Staff can update programs"
  on public.programs for update to authenticated
  using (private.is_org_staff(org_id))
  with check (private.is_org_staff(org_id));

create policy "Staff can delete programs"
  on public.programs for delete to authenticated
  using (private.is_org_staff(org_id));

-- program_weeks ---------------------------------------------------------------

create policy "Viewers of a program can view its weeks"
  on public.program_weeks for select to authenticated
  using (private.can_view_program(program_id));

create policy "Staff can manage program weeks"
  on public.program_weeks for all to authenticated
  using (private.can_edit_program(program_id))
  with check (private.can_edit_program(program_id));

-- program_days ----------------------------------------------------------------

create policy "Viewers of a program can view its days"
  on public.program_days for select to authenticated
  using (private.can_view_program(private.week_program_id(program_week_id)));

create policy "Staff can manage program days"
  on public.program_days for all to authenticated
  using (private.can_edit_program(private.week_program_id(program_week_id)))
  with check (private.can_edit_program(private.week_program_id(program_week_id)));

-- program_exercises -----------------------------------------------------------

create policy "Viewers of a program can view its exercises"
  on public.program_exercises for select to authenticated
  using (private.can_view_program(private.day_program_id(program_day_id)));

create policy "Staff can manage program exercises"
  on public.program_exercises for all to authenticated
  using (private.can_edit_program(private.day_program_id(program_day_id)))
  with check (
    private.can_edit_program(private.day_program_id(program_day_id))
    and private.exercise_usable_in_program(exercise_id, private.day_program_id(program_day_id))
  );

-- program_assignments ---------------------------------------------------------

create policy "Staff can view assignments; players can view their own"
  on public.program_assignments for select to authenticated
  using (
    player_id = (select auth.uid())
    or private.can_edit_program(program_id)
  );

create policy "Staff can assign programs to players in their org"
  on public.program_assignments for insert to authenticated
  with check (
    private.can_edit_program(program_id)
    and private.is_player_in_org(private.program_org_id(program_id), player_id)
  );

create policy "Staff can update assignments"
  on public.program_assignments for update to authenticated
  using (private.can_edit_program(program_id))
  with check (
    private.can_edit_program(program_id)
    and private.is_player_in_org(private.program_org_id(program_id), player_id)
  );

create policy "Staff can delete assignments"
  on public.program_assignments for delete to authenticated
  using (private.can_edit_program(program_id));
