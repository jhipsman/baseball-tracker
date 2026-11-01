-- Switching to 9D: bring a whole team over from GameChanger, TeamSnap,
-- LeagueApps, SportsEngine or a spreadsheet.
--
-- * Roster-only players: a coach can add a player by name, no email. They are
--   real roster members (jersey, position, lineups, stats, health) backed by a
--   passwordless account nobody can sign in to (like the demo team's people).
--   Parents are invited for them; later the coach can "give them a login",
--   which turns that same account into the player's own (nothing to merge).
-- * Parent invites can cover siblings.
-- * Every import is a batch that can be undone.

-- ------------------------------------------------------------ roster-only
create function private.is_roster_only(p_profile uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (u.raw_app_meta_data ->> 'roster_only')::boolean
                   from auth.users u where u.id = p_profile), false);
$$;
revoke all on function private.is_roster_only(uuid) from public;
grant execute on function private.is_roster_only(uuid) to authenticated;

create function private.coach_or_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_org_role(p_org, array['admin', 'coach']::public.org_role[]);
$$;
revoke all on function private.coach_or_admin(uuid) from public;

create table public.import_batches (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  kind         text not null check (kind in ('roster', 'schedule', 'stats')),
  source       text not null check (char_length(source) <= 40),
  label        text check (char_length(label) <= 200),
  players      uuid[] not null default '{}',
  games        uuid[] not null default '{}',
  practices    uuid[] not null default '{}',
  invitations  uuid[] not null default '{}',
  import_rows  uuid[] not null default '{}',
  summary      jsonb not null default '{}'::jsonb,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  undone_at    timestamptz
);
create index import_batches_org_idx on public.import_batches (org_id, created_at desc);
alter table public.import_batches enable row level security;
create policy "Staff see import history"
  on public.import_batches for select to authenticated
  using (private.is_org_staff(org_id));

-- Allow the newer sources on the stats archive.
alter table public.team_import_rows drop constraint if exists team_import_rows_source_check;
alter table public.team_import_rows add constraint team_import_rows_source_check
  check (source in ('sheets', 'excel', 'gamechanger', 'leagueapps', 'teamsnap', 'sportsengine', 'other'));

create function private.position_of(p text)
returns public.player_position language sql immutable set search_path = '' as $$
  select case upper(coalesce(nullif(trim(p), ''), '-'))
    when 'P' then 'P' when 'C' then 'C' when '1B' then '1B' when '2B' then '2B'
    when 'SS' then 'SS' when '3B' then '3B' when 'OF' then 'OF' when 'LF' then 'OF'
    when 'CF' then 'OF' when 'RF' then 'OF' when 'DH' then 'DH' when 'UTIL' then 'UTIL'
    when 'UT' then 'UTIL' when 'INF' then 'UTIL' when 'IF' then 'UTIL'
    else null end::public.player_position;
$$;

create function private.group_for(p_org uuid, p_name text, p_create boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if nullif(trim(p_name), '') is null then return null; end if;
  select id into v_id from public.player_groups
   where org_id = p_org and lower(trim(name)) = lower(trim(p_name)) limit 1;
  if v_id is null and p_create then
    insert into public.player_groups (org_id, name, created_by)
    values (p_org, left(trim(p_name), 60), auth.uid()) returning id into v_id;
  end if;
  return v_id;
end;
$$;
revoke all on function private.group_for(uuid, text, boolean) from public;

-- Make (or reuse) a roster player. Matches an existing player on the team by
-- name (and jersey, when both have one) so re-importing doesn't duplicate.
create function private.roster_player(p_org uuid, p jsonb, out v_id uuid, out v_created boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := left(trim(p ->> 'name'), 80);
  v_jersey smallint := case when coalesce(p ->> 'jersey', '') ~ '^\d{1,2}$' then (p ->> 'jersey')::smallint end;
  v_birth date := case when coalesce(p ->> 'birth_date', '') ~ '^\d{4}-\d{2}-\d{2}$' then (p ->> 'birth_date')::date end;
  v_group uuid;
begin
  v_created := false;
  if v_name is null or v_name = '' then raise exception 'Player name required.' using errcode = '22023'; end if;
  select m.profile_id into v_id
    from public.org_memberships m join public.profiles pr on pr.id = m.profile_id
   where m.org_id = p_org and m.role = 'player'
     and lower(regexp_replace(trim(pr.full_name), '\s+', ' ', 'g')) = lower(regexp_replace(v_name, '\s+', ' ', 'g'))
     and (v_jersey is null or m.jersey_number is null or m.jersey_number = v_jersey)
   limit 1;
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      'player-' || v_id || '@roster.invalid', '',
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'),
                         'roster_only', true, 'org', p_org),
      jsonb_build_object('full_name', v_name),
      now(), now(), '', '', '', '', '', '', '', ''
    );
    insert into public.org_memberships (org_id, profile_id, role, position, jersey_number)
    values (p_org, v_id, 'player', private.position_of(p ->> 'position'), v_jersey);
    v_created := true;
  else
    update public.org_memberships
       set jersey_number = coalesce(v_jersey, jersey_number),
           position = coalesce(private.position_of(p ->> 'position'), position)
     where org_id = p_org and profile_id = v_id;
  end if;
  if v_birth is not null then
    update public.profiles set birth_date = v_birth where id = v_id and birth_date is null;
  end if;
  v_group := private.group_for(p_org, p ->> 'group', true);
  if v_group is not null then
    insert into public.player_group_members (group_id, profile_id) values (v_group, v_id)
    on conflict do nothing;
  end if;
end;
$$;
revoke all on function private.roster_player(uuid, jsonb) from public;

-- ------------------------------------------------------------ invitations
alter table public.org_invitations
  -- "Give them a login": this invite turns a roster-only player into their own account.
  add column claim_profile_id uuid references public.profiles (id) on delete cascade,
  -- More children for the same parent (siblings).
  add column extra_player_ids uuid[] not null default '{}';

-- Claim invites are only completed through the claim page (service role).
create function private.guard_claim_accept()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.claim_profile_id is not null and new.accepted_at is not null and old.accepted_at is null
     and new.accepted_by is distinct from new.claim_profile_id then
    raise exception 'Open the link in your email to set up this account.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger org_invitations_claim_guard
  before update of accepted_at on public.org_invitations
  for each row execute function private.guard_claim_accept();

create or replace function public.accept_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.org_invitations;
  v_existing public.org_role;
  v_child uuid;
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
  elsif v_inv.claim_profile_id is not null then
    raise exception 'Open the link in your email to set up this account.' using errcode = 'P0001';
  elsif v_inv.email is distinct from private.current_verified_email() then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;

  if v_inv.role = 'parent' then
    select role into v_existing from public.org_memberships
    where org_id = v_inv.org_id and profile_id = v_uid;
    if v_existing is not null and v_existing <> 'parent' then
      raise exception 'You are already on this team as a % and can''t also join as a parent', v_existing
        using errcode = 'P0001';
    end if;
    if not private.is_player_in_org(v_inv.org_id, v_inv.player_id) then
      raise exception 'That player is no longer on this team' using errcode = 'P0001';
    end if;
  end if;

  insert into public.org_memberships (org_id, profile_id, role)
  values (v_inv.org_id, v_uid, v_inv.role)
  on conflict (org_id, profile_id) do nothing;

  if v_inv.role = 'parent' then
    foreach v_child in array (array[v_inv.player_id] || v_inv.extra_player_ids) loop
      if private.is_player_in_org(v_inv.org_id, v_child) then
        insert into public.parent_links (org_id, parent_id, player_id)
        values (v_inv.org_id, v_uid, v_child)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  update public.org_invitations
  set accepted_at = now(), accepted_by = v_uid
  where id = v_inv.id;

  return v_inv.org_id;
end;
$$;

-- Invite a parent for a child: reuses a pending invite to the same email
-- (adding the sibling), or links a parent who's already on the team.
create function private.invite_parent(p_org uuid, p_email text, p_child uuid, out v_inv uuid)
language plpgsql security definer set search_path = '' as $$
declare v_parent uuid;
begin
  v_inv := null;
  select m.profile_id into v_parent from public.org_memberships m
    join public.profiles pr on pr.id = m.profile_id
   where m.org_id = p_org and m.role = 'parent' and lower(pr.email) = lower(p_email) limit 1;
  if v_parent is not null then
    insert into public.parent_links (org_id, parent_id, player_id) values (p_org, v_parent, p_child)
    on conflict do nothing;
    return;
  end if;
  select id into v_inv from public.org_invitations
   where org_id = p_org and email = lower(p_email) and accepted_at is null limit 1;
  if v_inv is not null then
    update public.org_invitations
       set extra_player_ids = case when player_id = p_child or p_child = any(extra_player_ids)
                                   then extra_player_ids else extra_player_ids || p_child end,
           expires_at = greatest(expires_at, now() + interval '14 days')
     where id = v_inv and role = 'parent';
    v_inv := null; -- not new
    return;
  end if;
  insert into public.org_invitations (org_id, email, role, invited_by, player_id)
  values (p_org, lower(p_email), 'parent', auth.uid(), p_child)
  returning id into v_inv;
end;
$$;
revoke all on function private.invite_parent(uuid, text, uuid) from public;

-- Coach: send a roster-only player a link to set up their own login.
create function public.create_claim_invite(p_org uuid, p_player uuid, p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_token uuid; v_email text := lower(trim(p_email));
begin
  if not private.coach_or_admin(p_org) then raise exception 'Only coaches can do this.' using errcode = '42501'; end if;
  if not private.is_player_in_org(p_org, p_player) or not private.is_roster_only(p_player) then
    raise exception 'This player already has a login.';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a real email address.'; end if;
  if exists (select 1 from public.profiles where lower(email) = v_email) then
    raise exception 'That email already has a 9D account. Use a different email for the player.';
  end if;
  delete from public.org_invitations where org_id = p_org and claim_profile_id = p_player and accepted_at is null;
  if exists (select 1 from public.org_invitations where org_id = p_org and email = v_email and accepted_at is null) then
    raise exception 'That email already has a pending invitation on this team.';
  end if;
  insert into public.org_invitations (org_id, email, role, invited_by, claim_profile_id)
  values (p_org, v_email, 'player', auth.uid(), p_player)
  returning token into v_token;
  return v_token;
end;
$$;
revoke all on function public.create_claim_invite(uuid, uuid, text) from public;
grant execute on function public.create_claim_invite(uuid, uuid, text) to authenticated;

-- Coach: add players by name (no email needed). p_people: [{name, jersey?, position?, birth_date?, group?}]
create function public.add_roster_players(p_org uuid, p_people jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p jsonb; r record; v_out jsonb := '[]'::jsonb;
begin
  if not private.coach_or_admin(p_org) then raise exception 'Only coaches can add players.' using errcode = '42501'; end if;
  if jsonb_typeof(p_people) <> 'array' or jsonb_array_length(p_people) not between 1 and 300 then
    raise exception 'Add 1 to 300 players at a time.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 1));
  for p in select value from jsonb_array_elements(p_people) loop
    select * into r from private.roster_player(p_org, p);
    v_out := v_out || jsonb_build_object('id', r.v_id, 'created', r.v_created);
  end loop;
  return v_out;
end;
$$;
revoke all on function public.add_roster_players(uuid, jsonb) from public;
grant execute on function public.add_roster_players(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------ imports
-- Roster import: players (made or matched), groups, birthdays, and invites for
-- player emails (claim links) and parent emails (siblings combined).
-- p_people: [{name, jersey?, position?, birth_date?, group?, email?, parents: [email...]}]
create function public.import_roster(p_org uuid, p_source text, p_label text, p_people jsonb, p_invite boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p jsonb; r record; v_batch uuid; v_inv uuid; v_email text;
  v_players uuid[] := '{}'; v_invites uuid[] := '{}';
  v_created integer := 0; v_matched integer := 0; v_parent_invites integer := 0; v_player_invites integer := 0;
begin
  if not private.has_org_role(p_org, array['admin']::public.org_role[]) then
    raise exception 'Only team admins can import.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_people) <> 'array' or jsonb_array_length(p_people) not between 1 and 1000 then
    raise exception 'Import 1 to 1,000 players at a time.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 1));
  for p in select value from jsonb_array_elements(p_people) loop
    select * into r from private.roster_player(p_org, p);
    if r.v_created then v_created := v_created + 1; v_players := v_players || r.v_id;
    else v_matched := v_matched + 1; end if;
    if p_invite then
      v_email := lower(trim(coalesce(p ->> 'email', '')));
      if v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and private.is_roster_only(r.v_id)
         and not exists (select 1 from public.profiles where lower(email) = v_email)
         and not exists (select 1 from public.org_invitations where org_id = p_org and email = v_email and accepted_at is null)
         and not (v_email = any (array(select lower(trim(x)) from jsonb_array_elements_text(coalesce(p -> 'parents', '[]'::jsonb)) x))) then
        insert into public.org_invitations (org_id, email, role, invited_by, claim_profile_id)
        values (p_org, v_email, 'player', auth.uid(), r.v_id) returning id into v_inv;
        v_invites := v_invites || v_inv; v_player_invites := v_player_invites + 1;
      end if;
      for v_email in select distinct lower(trim(x)) from jsonb_array_elements_text(coalesce(p -> 'parents', '[]'::jsonb)) x loop
        continue when v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
        -- A parent's email can't be a player's or coach's login on this team.
        continue when exists (select 1 from public.org_memberships m join public.profiles pr on pr.id = m.profile_id
                              where m.org_id = p_org and m.role <> 'parent' and lower(pr.email) = v_email);
        select private.invite_parent(p_org, v_email, r.v_id) into v_inv;
        if v_inv is not null then v_invites := v_invites || v_inv; v_parent_invites := v_parent_invites + 1; end if;
      end loop;
    end if;
  end loop;
  insert into public.import_batches (org_id, kind, source, label, players, invitations, summary, created_by)
  values (p_org, 'roster', left(p_source, 40), left(p_label, 200), v_players, v_invites,
          jsonb_build_object('created', v_created, 'matched', v_matched,
                             'player_invites', v_player_invites, 'parent_invites', v_parent_invites),
          auth.uid())
  returning id into v_batch;
  return jsonb_build_object('batch', v_batch, 'created', v_created, 'matched', v_matched,
                            'player_invites', v_player_invites, 'parent_invites', v_parent_invites);
end;
$$;
revoke all on function public.import_roster(uuid, text, text, jsonb, boolean) from public;
grant execute on function public.import_roster(uuid, text, text, jsonb, boolean) to authenticated;

-- Schedule import: games and practices, skipping ones already on the calendar.
-- p_events: [{kind: game|practice, opponent?, title?, date, time?, home_away?, location?, group?}]
create function public.import_schedule(p_org uuid, p_source text, p_label text, p_events jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e jsonb; v_id uuid; v_batch uuid; v_group uuid; v_date date; v_time time;
  v_games uuid[] := '{}'; v_practices uuid[] := '{}'; v_skipped integer := 0;
begin
  if not private.has_org_role(p_org, array['admin']::public.org_role[]) then
    raise exception 'Only team admins can import.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) not between 1 and 1000 then
    raise exception 'Import 1 to 1,000 events at a time.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 0));
  for e in select value from jsonb_array_elements(p_events) loop
    v_date := (e ->> 'date')::date;
    v_time := nullif(e ->> 'time', '')::time;
    v_group := private.group_for(p_org, e ->> 'group', false);
    if e ->> 'kind' = 'practice' then
      if exists (select 1 from public.practice_plans where org_id = p_org and not is_template
                 and date = v_date and start_time is not distinct from v_time) then
        v_skipped := v_skipped + 1; continue;
      end if;
      insert into public.practice_plans (org_id, group_id, title, date, start_time, location, published, created_by)
      values (p_org, v_group, left(coalesce(nullif(trim(e ->> 'title'), ''), 'Practice'), 120), v_date, v_time,
              left(nullif(trim(e ->> 'location'), ''), 200), true, auth.uid())
      returning id into v_id;
      v_practices := v_practices || v_id;
    else
      if nullif(trim(e ->> 'opponent'), '') is null then raise exception 'Every game needs an opponent.'; end if;
      if exists (select 1 from public.games where org_id = p_org and date = v_date
                 and lower(trim(opponent)) = lower(trim(e ->> 'opponent'))) then
        v_skipped := v_skipped + 1; continue;
      end if;
      insert into public.games (org_id, group_id, opponent, date, start_time, home_away, location, created_by)
      values (p_org, v_group, left(trim(e ->> 'opponent'), 120), v_date, v_time,
              coalesce(nullif(e ->> 'home_away', ''), 'home')::public.home_away,
              left(nullif(trim(e ->> 'location'), ''), 200), auth.uid())
      returning id into v_id;
      v_games := v_games || v_id;
    end if;
  end loop;
  insert into public.import_batches (org_id, kind, source, label, games, practices, summary, created_by)
  values (p_org, 'schedule', left(p_source, 40), left(p_label, 200), v_games, v_practices,
          jsonb_build_object('games', cardinality(v_games), 'practices', cardinality(v_practices), 'skipped', v_skipped),
          auth.uid())
  returning id into v_batch;
  return jsonb_build_object('batch', v_batch, 'games', cardinality(v_games),
                            'practices', cardinality(v_practices), 'skipped', v_skipped);
end;
$$;
revoke all on function public.import_schedule(uuid, text, text, jsonb) from public;
grant execute on function public.import_schedule(uuid, text, text, jsonb) to authenticated;

-- Stats import: season lines kept as source snapshots (separate from live
-- season totals), matched to roster players by name (and jersey when given).
-- p_rows: [{key, values: {name, jersey?, season, category, <stats>...}}]
create function public.import_stats(p_org uuid, p_source text, p_season text, p_label text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb; v_values jsonb; v_id uuid; v_player uuid; v_batch uuid;
  v_ids uuid[] := '{}'; v_saved integer := 0; v_skipped integer := 0; v_matched integer := 0;
begin
  if not private.has_org_role(p_org, array['admin']::public.org_role[]) then
    raise exception 'Only team admins can import.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 1000
     or char_length(coalesce(p_season, '')) not between 1 and 80 then
    raise exception 'Invalid import.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 0));
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_values := v_row -> 'values';
    if jsonb_typeof(v_values) <> 'object' or nullif(v_values ->> 'name', '') is null
       or nullif(v_row ->> 'key', '') is null then
      raise exception 'Invalid row.';
    end if;
    if exists (select 1 from public.team_import_rows where org_id = p_org and kind = 'stats'
               and season = p_season and identity_key = v_row ->> 'key') then
      v_skipped := v_skipped + 1; continue;
    end if;
    select m.profile_id into v_player
      from public.org_memberships m join public.profiles pr on pr.id = m.profile_id
     where m.org_id = p_org and m.role = 'player'
       and lower(regexp_replace(trim(pr.full_name), '\s+', ' ', 'g'))
           = lower(regexp_replace(trim(v_values ->> 'name'), '\s+', ' ', 'g'))
       and (coalesce(v_values ->> 'jersey', '') !~ '^\d{1,2}$' or m.jersey_number is null
            or m.jersey_number = (v_values ->> 'jersey')::smallint)
     limit 1;
    insert into public.team_import_rows (org_id, kind, source, season, identity_key, values, player_id, imported_by)
    values (p_org, 'stats', p_source, p_season, v_row ->> 'key', v_values, v_player, auth.uid())
    returning id into v_id;
    v_ids := v_ids || v_id;
    v_saved := v_saved + 1;
    if v_player is not null then v_matched := v_matched + 1; end if;
  end loop;
  insert into public.import_batches (org_id, kind, source, label, import_rows, summary, created_by)
  values (p_org, 'stats', left(p_source, 40), left(p_label, 200), v_ids,
          jsonb_build_object('saved', v_saved, 'skipped', v_skipped, 'matched', v_matched), auth.uid())
  returning id into v_batch;
  return jsonb_build_object('batch', v_batch, 'saved', v_saved, 'skipped', v_skipped, 'matched', v_matched);
end;
$$;
revoke all on function public.import_stats(uuid, text, text, text, jsonb) from public;
grant execute on function public.import_stats(uuid, text, text, text, jsonb) to authenticated;

-- Undo an import: removes what it created and hasn't been taken over since
-- (players who set up a login stay; games with stats entered stay).
create function public.undo_import(p_batch uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.import_batches; v_players integer := 0; v_games integer := 0; v_practices integer := 0; v_kept integer := 0;
begin
  select * into b from public.import_batches where id = p_batch for update;
  if not found or not private.has_org_role(b.org_id, array['admin']::public.org_role[]) then
    raise exception 'Import not found.' using errcode = '42501';
  end if;
  if b.undone_at is not null then raise exception 'This import was already undone.'; end if;
  delete from public.org_invitations where id = any (b.invitations) and accepted_at is null;
  with gone as (
    delete from auth.users u where u.id = any (b.players)
      and coalesce((u.raw_app_meta_data ->> 'roster_only')::boolean, false)
      and not exists (select 1 from public.org_memberships m where m.profile_id = u.id and m.org_id <> b.org_id)
    returning 1)
  select count(*) into v_players from gone;
  with gone as (
    delete from public.games g where g.id = any (b.games) and g.org_id = b.org_id
      and not exists (select 1 from public.game_batting x where x.game_id = g.id)
      and not exists (select 1 from public.game_pitching x where x.game_id = g.id)
    returning 1)
  select count(*) into v_games from gone;
  with gone as (
    delete from public.practice_plans pp where pp.id = any (b.practices) and pp.org_id = b.org_id
      and not exists (select 1 from public.practice_blocks x where x.plan_id = pp.id)
    returning 1)
  select count(*) into v_practices from gone;
  delete from public.team_import_rows where id = any (b.import_rows) and org_id = b.org_id;
  v_kept := cardinality(b.players) - v_players + cardinality(b.games) - v_games + cardinality(b.practices) - v_practices;
  update public.import_batches set undone_at = now() where id = b.id;
  return jsonb_build_object('players', v_players, 'games', v_games, 'practices', v_practices, 'kept', v_kept);
end;
$$;
revoke all on function public.undo_import(uuid) from public;
grant execute on function public.undo_import(uuid) to authenticated;

-- Removing a roster-only player from the team deletes their placeholder
-- account (nobody can sign in to it, so nothing else would ever use it).
create function private.cleanup_roster_only()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'player' and private.is_roster_only(old.profile_id)
     and not exists (select 1 from public.org_memberships m where m.profile_id = old.profile_id) then
    delete from auth.users where id = old.profile_id;
  end if;
  return old;
end;
$$;
create trigger org_memberships_cleanup_roster_only
  after delete on public.org_memberships
  for each row execute function private.cleanup_roster_only();
