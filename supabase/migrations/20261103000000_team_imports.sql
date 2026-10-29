-- Import archive: accountless roster entries and historical snapshots are distinct
-- from auth profiles and live-game-derived season totals.
create table public.team_import_rows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('roster','schedule','stats')),
  source text not null check (source in ('sheets','excel','gamechanger','other')),
  season text not null check (char_length(season) between 1 and 80),
  identity_key text not null check (char_length(identity_key) between 1 and 600),
  values jsonb not null check (jsonb_typeof(values) = 'object'),
  player_id uuid references public.profiles(id) on delete set null,
  game_id uuid references public.games(id) on delete set null,
  imported_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(org_id,kind,season,identity_key)
);
alter table public.team_import_rows enable row level security;
create policy "Staff see import archive" on public.team_import_rows for select to authenticated
  using(private.is_org_staff(org_id));
-- All mutations go through the bounded, atomic RPC below; regular clients cannot
-- overwrite an existing import or silently modify another team's archive.
create function public.import_team_rows(p_org uuid, p_kind text, p_source text, p_season text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row jsonb; v_id uuid; v_game uuid; v_saved integer := 0; v_skipped integer := 0; v_values jsonb;
begin
  if not private.has_org_role(p_org, array['admin']::public.org_role[]) then raise exception 'Only team admins can import data.'; end if;
  if p_kind not in ('roster','schedule','stats') or p_source not in ('sheets','excel','gamechanger','other')
     or p_season is null or char_length(p_season) not between 1 and 80
     or jsonb_typeof(p_rows) is distinct from 'array'
     or jsonb_array_length(p_rows) not between 1 and 1000 then raise exception 'Invalid import.'; end if;
  -- Serialize imports for this organization so duplicate checks and schedule
  -- creation remain atomic even when two admins confirm at the same time.
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 0));
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_values := v_row -> 'values';
    if jsonb_typeof(v_values) is distinct from 'object' or nullif(v_row->>'key','') is null then raise exception 'Invalid row.'; end if;
    if p_kind in ('roster','stats') and nullif(v_values->>'name','') is null then raise exception 'Player name required.'; end if;
    if p_kind = 'schedule' and (nullif(v_values->>'opponent','') is null or nullif(v_values->>'date','') is null) then raise exception 'Opponent and date required.'; end if;
    if exists(select 1 from public.team_import_rows where org_id=p_org and kind=p_kind and season=p_season and identity_key=v_row->>'key') then v_skipped:=v_skipped+1; continue; end if;
    v_game := null;
    if p_kind = 'schedule' then
      select id into v_game from public.games where org_id=p_org
        and lower(trim(opponent))=lower(trim(v_values->>'opponent')) and date=(v_values->>'date')::date
        and start_time is not distinct from nullif(v_values->>'time','')::time
        and home_away=(v_values->>'home_away')::public.home_away limit 1;
      if v_game is not null then v_skipped:=v_skipped+1; continue; end if;
      insert into public.games(org_id,opponent,date,start_time,home_away,location,created_by)
        values(p_org,v_values->>'opponent',(v_values->>'date')::date,nullif(v_values->>'time','')::time,
        (v_values->>'home_away')::public.home_away,nullif(v_values->>'location',''),auth.uid()) returning id into v_game;
    end if;
    insert into public.team_import_rows(org_id,kind,source,season,identity_key,values,game_id,imported_by)
      values(p_org,p_kind,p_source,p_season,v_row->>'key',v_values,v_game,auth.uid()) returning id into v_id;
    v_saved:=v_saved+1;
  end loop;
  return jsonb_build_object('saved',v_saved,'skipped',v_skipped);
end; $$;
revoke all on function public.import_team_rows(uuid,text,text,text,jsonb) from public;
grant execute on function public.import_team_rows(uuid,text,text,text,jsonb) to authenticated;
