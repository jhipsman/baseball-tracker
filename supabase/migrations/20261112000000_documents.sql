-- Documents: forms coaches share (read, acknowledge, sign, or upload something
-- back), each family's completion with a signing record, and staff
-- certifications with expiry dates. Files live in the private "team-docs"
-- bucket under the team's folder.
--
--   {org}/documents/{document_id}.pdf          the form       (team reads, staff write)
--   {org}/responses/{subject_id}/{file}        what came back (staff, the player, their parents)
--   {org}/credentials/{profile_id}/{file}      certifications (admins and the owner)

create table public.team_documents (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  description  text check (char_length(description) <= 1000),
  -- read: just look · acknowledge: "I've read this" · sign: e-sign · upload: send a file back
  kind         text not null check (kind in ('read', 'acknowledge', 'sign', 'upload')),
  -- families: one completion per player (the player or a linked parent) · staff: per coach
  audience     text not null default 'families' check (audience in ('families', 'staff')),
  group_id     uuid references public.player_groups (id) on delete set null,
  file_path    text check (char_length(file_path) <= 300),
  file_sha256  text check (file_sha256 ~ '^[0-9a-f]{64}$'),
  due_date     date,
  archived     boolean not null default false,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (kind = 'upload' or file_path is not null)
);
create index team_documents_org_idx on public.team_documents (org_id, created_at desc);
create trigger team_documents_updated before update on public.team_documents
  for each row execute function private.set_updated_at();
alter table public.team_documents enable row level security;

create policy "Staff, and families for family forms, see documents"
  on public.team_documents for select to authenticated
  using (
    private.is_org_staff(org_id)
    or (audience = 'families' and not archived and private.is_org_member(org_id))
  );
create policy "Staff add documents"
  on public.team_documents for insert to authenticated
  with check (private.is_org_staff(org_id) and created_by = (select auth.uid()));
create policy "Staff edit documents"
  on public.team_documents for update to authenticated
  using (private.is_org_staff(org_id))
  with check (private.is_org_staff(org_id));
create policy "Staff delete documents"
  on public.team_documents for delete to authenticated
  using (private.is_org_staff(org_id));

create table public.document_responses (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  document_id   uuid not null references public.team_documents (id) on delete cascade,
  -- The player (family forms) or staff member (staff forms) this counts for.
  subject_id    uuid not null references public.profiles (id) on delete cascade,
  completed_by  uuid references public.profiles (id) on delete set null,
  kind          text not null check (kind in ('acknowledged', 'signed', 'uploaded')),
  signed_name   text check (char_length(signed_name) between 2 and 120),
  file_path     text check (char_length(file_path) <= 300),
  -- Signing record: the exact form signed, consent to sign electronically, where from.
  doc_sha256    text check (doc_sha256 ~ '^[0-9a-f]{64}$'),
  consent_at    timestamptz,
  signer_ip     text check (char_length(signer_ip) <= 100),
  signer_agent  text check (char_length(signer_agent) <= 400),
  created_at    timestamptz not null default now(),
  unique (document_id, subject_id),
  check (kind <> 'signed' or (signed_name is not null and file_path is not null and consent_at is not null and doc_sha256 is not null)),
  check (kind <> 'uploaded' or file_path is not null)
);
create index document_responses_subject_idx on public.document_responses (subject_id);
alter table public.document_responses enable row level security;

-- Who may complete a document for a subject: the player or a linked parent
-- (family forms, in the form's group if it has one), or the staff member themself.
create function private.can_complete_document(p_doc uuid, p_subject uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_documents d
    where d.id = p_doc and not d.archived
      and (
        (d.audience = 'families'
          and private.is_player_in_org(d.org_id, p_subject)
          and (p_subject = (select auth.uid()) or private.is_parent_of(d.org_id, p_subject))
          and (d.group_id is null or exists (
            select 1 from public.player_group_members m
            where m.group_id = d.group_id and m.profile_id = p_subject)))
        or (d.audience = 'staff' and p_subject = (select auth.uid()) and private.is_org_staff(d.org_id))
      )
  );
$$;
revoke all on function private.can_complete_document(uuid, uuid) from public;
grant execute on function private.can_complete_document(uuid, uuid) to authenticated;

create policy "Staff, the player and their parents see completions"
  on public.document_responses for select to authenticated
  using (
    private.is_org_staff(org_id)
    or subject_id = (select auth.uid())
    or private.is_parent_of(org_id, subject_id)
  );
create policy "Families and staff complete their own documents"
  on public.document_responses for insert to authenticated
  with check (
    completed_by = (select auth.uid())
    and private.can_complete_document(document_id, subject_id)
    and org_id = (select d.org_id from public.team_documents d where d.id = document_id)
  );
create policy "Staff reset completions"
  on public.document_responses for delete to authenticated
  using (private.is_org_staff(org_id));

create table public.staff_credentials (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('background_check', 'safesport', 'concussion', 'first_aid', 'other')),
  label       text check (char_length(label) <= 120),
  file_path   text not null check (char_length(file_path) <= 300),
  issued_on   date,
  expires_on  date,
  created_at  timestamptz not null default now(),
  check (expires_on is null or issued_on is null or expires_on >= issued_on)
);
create index staff_credentials_org_idx on public.staff_credentials (org_id, profile_id);
alter table public.staff_credentials enable row level security;

create policy "Admins and the owner see certifications"
  on public.staff_credentials for select to authenticated
  using (profile_id = (select auth.uid()) or private.has_org_role(org_id, array['admin']::public.org_role[]));
create policy "Staff add their own certifications"
  on public.staff_credentials for insert to authenticated
  with check (profile_id = (select auth.uid()) and private.is_org_staff(org_id));
create policy "Owner or admins remove certifications"
  on public.staff_credentials for delete to authenticated
  using (profile_id = (select auth.uid()) or private.has_org_role(org_id, array['admin']::public.org_role[]));

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-docs', 'team-docs', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create function private.team_doc_access(p_name text, p_write boolean)
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
  return false;
end;
$$;
revoke all on function private.team_doc_access(text, boolean) from public;
grant execute on function private.team_doc_access(text, boolean) to authenticated;

create policy "Team docs: read"
  on storage.objects for select to authenticated
  using (bucket_id = 'team-docs' and private.team_doc_access(name, false));
create policy "Team docs: upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'team-docs' and private.team_doc_access(name, true));
create policy "Team docs: delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'team-docs' and private.team_doc_access(name, true));

-- ---------------------------------------------------------------- notifications
-- Who a family document is for: active players (in its group, if any).
create function private.document_players(p_doc uuid)
returns table (player_id uuid) language sql stable security definer set search_path = '' as $$
  select m.profile_id
  from public.team_documents d
  join public.org_memberships m on m.org_id = d.org_id and m.role = 'player'
  where d.id = p_doc
    and (d.group_id is null or exists (
      select 1 from public.player_group_members g where g.group_id = d.group_id and g.profile_id = m.profile_id));
$$;
revoke all on function private.document_players(uuid) from public;

-- Tell the players (and their parents) who still need to do it. p_missing_only
-- for reminders; at most once a day per document.
create function public.notify_document(p_doc uuid, p_missing_only boolean)
returns integer language plpgsql security definer set search_path = '' as $$
declare d public.team_documents%rowtype; v_sent integer := 0; v_player uuid; v_who uuid; v_title text;
begin
  select * into d from public.team_documents where id = p_doc;
  if not found or not private.is_org_staff(d.org_id) then raise exception 'Only coaches can send this.'; end if;
  if d.archived then raise exception 'This document is archived.'; end if;
  v_title := case when p_missing_only then 'Reminder: ' else 'New form: ' end || d.title;
  if p_missing_only and exists (select 1 from public.notifications n where n.org_id = d.org_id
      and n.actor_id = auth.uid() and n.title = v_title and n.created_at > now() - interval '20 hours') then
    raise exception 'A reminder for this form already went out today.';
  end if;
  if d.audience = 'staff' then
    for v_who in select profile_id from public.org_memberships
                 where org_id = d.org_id and role in ('admin', 'coach') and profile_id <> auth.uid()
                   and not (p_missing_only and exists (select 1 from public.document_responses r
                            where r.document_id = d.id and r.subject_id = profile_id)) loop
      perform private.notify(v_who, d.org_id, auth.uid(), 'announcement', v_title,
        case d.kind when 'sign' then 'Please sign' when 'upload' then 'Please upload' when 'acknowledge' then 'Please read and confirm' else 'Please read' end
          || coalesce(' by ' || to_char(d.due_date, 'Mon FMDD'), '') || '.', '/documents');
      v_sent := v_sent + 1;
    end loop;
    return v_sent;
  end if;
  for v_player in select player_id from private.document_players(d.id) loop
    if p_missing_only and exists (select 1 from public.document_responses r
        where r.document_id = d.id and r.subject_id = v_player) then continue; end if;
    for v_who in select v_player union select parent_id from public.parent_links
                 where org_id = d.org_id and player_id = v_player loop
      perform private.notify(v_who, d.org_id, auth.uid(), 'announcement', v_title,
        case d.kind when 'sign' then 'Please sign' when 'upload' then 'Please upload' when 'acknowledge' then 'Please read and confirm' else 'Please read' end
          || coalesce(' by ' || to_char(d.due_date, 'Mon FMDD'), '') || '.',
        case when v_who = v_player then '/player/documents' else '/parent/documents' end);
      v_sent := v_sent + 1;
    end loop;
  end loop;
  return v_sent;
end;
$$;
revoke all on function public.notify_document(uuid, boolean) from public;
grant execute on function public.notify_document(uuid, boolean) to authenticated;
