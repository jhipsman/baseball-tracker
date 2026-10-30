-- =============================================================================
-- Demo team: a sample team full of fake players/parents for showing the app
-- and testing every screen. The fake people are real auth users with no
-- password (nobody can sign in as them) and app_metadata.demo = true.
--
-- Only the owner of a demo team can seed it, act as its fake members, or
-- delete it. None of these functions can touch a real team or a real person.
-- =============================================================================

alter table public.organizations
  add column is_demo boolean not null default false;

-- Clients can't flip a real team into a demo (or back): only these functions can.
create or replace function private.protect_demo_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and new.is_demo is distinct from old.is_demo then
    raise exception 'Demo status can''t be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger organizations_protect_demo
  before update on public.organizations
  for each row execute function private.protect_demo_flag();

-- True when p_profile is a fake demo person.
create or replace function private.is_demo_user(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (u.raw_app_meta_data ->> 'demo')::boolean from auth.users u where u.id = p_profile), false);
$$;

-- The caller's demo team must be this org.
create or replace function private.assert_demo_owner(p_org uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.organizations o
    where o.id = p_org and o.is_demo and o.owner_id = auth.uid()
  ) then
    raise exception 'Not your demo team' using errcode = '42501';
  end if;
end;
$$;

-- Creates the caller's demo team (or returns the existing one) and its fake
-- members. p_people: [{key, name, role: player|parent, birth_date?, position?,
-- jersey?, parent_of?: key, group?: text}]. Returns {org, created, people: {key: id}}.
create or replace function public.create_demo_team(p_name text, p_people jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_person jsonb;
  v_id uuid;
  v_ids jsonb := '{}'::jsonb;
  v_groups jsonb := '{}'::jsonb;
  v_group uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  select id into v_org from public.organizations where owner_id = v_uid and is_demo limit 1;
  if v_org is not null then
    return jsonb_build_object('org', v_org, 'created', false);
  end if;
  if jsonb_typeof(p_people) <> 'array' or jsonb_array_length(p_people) > 40 then
    raise exception 'Invalid demo roster' using errcode = '22023';
  end if;

  insert into public.organizations (name, slug, owner_id, is_demo, team_type, current_season_phase)
  values (left(trim(p_name), 80), 'demo-' || substr(md5(gen_random_uuid()::text), 1, 10), v_uid, true,
          'travel', 'in_season')
  returning id into v_org;
  insert into public.org_memberships (org_id, profile_id, role) values (v_org, v_uid, 'admin');

  for v_person in select * from jsonb_array_elements(p_people) loop
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      'demo-' || v_id || '@demo.invalid', '',
      '{"provider":"email","providers":["email"],"demo":true}'::jsonb,
      jsonb_build_object('full_name', left(v_person ->> 'name', 80),
                         'birth_date', v_person ->> 'birth_date'),
      now(), now(), '', '', '', '', '', '', '', ''
    );
    insert into public.org_memberships (org_id, profile_id, role, position, jersey_number)
    values (
      v_org, v_id,
      case when v_person ->> 'role' = 'parent' then 'parent' else 'player' end::public.org_role,
      nullif(v_person ->> 'position', '')::public.player_position,
      nullif(v_person ->> 'jersey', '')::smallint
    );
    v_ids := v_ids || jsonb_build_object(v_person ->> 'key', v_id);

    if coalesce(v_person ->> 'group', '') <> '' then
      v_group := (v_groups ->> (v_person ->> 'group'))::uuid;
      if v_group is null then
        insert into public.player_groups (org_id, name, created_by)
        values (v_org, v_person ->> 'group', v_uid) returning id into v_group;
        v_groups := v_groups || jsonb_build_object(v_person ->> 'group', v_group);
      end if;
      insert into public.player_group_members (group_id, profile_id) values (v_group, v_id);
    end if;
  end loop;

  -- Parents link to the children named by key.
  for v_person in select * from jsonb_array_elements(p_people) where value ->> 'role' = 'parent' loop
    if v_ids ? (v_person ->> 'parent_of') then
      insert into public.parent_links (org_id, parent_id, player_id)
      values (v_org, (v_ids ->> (v_person ->> 'key'))::uuid, (v_ids ->> (v_person ->> 'parent_of'))::uuid);
    end if;
  end loop;

  return jsonb_build_object('org', v_org, 'created', true, 'people', v_ids, 'groups', v_groups);
end;
$$;

-- Things only a player or parent can write (their workout logs, their own
-- throwing check-ins, RSVPs), written on behalf of fake demo members only.
-- p_rows: {workouts: [...], throws: [...], attendance: [...]}
create or replace function public.seed_demo_activity(p_org uuid, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_player uuid;
begin
  perform private.assert_demo_owner(p_org);

  for v_row in select * from jsonb_array_elements(coalesce(p_rows -> 'workouts', '[]')) loop
    v_player := (v_row ->> 'player_id')::uuid;
    if not private.is_demo_user(v_player) or not exists (
      select 1 from public.program_assignments a join public.programs p on p.id = a.program_id
      where a.id = (v_row ->> 'assignment_id')::uuid and a.player_id = v_player and p.org_id = p_org
    ) then
      raise exception 'Not a demo workout' using errcode = '42501';
    end if;
    insert into public.workout_logs (
      program_assignment_id, program_day_id, player_id, date_completed, status,
      duration_minutes, overall_rpe, notes, day_name, created_at, updated_at
    ) values (
      (v_row ->> 'assignment_id')::uuid, (v_row ->> 'day_id')::uuid, v_player,
      (v_row ->> 'date')::date, (v_row ->> 'status')::public.workout_status,
      nullif(v_row ->> 'minutes', '')::smallint, nullif(v_row ->> 'rpe', '')::smallint,
      nullif(v_row ->> 'notes', ''), v_row ->> 'day_name',
      coalesce(least((v_row ->> 'logged_at')::timestamptz, now()), now()),
      coalesce(least((v_row ->> 'logged_at')::timestamptz, now()), now())
    ) on conflict do nothing;
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows -> 'throws', '[]')) loop
    v_player := (v_row ->> 'player_id')::uuid;
    if not private.is_demo_user(v_player) or not private.is_player_in_org(p_org, v_player) then
      raise exception 'Not a demo player' using errcode = '42501';
    end if;
    insert into public.throwing_logs (
      org_id, player_id, logged_by, date, throwing_type, pitch_count, max_distance_ft,
      intensity, arm_feel, notes
    ) values (
      p_org, v_player, v_player, (v_row ->> 'date')::date,
      (v_row ->> 'type')::public.throwing_type, coalesce(nullif(v_row ->> 'pitches', '')::smallint, 0),
      nullif(v_row ->> 'distance', '')::smallint,
      nullif(v_row ->> 'intensity', '')::public.throwing_intensity,
      nullif(v_row ->> 'arm_feel', '')::public.arm_feel, nullif(v_row ->> 'notes', '')
    );
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows -> 'attendance', '[]')) loop
    v_player := (v_row ->> 'player_id')::uuid;
    if not private.is_demo_user(v_player) or not private.is_player_in_org(p_org, v_player) then
      raise exception 'Not a demo player' using errcode = '42501';
    end if;
    insert into public.activity_attendance (org_id, kind, activity_id, player_id, response, updated_by)
    values (p_org, v_row ->> 'kind', (v_row ->> 'activity_id')::uuid, v_player,
            v_row ->> 'response', v_player)
    on conflict do nothing;
  end loop;
end;
$$;

-- Deletes the caller's demo team and its fake people. Real accounts are never touched.
create or replace function public.delete_demo_team(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_people uuid[];
begin
  perform private.assert_demo_owner(p_org);
  select coalesce(array_agg(m.profile_id), '{}') into v_people
  from public.org_memberships m
  where m.org_id = p_org and private.is_demo_user(m.profile_id);
  delete from public.organizations where id = p_org;
  delete from auth.users u
  where u.id = any (v_people)
    and (u.raw_app_meta_data ->> 'demo')::boolean
    and not exists (select 1 from public.org_memberships m where m.profile_id = u.id);
end;
$$;

revoke execute on function public.create_demo_team(text, jsonb) from public, anon;
revoke execute on function public.seed_demo_activity(uuid, jsonb) from public, anon;
revoke execute on function public.delete_demo_team(uuid) from public, anon;
grant execute on function public.create_demo_team(text, jsonb) to authenticated;
grant execute on function public.seed_demo_activity(uuid, jsonb) to authenticated;
grant execute on function public.delete_demo_team(uuid) to authenticated;
