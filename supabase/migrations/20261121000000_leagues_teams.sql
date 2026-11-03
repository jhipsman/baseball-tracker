-- =============================================================================
-- 9D Leagues, step 1: public team pages anyone can create.
-- A page linked to a 9D team shows that team's schedule and results
-- automatically (read through security definer functions that expose only
-- safe columns). Other teams enter their games by hand. Nothing about players
-- is public.
-- =============================================================================

create table public.public_teams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 70),
  name text not null check (char_length(trim(name)) between 2 and 80),
  level text not null default 'travel'
    check (level in ('youth', 'middle_school', 'high_school', 'travel', 'college', 'adult')),
  age_group text check (char_length(age_group) <= 20),
  city text check (char_length(city) <= 60),
  state text check (char_length(state) <= 30),
  -- Linked 9D team (and optionally one group of it): results come from its games.
  org_id uuid references public.organizations (id) on delete set null,
  group_id uuid references public.player_groups (id) on delete set null,
  owner_id uuid references public.profiles (id) on delete set null,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (group_id is null or org_id is not null)
);
create unique index public_teams_one_per_link
  on public.public_teams (org_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where org_id is not null;
create index public_teams_name on public.public_teams (lower(name));
alter table public.public_teams enable row level security;

create policy "Anyone can see public teams"
  on public.public_teams for select to anon, authenticated using (true);
create policy "Signed-in people create teams they own"
  on public.public_teams for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (org_id is null or private.has_org_role(org_id, array['admin']::public.org_role[]))
  );
create policy "Owners edit their team"
  on public.public_teams for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (org_id is null or private.has_org_role(org_id, array['admin']::public.org_role[]))
  );
create policy "Owners delete their team"
  on public.public_teams for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Verified = linked to a real 9D team. The group must belong to that team.
create or replace function private.guard_public_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.group_id is not null and private.group_org_id(new.group_id) is distinct from new.org_id then
    raise exception 'That group isn''t part of this team.' using errcode = '42501';
  end if;
  new.verified := new.org_id is not null;
  new.updated_at := now();
  return new;
end;
$$;
create trigger guard_public_team
  before insert or update on public.public_teams
  for each row execute function private.guard_public_team();

-- Games for teams that aren't on 9D (entered by the page owner).
create table public.public_games (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.public_teams (id) on delete cascade,
  date date not null,
  start_time time,
  opponent text not null check (char_length(trim(opponent)) between 1 and 80),
  home_away text not null default 'home' check (home_away in ('home', 'away', 'neutral')),
  location text check (char_length(location) <= 120),
  status text not null default 'scheduled' check (status in ('scheduled', 'final', 'postponed', 'canceled')),
  team_score integer check (team_score between 0 and 99),
  opponent_score integer check (opponent_score between 0 and 99),
  created_at timestamptz not null default now(),
  check (status <> 'final' or (team_score is not null and opponent_score is not null))
);
create index public_games_team_date on public.public_games (team_id, date);
create index public_games_date on public.public_games (date);
alter table public.public_games enable row level security;

create policy "Anyone can see public games"
  on public.public_games for select to anon, authenticated using (true);
create policy "Team owners manage games on unlinked teams"
  on public.public_games for all to authenticated
  using (exists (
    select 1 from public.public_teams t
    where t.id = public_games.team_id and t.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.public_teams t
    where t.id = public_games.team_id and t.owner_id = (select auth.uid()) and t.org_id is null
  ));

/**
 * Games for public pages: one team (p_team) or every team (scoreboard), in a
 * date range. Linked teams read their 9D games; only schedule and score
 * columns leave the database.
 */
create or replace function public.public_team_games(
  p_team uuid default null,
  p_from date default null,
  p_to date default null
)
returns table (
  id uuid,
  team_id uuid,
  date date,
  start_time time,
  opponent text,
  home_away text,
  location text,
  status text,
  team_score integer,
  opponent_score integer,
  inning integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, t.id, g.date, g.start_time, g.opponent, g.home_away::text, g.location,
         g.status::text, g.team_score, g.opponent_score, g.current_inning::integer
  from public.public_teams t
  join public.games g on g.org_id = t.org_id
    and (t.group_id is null or g.group_id is null or g.group_id = t.group_id)
  where t.org_id is not null
    and (p_team is null or t.id = p_team)
    and (p_from is null or g.date >= p_from)
    and (p_to is null or g.date <= p_to)
  union all
  select g.id, t.id, g.date, g.start_time, g.opponent, g.home_away, g.location,
         g.status, g.team_score, g.opponent_score, null
  from public.public_teams t
  join public.public_games g on g.team_id = t.id
  where t.org_id is null
    and (p_team is null or t.id = p_team)
    and (p_from is null or g.date >= p_from)
    and (p_to is null or g.date <= p_to)
  order by 3, 4 nulls last
  limit 1000;
$$;
revoke execute on function public.public_team_games(uuid, date, date) from public;
grant execute on function public.public_team_games(uuid, date, date) to anon, authenticated;
