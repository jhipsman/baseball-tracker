create table public.message_templates (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
 title text not null check(char_length(title) between 1 and 140),body text not null check(char_length(body) between 1 and 5000),
 created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now()
);
alter table public.message_templates enable row level security;
create policy "Staff manage message templates" on public.message_templates for all to authenticated using(private.is_org_staff(org_id)) with check(private.is_org_staff(org_id));
alter table public.announcements add column recipient_ids uuid[], add column audience_scope text not null default 'audience' check(audience_scope in ('audience','overdue'));
create function public.announcement_recipients(p_org uuid,p_group uuid default null,p_parents boolean default true,p_scope text default 'audience')
returns table(profile_id uuid,display_name text) language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_org_staff(p_org) then raise exception 'Only staff can preview announcements.';end if;
 if p_group is not null and private.group_org_id(p_group) is distinct from p_org then raise exception 'Group not found.';end if;
 if p_scope is null or p_scope not in ('audience','overdue') or p_scope='overdue' and not private.has_org_role(p_org,array['admin']::public.org_role[]) then raise exception 'Choose an allowed audience.';end if;
 return query select m.profile_id,coalesce(p.full_name,p.email) from public.org_memberships m join public.profiles p on p.id=m.profile_id
 where m.org_id=p_org and m.status<>'inactive' and (
 m.role in ('admin','coach','trainer') or
 (m.role='player' and (p_group is null or exists(select 1 from public.player_group_members gm where gm.profile_id=m.profile_id and gm.group_id=p_group))) or
 (m.role='parent' and p_parents and (p_group is null or exists(select 1 from public.parent_links pl join public.player_group_members gm on gm.profile_id=pl.player_id where pl.org_id=p_org and pl.parent_id=m.profile_id and gm.group_id=p_group)))
 ) and (p_scope='audience' or exists(select 1 from public.team_invoices i where i.org_id=p_org and i.payer_id=m.profile_id and i.status='open' and i.due_date<current_date and i.paid_cents<i.amount_cents))
 order by coalesce(p.full_name,p.email);
end;$$;
revoke all on function public.announcement_recipients(uuid,uuid,boolean,text) from public;
grant execute on function public.announcement_recipients(uuid,uuid,boolean,text) to authenticated;
drop policy "Audience sees announcements" on public.announcements;
create policy "Audience sees announcements" on public.announcements for select to authenticated using(
 (private.is_org_staff(org_id) and(audience_scope='audience' or (recipient_ids is not null and cardinality(recipient_ids)>0 and private.has_org_role(org_id,array['admin']::public.org_role[])))) or(private.can_see_announcement(org_id,group_id,include_parents) and((recipient_ids is null and audience_scope='audience') or (select auth.uid())=any(recipient_ids))));
create or replace function private.on_announcement() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform private.notify(m.profile_id,new.org_id,new.author_id,'announcement',new.title,left(new.body,200),'/messages?a='||new.id)
 from public.org_memberships m where m.org_id=new.org_id and (new.recipient_ids is null or m.profile_id=any(new.recipient_ids)) and (
 m.role in ('admin','coach','trainer') or (m.role='player' and(new.group_id is null or exists(select 1 from public.player_group_members gm where gm.group_id=new.group_id and gm.profile_id=m.profile_id))) or
 (m.role='parent' and new.include_parents and(new.group_id is null or exists(select 1 from public.parent_links pl join public.player_group_members gm on gm.profile_id=pl.player_id where pl.org_id=new.org_id and pl.parent_id=m.profile_id and gm.group_id=new.group_id))));return new;
end;$$;

-- Keep financial-audience announcements private from staff without billing access.
drop policy "Staff post announcements" on public.announcements;
create policy "Staff post announcements" on public.announcements for insert to authenticated with check(
 author_id=(select auth.uid()) and private.is_org_staff(org_id) and(group_id is null or private.group_org_id(group_id)=org_id)
 and(audience_scope='audience' or (recipient_ids is not null and cardinality(recipient_ids)>0 and private.has_org_role(org_id,array['admin']::public.org_role[]))));
drop policy "Staff edit announcements" on public.announcements;
create policy "Staff edit announcements" on public.announcements for update to authenticated
 using(private.is_org_staff(org_id) and(audience_scope='audience' or (recipient_ids is not null and cardinality(recipient_ids)>0 and private.has_org_role(org_id,array['admin']::public.org_role[]))))
 with check(private.is_org_staff(org_id) and(group_id is null or private.group_org_id(group_id)=org_id) and(audience_scope='audience' or (recipient_ids is not null and cardinality(recipient_ids)>0 and private.has_org_role(org_id,array['admin']::public.org_role[]))));
drop policy "Staff delete announcements" on public.announcements;
create policy "Staff delete announcements" on public.announcements for delete to authenticated
 using(private.is_org_staff(org_id) and(audience_scope='audience' or (recipient_ids is not null and cardinality(recipient_ids)>0 and private.has_org_role(org_id,array['admin']::public.org_role[]))));
