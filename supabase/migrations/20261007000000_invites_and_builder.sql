-- =============================================================================
-- Phase 1 (cont.): org invitations, owner protection, workout builder RPCs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Owner protection
-- The org owner must always remain an admin member of their org.
-- -----------------------------------------------------------------------------

create or replace function private.org_owner_id(p_org_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select owner_id from public.organizations where id = p_org_id;
$$;

-- Members are now added only through create_organization() and
-- accept_invitation(), so a user always consents to joining an org.
drop policy "Admins can add members" on public.org_memberships;

drop policy "Admins can update members" on public.org_memberships;
create policy "Admins can update members"
  on public.org_memberships for update to authenticated
  using (private.has_org_role(org_id, array['admin']::public.org_role[]))
  with check (
    private.has_org_role(org_id, array['admin']::public.org_role[])
    and (profile_id <> private.org_owner_id(org_id) or role = 'admin')
  );

drop policy "Admins can remove members; members can leave" on public.org_memberships;
create policy "Admins can remove members; members can leave"
  on public.org_memberships for delete to authenticated
  using (
    profile_id <> private.org_owner_id(org_id)
    and (
      private.has_org_role(org_id, array['admin']::public.org_role[])
      or profile_id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- Fix: programs SELECT policy
-- can_view_program(id) looks the program up by id, which can't see a row being
-- inserted in the same statement, so `insert ... returning` failed for staff.
-- Check the row's own org_id instead.
-- -----------------------------------------------------------------------------

create or replace function private.is_assigned_to_program(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.program_assignments a
    where a.program_id = p_program_id
      and a.player_id = (select auth.uid())
  );
$$;

drop policy "Staff and assigned players can view programs" on public.programs;
create policy "Staff and assigned players can view programs"
  on public.programs for select to authenticated
  using (private.is_org_staff(org_id) or private.is_assigned_to_program(id));

-- -----------------------------------------------------------------------------
-- org_invitations
-- -----------------------------------------------------------------------------

create table public.org_invitations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  email        text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role         public.org_role not null,
  token        uuid not null unique default gen_random_uuid(),
  invited_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '14 days',
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles (id) on delete set null
);

-- One pending invitation per email per org.
create unique index org_invitations_pending_key
  on public.org_invitations (org_id, email) where accepted_at is null;

alter table public.org_invitations enable row level security;

create policy "Admins can view their org's invitations"
  on public.org_invitations for select to authenticated
  using (private.has_org_role(org_id, array['admin']::public.org_role[]));

create policy "Admins can create invitations"
  on public.org_invitations for insert to authenticated
  with check (
    private.has_org_role(org_id, array['admin']::public.org_role[])
    and invited_by = (select auth.uid())
    and accepted_at is null
  );

create policy "Admins can revoke invitations"
  on public.org_invitations for delete to authenticated
  using (private.has_org_role(org_id, array['admin']::public.org_role[]));

-- The signed-in user's verified email (null if unverified).
create or replace function private.current_verified_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email)
  from auth.users u
  where u.id = (select auth.uid())
    and u.email_confirmed_at is not null;
$$;

-- Look up an invitation by its secret token (for the accept page).
create or replace function public.get_invitation(p_token uuid)
returns table (
  org_name text,
  role public.org_role,
  email text,
  is_expired boolean,
  is_accepted boolean,
  email_matches boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name,
         i.role,
         i.email,
         i.expires_at < now(),
         i.accepted_at is not null,
         i.email = private.current_verified_email()
  from public.org_invitations i
  join public.organizations o on o.id = i.org_id
  where i.token = p_token
    and (select auth.uid()) is not null;
$$;

-- Pending, unexpired invitations addressed to the signed-in user.
create or replace function public.my_pending_invitations()
returns table (token uuid, org_name text, role public.org_role, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.token, o.name, i.role, i.created_at
  from public.org_invitations i
  join public.organizations o on o.id = i.org_id
  where i.email = private.current_verified_email()
    and i.accepted_at is null
    and i.expires_at > now()
  order by i.created_at desc;
$$;

-- Accept an invitation: adds the caller to the org. Returns the org id.
create or replace function public.accept_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.org_invitations;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_inv from public.org_invitations where token = p_token for update;

  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  elsif v_inv.accepted_at is not null then
    raise exception 'Invitation has already been used' using errcode = 'P0001';
  elsif v_inv.expires_at < now() then
    raise exception 'Invitation has expired' using errcode = 'P0001';
  elsif v_inv.email is distinct from private.current_verified_email() then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;

  insert into public.org_memberships (org_id, profile_id, role)
  values (v_inv.org_id, v_uid, v_inv.role)
  on conflict (org_id, profile_id) do nothing;

  update public.org_invitations
  set accepted_at = now(), accepted_by = v_uid
  where id = v_inv.id;

  return v_inv.org_id;
end;
$$;

revoke execute on function public.get_invitation(uuid) from public, anon;
revoke execute on function public.my_pending_invitations() from public, anon;
revoke execute on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.get_invitation(uuid) to authenticated;
grant execute on function public.my_pending_invitations() to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Program structure: allow renumbering weeks inside one transaction
-- -----------------------------------------------------------------------------

alter table public.program_weeks drop constraint program_weeks_program_id_week_number_key;
alter table public.program_weeks
  add constraint program_weeks_program_id_week_number_key
  unique (program_id, week_number) deferrable initially deferred;

-- A player can only have one active assignment of the same program.
create unique index program_assignments_active_key
  on public.program_assignments (program_id, player_id) where status = 'active';

-- -----------------------------------------------------------------------------
-- save_program_structure: atomically replace a program's weeks/days/exercises
-- with the builder's state. Rows are matched by id (client-generated uuids):
-- existing rows are updated, new ones inserted, missing ones deleted.
--
-- SECURITY INVOKER, so every write is still checked by RLS.
--
-- p_weeks: [{ id, week_number, label, notes, days: [{ id, day_number,
--   day_of_week, name, session_type, notes, sort_order, exercises: [{ id,
--   exercise_id, sort_order, group_id, group_type, sets, reps, intensity,
--   tempo, rest_seconds, notes }] }] }]
-- -----------------------------------------------------------------------------

create or replace function public.save_program_structure(p_program_id uuid, p_weeks jsonb)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_week jsonb;
  v_day jsonb;
  v_ex jsonb;
  v_week_ids uuid[];
  v_day_ids uuid[];
  v_ex_ids uuid[];
  v_updated_at timestamptz;
begin
  if not private.can_edit_program(p_program_id) then
    raise exception 'You do not have permission to edit this program' using errcode = '42501';
  end if;
  if jsonb_typeof(p_weeks) is distinct from 'array' then
    raise exception 'p_weeks must be an array' using errcode = '22023';
  end if;

  select coalesce(array_agg((w ->> 'id')::uuid), '{}')
    into v_week_ids
    from jsonb_array_elements(p_weeks) w;
  select coalesce(array_agg((d ->> 'id')::uuid), '{}')
    into v_day_ids
    from jsonb_array_elements(p_weeks) w, jsonb_array_elements(w -> 'days') d;
  select coalesce(array_agg((e ->> 'id')::uuid), '{}')
    into v_ex_ids
    from jsonb_array_elements(p_weeks) w,
         jsonb_array_elements(w -> 'days') d,
         jsonb_array_elements(d -> 'exercises') e;

  -- Ids that already exist must belong to this program.
  if exists (
    select 1 from public.program_weeks w
    where w.id = any (v_week_ids) and w.program_id <> p_program_id
  ) or exists (
    select 1 from public.program_days d
    join public.program_weeks w on w.id = d.program_week_id
    where d.id = any (v_day_ids) and w.program_id <> p_program_id
  ) or exists (
    select 1 from public.program_exercises pe
    join public.program_days d on d.id = pe.program_day_id
    join public.program_weeks w on w.id = d.program_week_id
    where pe.id = any (v_ex_ids) and w.program_id <> p_program_id
  ) then
    raise exception 'Payload references rows from another program' using errcode = '22023';
  end if;

  -- Delete rows that are no longer present (children first).
  delete from public.program_exercises pe
  using public.program_days d, public.program_weeks w
  where pe.program_day_id = d.id
    and d.program_week_id = w.id
    and w.program_id = p_program_id
    and pe.id <> all (v_ex_ids);

  delete from public.program_days d
  using public.program_weeks w
  where d.program_week_id = w.id
    and w.program_id = p_program_id
    and d.id <> all (v_day_ids);

  delete from public.program_weeks w
  where w.program_id = p_program_id
    and w.id <> all (v_week_ids);

  -- Upsert everything that remains.
  for v_week in select * from jsonb_array_elements(p_weeks) loop
    insert into public.program_weeks (id, program_id, week_number, label, notes)
    values (
      (v_week ->> 'id')::uuid,
      p_program_id,
      (v_week ->> 'week_number')::smallint,
      nullif(v_week ->> 'label', ''),
      nullif(v_week ->> 'notes', '')
    )
    on conflict (id) do update
      set week_number = excluded.week_number,
          label = excluded.label,
          notes = excluded.notes;

    for v_day in select * from jsonb_array_elements(coalesce(v_week -> 'days', '[]')) loop
      insert into public.program_days (
        id, program_week_id, day_of_week, day_number, name, session_type, notes, sort_order
      )
      values (
        (v_day ->> 'id')::uuid,
        (v_week ->> 'id')::uuid,
        (v_day ->> 'day_of_week')::smallint,
        (v_day ->> 'day_number')::smallint,
        coalesce(v_day ->> 'name', ''),
        coalesce((v_day ->> 'session_type')::public.session_type, 'strength'),
        nullif(v_day ->> 'notes', ''),
        coalesce((v_day ->> 'sort_order')::integer, 0)
      )
      on conflict (id) do update
        set program_week_id = excluded.program_week_id,
            day_of_week = excluded.day_of_week,
            day_number = excluded.day_number,
            name = excluded.name,
            session_type = excluded.session_type,
            notes = excluded.notes,
            sort_order = excluded.sort_order;

      for v_ex in select * from jsonb_array_elements(coalesce(v_day -> 'exercises', '[]')) loop
        insert into public.program_exercises (
          id, program_day_id, exercise_id, sort_order, group_id, group_type,
          sets, reps, intensity, tempo, rest_seconds, notes
        )
        values (
          (v_ex ->> 'id')::uuid,
          (v_day ->> 'id')::uuid,
          (v_ex ->> 'exercise_id')::uuid,
          coalesce((v_ex ->> 'sort_order')::integer, 0),
          (v_ex ->> 'group_id')::uuid,
          (v_ex ->> 'group_type')::public.exercise_group_type,
          (v_ex ->> 'sets')::smallint,
          nullif(v_ex ->> 'reps', ''),
          nullif(v_ex ->> 'intensity', ''),
          nullif(v_ex ->> 'tempo', ''),
          (v_ex ->> 'rest_seconds')::integer,
          nullif(v_ex ->> 'notes', '')
        )
        on conflict (id) do update
          set program_day_id = excluded.program_day_id,
              exercise_id = excluded.exercise_id,
              sort_order = excluded.sort_order,
              group_id = excluded.group_id,
              group_type = excluded.group_type,
              sets = excluded.sets,
              reps = excluded.reps,
              intensity = excluded.intensity,
              tempo = excluded.tempo,
              rest_seconds = excluded.rest_seconds,
              notes = excluded.notes;
      end loop;
    end loop;
  end loop;

  update public.programs
  set duration_weeks = greatest(jsonb_array_length(p_weeks), 1)
  where id = p_program_id
  returning updated_at into v_updated_at;

  return v_updated_at;
end;
$$;

revoke execute on function public.save_program_structure(uuid, jsonb) from public, anon;
grant execute on function public.save_program_structure(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- duplicate_program: deep-copy a program (used for "save as template" and
-- "use template"). SECURITY INVOKER, so RLS applies to the reads and writes.
-- -----------------------------------------------------------------------------

create or replace function public.duplicate_program(
  p_program_id uuid,
  p_name text,
  p_is_template boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_new_program uuid;
  v_week record;
  v_day record;
  v_new_week uuid;
  v_new_day uuid;
begin
  insert into public.programs (
    org_id, name, description, program_type, season_phase, duration_weeks, created_by, is_template
  )
  select org_id, coalesce(nullif(trim(p_name), ''), name), description, program_type,
         season_phase, duration_weeks, auth.uid(), p_is_template
  from public.programs
  where id = p_program_id
  returning id into v_new_program;

  if v_new_program is null then
    raise exception 'Program not found' using errcode = 'P0002';
  end if;

  for v_week in
    select * from public.program_weeks where program_id = p_program_id order by week_number
  loop
    insert into public.program_weeks (program_id, week_number, label, notes)
    values (v_new_program, v_week.week_number, v_week.label, v_week.notes)
    returning id into v_new_week;

    for v_day in
      select * from public.program_days where program_week_id = v_week.id order by sort_order
    loop
      insert into public.program_days (
        program_week_id, day_of_week, day_number, name, session_type, notes, sort_order
      )
      values (
        v_new_week, v_day.day_of_week, v_day.day_number, v_day.name, v_day.session_type,
        v_day.notes, v_day.sort_order
      )
      returning id into v_new_day;

      insert into public.program_exercises (
        program_day_id, exercise_id, sort_order, group_id, group_type,
        sets, reps, intensity, tempo, rest_seconds, notes
      )
      select v_new_day, exercise_id, sort_order, group_id, group_type,
             sets, reps, intensity, tempo, rest_seconds, notes
      from public.program_exercises
      where program_day_id = v_day.id;
    end loop;
  end loop;

  return v_new_program;
end;
$$;

revoke execute on function public.duplicate_program(uuid, text, boolean) from public, anon;
grant execute on function public.duplicate_program(uuid, text, boolean) to authenticated;
