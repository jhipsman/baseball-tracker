-- =============================================================================
-- Live game log: at-bat-by-at-bat scoring with live pitch counts.
--
-- games.live_state holds the scorer's setup and the in-progress count:
--   {"lineup": [player ids in batting order], "pitcher_id": uuid,
--    "we_bat_first": bool, "balls": 0, "strikes": 0, "pitches": 0}
-- Everything else (inning, outs, batter up, box score, line score) is derived
-- from game_plays in the app, so undo is just deleting the last play.
-- =============================================================================

alter table public.games add column live_state jsonb
  check (live_state is null or jsonb_typeof(live_state) = 'object');

create table public.game_plays (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  seq         integer not null check (seq >= 1),
  inning      smallint not null check (inning between 1 and 30),
  half        text not null check (half in ('top', 'bottom')),
  -- True when this play happened while our team was batting.
  we_bat      boolean not null,
  -- pa: a plate appearance; steal: SB/CS by a runner; sub: pitching or lineup
  -- change; half_end: close a half with a run total without logging each at-bat.
  kind        text not null check (kind in ('pa', 'steal', 'sub', 'half_end')),
  batter_id   uuid references public.profiles (id) on delete set null,
  pitcher_id  uuid references public.profiles (id) on delete set null,
  -- Lineup slot for a batting substitution.
  slot        smallint check (slot between 1 and 30),
  result      text check (result in (
                '1B', '2B', '3B', 'HR', 'BB', 'IBB', 'HBP', 'K', 'KL',
                'GO', 'FO', 'LO', 'PO', 'E', 'FC', 'SAC', 'SF', 'DP', 'SB', 'CS'
              )),
  rbi         smallint not null default 0 check (rbi between 0 and 4),
  -- Runs that scored on this play (and how many were unearned, when we pitch).
  runs        smallint not null default 0 check (runs between 0 and 30),
  unearned    smallint not null default 0 check (unearned between 0 and 4),
  -- Our runners who scored on the play (for runs scored per player).
  scored      uuid[] not null default '{}',
  pitches     smallint not null default 0 check (pitches between 0 and 40),
  outs        smallint not null default 0 check (outs between 0 and 3),
  note        text check (char_length(note) <= 280),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (game_id, seq),
  check (unearned <= runs and rbi <= runs + 1)
);

create index game_plays_game_seq_idx on public.game_plays (game_id, seq);

create or replace function private.can_view_game(p_game uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.games g
    where g.id = p_game and private.can_see_announcement(g.org_id, g.group_id, true)
  );
$$;

alter table public.game_plays enable row level security;

-- The play feed follows the team's stats privacy: in "own player only" mode,
-- players and parents see plays involving their player (and opponent-only plays).
create policy "Team sees the game log"
  on public.game_plays for select to authenticated
  using (
    private.is_org_staff(org_id)
    or (
      private.can_view_game(game_id)
      and (
        coalesce(batter_id, pitcher_id) is null
        or private.can_view_stats(org_id, coalesce(batter_id, pitcher_id))
      )
    )
  );

create policy "Staff keep the game log"
  on public.game_plays for all to authenticated
  using (private.is_org_staff(org_id))
  with check (
    private.is_org_staff(org_id)
    and private.game_org_id(game_id) = org_id
    and (batter_id is null or private.is_player_in_org(org_id, batter_id))
    and (pitcher_id is null or private.is_player_in_org(org_id, pitcher_id))
  );
