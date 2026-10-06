-- =============================================================================
-- Phase 3: player groups (for bulk assignment / filtering) and the org's
-- current season phase (drives program recommendations).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Current season phase
-- -----------------------------------------------------------------------------

alter table public.organizations
  add column current_season_phase public.season_phase not null default 'off_season';

-- Staff (not just admins) can flip the season; nothing else on the org changes.
create or replace function public.set_current_season_phase(p_org_id uuid, p_phase public.season_phase)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_org_staff(p_org_id) then
    raise exception 'Only coaches, trainers, and admins can change the season' using errcode = '42501';
  end if;
  update public.organizations set current_season_phase = p_phase where id = p_org_id;
end;
$$;

revoke execute on function public.set_current_season_phase(uuid, public.season_phase) from public, anon;
grant execute on function public.set_current_season_phase(uuid, public.season_phase) to authenticated;

-- -----------------------------------------------------------------------------
-- Player groups
-- -----------------------------------------------------------------------------

create table public.player_groups (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 60),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create unique index player_groups_org_name_key on public.player_groups (org_id, lower(name));

create table public.player_group_members (
  group_id    uuid not null references public.player_groups (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (group_id, profile_id)
);

create index player_group_members_profile_idx on public.player_group_members (profile_id);

create or replace function private.group_org_id(p_group_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select org_id from public.player_groups where id = p_group_id;
$$;

alter table public.player_groups enable row level security;
alter table public.player_group_members enable row level security;

create policy "Members can view their org's groups"
  on public.player_groups for select to authenticated
  using (private.is_org_member(org_id));

create policy "Staff manage groups"
  on public.player_groups for all to authenticated
  using (private.is_org_staff(org_id))
  with check (private.is_org_staff(org_id));

create policy "Members can view group membership"
  on public.player_group_members for select to authenticated
  using (private.is_org_member(private.group_org_id(group_id)));

-- Only players of the same org can be put in a group.
create policy "Staff manage group membership"
  on public.player_group_members for all to authenticated
  using (private.is_org_staff(private.group_org_id(group_id)))
  with check (
    private.is_org_staff(private.group_org_id(group_id))
    and private.is_player_in_org(private.group_org_id(group_id), profile_id)
  );

-- When someone leaves an org, drop them from that org's groups.
create or replace function private.remove_from_org_groups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.player_group_members gm
  using public.player_groups g
  where gm.group_id = g.id
    and g.org_id = old.org_id
    and gm.profile_id = old.profile_id;
  return old;
end;
$$;

create trigger org_memberships_remove_from_groups
  after delete on public.org_memberships
  for each row execute function private.remove_from_org_groups();
