-- Organizer events, shared activity projection, RSVP and audited bulk changes.
alter table public.practice_plans add column canceled boolean not null default false;
create table public.team_events (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid references public.player_groups(id) on delete set null,
  title text not null check(char_length(title) between 1 and 120),
  event_type text not null default 'other' check(event_type in ('meeting','training','tryout','social','other')),
  date date not null, start_time time, duration_minutes integer not null default 60 check(duration_minutes between 1 and 720),
  location text check(char_length(location)<=200), notes text check(char_length(notes)<=4000),
  published boolean not null default true, canceled boolean not null default false, series_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index team_events_org_date_idx on public.team_events(org_id,date);
create index team_events_series_idx on public.team_events(series_id) where series_id is not null;
create trigger team_events_updated before update on public.team_events for each row execute function private.set_updated_at();
alter table public.team_events enable row level security;
create policy "Activity audience sees team events" on public.team_events for select to authenticated
 using(private.is_org_staff(org_id) or (published and private.can_see_announcement(org_id,group_id,true)));
-- RPCs are the only writers, so series creation and bulk changes are atomic.
create view public.schedule_activities with(security_invoker=true) as
 select g.id,g.org_id,'game'::text kind,g.group_id,('vs '||g.opponent)::text title,g.date,g.start_time,
  120::integer duration_minutes,g.location,true published,g.status::text state,g.updated_at,null::uuid series_id
 from public.games g
 where exists(select 1 from public.organizations o where o.id=g.org_id and 'games'=any(o.modules))
 union all
 select p.id,p.org_id,'practice'::text,p.group_id,p.title,p.date,p.start_time,
  greatest(1,coalesce((select sum(b.duration_min)::integer from public.practice_blocks b where b.plan_id=p.id),60)),
  p.location,p.published,case when p.canceled then 'canceled' when not p.published then 'draft' else 'scheduled' end,p.updated_at,null::uuid
 from public.practice_plans p where not p.is_template and p.date is not null
 and exists(select 1 from public.organizations o where o.id=p.org_id and 'practices'=any(o.modules))
 union all
 select e.id,e.org_id,'event'::text,e.group_id,e.title,e.date,e.start_time,e.duration_minutes,e.location,e.published,
  case when e.canceled then 'canceled' when not e.published then 'draft' else 'scheduled' end,e.updated_at,e.series_id
 from public.team_events e;
grant select on public.schedule_activities to authenticated;

create table public.activity_attendance (
 org_id uuid not null references public.organizations(id) on delete cascade,
 kind text not null check(kind in ('game','practice','event')), activity_id uuid not null,
 player_id uuid not null references public.profiles(id) on delete cascade,
 response text not null default 'unanswered' check(response in ('unanswered','yes','no','maybe')),
 checked_in boolean not null default false, updated_by uuid references public.profiles(id) on delete set null,
 updated_at timestamptz not null default now(), primary key(kind,activity_id,player_id)
);
create index activity_attendance_org_idx on public.activity_attendance(org_id,activity_id);
alter table public.activity_attendance enable row level security;
create policy "Staff and families see attendance" on public.activity_attendance for select to authenticated
 using(private.is_org_staff(org_id) or (private.is_org_member(org_id) and (player_id=(select auth.uid()) or private.is_parent_of(org_id,player_id))));

create table public.schedule_changes (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
 actor_id uuid references public.profiles(id) on delete set null,action text not null,
 before_data jsonb not null,after_data jsonb,notified boolean not null,created_at timestamptz not null default now()
);
alter table public.schedule_changes enable row level security;
create policy "Staff see schedule audit" on public.schedule_changes for select to authenticated using(private.is_org_staff(org_id));

-- Existing game/practice triggers keep working outside organizer bulk operations.
create or replace function private.notify(p_profile uuid,p_org uuid,p_actor uuid,p_kind text,p_title text,p_body text,p_href text)
returns void language sql security definer set search_path='' as $$
 insert into public.notifications(profile_id,org_id,actor_id,kind,title,body,href)
 select p_profile,p_org,p_actor,p_kind,left(p_title,200),left(p_body,500),p_href
 where p_profile is distinct from p_actor and not(
   coalesce(current_setting('app.suppress_schedule_notifications',true),'false')='true' and p_kind in ('practice','game','announcement'));
$$;
create function private.notify_activity(p_org uuid,p_group uuid,p_title text,p_body text,p_href text)
returns void language sql security definer set search_path='' as $$
 select private.notify(m.profile_id,p_org,auth.uid(),'announcement',p_title,p_body,p_href)
 from public.org_memberships m where m.org_id=p_org and m.status<>'inactive' and (
 m.role in ('admin','coach','trainer') or p_group is null or
 (m.role='player' and exists(select 1 from public.player_group_members gm where gm.group_id=p_group and gm.profile_id=m.profile_id)) or
 (m.role='parent' and exists(select 1 from public.parent_links pl join public.player_group_members gm on gm.profile_id=pl.player_id
  where pl.org_id=p_org and pl.parent_id=m.profile_id and gm.group_id=p_group)));
$$;

create function public.create_team_events(p_org uuid,p_event jsonb,p_count integer default 1,p_notify boolean default true)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_first uuid;v_id uuid;v_series uuid;v_group uuid;v_date date;v_i integer;v_count integer;
begin
 if not private.is_org_staff(p_org) then raise exception 'Only staff can create events.';end if;
 if p_count is null or p_count not between 1 and 26 or jsonb_typeof(p_event) is distinct from 'object' then raise exception 'Invalid event.';end if;
 v_group:=nullif(p_event->>'group_id','')::uuid;
 if v_group is not null and private.group_org_id(v_group) is distinct from p_org then raise exception 'Choose a group from this organization.';end if;
 v_date:=(p_event->>'date')::date;
 if v_date is null or nullif(trim(p_event->>'title'),'') is null then raise exception 'Choose a title and date.';end if;
 if p_count>1 then v_series:=gen_random_uuid();end if;
 for v_i in 0..p_count-1 loop
  insert into public.team_events(org_id,group_id,title,event_type,date,start_time,duration_minutes,location,notes,published,series_id,created_by)
  values(p_org,v_group,trim(p_event->>'title'),coalesce(p_event->>'event_type','other'),v_date+v_i*7,
   nullif(p_event->>'start_time','')::time,coalesce((p_event->>'duration_minutes')::integer,60),nullif(p_event->>'location',''),
   nullif(p_event->>'notes',''),coalesce((p_event->>'published')::boolean,true),v_series,auth.uid()) returning id into v_id;
  if v_first is null then v_first:=v_id;end if;
 end loop;
 if p_notify and coalesce((p_event->>'published')::boolean,true) then
  perform private.notify_activity(p_org,v_group,trim(p_event->>'title'),
   case when p_count>1 then p_count||' weekly events starting ' else 'Event on ' end||v_date::text,'/events/event/'||v_first);
 end if;
 return v_first;
end;$$;

create function public.update_schedule_activities(p_org uuid,p_items jsonb,p_action text,p_days integer default 0,p_time text default null,p_location text default null,p_notify boolean default true)
returns integer language plpgsql security definer set search_path='' as $$
declare v_item jsonb;v_old record;v_new jsonb;v_date date;v_time time;v_location text;v_n integer:=0;v_seen text[]:='{}';v_key text;
begin
 if not private.is_org_staff(p_org) then raise exception 'Only staff can change schedules.';end if;
 if p_action is null or p_action not in ('reschedule','cancel','restore','delete') or p_days is null or abs(p_days)>365
  or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid schedule change.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text,0));
 perform set_config('app.suppress_schedule_notifications','true',true);
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_key:=(v_item->>'kind')||':'||(v_item->>'id');
  if v_key=any(v_seen) then raise exception 'An activity was selected twice.';end if;v_seen:=array_append(v_seen,v_key);
  -- Lock source rows before checking the last-seen version.
  if v_item->>'kind'='game' then perform 1 from public.games where id=(v_item->>'id')::uuid and org_id=p_org for update;
  elsif v_item->>'kind'='practice' then perform 1 from public.practice_plans where id=(v_item->>'id')::uuid and org_id=p_org for update;
  elsif v_item->>'kind'='event' then perform 1 from public.team_events where id=(v_item->>'id')::uuid and org_id=p_org for update;
  else raise exception 'Invalid activity type.';end if;
  select * into v_old from public.schedule_activities where id=(v_item->>'id')::uuid and kind=v_item->>'kind' and org_id=p_org;
  if not found then raise exception 'Activity not found or feature unavailable.';end if;
  if (v_item->>'updatedAt')::timestamptz is distinct from v_old.updated_at then raise exception 'The schedule changed. Refresh before confirming.';end if;
  if v_old.kind='game' and v_old.state not in ('scheduled','canceled','postponed') then raise exception 'Live and completed games cannot be bulk changed.';end if;
  if p_action='delete' and v_old.kind='game' and exists(select 1 from public.game_plays where game_id=v_old.id) then raise exception 'Scored games cannot be deleted here.';end if;
  v_date:=v_old.date+case when p_action='reschedule' then p_days else 0 end;
  v_time:=case when p_action='reschedule' and p_time is not null then nullif(p_time,'')::time else v_old.start_time end;
  v_location:=case when p_action='reschedule' and p_location is not null then nullif(trim(p_location),'') else v_old.location end;
  if char_length(v_location)>200 then raise exception 'Location is too long.';end if;
  if p_action='delete' then
   if v_old.kind='game' then delete from public.games where id=v_old.id;
   elsif v_old.kind='practice' then delete from public.practice_plans where id=v_old.id;
   else delete from public.team_events where id=v_old.id;end if;
   delete from public.activity_attendance where kind=v_old.kind and activity_id=v_old.id;
   v_new:=null;
  else
   if v_old.kind='game' then update public.games set date=v_date,start_time=v_time,location=v_location,
    status=case when p_action='cancel' then 'canceled'::public.game_status when p_action='restore' then 'scheduled'::public.game_status else status end where id=v_old.id;
   elsif v_old.kind='practice' then update public.practice_plans set date=v_date,start_time=v_time,location=v_location,
    canceled=case when p_action='cancel' then true when p_action='restore' then false else canceled end where id=v_old.id;
   else update public.team_events set date=v_date,start_time=v_time,location=v_location,
    canceled=case when p_action='cancel' then true when p_action='restore' then false else canceled end where id=v_old.id;end if;
   select to_jsonb(a) into v_new from public.schedule_activities a where id=v_old.id and kind=v_old.kind;
  end if;
  insert into public.schedule_changes(org_id,actor_id,action,before_data,after_data,notified)
   values(p_org,auth.uid(),p_action,to_jsonb(v_old),v_new,p_notify and v_old.published);
  if p_notify and v_old.published then
   perform set_config('app.suppress_schedule_notifications','false',true);
   perform private.notify_activity(p_org,v_old.group_id,initcap(p_action)||': '||v_old.title,
    case when p_action='reschedule' then 'Now '||v_date::text||coalesce(' at '||to_char(v_time,'HH24:MI'),'')||coalesce(' · '||v_location,'') else 'Your team schedule has changed.' end,
    case when p_action='delete' then '/events' else '/events/'||v_old.kind||'/'||v_old.id end);
   perform set_config('app.suppress_schedule_notifications','true',true);
  end if;
  v_n:=v_n+1;
 end loop;
 perform set_config('app.suppress_schedule_notifications','false',true);
 return v_n;
end;$$;

create function public.respond_activity(p_org uuid,p_kind text,p_activity uuid,p_player uuid,p_response text default null,p_check_in boolean default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_activity record;v_staff boolean:=private.is_org_staff(p_org);
begin
 select * into v_activity from public.schedule_activities where id=p_activity and kind=p_kind and org_id=p_org;
 if not found or v_activity.state in ('canceled','postponed') or (not v_staff and not v_activity.published) then raise exception 'This activity is not open for responses.';end if;
 if not exists(select 1 from public.org_memberships where org_id=p_org and profile_id=p_player and role='player'
  and (v_activity.group_id is null or exists(select 1 from public.player_group_members where group_id=v_activity.group_id and profile_id=p_player))) then raise exception 'Player is not on this activity roster.';end if;
 if not v_staff and not(private.is_org_member(p_org) and (p_player=auth.uid() or private.is_parent_of(p_org,p_player))) then raise exception 'You cannot respond for this player.';end if;
 if p_check_in is not null and not v_staff then raise exception 'Only staff can check players in.';end if;
 if p_response is not null and p_response not in ('yes','no','maybe','unanswered') then raise exception 'Choose an RSVP.';end if;
 insert into public.activity_attendance(org_id,kind,activity_id,player_id,response,checked_in,updated_by)
 values(p_org,p_kind,p_activity,p_player,coalesce(p_response,'unanswered'),coalesce(p_check_in,false),auth.uid())
 on conflict(kind,activity_id,player_id) do update set response=coalesce(p_response,activity_attendance.response),
 checked_in=coalesce(p_check_in,activity_attendance.checked_in),updated_by=auth.uid(),updated_at=now();
end;$$;
revoke all on function public.create_team_events(uuid,jsonb,integer,boolean) from public;
revoke all on function public.update_schedule_activities(uuid,jsonb,text,integer,text,text,boolean) from public;
revoke all on function public.respond_activity(uuid,text,uuid,uuid,text,boolean) from public;
grant execute on function public.create_team_events(uuid,jsonb,integer,boolean),public.update_schedule_activities(uuid,jsonb,text,integer,text,text,boolean),public.respond_activity(uuid,text,uuid,uuid,text,boolean) to authenticated;

revoke all on function private.notify_activity(uuid,uuid,text,text,text) from public;

create function public.edit_team_event(p_org uuid,p_id uuid,p_updated timestamptz,p_event jsonb,p_following boolean default false,p_notify boolean default true)
returns integer language plpgsql security definer set search_path='' as $$
declare v public.team_events%rowtype;r public.team_events%rowtype;v_group uuid;v_days integer;v_count integer:=0;
begin
 if not private.is_org_staff(p_org) then raise exception 'Only staff can edit team events.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text,0));
 select * into v from public.team_events where id=p_id and org_id=p_org for update;
 if not found or v.updated_at is distinct from p_updated then raise exception 'The event changed. Refresh before saving.';end if;
 v_group:=nullif(p_event->>'group_id','')::uuid;
 if v_group is not null and private.group_org_id(v_group) is distinct from p_org then raise exception 'Group not found.';end if;
 v_days:=(p_event->>'date')::date-v.date;
 if v_days is null or abs(v_days)>365 then raise exception 'Choose a date within one year of this event.';end if;
 for r in select * from public.team_events where org_id=p_org and(id=v.id or(p_following and v.series_id is not null and series_id=v.series_id and date>=v.date)) order by date for update loop
  update public.team_events set title=trim(p_event->>'title'),event_type=p_event->>'event_type',date=r.date+v_days,
   start_time=nullif(p_event->>'start_time','')::time,duration_minutes=(p_event->>'duration_minutes')::integer,
   location=nullif(p_event->>'location',''),notes=nullif(p_event->>'notes',''),group_id=v_group,published=(p_event->>'published')::boolean
   where id=r.id;
  insert into public.schedule_changes(org_id,actor_id,action,before_data,after_data,notified)
   select p_org,auth.uid(),'edit',to_jsonb(r),to_jsonb(e),p_notify and(e.published or r.published) from public.team_events e where e.id=r.id;
  v_count:=v_count+1;
 end loop;
 if p_notify then
  if (p_event->>'published')::boolean then perform private.notify_activity(p_org,v_group,'Updated: '||trim(p_event->>'title'),v_count||' team activities updated. Open your schedule for details.','/events');end if;
  if v.published and(v_group is distinct from v.group_id or not(p_event->>'published')::boolean) then
   perform private.notify_activity(p_org,v.group_id,'Schedule update: '||v.title,'This activity’s availability has changed. Check your team schedule.','/events');
  end if;
 end if;return v_count;
end;$$;
revoke all on function public.edit_team_event(uuid,uuid,timestamptz,jsonb,boolean,boolean) from public;
grant execute on function public.edit_team_event(uuid,uuid,timestamptz,jsonb,boolean,boolean) to authenticated;
