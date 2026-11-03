-- =============================================================================
-- 9D Leagues, step 2: leagues with divisions, a league schedule and standings.
-- Anyone signed in can start a league. The league admin adds teams (public
-- team pages), builds the schedule and can always set a game's score. Scores
-- otherwise come from the two teams' own pages (worked out in the app), so a
-- team on 9D reports automatically. A team's owner can take it out of a league.
-- =============================================================================

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 70),
  name text not null check (char_length(trim(name)) between 2 and 80),
  season text check (char_length(season) <= 40),
  level text not null default 'travel'
    check (level in ('youth', 'middle_school', 'high_school', 'travel', 'college', 'adult')),
  city text check (char_length(city) <= 60),
  state text check (char_length(state) <= 30),
  owner_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index leagues_name on public.leagues (lower(name));
alter table public.leagues enable row level security;
create policy "Anyone can see leagues" on public.leagues for select to anon, authenticated using (true);
create policy "Signed-in people start leagues they own" on public.leagues for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "League owners edit" on public.leagues for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "League owners delete" on public.leagues for delete to authenticated
  using (owner_id = (select auth.uid()));

create or replace function private.owns_league(p_league uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.leagues l where l.id = p_league and l.owner_id = (select auth.uid()));
$$;

create table public.league_divisions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index league_divisions_league on public.league_divisions (league_id, sort);
alter table public.league_divisions enable row level security;
create policy "Anyone can see divisions" on public.league_divisions for select to anon, authenticated using (true);
create policy "League owners manage divisions" on public.league_divisions for all to authenticated
  using (private.owns_league(league_id)) with check (private.owns_league(league_id));

create table public.league_teams (
  league_id uuid not null references public.leagues (id) on delete cascade,
  team_id uuid not null references public.public_teams (id) on delete cascade,
  division_id uuid references public.league_divisions (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (league_id, team_id)
);
create index league_teams_team on public.league_teams (team_id);
alter table public.league_teams enable row level security;
create policy "Anyone can see league teams" on public.league_teams for select to anon, authenticated using (true);
create policy "League owners add teams" on public.league_teams for insert to authenticated
  with check (private.owns_league(league_id));
create policy "League owners place teams" on public.league_teams for update to authenticated
  using (private.owns_league(league_id)) with check (private.owns_league(league_id));
create policy "League owners or the team's owner remove a team" on public.league_teams for delete to authenticated
  using (
    private.owns_league(league_id)
    or exists (select 1 from public.public_teams t where t.id = team_id and t.owner_id = (select auth.uid()))
  );

-- The division must belong to the same league.
create or replace function private.guard_league_team()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.division_id is not null and not exists (
    select 1 from public.league_divisions d where d.id = new.division_id and d.league_id = new.league_id
  ) then
    raise exception 'That division isn''t part of this league.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_league_team before insert or update on public.league_teams
  for each row execute function private.guard_league_team();

create table public.league_games (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  date date not null,
  start_time time,
  home_team_id uuid not null references public.public_teams (id) on delete cascade,
  away_team_id uuid not null references public.public_teams (id) on delete cascade,
  location text check (char_length(location) <= 120),
  -- Set by the league admin; when set it overrides what the teams report.
  status text not null default 'scheduled' check (status in ('scheduled', 'final', 'postponed', 'canceled')),
  home_score integer check (home_score between 0 and 99),
  away_score integer check (away_score between 0 and 99),
  created_at timestamptz not null default now(),
  check (home_team_id <> away_team_id),
  check (status <> 'final' or (home_score is not null and away_score is not null))
);
create index league_games_league_date on public.league_games (league_id, date);
alter table public.league_games enable row level security;
create policy "Anyone can see league games" on public.league_games for select to anon, authenticated using (true);
create policy "League owners manage games" on public.league_games for all to authenticated
  using (private.owns_league(league_id))
  with check (
    private.owns_league(league_id)
    and exists (select 1 from public.league_teams lt where lt.league_id = league_games.league_id and lt.team_id = home_team_id)
    and exists (select 1 from public.league_teams lt where lt.league_id = league_games.league_id and lt.team_id = away_team_id)
  );

/** The games of several teams in a date range (for scores the teams report). */
create or replace function public.public_teams_games(p_teams uuid[], p_from date, p_to date)
returns table (
  id uuid, team_id uuid, date date, start_time time, opponent text, home_away text,
  location text, status text, team_score integer, opponent_score integer, inning integer
)
language sql stable security definer set search_path = '' as $$
  select g.id, t.id, g.date, g.start_time, g.opponent, g.home_away::text, g.location,
         g.status::text, g.team_score, g.opponent_score, g.current_inning::integer
  from public.public_teams t
  join public.games g on g.org_id = t.org_id
    and (t.group_id is null or g.group_id is null or g.group_id = t.group_id)
  where t.org_id is not null and t.id = any (p_teams) and g.date between p_from and p_to
  union all
  select g.id, t.id, g.date, g.start_time, g.opponent, g.home_away, g.location,
         g.status, g.team_score, g.opponent_score, null
  from public.public_teams t
  join public.public_games g on g.team_id = t.id
  where t.org_id is null and t.id = any (p_teams) and g.date between p_from and p_to
  limit 5000;
$$;
revoke execute on function public.public_teams_games(uuid[], date, date) from public;
grant execute on function public.public_teams_games(uuid[], date, date) to anon, authenticated;

-- A team leaving a league takes its league games with it (whoever removes it).
create or replace function private.league_team_removed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.league_games g
  where g.league_id = old.league_id
    and (g.home_team_id = old.team_id or g.away_team_id = old.team_id);
  return old;
end;
$$;
create trigger league_team_removed after delete on public.league_teams
  for each row execute function private.league_team_removed();
