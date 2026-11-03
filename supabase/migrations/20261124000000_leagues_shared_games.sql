-- =============================================================================
-- 9D Leagues: shared games. A game can name its opponent's team page; it then
-- shows on both teams' schedules (flipped for the opponent), and either team's
-- owner can report the score through report_public_game. If the second team
-- reports a different final, the game is disputed until one side agrees.
-- =============================================================================

alter table public.public_games
  add column opponent_team_id uuid references public.public_teams (id) on delete set null,
  -- The team (this one or the opponent) that reported the current final.
  add column reported_by uuid references public.public_teams (id) on delete set null,
  -- The other team's different report, from this row's side: {team_id, team_score, opponent_score}.
  add column dispute jsonb,
  -- Both teams agree on the final (after that, any change by either side is a dispute).
  add column confirmed boolean not null default false,
  add constraint public_games_not_self check (opponent_team_id is null or opponent_team_id <> team_id);
create index public_games_opponent on public.public_games (opponent_team_id, date) where opponent_team_id is not null;

-- Owners can still edit their rows, but scores go through report_public_game.
create or replace function private.guard_public_game()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('app.reporting_score', true) = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.reported_by := case when new.status = 'final' then new.team_id end;
    new.dispute := null;
    new.confirmed := false;
  else
    new.reported_by := old.reported_by;
    new.dispute := old.dispute;
    new.confirmed := old.confirmed;
    -- A new opponent never inherits the old one's agreement or claim.
    if new.opponent_team_id is distinct from old.opponent_team_id then
      new.dispute := null;
      new.confirmed := false;
      if old.reported_by is distinct from old.team_id then
        new.reported_by := case when old.status = 'final' then old.team_id end;
      end if;
    end if;
    new.status := old.status;
    new.team_score := old.team_score;
    new.opponent_score := old.opponent_score;
  end if;
  return new;
end;
$$;
create trigger guard_public_game before insert or update on public.public_games
  for each row execute function private.guard_public_game();

/**
 * Report a game's result as either team. Scores are from the caller's side.
 * Returns 'final', 'disputed', or the status set.
 */
create or replace function public.report_public_game(
  p_game uuid,
  p_status text,
  p_us integer default null,
  p_them integer default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.public_games;
  v_me uuid := (select auth.uid());
  v_team uuid;
  v_ts integer;
  v_os integer;
  v_claim uuid;
begin
  select * into g from public.public_games where id = p_game for update;
  if g.id is null then
    raise exception 'Game not found.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.public_teams t where t.id = g.team_id and t.owner_id = v_me) then
    v_team := g.team_id;
  elsif g.opponent_team_id is not null
    and exists (select 1 from public.public_teams t where t.id = g.opponent_team_id and t.owner_id = v_me) then
    v_team := g.opponent_team_id;
  else
    raise exception 'Only the two teams can report this game.' using errcode = '42501';
  end if;
  if p_status not in ('scheduled', 'final', 'postponed', 'canceled') then
    raise exception 'Unknown status.' using errcode = '22023';
  end if;

  perform set_config('app.reporting_score', 'on', true);

  if p_status <> 'final' then
    -- Once the other team has a say in the final, it can only be changed by a new score.
    if g.dispute is not null then
      raise exception 'The two teams disagree on this score. Enter the score you agree with.' using errcode = '42501';
    end if;
    if g.status = 'final' and (g.confirmed or g.reported_by is distinct from v_team) then
      raise exception 'The other team has this game as final. Enter a different score if it''s wrong.' using errcode = '42501';
    end if;
    update public.public_games
      set status = p_status, team_score = null, opponent_score = null, dispute = null, confirmed = false,
          reported_by = case when p_status = 'scheduled' then null else v_team end
      where id = g.id;
    perform set_config('app.reporting_score', 'off', true);
    return p_status;
  end if;

  if p_us is null or p_them is null or p_us not between 0 and 99 or p_them not between 0 and 99 then
    raise exception 'Enter both scores (0 to 99).' using errcode = '22023';
  end if;
  -- Store from the row's side.
  if v_team = g.team_id then
    v_ts := p_us; v_os := p_them;
  else
    v_ts := p_them; v_os := p_us;
  end if;

  if g.dispute is not null then
    v_claim := (g.dispute ->> 'team_id')::uuid;
    if v_team = v_claim then
      -- The disputing team changes its claim (agreeing ends the dispute).
      update public.public_games
        set dispute = case
              when (v_ts, v_os) = (g.team_score, g.opponent_score) then null
              else jsonb_build_object('team_id', v_team, 'team_score', v_ts, 'opponent_score', v_os)
            end,
            confirmed = (v_ts, v_os) = (g.team_score, g.opponent_score)
        where id = g.id;
    else
      -- The other team changes its score (matching the claim ends the dispute).
      update public.public_games
        set team_score = v_ts, opponent_score = v_os,
            dispute = case
              when (v_ts, v_os) = ((g.dispute ->> 'team_score')::int, (g.dispute ->> 'opponent_score')::int) then null
              else g.dispute
            end,
            confirmed = (v_ts, v_os) = ((g.dispute ->> 'team_score')::int, (g.dispute ->> 'opponent_score')::int)
        where id = g.id;
    end if;
  elsif g.status = 'final' and g.reported_by is not null then
    if (v_ts, v_os) = (g.team_score, g.opponent_score) then
      -- Same score: the other team confirms it.
      if g.reported_by <> v_team then
        update public.public_games set confirmed = true where id = g.id;
      end if;
    elsif g.reported_by = v_team and not g.confirmed then
      -- Fixing your own score before the other team has confirmed it.
      update public.public_games set team_score = v_ts, opponent_score = v_os where id = g.id;
    else
      update public.public_games
        set dispute = jsonb_build_object('team_id', v_team, 'team_score', v_ts, 'opponent_score', v_os)
        where id = g.id;
    end if;
  else
    update public.public_games
      set status = 'final', team_score = v_ts, opponent_score = v_os, reported_by = v_team,
          dispute = null, confirmed = false
      where id = g.id;
  end if;

  perform set_config('app.reporting_score', 'off', true);
  select * into g from public.public_games where id = p_game;
  return case when g.dispute is not null then 'disputed' else g.status end;
end;
$$;
revoke execute on function public.report_public_game(uuid, text, integer, integer) from public, anon;
grant execute on function public.report_public_game(uuid, text, integer, integer) to authenticated;

-- Games for public pages, now including games other teams added against this
-- team ("mirror", flipped to this team's side) and disputes. In a dispute the
-- main score is one team's report and alt_* the other's; alt_is_ours says
-- whether the alt report is this team's.
drop function if exists public.public_team_games(uuid, date, date);
drop function if exists public.public_teams_games(uuid[], date, date);

create or replace function private.team_games(p_teams uuid[], p_from date, p_to date)
returns table (
  id uuid, team_id uuid, date date, start_time time, opponent text, home_away text,
  location text, status text, team_score integer, opponent_score integer, inning integer,
  opponent_team_id uuid, mirror boolean, alt_team_score integer, alt_opponent_score integer,
  alt_is_ours boolean
)
language sql stable security definer set search_path = '' as $$
  -- Teams linked to 9D: their 9D games.
  select g.id, t.id, g.date, g.start_time, g.opponent, g.home_away::text, g.location,
         g.status::text, g.team_score, g.opponent_score, g.current_inning::integer,
         null::uuid, false, null::integer, null::integer, null::boolean
  from public.public_teams t
  join public.games g on g.org_id = t.org_id
    and (t.group_id is null or g.group_id is null or g.group_id = t.group_id)
  where t.org_id is not null and (p_teams is null or t.id = any (p_teams))
    and (p_from is null or g.date >= p_from) and (p_to is null or g.date <= p_to)
  union all
  -- Games a team entered itself.
  select g.id, t.id, g.date, g.start_time, g.opponent, g.home_away, g.location,
         case when g.dispute is not null then 'disputed' else g.status end,
         g.team_score, g.opponent_score, null,
         g.opponent_team_id, false,
         (g.dispute ->> 'team_score')::int, (g.dispute ->> 'opponent_score')::int,
         case when g.dispute is not null then (g.dispute ->> 'team_id')::uuid = t.id end
  from public.public_teams t
  join public.public_games g on g.team_id = t.id
  where t.org_id is null and (p_teams is null or t.id = any (p_teams))
    and (p_from is null or g.date >= p_from) and (p_to is null or g.date <= p_to)
  union all
  -- Games another team added against this one, from this team's side.
  select g.id, t.id, g.date, g.start_time, o.name,
         case g.home_away when 'home' then 'away' when 'away' then 'home' else 'neutral' end,
         g.location,
         case when g.dispute is not null then 'disputed' else g.status end,
         g.opponent_score, g.team_score, null,
         g.team_id, true,
         (g.dispute ->> 'opponent_score')::int, (g.dispute ->> 'team_score')::int,
         case when g.dispute is not null then (g.dispute ->> 'team_id')::uuid = t.id end
  from public.public_teams t
  join public.public_games g on g.opponent_team_id = t.id
  join public.public_teams o on o.id = g.team_id
  where (p_teams is null or t.id = any (p_teams))
    and (p_from is null or g.date >= p_from) and (p_to is null or g.date <= p_to)
  limit 5000;
$$;

create function public.public_team_games(
  p_team uuid default null,
  p_from date default null,
  p_to date default null
)
returns table (
  id uuid, team_id uuid, date date, start_time time, opponent text, home_away text,
  location text, status text, team_score integer, opponent_score integer, inning integer,
  opponent_team_id uuid, mirror boolean, alt_team_score integer, alt_opponent_score integer,
  alt_is_ours boolean
)
language sql stable security definer set search_path = '' as $$
  select * from private.team_games(case when p_team is null then null else array[p_team] end, p_from, p_to)
  order by 3, 4 nulls last;
$$;
revoke execute on function public.public_team_games(uuid, date, date) from public;
grant execute on function public.public_team_games(uuid, date, date) to anon, authenticated;

create function public.public_teams_games(p_teams uuid[], p_from date, p_to date)
returns table (
  id uuid, team_id uuid, date date, start_time time, opponent text, home_away text,
  location text, status text, team_score integer, opponent_score integer, inning integer,
  opponent_team_id uuid, mirror boolean, alt_team_score integer, alt_opponent_score integer,
  alt_is_ours boolean
)
language sql stable security definer set search_path = '' as $$
  select * from private.team_games(coalesce(p_teams, array[]::uuid[]), p_from, p_to);
$$;
revoke execute on function public.public_teams_games(uuid[], date, date) from public;
grant execute on function public.public_teams_games(uuid[], date, date) to anon, authenticated;
