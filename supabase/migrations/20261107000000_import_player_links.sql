alter table public.team_import_rows drop constraint team_import_rows_source_check;
alter table public.team_import_rows add constraint team_import_rows_source_check check(source in ('sheets','excel','gamechanger','leagueapps','other'));
create or replace function public.import_team_rows(p_org uuid, p_kind text, p_source text, p_season text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row jsonb; v_id uuid; v_game uuid; v_saved integer := 0; v_skipped integer := 0; v_values jsonb; v_group uuid; v_matches integer;
begin
  if not private.has_org_role(p_org, array['admin']::public.org_role[]) then raise exception 'Only team admins can import data.'; end if;
  if p_kind not in ('roster','schedule','stats') or p_source not in ('sheets','excel','gamechanger','leagueapps','other')
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
      v_group:=null;
      if nullif(trim(v_values->>'group'),'') is not null then
        select count(*)::integer,min(id::text)::uuid into v_matches,v_group from public.player_groups where org_id=p_org and lower(trim(name))=lower(trim(v_values->>'group'));
        if v_matches<>1 then raise exception 'Choose an existing roster group.';end if;
      end if;
      select id into v_game from public.games where org_id=p_org
        and lower(trim(opponent))=lower(trim(v_values->>'opponent')) and date=(v_values->>'date')::date
        and start_time is not distinct from nullif(v_values->>'time','')::time
        and home_away=(v_values->>'home_away')::public.home_away and group_id is not distinct from v_group limit 1;
      if v_game is not null then v_skipped:=v_skipped+1; continue; end if;
      insert into public.games(org_id,opponent,date,start_time,home_away,location,group_id,created_by)
        values(p_org,v_values->>'opponent',(v_values->>'date')::date,nullif(v_values->>'time','')::time,
        (v_values->>'home_away')::public.home_away,nullif(v_values->>'location',''),v_group,auth.uid()) returning id into v_game;
    end if;
    insert into public.team_import_rows(org_id,kind,source,season,identity_key,values,game_id,imported_by)
      values(p_org,p_kind,p_source,p_season,v_row->>'key',v_values,v_game,auth.uid()) returning id into v_id;
    v_saved:=v_saved+1;
  end loop;
  return jsonb_build_object('saved',v_saved,'skipped',v_skipped);
end; $$;
revoke all on function public.import_team_rows(uuid,text,text,text,jsonb) from public;
grant execute on function public.import_team_rows(uuid,text,text,text,jsonb) to authenticated;


create function public.link_imported_player(p_org uuid,p_row uuid,p_player uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v public.team_import_rows%rowtype;
begin
 if not private.has_org_role(p_org,array['admin']::public.org_role[]) or not private.is_player_in_org(p_org,p_player) then raise exception 'Choose a player on this team.';end if;
 select * into v from public.team_import_rows where id=p_row and org_id=p_org and kind='roster' for update;
 if not found then raise exception 'Imported player not found.';end if;
 if v.player_id is not null and v.player_id<>p_player then raise exception 'This import is already linked to another player.';end if;
 update public.team_import_rows set player_id=p_player where id=v.id;
 update public.team_import_rows set player_id=p_player where org_id=p_org and kind='stats' and player_id is null and source=v.source
 and ((nullif(v.values->>'external_id','') is not null and values->>'external_id'=v.values->>'external_id')
  or(season=v.season and nullif(v.values->>'external_id','') is null and nullif(values->>'external_id','') is null and lower(trim(values->>'name'))=lower(trim(v.values->>'name'))));
 update public.org_memberships set jersey_number=coalesce(jersey_number,case when v.values->>'jersey'~'^\d{1,2}$' then(v.values->>'jersey')::smallint end),
 position=coalesce(position,case when v.values->>'position'=any(array['P','C','1B','2B','SS','3B','OF','DH','UTIL']) then(v.values->>'position')::public.player_position end)
 where org_id=p_org and profile_id=p_player and role='player';
end;$$;
revoke all on function public.link_imported_player(uuid,uuid,uuid) from public;
grant execute on function public.link_imported_player(uuid,uuid,uuid) to authenticated;
