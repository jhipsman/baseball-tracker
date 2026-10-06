-- =============================================================================
-- Phase 2: player workout logging
--
-- workout_logs  — one row per (assignment, program day) the player logs
-- exercise_logs — per-exercise sets within a workout log
--
-- Players write only their own logs, against days of programs assigned to
-- them. Staff in the program's org can read them. Logs survive program edits:
-- if a coach deletes a day or exercise, the log keeps its data (FKs set null).
-- =============================================================================

create type public.workout_status as enum ('completed', 'partial', 'skipped');

create table public.workout_logs (
  id                     uuid primary key default gen_random_uuid(),
  program_assignment_id  uuid not null references public.program_assignments (id) on delete cascade,
  program_day_id         uuid references public.program_days (id) on delete set null,
  player_id              uuid not null references public.profiles (id) on delete cascade,
  date_completed         date not null default current_date,
  status                 public.workout_status not null,
  duration_minutes       smallint check (duration_minutes between 0 and 600),
  overall_rpe            smallint check (overall_rpe between 1 and 10),
  notes                  text,
  -- Snapshot so history still reads well if the day is later renamed/removed.
  day_name               text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- A program day is logged once per assignment (re-logging updates it).
create unique index workout_logs_assignment_day_key
  on public.workout_logs (program_assignment_id, program_day_id);
create index workout_logs_player_date_idx on public.workout_logs (player_id, date_completed desc);
create index workout_logs_day_idx on public.workout_logs (program_day_id);

create trigger workout_logs_set_updated_at
  before update on public.workout_logs
  for each row execute function private.set_updated_at();

create table public.exercise_logs (
  id                   uuid primary key default gen_random_uuid(),
  workout_log_id       uuid not null references public.workout_logs (id) on delete cascade,
  program_exercise_id  uuid references public.program_exercises (id) on delete set null,
  exercise_id          uuid not null references public.exercises (id) on delete restrict,
  sort_order           integer not null default 0,
  -- [{ "set": 1, "reps": 8, "weight": 185, "rpe": 7, "done": true }, ...]
  sets_completed       jsonb not null default '[]'::jsonb
                       check (jsonb_typeof(sets_completed) = 'array'),
  notes                text,
  video_url            text
);

create index exercise_logs_workout_log_idx on public.exercise_logs (workout_log_id, sort_order);
create index exercise_logs_exercise_idx on public.exercise_logs (exercise_id);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function private.assignment_org_id(p_assignment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.org_id
  from public.program_assignments a
  join public.programs p on p.id = a.program_id
  where a.id = p_assignment_id;
$$;

-- The caller owns the assignment, and the day belongs to its program.
create or replace function private.can_log_day(p_assignment_id uuid, p_day_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.program_assignments a
    join public.program_weeks w on w.program_id = a.program_id
    join public.program_days d on d.program_week_id = w.id
    where a.id = p_assignment_id
      and d.id = p_day_id
      and a.player_id = (select auth.uid())
  );
$$;

create or replace function private.can_view_workout_log(p_log_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workout_logs l
    where l.id = p_log_id
      and (
        l.player_id = (select auth.uid())
        or private.is_org_staff(private.assignment_org_id(l.program_assignment_id))
      )
  );
$$;

create or replace function private.owns_workout_log(p_log_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workout_logs l
    where l.id = p_log_id and l.player_id = (select auth.uid())
  );
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.workout_logs enable row level security;
alter table public.exercise_logs enable row level security;

create policy "Players see their logs; staff see their org's logs"
  on public.workout_logs for select to authenticated
  using (
    player_id = (select auth.uid())
    or private.is_org_staff(private.assignment_org_id(program_assignment_id))
  );

create policy "Players log their own assigned days"
  on public.workout_logs for insert to authenticated
  with check (
    player_id = (select auth.uid())
    and private.can_log_day(program_assignment_id, program_day_id)
  );

create policy "Players update their own logs"
  on public.workout_logs for update to authenticated
  using (player_id = (select auth.uid()))
  with check (
    player_id = (select auth.uid())
    and private.can_log_day(program_assignment_id, program_day_id)
  );

create policy "Players delete their own logs"
  on public.workout_logs for delete to authenticated
  using (player_id = (select auth.uid()));

create policy "Visible with their workout log"
  on public.exercise_logs for select to authenticated
  using (private.can_view_workout_log(workout_log_id));

create policy "Players write exercise logs in their own workouts"
  on public.exercise_logs for all to authenticated
  using (private.owns_workout_log(workout_log_id))
  with check (private.owns_workout_log(workout_log_id));

-- -----------------------------------------------------------------------------
-- save_workout_log: create or replace a player's log for one program day,
-- including its exercise logs, in one transaction. SECURITY INVOKER (RLS
-- applies). Returns the workout log id.
--
-- p_exercises: [{ program_exercise_id, exercise_id, sort_order, notes,
--                 sets: [{ set, reps, weight, rpe, done }] }]
-- -----------------------------------------------------------------------------

create or replace function public.save_workout_log(
  p_assignment_id uuid,
  p_day_id uuid,
  p_date date,
  p_status public.workout_status,
  p_duration_minutes smallint,
  p_overall_rpe smallint,
  p_notes text,
  p_exercises jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_log_id uuid;
  v_day_name text;
begin
  if not private.can_log_day(p_assignment_id, p_day_id) then
    raise exception 'You can only log days from your own assigned programs' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_exercises, '[]')) <> 'array' then
    raise exception 'p_exercises must be an array' using errcode = '22023';
  end if;

  select name into v_day_name from public.program_days where id = p_day_id;

  insert into public.workout_logs (
    program_assignment_id, program_day_id, player_id, date_completed, status,
    duration_minutes, overall_rpe, notes, day_name
  )
  values (
    p_assignment_id, p_day_id, auth.uid(), coalesce(p_date, current_date), p_status,
    p_duration_minutes, p_overall_rpe, nullif(trim(p_notes), ''), v_day_name
  )
  on conflict (program_assignment_id, program_day_id) do update
    set date_completed = excluded.date_completed,
        status = excluded.status,
        duration_minutes = excluded.duration_minutes,
        overall_rpe = excluded.overall_rpe,
        notes = excluded.notes,
        day_name = excluded.day_name
  returning id into v_log_id;

  delete from public.exercise_logs where workout_log_id = v_log_id;

  -- Only exercises that belong to this day are accepted.
  insert into public.exercise_logs (
    workout_log_id, program_exercise_id, exercise_id, sort_order, sets_completed, notes
  )
  select v_log_id,
         pe.id,
         pe.exercise_id,
         coalesce((e ->> 'sort_order')::integer, pe.sort_order),
         coalesce(e -> 'sets', '[]'::jsonb),
         nullif(trim(e ->> 'notes'), '')
  from jsonb_array_elements(coalesce(p_exercises, '[]')) e
  join public.program_exercises pe
    on pe.id = (e ->> 'program_exercise_id')::uuid
   and pe.program_day_id = p_day_id
  where jsonb_typeof(coalesce(e -> 'sets', '[]'::jsonb)) = 'array';

  return v_log_id;
end;
$$;

revoke execute on function public.save_workout_log(uuid, uuid, date, public.workout_status, smallint, smallint, text, jsonb) from public, anon;
grant execute on function public.save_workout_log(uuid, uuid, date, public.workout_status, smallint, smallint, text, jsonb) to authenticated;
