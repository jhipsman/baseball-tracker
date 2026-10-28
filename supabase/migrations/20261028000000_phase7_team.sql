-- =============================================================================
-- Phase 7: parents, messaging, notifications, practice plans, tracking types
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Parents: linked to one or more players in an org (read-only access to them)
-- -----------------------------------------------------------------------------

create table public.parent_links (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  parent_id   uuid not null references public.profiles (id) on delete cascade,
  player_id   uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (org_id, parent_id, player_id),
  check (parent_id <> player_id)
);

create index parent_links_player_idx on public.parent_links (org_id, player_id);

-- Parent invitations name the player they're for.
alter table public.org_invitations
  add column player_id uuid references public.profiles (id) on delete cascade;
alter table public.org_invitations
  add constraint org_invitations_parent_player check ((role = 'parent') = (player_id is not null));

-- True when the current user is a parent member of p_org_id linked to p_player_id,
-- and that player is still on the team.
create or replace function private.is_parent_of(p_org_id uuid, p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.parent_links pl
    where pl.org_id = p_org_id
      and pl.parent_id = (select auth.uid())
      and pl.player_id = p_player_id
  )
  and private.has_org_role(p_org_id, array['parent']::public.org_role[])
  and private.is_player_in_org(p_org_id, p_player_id);
$$;

-- True when the current user is a parent of any player in the group.
create or replace function private.is_parent_in_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.player_group_members gm
    join public.player_groups g on g.id = gm.group_id
    where gm.group_id = p_group_id
      and private.is_parent_of(g.org_id, gm.profile_id)
  );
$$;

create or replace function private.is_in_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.player_group_members
    where group_id = p_group_id and profile_id = (select auth.uid())
  );
$$;

alter table public.parent_links enable row level security;

create policy "Staff, the parent, and the player see links"
  on public.parent_links for select to authenticated
  using (
    private.is_org_staff(org_id)
    or (parent_id = (select auth.uid()) and private.is_org_member(org_id))
    or (player_id = (select auth.uid()) and private.is_org_member(org_id))
  );

create policy "Staff remove parent links"
  on public.parent_links for delete to authenticated
  using (private.is_org_staff(org_id));

-- Staff (not only admins) can invite parents; players can invite their own parents.
create policy "Staff and players invite parents"
  on public.org_invitations for insert to authenticated
  with check (
    role = 'parent'
    and invited_by = (select auth.uid())
    and accepted_at is null
    and private.is_player_in_org(org_id, player_id)
    and (private.is_org_staff(org_id) or player_id = (select auth.uid()))
  );

create policy "Staff and players see parent invitations"
  on public.org_invitations for select to authenticated
  using (
    role = 'parent'
    and (private.is_org_staff(org_id) or player_id = (select auth.uid()))
  );

create policy "Staff and inviting players revoke parent invitations"
  on public.org_invitations for delete to authenticated
  using (
    role = 'parent'
    and accepted_at is null
    and (private.is_org_staff(org_id) or invited_by = (select auth.uid()))
  );

-- Accepting a parent invitation also links the parent to the player.
create or replace function public.accept_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.org_invitations;
  v_existing public.org_role;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_inv from public.org_invitations where token = p_token for update;

  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  elsif v_inv.accepted_at is not null then
    raise exception 'Invitation has already been used' using errcode = 'P0001';
  elsif v_inv.expires_at < now() then
    raise exception 'Invitation has expired' using errcode = 'P0001';
  elsif v_inv.email is distinct from private.current_verified_email() then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;

  if v_inv.role = 'parent' then
    select role into v_existing from public.org_memberships
    where org_id = v_inv.org_id and profile_id = v_uid;
    if v_existing is not null and v_existing <> 'parent' then
      raise exception 'You are already on this team as a % and can''t also join as a parent', v_existing
        using errcode = 'P0001';
    end if;
    if not private.is_player_in_org(v_inv.org_id, v_inv.player_id) then
      raise exception 'That player is no longer on this team' using errcode = 'P0001';
    end if;
  end if;

  insert into public.org_memberships (org_id, profile_id, role)
  values (v_inv.org_id, v_uid, v_inv.role)
  on conflict (org_id, profile_id) do nothing;

  if v_inv.role = 'parent' then
    insert into public.parent_links (org_id, parent_id, player_id)
    values (v_inv.org_id, v_uid, v_inv.player_id)
    on conflict do nothing;
  end if;

  update public.org_invitations
  set accepted_at = now(), accepted_by = v_uid
  where id = v_inv.id;

  return v_inv.org_id;
end;
$$;

-- get_invitation also says which player a parent invite is for.
drop function if exists public.get_invitation(uuid);
create function public.get_invitation(p_token uuid)
returns table (
  org_name text,
  role public.org_role,
  email text,
  is_expired boolean,
  is_accepted boolean,
  email_matches boolean,
  player_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name,
         i.role,
         i.email,
         i.expires_at < now(),
         i.accepted_at is not null,
         i.email = private.current_verified_email(),
         coalesce(p.full_name, p.email)
  from public.org_invitations i
  join public.organizations o on o.id = i.org_id
  left join public.profiles p on p.id = i.player_id
  where i.token = p_token;
$$;
revoke execute on function public.get_invitation(uuid) from public, anon;
grant execute on function public.get_invitation(uuid) to authenticated;

-- ---- Parent read access to their child's data (read-only, additive policies)

create or replace function private.can_view_program(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_org_staff(private.program_org_id(p_program_id))
      or exists (
        select 1 from public.program_assignments a
        where a.program_id = p_program_id
          and (
            a.player_id = (select auth.uid())
            or private.is_parent_of(private.program_org_id(p_program_id), a.player_id)
          )
      );
$$;

create policy "Parents view their child's programs"
  on public.programs for select to authenticated
  using (
    exists (
      select 1 from public.program_assignments a
      where a.program_id = programs.id and private.is_parent_of(programs.org_id, a.player_id)
    )
  );

create policy "Parents view their child's assignments"
  on public.program_assignments for select to authenticated
  using (private.is_parent_of(private.program_org_id(program_id), player_id));

create policy "Parents view their child's workouts"
  on public.workout_logs for select to authenticated
  using (private.is_parent_of(private.assignment_org_id(program_assignment_id), player_id));

create or replace function private.can_view_workout_log(p_log_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workout_logs l
    where l.id = p_log_id
      and (
        l.player_id = (select auth.uid())
        or private.is_org_staff(private.assignment_org_id(l.program_assignment_id))
        or private.is_parent_of(private.assignment_org_id(l.program_assignment_id), l.player_id)
      )
  );
$$;

create policy "Parents view their child's assessments"
  on public.assessments for select to authenticated
  using (private.is_parent_of(org_id, player_id));

create policy "Parents view their child's throwing"
  on public.throwing_logs for select to authenticated
  using (private.is_parent_of(org_id, player_id));

-- Parents can log an arm check-in or a game pitch count for their child.
create policy "Parents log their child's throwing"
  on public.throwing_logs for insert to authenticated
  with check (logged_by = (select auth.uid()) and private.is_parent_of(org_id, player_id));

-- Parents see reviewed videos only (feedback is the point; drafts stay with the coach).
create policy "Parents view their child's reviewed videos"
  on public.videos for select to authenticated
  using (status = 'reviewed' and private.is_parent_of(org_id, player_id));

create or replace function private.can_see_video_feedback(p_video_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.videos v
    where v.id = p_video_id
      and (
        private.is_org_staff(v.org_id)
        or (v.status = 'reviewed' and (
              (v.player_id = (select auth.uid()) and private.is_org_member(v.org_id))
              or private.is_parent_of(v.org_id, v.player_id)
            ))
      )
  );
$$;

create or replace function private.can_read_video_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[] := string_to_array(p_name, '/');
  v_org uuid;
  v_player uuid;
begin
  if array_length(parts, 1) <> 4 then
    return false;
  end if;
  begin
    v_org := parts[1]::uuid;
    v_player := parts[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return private.is_org_staff(v_org)
    or (v_player = (select auth.uid()) and private.is_org_member(v_org))
    or private.is_parent_of(v_org, v_player);
end;
$$;

-- -----------------------------------------------------------------------------
-- Notifications (in-app; push delivery reads unpushed rows server-side)
-- -----------------------------------------------------------------------------

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  kind        text not null check (kind in (
                'announcement', 'message', 'video_reviewed', 'video_uploaded',
                'arm_pain', 'practice', 'program_assigned'
              )),
  title       text not null check (char_length(title) between 1 and 200),
  body        text check (char_length(body) <= 500),
  href        text check (href like '/%'),
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  pushed_at   timestamptz
);

create index notifications_profile_created_idx on public.notifications (profile_id, created_at desc);
create index notifications_unpushed_idx on public.notifications (created_at) where pushed_at is null;

alter table public.notifications enable row level security;

create policy "Users see their notifications"
  on public.notifications for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "Users mark their notifications read"
  on public.notifications for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "Users delete their notifications"
  on public.notifications for delete to authenticated
  using (profile_id = (select auth.uid()));

-- Only triggers create notifications.
create or replace function private.notify(
  p_profile uuid, p_org uuid, p_actor uuid, p_kind text, p_title text, p_body text, p_href text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (profile_id, org_id, actor_id, kind, title, body, href)
  select p_profile, p_org, p_actor, p_kind, left(p_title, 200), left(p_body, 500), p_href
  where p_profile is distinct from p_actor;
$$;

create or replace function private.notify_staff(
  p_org uuid, p_actor uuid, p_kind text, p_title text, p_body text, p_href text
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.notify(m.profile_id, p_org, p_actor, p_kind, p_title, p_body, p_href)
  from public.org_memberships m
  where m.org_id = p_org and m.role in ('admin', 'coach', 'trainer');
$$;

create or replace function private.notify_parents(
  p_org uuid, p_player uuid, p_actor uuid, p_kind text, p_title text, p_body text, p_href text
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.notify(pl.parent_id, p_org, p_actor, p_kind, p_title, p_body, p_href)
  from public.parent_links pl
  join public.org_memberships m
    on m.org_id = pl.org_id and m.profile_id = pl.parent_id and m.role = 'parent'
  where pl.org_id = p_org and pl.player_id = p_player;
$$;

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

create policy "Users manage their push subscriptions"
  on public.push_subscriptions for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- Notification preferences: kinds a user has muted for push (in-app still shows them).
alter table public.profiles
  add column push_muted text[] not null default '{}';

-- -----------------------------------------------------------------------------
-- Announcements (team or group; optionally copied to parents)
-- -----------------------------------------------------------------------------

create table public.announcements (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  group_id         uuid references public.player_groups (id) on delete cascade,
  author_id        uuid references public.profiles (id) on delete set null,
  title            text not null check (char_length(title) between 1 and 140),
  body             text not null check (char_length(body) between 1 and 5000),
  include_parents  boolean not null default true,
  pinned           boolean not null default false,
  created_at       timestamptz not null default now()
);

create index announcements_org_created_idx on public.announcements (org_id, created_at desc);

create table public.announcement_reads (
  announcement_id  uuid not null references public.announcements (id) on delete cascade,
  profile_id       uuid not null references public.profiles (id) on delete cascade,
  read_at          timestamptz not null default now(),
  primary key (announcement_id, profile_id)
);

create or replace function private.can_see_announcement(p_org uuid, p_group uuid, p_parents boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_org_staff(p_org)
    or (private.has_org_role(p_org, array['player']::public.org_role[])
        and (p_group is null or private.is_in_group(p_group)))
    or (p_parents and private.has_org_role(p_org, array['parent']::public.org_role[])
        and (p_group is null or private.is_parent_in_group(p_group)));
$$;

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

create policy "Audience sees announcements"
  on public.announcements for select to authenticated
  using (private.can_see_announcement(org_id, group_id, include_parents));

create policy "Staff post announcements"
  on public.announcements for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and private.is_org_staff(org_id)
    and (group_id is null or private.group_org_id(group_id) = org_id)
  );

create policy "Staff edit announcements"
  on public.announcements for update to authenticated
  using (private.is_org_staff(org_id))
  with check (private.is_org_staff(org_id) and (group_id is null or private.group_org_id(group_id) = org_id));

create policy "Staff delete announcements"
  on public.announcements for delete to authenticated
  using (private.is_org_staff(org_id));

create policy "Readers record reads; staff see who read"
  on public.announcement_reads for select to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (
      select 1 from public.announcements a
      where a.id = announcement_id and private.is_org_staff(a.org_id)
    )
  );

create policy "Readers mark announcements read"
  on public.announcement_reads for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (select 1 from public.announcements a where a.id = announcement_id)
  );

create or replace function private.on_announcement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(m.profile_id, new.org_id, new.author_id, 'announcement',
                         new.title, left(new.body, 200), '/messages?a=' || new.id)
  from public.org_memberships m
  where m.org_id = new.org_id
    and (
      m.role in ('admin', 'coach', 'trainer')
      or (m.role = 'player' and (new.group_id is null or exists (
            select 1 from public.player_group_members gm
            where gm.group_id = new.group_id and gm.profile_id = m.profile_id)))
      or (m.role = 'parent' and new.include_parents and (new.group_id is null or exists (
            select 1 from public.parent_links pl
            join public.player_group_members gm on gm.profile_id = pl.player_id
            where pl.org_id = new.org_id and pl.parent_id = m.profile_id
              and gm.group_id = new.group_id)))
    );
  return new;
end;
$$;

create trigger announcements_notify
  after insert on public.announcements
  for each row execute function private.on_announcement();

-- -----------------------------------------------------------------------------
-- Message threads (coach <-> player/parent; parents copied on player threads)
-- -----------------------------------------------------------------------------

create table public.threads (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  created_by       uuid references public.profiles (id) on delete set null,
  subject          text check (char_length(subject) <= 140),
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz not null default now()
);

create table public.thread_members (
  thread_id     uuid not null references public.threads (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  last_read_at  timestamptz,
  primary key (thread_id, profile_id)
);

create index thread_members_profile_idx on public.thread_members (profile_id);

create table public.thread_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.threads (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null,
  body        text not null check (char_length(body) between 1 and 4000),
  created_at  timestamptz not null default now()
);

create index thread_messages_thread_created_idx on public.thread_messages (thread_id, created_at);

create or replace function private.is_thread_member(p_thread uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.thread_members tm
    join public.threads t on t.id = tm.thread_id
    where tm.thread_id = p_thread
      and tm.profile_id = (select auth.uid())
      and private.is_org_member(t.org_id)
  );
$$;

alter table public.threads enable row level security;
alter table public.thread_members enable row level security;
alter table public.thread_messages enable row level security;

create policy "Members see their threads"
  on public.threads for select to authenticated
  using (private.is_thread_member(id));

create policy "Members see who is in their threads"
  on public.thread_members for select to authenticated
  using (private.is_thread_member(thread_id));

create policy "Members update their read marker"
  on public.thread_members for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "Members read messages"
  on public.thread_messages for select to authenticated
  using (private.is_thread_member(thread_id));

create policy "Members post messages"
  on public.thread_messages for insert to authenticated
  with check (author_id = (select auth.uid()) and private.is_thread_member(thread_id));

-- Starts a thread. Rules (youth-sports safeguarding):
--   * everyone must be on the team;
--   * a thread needs at least one coach/trainer/admin in it (no player-to-player DMs);
--   * linked parents of every player in the thread are added automatically.
create or replace function public.start_thread(
  p_org_id uuid, p_member_ids uuid[], p_subject text, p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_members uuid[];
  v_thread uuid;
begin
  if v_uid is null or not private.is_org_member(p_org_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if coalesce(char_length(trim(p_body)), 0) = 0 then
    raise exception 'Write a message first' using errcode = '22023';
  end if;

  select array_agg(distinct x) into v_members
  from unnest(array_append(coalesce(p_member_ids, '{}'), v_uid)) x;

  if array_length(v_members, 1) < 2 then
    raise exception 'Choose who to message' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_members) x
    where not exists (select 1 from public.org_memberships m where m.org_id = p_org_id and m.profile_id = x)
  ) then
    raise exception 'Everyone in a conversation must be on the team' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.org_memberships m
    where m.org_id = p_org_id and m.profile_id = any (v_members)
      and m.role in ('admin', 'coach', 'trainer')
  ) then
    raise exception 'Conversations must include a coach' using errcode = '42501';
  end if;

  -- Copy parents of any player in the thread.
  select array_agg(distinct x) into v_members
  from (
    select unnest(v_members) x
    union
    select pl.parent_id
    from public.parent_links pl
    join public.org_memberships pm
      on pm.org_id = pl.org_id and pm.profile_id = pl.parent_id and pm.role = 'parent'
    where pl.org_id = p_org_id and pl.player_id = any (v_members)
  ) s;

  insert into public.threads (org_id, created_by, subject)
  values (p_org_id, v_uid, nullif(left(trim(coalesce(p_subject, '')), 140), ''))
  returning id into v_thread;

  insert into public.thread_members (thread_id, profile_id, last_read_at)
  select v_thread, x, case when x = v_uid then now() end from unnest(v_members) x;

  insert into public.thread_messages (thread_id, author_id, body)
  values (v_thread, v_uid, left(trim(p_body), 4000));

  return v_thread;
end;
$$;

revoke execute on function public.start_thread(uuid, uuid[], text, text) from public, anon;
grant execute on function public.start_thread(uuid, uuid[], text, text) to authenticated;

create or replace function private.on_thread_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thread public.threads;
  v_name text;
begin
  update public.threads set last_message_at = new.created_at
  where id = new.thread_id
  returning * into v_thread;

  update public.thread_members set last_read_at = new.created_at
  where thread_id = new.thread_id and profile_id = new.author_id;

  select coalesce(full_name, email) into v_name from public.profiles where id = new.author_id;

  perform private.notify(tm.profile_id, v_thread.org_id, new.author_id, 'message',
                         coalesce(v_name, 'New message') || coalesce(': ' || v_thread.subject, ''),
                         left(new.body, 200), '/messages/' || new.thread_id)
  from public.thread_members tm
  where tm.thread_id = new.thread_id;
  return new;
end;
$$;

create trigger thread_messages_after_insert
  after insert on public.thread_messages
  for each row execute function private.on_thread_message();

-- -----------------------------------------------------------------------------
-- Notification triggers on existing tables
-- -----------------------------------------------------------------------------

create or replace function private.on_video_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if tg_op = 'INSERT' then
    if new.uploaded_by = new.player_id then
      select coalesce(full_name, email) into v_name from public.profiles where id = new.player_id;
      perform private.notify_staff(new.org_id, new.uploaded_by, 'video_uploaded',
        coalesce(v_name, 'A player') || ' uploaded a video', new.title, '/videos/' || new.id);
    end if;
  elsif new.status = 'reviewed' and old.status is distinct from 'reviewed' then
    perform private.notify(new.player_id, new.org_id, new.reviewed_by, 'video_reviewed',
      'Your coach reviewed "' || new.title || '"', new.review_summary, '/player/videos/' || new.id);
    perform private.notify_parents(new.org_id, new.player_id, new.reviewed_by, 'video_reviewed',
      'Video reviewed: ' || new.title, new.review_summary, '/parent/videos/' || new.id);
  end if;
  return new;
end;
$$;

create trigger videos_notify
  after insert or update of status on public.videos
  for each row execute function private.on_video_change();

create or replace function private.on_throwing_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if new.arm_feel = 'pain' then
    select coalesce(full_name, email) into v_name from public.profiles where id = new.player_id;
    perform private.notify_staff(new.org_id, new.logged_by, 'arm_pain',
      coalesce(v_name, 'A player') || ' reported arm pain', new.notes, '/throwing');
    perform private.notify_parents(new.org_id, new.player_id, new.logged_by, 'arm_pain',
      coalesce(v_name, 'Your player') || ' reported arm pain',
      'Talk to the coach or an athletic trainer before the next throwing session.', '/parent');
  end if;
  return new;
end;
$$;

create trigger throwing_logs_notify
  after insert on public.throwing_logs
  for each row execute function private.on_throwing_log();

create or replace function private.on_program_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program public.programs;
begin
  select * into v_program from public.programs where id = new.program_id;
  perform private.notify(new.player_id, v_program.org_id, auth.uid(), 'program_assigned',
    'New program: ' || v_program.name, 'Starts ' || to_char(new.start_date, 'Mon DD'), '/player');
  return new;
end;
$$;

create trigger program_assignments_notify
  after insert on public.program_assignments
  for each row execute function private.on_program_assigned();

-- -----------------------------------------------------------------------------
-- Practice plans
-- -----------------------------------------------------------------------------

create type public.practice_block_kind as enum (
  'warmup', 'throwing', 'defense', 'hitting', 'pitching', 'baserunning',
  'conditioning', 'team', 'other'
);

create table public.practice_plans (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  group_id     uuid references public.player_groups (id) on delete set null,
  title        text not null check (char_length(title) between 1 and 120),
  -- Templates have no date.
  is_template  boolean not null default false,
  date         date,
  start_time   time,
  location     text check (char_length(location) <= 200),
  notes        text check (char_length(notes) <= 4000),
  published    boolean not null default false,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (is_template = (date is null)),
  check (not (is_template and published))
);

create index practice_plans_org_date_idx on public.practice_plans (org_id, date);

create trigger practice_plans_set_updated_at
  before update on public.practice_plans
  for each row execute function private.set_updated_at();

create table public.practice_blocks (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.practice_plans (id) on delete cascade,
  sort_order    integer not null default 0,
  kind          public.practice_block_kind not null default 'other',
  title         text not null check (char_length(title) between 1 and 120),
  duration_min  smallint not null check (duration_min between 1 and 240),
  details       text check (char_length(details) <= 2000),
  -- Concurrent stations: [{"name": "Infield", "coach": "Coach B", "detail": "..."}]
  stations      jsonb not null default '[]'::jsonb check (jsonb_typeof(stations) = 'array')
);

create index practice_blocks_plan_idx on public.practice_blocks (plan_id, sort_order);

create or replace function private.practice_org_id(p_plan uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select org_id from public.practice_plans where id = p_plan;
$$;

create or replace function private.can_view_practice(p_plan uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.practice_plans p
    where p.id = p_plan
      and (
        private.is_org_staff(p.org_id)
        or (p.published and private.can_see_announcement(p.org_id, p.group_id, true))
      )
  );
$$;

alter table public.practice_plans enable row level security;
alter table public.practice_blocks enable row level security;

create policy "Staff see all practices; team sees published ones"
  on public.practice_plans for select to authenticated
  using (private.can_view_practice(id));

create policy "Staff manage practices"
  on public.practice_plans for all to authenticated
  using (private.is_org_staff(org_id))
  with check (
    private.is_org_staff(org_id)
    and (group_id is null or private.group_org_id(group_id) = org_id)
  );

create policy "Viewers see practice blocks"
  on public.practice_blocks for select to authenticated
  using (private.can_view_practice(plan_id));

create policy "Staff manage practice blocks"
  on public.practice_blocks for all to authenticated
  using (private.is_org_staff(private.practice_org_id(plan_id)))
  with check (private.is_org_staff(private.practice_org_id(plan_id)));

-- Atomically replace a plan's blocks (SECURITY INVOKER: RLS applies).
create or replace function public.save_practice_blocks(p_plan_id uuid, p_blocks jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.is_org_staff(private.practice_org_id(p_plan_id)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_blocks) <> 'array' then
    raise exception 'Blocks must be an array' using errcode = '22023';
  end if;

  delete from public.practice_blocks where plan_id = p_plan_id;

  insert into public.practice_blocks (plan_id, sort_order, kind, title, duration_min, details, stations)
  select p_plan_id,
         (b.ord - 1)::integer,
         coalesce((b.value ->> 'kind')::public.practice_block_kind, 'other'),
         b.value ->> 'title',
         (b.value ->> 'duration_min')::smallint,
         nullif(b.value ->> 'details', ''),
         coalesce(b.value -> 'stations', '[]'::jsonb)
  from jsonb_array_elements(p_blocks) with ordinality as b(value, ord);

  update public.practice_plans set updated_at = now() where id = p_plan_id;
end;
$$;

revoke execute on function public.save_practice_blocks(uuid, jsonb) from public, anon;
grant execute on function public.save_practice_blocks(uuid, jsonb) to authenticated;

create or replace function private.on_practice_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.published and (tg_op = 'INSERT' or not old.published) then
    perform private.notify(m.profile_id, new.org_id, auth.uid(), 'practice',
      'Practice ' || to_char(new.date, 'Dy Mon DD')
        || coalesce(' at ' || to_char(new.start_time, 'FMHH12:MI AM'), ''),
      new.title || coalesce(' · ' || new.location, ''),
      '/practices/' || new.id)
    from public.org_memberships m
    where m.org_id = new.org_id
      and (
        (m.role = 'player' and (new.group_id is null or exists (
          select 1 from public.player_group_members gm
          where gm.group_id = new.group_id and gm.profile_id = m.profile_id)))
        or (m.role = 'parent' and (new.group_id is null or exists (
          select 1 from public.parent_links pl
          join public.player_group_members gm on gm.profile_id = pl.player_id
          where pl.org_id = new.org_id and pl.parent_id = m.profile_id
            and gm.group_id = new.group_id)))
      );
  end if;
  return new;
end;
$$;

create trigger practice_plans_notify
  after insert or update of published on public.practice_plans
  for each row execute function private.on_practice_published();

-- -----------------------------------------------------------------------------
-- Exercise tracking types (time / distance for sprints and conditioning)
-- -----------------------------------------------------------------------------

create type public.tracking_type as enum (
  'weight_reps', 'reps', 'time', 'distance', 'distance_time'
);

alter table public.exercises
  add column tracking_type public.tracking_type not null default 'weight_reps';
