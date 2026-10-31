-- Whole-athlete health, part 2: a 10-second daily body check-in (overall feel,
-- sore spots tapped on a body outline, optional sleep). Players (or a parent)
-- check in; the team's staff, the player and their parents can see it.

create table public.body_checkins (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  player_id  uuid not null references public.profiles (id) on delete cascade,
  date       date not null,
  -- 1 = awful … 5 = great
  feel       smallint not null check (feel between 1 and 5),
  -- Sore spots: "chest", "knee:left", …
  sore       text[] not null default '{}'
             check (cardinality(sore) <= 16
                    and array_to_string(sore, ',') ~ '^([a-z_]+(:(left|right))?(,|$))*$'),
  sleep      text check (sleep in ('under6', '6to7', '8plus')),
  note       text check (char_length(note) <= 200),
  logged_by  uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (org_id, player_id, date)
);
create index body_checkins_recent_idx on public.body_checkins (org_id, date desc);

create trigger body_checkins_updated
  before update on public.body_checkins
  for each row execute function private.set_updated_at();

alter table public.body_checkins enable row level security;

create policy "Staff, the player, and their parents see body check-ins"
  on public.body_checkins for select to authenticated
  using (
    private.is_org_staff(org_id)
    or (player_id = (select auth.uid()) and private.is_org_member(org_id))
    or private.is_parent_of(org_id, player_id)
  );

create policy "The player or a parent checks in"
  on public.body_checkins for insert to authenticated
  with check (
    logged_by = (select auth.uid())
    and date between current_date - 1 and current_date + 1
    and private.is_player_in_org(org_id, player_id)
    and (player_id = (select auth.uid()) or private.is_parent_of(org_id, player_id))
  );

create policy "The player or a parent updates a check-in"
  on public.body_checkins for update to authenticated
  using (player_id = (select auth.uid()) or private.is_parent_of(org_id, player_id))
  with check (
    logged_by = (select auth.uid())
    and date between current_date - 1 and current_date + 1
    and (player_id = (select auth.uid()) or private.is_parent_of(org_id, player_id))
  );
