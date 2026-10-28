-- =============================================================================
-- Games, tournaments, box scores, season stats
-- =============================================================================

-- Who can see game stats: the whole team ('team', the usual for baseball) or
-- only each family's own player ('own'). Staff always see everything.
alter table public.organizations
  add column stats_visibility text not null default 'team'
  check (stats_visibility in ('team', 'own'));

create type public.game_kind as enum ('league', 'non_league', 'scrimmage', 'tournament', 'playoff');
create type public.home_away as enum ('home', 'away', 'neutral');
create type public.game_status as enum ('scheduled', 'live', 'final', 'postponed', 'canceled');

-- -----------------------------------------------------------------------------
-- Tournaments and games
-- -----------------------------------------------------------------------------

create table public.tournaments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  group_id    uuid references public.player_groups (id) on delete set null,
  name        text not null check (char_length(name) between 1 and 120),
  start_date  date not null,
  end_date    date not null,
  location    text check (char_length(location) <= 200),
  address     text check (char_length(address) <= 300),
  -- Link to the organizer's bracket / schedule page.
  url         text check (url is null or url ~ '^https?://'),
  notes       text check (char_length(notes) <= 4000),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date <= 31)
);

create index tournaments_org_dates_idx on public.tournaments (org_id, start_date);

create table public.games (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations (id) on delete cascade,
  group_id           uuid references public.player_groups (id) on delete set null,
  tournament_id      uuid references public.tournaments (id) on delete set null,
  opponent           text not null check (char_length(opponent) between 1 and 120),
  kind               public.game_kind not null default 'league',
  home_away          public.home_away not null default 'home',
  date               date not null,
  start_time         time,
  arrival_time       time,
  location           text check (char_length(location) <= 200),
  address            text check (char_length(address) <= 300),
  notes              text check (char_length(notes) <= 4000),
  status             public.game_status not null default 'scheduled',
  team_score         smallint check (team_score between 0 and 99),
  opponent_score     smallint check (opponent_score between 0 and 99),
  -- Runs by inning: [{"us": 0, "them": 1}, ...]
  line_score         jsonb not null default '[]'::jsonb check (jsonb_typeof(line_score) = 'array'),
  current_inning     smallint check (current_inning between 1 and 30),
  innings_scheduled  smallint not null default 7 check (innings_scheduled between 1 and 12),
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index games_org_date_idx on public.games (org_id, date);
create index games_tournament_idx on public.games (tournament_id);

create trigger games_set_updated_at
  before update on public.games
  for each row execute function private.set_updated_at();

create or replace function private.game_org_id(p_game uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select org_id from public.games where id = p_game;
$$;

alter table public.tournaments enable row level security;
alter table public.games enable row level security;

-- Everyone on the team (players and parents limited to their / their child's group).
create policy "Team sees tournaments"
  on public.tournaments for select to authenticated
  using (private.can_see_announcement(org_id, group_id, true));

create policy "Staff manage tournaments"
  on public.tournaments for all to authenticated
  using (private.is_org_staff(org_id))
  with check (
    private.is_org_staff(org_id)
    and (group_id is null or private.group_org_id(group_id) = org_id)
  );

create policy "Team sees games"
  on public.games for select to authenticated
  using (private.can_see_announcement(org_id, group_id, true));

create policy "Staff manage games"
  on public.games for all to authenticated
  using (private.is_org_staff(org_id))
  with check (
    private.is_org_staff(org_id)
    and (group_id is null or private.group_org_id(group_id) = org_id)
    and (tournament_id is null
         or exists (select 1 from public.tournaments t where t.id = tournament_id and t.org_id = games.org_id))
  );

-- -----------------------------------------------------------------------------
-- Box scores
-- -----------------------------------------------------------------------------

create table public.game_batting (
  id             uuid primary key default gen_random_uuid(),
  game_id        uuid not null references public.games (id) on delete cascade,
  org_id         uuid not null references public.organizations (id) on delete cascade,
  player_id      uuid not null references public.profiles (id) on delete cascade,
  batting_order  smallint check (batting_order between 1 and 30),
  position       text check (char_length(position) <= 8),
  ab             smallint not null default 0 check (ab between 0 and 15),
  r              smallint not null default 0 check (r between 0 and 15),
  h              smallint not null default 0 check (h between 0 and 15),
  doubles        smallint not null default 0 check (doubles between 0 and 15),
  triples        smallint not null default 0 check (triples between 0 and 15),
  hr             smallint not null default 0 check (hr between 0 and 15),
  rbi            smallint not null default 0 check (rbi between 0 and 30),
  bb             smallint not null default 0 check (bb between 0 and 15),
  so             smallint not null default 0 check (so between 0 and 15),
  hbp            smallint not null default 0 check (hbp between 0 and 15),
  sb             smallint not null default 0 check (sb between 0 and 15),
  cs             smallint not null default 0 check (cs between 0 and 15),
  sac            smallint not null default 0 check (sac between 0 and 15),
  sf             smallint not null default 0 check (sf between 0 and 15),
  e              smallint not null default 0 check (e between 0 and 15),
  unique (game_id, player_id),
  check (h <= ab and doubles + triples + hr <= h and so <= ab)
);

create table public.game_pitching (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  player_id   uuid not null references public.profiles (id) on delete cascade,
  sort_order  smallint not null default 0,
  -- Innings pitched stored as outs (5.2 IP = 17 outs).
  outs        smallint not null default 0 check (outs between 0 and 90),
  h           smallint not null default 0 check (h between 0 and 60),
  r           smallint not null default 0 check (r between 0 and 60),
  er          smallint not null default 0 check (er between 0 and 60),
  bb          smallint not null default 0 check (bb between 0 and 60),
  so          smallint not null default 0 check (so between 0 and 60),
  hbp         smallint not null default 0 check (hbp between 0 and 60),
  hr          smallint not null default 0 check (hr between 0 and 60),
  pitches     smallint check (pitches between 0 and 250),
  strikes     smallint check (strikes between 0 and 250),
  decision    text check (decision in ('W', 'L', 'S', 'H')),
  unique (game_id, player_id),
  check (er <= r and hr <= h and (strikes is null or pitches is null or strikes <= pitches))
);

create index game_batting_player_idx on public.game_batting (org_id, player_id);
create index game_pitching_player_idx on public.game_pitching (org_id, player_id);

-- Stats are visible to staff, the player, their parents, and (when the team
-- shares stats) everyone on the team.
create or replace function private.can_view_stats(p_org uuid, p_player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_org_staff(p_org)
    or (p_player = (select auth.uid()) and private.is_org_member(p_org))
    or private.is_parent_of(p_org, p_player)
    or (private.is_org_member(p_org)
        and exists (select 1 from public.organizations o
                    where o.id = p_org and o.stats_visibility = 'team'));
$$;

alter table public.game_batting enable row level security;
alter table public.game_pitching enable row level security;

create policy "Stats viewers see batting lines"
  on public.game_batting for select to authenticated
  using (private.can_view_stats(org_id, player_id));

create policy "Staff record batting lines"
  on public.game_batting for all to authenticated
  using (private.is_org_staff(org_id))
  with check (
    private.is_org_staff(org_id)
    and private.game_org_id(game_id) = org_id
    and private.is_player_in_org(org_id, player_id)
  );

create policy "Stats viewers see pitching lines"
  on public.game_pitching for select to authenticated
  using (private.can_view_stats(org_id, player_id));

create policy "Staff record pitching lines"
  on public.game_pitching for all to authenticated
  using (private.is_org_staff(org_id))
  with check (
    private.is_org_staff(org_id)
    and private.game_org_id(game_id) = org_id
    and private.is_player_in_org(org_id, player_id)
  );

-- Replace a game's box score in one transaction (SECURITY INVOKER: RLS applies).
-- p_batting / p_pitching: arrays of objects with the column names above.
create or replace function public.save_box_score(p_game_id uuid, p_batting jsonb, p_pitching jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid := private.game_org_id(p_game_id);
begin
  if v_org is null or not private.is_org_staff(v_org) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_batting) <> 'array' or jsonb_typeof(p_pitching) <> 'array' then
    raise exception 'Box score must be arrays' using errcode = '22023';
  end if;

  delete from public.game_batting b
  where b.game_id = p_game_id
    and b.player_id not in (select (x ->> 'player_id')::uuid from jsonb_array_elements(p_batting) x);

  insert into public.game_batting (
    game_id, org_id, player_id, batting_order, position,
    ab, r, h, doubles, triples, hr, rbi, bb, so, hbp, sb, cs, sac, sf, e
  )
  select p_game_id, v_org, (x ->> 'player_id')::uuid,
         nullif(x ->> 'batting_order', '')::smallint, nullif(x ->> 'position', ''),
         coalesce((x ->> 'ab')::smallint, 0), coalesce((x ->> 'r')::smallint, 0),
         coalesce((x ->> 'h')::smallint, 0), coalesce((x ->> 'doubles')::smallint, 0),
         coalesce((x ->> 'triples')::smallint, 0), coalesce((x ->> 'hr')::smallint, 0),
         coalesce((x ->> 'rbi')::smallint, 0), coalesce((x ->> 'bb')::smallint, 0),
         coalesce((x ->> 'so')::smallint, 0), coalesce((x ->> 'hbp')::smallint, 0),
         coalesce((x ->> 'sb')::smallint, 0), coalesce((x ->> 'cs')::smallint, 0),
         coalesce((x ->> 'sac')::smallint, 0), coalesce((x ->> 'sf')::smallint, 0),
         coalesce((x ->> 'e')::smallint, 0)
  from jsonb_array_elements(p_batting) x
  on conflict (game_id, player_id) do update set
    batting_order = excluded.batting_order, position = excluded.position,
    ab = excluded.ab, r = excluded.r, h = excluded.h, doubles = excluded.doubles,
    triples = excluded.triples, hr = excluded.hr, rbi = excluded.rbi, bb = excluded.bb,
    so = excluded.so, hbp = excluded.hbp, sb = excluded.sb, cs = excluded.cs,
    sac = excluded.sac, sf = excluded.sf, e = excluded.e;

  delete from public.game_pitching p
  where p.game_id = p_game_id
    and p.player_id not in (select (x ->> 'player_id')::uuid from jsonb_array_elements(p_pitching) x);

  insert into public.game_pitching (
    game_id, org_id, player_id, sort_order, outs, h, r, er, bb, so, hbp, hr, pitches, strikes, decision
  )
  select p_game_id, v_org, (x ->> 'player_id')::uuid, (o.ord - 1)::smallint,
         coalesce((x ->> 'outs')::smallint, 0), coalesce((x ->> 'h')::smallint, 0),
         coalesce((x ->> 'r')::smallint, 0), coalesce((x ->> 'er')::smallint, 0),
         coalesce((x ->> 'bb')::smallint, 0), coalesce((x ->> 'so')::smallint, 0),
         coalesce((x ->> 'hbp')::smallint, 0), coalesce((x ->> 'hr')::smallint, 0),
         nullif(x ->> 'pitches', '')::smallint, nullif(x ->> 'strikes', '')::smallint,
         nullif(x ->> 'decision', '')
  from jsonb_array_elements(p_pitching) with ordinality as o(x, ord)
  on conflict (game_id, player_id) do update set
    sort_order = excluded.sort_order, outs = excluded.outs, h = excluded.h, r = excluded.r,
    er = excluded.er, bb = excluded.bb, so = excluded.so, hbp = excluded.hbp, hr = excluded.hr,
    pitches = excluded.pitches, strikes = excluded.strikes, decision = excluded.decision;
end;
$$;

revoke execute on function public.save_box_score(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_box_score(uuid, jsonb, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Pitch counts from box scores feed Pitch Smart automatically
-- -----------------------------------------------------------------------------

alter table public.throwing_logs
  add column game_id uuid references public.games (id) on delete cascade;

create unique index throwing_logs_game_player_key
  on public.throwing_logs (game_id, player_id) where game_id is not null;

create or replace function private.sync_game_pitch_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games;
  v_row public.game_pitching;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  if tg_op = 'DELETE' or coalesce(v_row.pitches, 0) = 0 then
    delete from public.throwing_logs
    where game_id = v_row.game_id and player_id = v_row.player_id;
    return v_row;
  end if;

  select * into v_game from public.games where id = new.game_id;
  insert into public.throwing_logs (
    org_id, player_id, logged_by, date, throwing_type, pitch_count, intensity, notes, game_id
  )
  values (
    new.org_id, new.player_id, auth.uid(), v_game.date, 'game', new.pitches, 'max_effort',
    'vs ' || v_game.opponent || ' (from box score)', new.game_id
  )
  on conflict (game_id, player_id) where game_id is not null
  do update set pitch_count = excluded.pitch_count, date = excluded.date, notes = excluded.notes;
  return new;
end;
$$;

create trigger game_pitching_sync_throwing
  after insert or update or delete on public.game_pitching
  for each row execute function private.sync_game_pitch_count();

-- Keep linked throwing logs on the game's date if it's rescheduled.
create or replace function private.on_game_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_body text;
  v_when text;
begin
  if new.date is distinct from old.date then
    update public.throwing_logs set date = new.date where game_id = new.id;
  end if;

  v_when := to_char(new.date, 'Dy Mon DD')
    || coalesce(' ' || to_char(new.start_time, 'FMHH12:MI AM'), '');

  if new.status = 'final' and old.status is distinct from 'final' then
    v_title := 'Final: '
      || case
           when new.team_score > new.opponent_score then 'W '
           when new.team_score < new.opponent_score then 'L '
           when new.team_score is not null then 'T '
           else ''
         end
      || coalesce(new.team_score::text || '–' || new.opponent_score::text || ' ', '')
      || case new.home_away when 'away' then '@ ' else 'vs ' end || new.opponent;
    v_body := 'Box score and stats are in the app.';
  elsif new.status in ('postponed', 'canceled') and old.status is distinct from new.status then
    v_title := initcap(new.status::text) || ': '
      || case new.home_away when 'away' then '@ ' else 'vs ' end || new.opponent;
    v_body := 'Was ' || to_char(old.date, 'Dy Mon DD') || '.';
  elsif new.status = 'scheduled'
        and (new.date, new.start_time, new.location)
            is distinct from (old.date, old.start_time, old.location) then
    v_title := 'Game moved: '
      || case new.home_away when 'away' then '@ ' else 'vs ' end || new.opponent;
    v_body := 'Now ' || v_when || coalesce(' · ' || new.location, '');
  else
    return new;
  end if;

  perform private.notify(m.profile_id, new.org_id, auth.uid(), 'game', v_title, v_body,
                         '/games/' || new.id)
  from public.org_memberships m
  where m.org_id = new.org_id
    and (
      (m.role = 'player' and (new.group_id is null or exists (
        select 1 from public.player_group_members gm
        where gm.group_id = new.group_id and gm.profile_id = m.profile_id)))
      or (m.role = 'parent' and (new.group_id is null or exists (
        select 1 from public.parent_links pl
        join public.player_group_members gm on gm.profile_id = pl.player_id
        where pl.org_id = new.org_id and pl.parent_id = m.profile_id
          and gm.group_id = new.group_id)))
    );
  return new;
end;
$$;

create trigger games_after_update
  after update on public.games
  for each row execute function private.on_game_change();

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'announcement', 'message', 'video_reviewed', 'video_uploaded',
  'arm_pain', 'practice', 'program_assigned', 'game'
));
