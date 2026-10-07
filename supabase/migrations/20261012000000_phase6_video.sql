-- =============================================================================
-- Phase 6: video upload, coach review (drawings, voice-over), AI analysis
-- =============================================================================
--
-- Files live in the private "videos" storage bucket at
--   {org_id}/{player_id}/{video_id}/{file}
-- e.g. original.mp4, thumb.jpg, breakdown-<ts>.webm. Access is checked from
-- the path, so nothing is ever public: the app hands out short-lived signed URLs.

create type public.video_type as enum (
  'hitting', 'pitching', 'fielding', 'catching', 'exercise_form', 'other'
);
create type public.video_status as enum ('pending', 'reviewed');
create type public.annotation_kind as enum (
  'note', 'line', 'arrow', 'angle', 'circle', 'freehand'
);

create table public.videos (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  player_id       uuid not null references public.profiles (id) on delete cascade,
  uploaded_by     uuid references public.profiles (id) on delete set null,
  video_type      public.video_type not null default 'other',
  title           text not null check (char_length(title) between 1 and 120),
  notes           text check (char_length(notes) <= 2000),
  storage_path    text not null,
  thumb_path      text,
  mime_type       text,
  size_bytes      bigint check (size_bytes >= 0),
  duration_s      numeric(7, 2) check (duration_s >= 0),
  status          public.video_status not null default 'pending',
  -- Written feedback sent with the review.
  review_summary  text check (char_length(review_summary) <= 5000),
  -- Narrated breakdown recording (screen + voice) in the same folder.
  breakdown_path  text,
  -- AI analysis the coach approved (and possibly edited) for the player.
  ai_summary      text check (char_length(ai_summary) <= 8000),
  reviewed_by     uuid references public.profiles (id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  check (storage_path like org_id::text || '/' || player_id::text || '/' || id::text || '/%'),
  check (thumb_path is null or thumb_path like org_id::text || '/' || player_id::text || '/' || id::text || '/%'),
  check (breakdown_path is null or breakdown_path like org_id::text || '/' || player_id::text || '/' || id::text || '/%')
);

create index videos_org_status_created_idx on public.videos (org_id, status, created_at desc);
create index videos_player_created_idx on public.videos (player_id, created_at desc);

-- Drawings and timestamped notes, stored as data so they stay editable.
-- shape: normalized 0..1 coordinates, e.g. {"points": [[0.2,0.3],[0.5,0.6]]}
-- or {"center": [0.5,0.5], "radius": 0.1}.
create table public.video_annotations (
  id          uuid primary key default gen_random_uuid(),
  video_id    uuid not null references public.videos (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null,
  t_seconds   numeric(7, 2) not null check (t_seconds >= 0),
  kind        public.annotation_kind not null,
  shape       jsonb check (shape is null or jsonb_typeof(shape) = 'object'),
  color       text check (color ~ '^#[0-9a-fA-F]{6}$'),
  comment     text check (char_length(comment) <= 1000),
  created_at  timestamptz not null default now(),
  check (kind = 'note' or shape is not null),
  check (kind <> 'note' or char_length(coalesce(comment, '')) > 0)
);

create index video_annotations_video_idx on public.video_annotations (video_id, t_seconds);

-- AI drafts are staff-only until a coach approves them into videos.ai_summary.
create table public.video_ai_analyses (
  id          uuid primary key default gen_random_uuid(),
  video_id    uuid not null references public.videos (id) on delete cascade,
  created_by  uuid references public.profiles (id) on delete set null,
  model       text not null,
  result      jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at  timestamptz not null default now()
);

create index video_ai_analyses_video_idx on public.video_ai_analyses (video_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function private.video_org_id(p_video_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select org_id from public.videos where id = p_video_id;
$$;

-- Player who owns the video can see feedback only once the review is sent.
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
        or (v.player_id = (select auth.uid()) and v.status = 'reviewed'
            and private.is_org_member(v.org_id))
      )
  );
$$;

-- Storage access from an object path {org_id}/{player_id}/{video_id}/{file}.
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
    or (v_player = (select auth.uid()) and private.is_org_member(v_org));
end;
$$;

create or replace function private.can_write_video_object(p_name text)
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
    perform parts[3]::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return private.is_player_in_org(v_org, v_player)
    and (v_player = (select auth.uid()) or private.is_org_staff(v_org));
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.videos enable row level security;
alter table public.video_annotations enable row level security;
alter table public.video_ai_analyses enable row level security;

create policy "Players see their videos; staff see their org's"
  on public.videos for select to authenticated
  using (
    private.is_org_staff(org_id)
    or (player_id = (select auth.uid()) and private.is_org_member(org_id))
  );

create policy "Players and staff upload videos"
  on public.videos for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and private.is_player_in_org(org_id, player_id)
    and (player_id = (select auth.uid()) or private.is_org_staff(org_id))
    and status = 'pending'
    and review_summary is null and breakdown_path is null and ai_summary is null
    and reviewed_by is null and reviewed_at is null
  );

-- Only staff edit (review) a video; players can delete their own clip.
create policy "Staff review videos"
  on public.videos for update to authenticated
  using (private.is_org_staff(org_id))
  with check (private.is_org_staff(org_id) and private.is_player_in_org(org_id, player_id));

create policy "Uploaders and staff delete videos"
  on public.videos for delete to authenticated
  using (
    private.is_org_staff(org_id)
    or (uploaded_by = (select auth.uid()) and private.is_org_member(org_id))
  );

create policy "Staff see annotations; players once reviewed"
  on public.video_annotations for select to authenticated
  using (private.can_see_video_feedback(video_id));

create policy "Staff annotate"
  on public.video_annotations for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and private.is_org_staff(private.video_org_id(video_id))
  );

create policy "Staff edit annotations"
  on public.video_annotations for update to authenticated
  using (private.is_org_staff(private.video_org_id(video_id)))
  with check (private.is_org_staff(private.video_org_id(video_id)));

create policy "Staff delete annotations"
  on public.video_annotations for delete to authenticated
  using (private.is_org_staff(private.video_org_id(video_id)));

create policy "Staff see AI drafts"
  on public.video_ai_analyses for select to authenticated
  using (private.is_org_staff(private.video_org_id(video_id)));

create policy "Staff create AI drafts"
  on public.video_ai_analyses for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.is_org_staff(private.video_org_id(video_id))
  );

create policy "Staff delete AI drafts"
  on public.video_ai_analyses for delete to authenticated
  using (private.is_org_staff(private.video_org_id(video_id)));

-- -----------------------------------------------------------------------------
-- Storage bucket + policies
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos', 'videos', false, 52428800,
  array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/3gpp', 'image/jpeg']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Video files: read"
  on storage.objects for select to authenticated
  using (bucket_id = 'videos' and private.can_read_video_object(name));

create policy "Video files: upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and private.can_write_video_object(name));

create policy "Video files: delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and private.can_write_video_object(name));
