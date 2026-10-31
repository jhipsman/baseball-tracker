-- Whole-athlete health, part 1: any injury (where and what) on an Out/Limited
-- status, a return-to-play plan per kind, a concussion protocol that can't be
-- cleared without a doctor's written clearance on file, and injury history.
-- Visible to the team's staff, the player and their parents only.

alter table public.player_health_status
  add column injury_type    text check (injury_type in
    ('soreness', 'strain', 'sprain', 'bruise', 'fracture', 'concussion', 'illness', 'other')),
  add column body_part      text check (char_length(body_part) <= 40),
  add column side           text check (side in ('left', 'right', 'both')),
  add column started_on     date,
  -- A doctor's note / written clearance (team-docs: {org}/health/{player}/...).
  add column clearance_path text check (char_length(clearance_path) <= 300),
  add column clearance_by   uuid references public.profiles (id) on delete set null,
  add column clearance_at   timestamptz,
  add constraint player_health_full_is_clear
    check (status <> 'full' or (injury_type is null and body_part is null and clearance_path is null));

-- Past injuries, written when a player returns to Full (or the status is cleared).
create table public.player_health_history (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  player_id      uuid not null references public.profiles (id) on delete cascade,
  status         public.health_status not null,
  injury_type    text,
  body_part      text,
  side           text,
  reason         text,
  started_on     date,
  ended_on       date not null default current_date,
  clearance_path text,
  closed_by      uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index player_health_history_player_idx
  on public.player_health_history (org_id, player_id, ended_on desc);
alter table public.player_health_history enable row level security;

create policy "Staff, the player, and their parents see injury history"
  on public.player_health_history for select to authenticated
  using (
    private.is_org_staff(org_id)
    or (player_id = (select auth.uid()) and private.is_org_member(org_id))
    or private.is_parent_of(org_id, player_id)
  );
create policy "Staff remove a history entry"
  on public.player_health_history for delete to authenticated
  using (private.is_org_staff(org_id));

-- ------------------------------------------------------------ concussion guard
-- An active concussion can't be turned into Full, relabelled or deleted until
-- written clearance is on file. A clearance path must be a real uploaded file
-- in this player's health folder.
create function private.guard_health_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.clearance_path is not null
     and new.clearance_path is distinct from old.clearance_path then
    if new.clearance_path not like old.org_id::text || '/health/' || old.player_id::text || '/%'
       or not exists (select 1 from storage.objects o
                      where o.bucket_id = 'team-docs' and o.name = new.clearance_path) then
      raise exception 'Upload the clearance file first.' using errcode = '22023';
    end if;
  end if;
  if old.injury_type = 'concussion' and old.status <> 'full' and old.clearance_path is null
     and (tg_op = 'DELETE' or new.status = 'full' or new.injury_type is distinct from 'concussion') then
    raise exception 'A concussion needs a doctor''s written clearance on file before the player returns.'
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function private.guard_health_status() from public;

create trigger player_health_status_guard
  before update or delete on public.player_health_status
  for each row execute function private.guard_health_status();

-- ------------------------------------------------- history and family updates
create function private.on_health_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
  v_who uuid;
begin
  -- Close out an injury into history.
  if tg_op in ('UPDATE', 'DELETE') and old.status <> 'full'
     and (tg_op = 'DELETE' or new.status = 'full') then
    insert into public.player_health_history
      (org_id, player_id, status, injury_type, body_part, side, reason, started_on, clearance_path, closed_by)
    values (old.org_id, old.player_id, old.status, old.injury_type, old.body_part, old.side, old.reason,
            coalesce(old.started_on, old.updated_at::date), old.clearance_path, auth.uid());
  end if;
  if tg_op = 'DELETE' then return old; end if;

  -- Tell the player and their parents (kept vague: details are in the app).
  v_title := case
    when new.injury_type = 'concussion'
         and (tg_op = 'INSERT' or old.injury_type is distinct from 'concussion')
      then 'Concussion protocol started'
    when tg_op = 'INSERT' and new.status <> 'full'
      or tg_op = 'UPDATE' and new.status is distinct from old.status
      then case new.status when 'out' then 'Coach update: out for now'
                           when 'limited' then 'Coach update: playing with limits'
                           else 'Coach update: cleared, full go' end
    end;
  if v_title is not null then
    for v_who in
      select new.player_id
      union
      select pl.parent_id from public.parent_links pl
      where pl.org_id = new.org_id and pl.player_id = new.player_id
    loop
      perform private.notify(v_who, new.org_id, auth.uid(), 'health', v_title,
        case when new.injury_type = 'concussion' and new.status <> 'full'
          then 'A doctor''s written clearance is needed before returning. Open 9D for the steps and to upload it.'
          else 'Open 9D for the details.' end,
        '/player');
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function private.on_health_status_change() from public;

create trigger player_health_status_changed
  after insert or update or delete on public.player_health_status
  for each row execute function private.on_health_status_change();

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'announcement', 'message', 'video_reviewed', 'video_uploaded',
  'arm_pain', 'practice', 'program_assigned', 'game', 'health'
));

-- ------------------------------------------------------------ clearance upload
-- Health files: {org}/health/{player}/... readable and uploadable by staff, the
-- player and their parents.
create or replace function private.team_doc_access(p_name text, p_write boolean)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  parts text[] := string_to_array(p_name, '/');
  v_org uuid;
  v_who uuid;
begin
  if array_length(parts, 1) < 3 then return false; end if;
  begin
    v_org := parts[1]::uuid;
  exception when others then return false;
  end;
  if parts[2] = 'documents' then
    return case when p_write then private.is_org_staff(v_org) else private.is_org_member(v_org) end;
  end if;
  if array_length(parts, 1) < 4 then return false; end if;
  begin
    v_who := parts[3]::uuid;
  exception when others then return false;
  end;
  if parts[2] = 'responses' then
    return private.is_org_staff(v_org) and not p_write
        or (v_who = (select auth.uid()) and private.is_org_member(v_org))
        or private.is_parent_of(v_org, v_who)
        or (p_write and private.is_org_staff(v_org) and v_who = (select auth.uid()));
  end if;
  if parts[2] = 'credentials' then
    return (v_who = (select auth.uid()) and private.is_org_staff(v_org))
        or (not p_write and private.has_org_role(v_org, array['admin']::public.org_role[]));
  end if;
  if parts[2] = 'health' then
    return (private.is_org_staff(v_org) and private.is_player_in_org(v_org, v_who))
        or (v_who = (select auth.uid()) and private.is_org_member(v_org))
        or private.is_parent_of(v_org, v_who);
  end if;
  return false;
end;
$$;

-- Staff, the player or a parent attaches the doctor's note to the current injury.
create function public.submit_health_clearance(p_org uuid, p_player uuid, p_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_staff boolean := private.is_org_staff(p_org);
  v_name text;
  v_coach uuid;
begin
  if not (v_staff or (p_player = auth.uid() and private.is_org_member(p_org))
          or private.is_parent_of(p_org, p_player)) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  update public.player_health_status
     set clearance_path = p_path, clearance_by = auth.uid(), clearance_at = now()
   where org_id = p_org and player_id = p_player and status <> 'full';
  if not found then raise exception 'There''s no open injury to attach this to.'; end if;
  if not v_staff then
    select coalesce(nullif(full_name, ''), email) into v_name from public.profiles where id = p_player;
    for v_coach in select profile_id from public.org_memberships
                   where org_id = p_org and role in ('admin', 'coach', 'trainer') loop
      perform private.notify(v_coach, p_org, auth.uid(), 'health',
        'Doctor''s note uploaded for ' || v_name, 'Review it and update their status.',
        '/throwing/' || p_player::text);
    end loop;
  end if;
end;
$$;
revoke all on function public.submit_health_clearance(uuid, uuid, text) from public;
grant execute on function public.submit_health_clearance(uuid, uuid, text) to authenticated;
