-- 9D Leagues: team logos. Public images (PNG, JPEG, WebP; no SVG) in their
-- own bucket, under the team's id; only the page owner can add or remove them.

alter table public.public_teams
  add column logo_path text
    check (logo_path is null or (logo_path like id::text || '/%' and char_length(logo_path) <= 200));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-logos', 'team-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.owns_public_team_path(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_team uuid;
begin
  begin
    v_team := (string_to_array(p_name, '/'))[1]::uuid;
  exception when others then
    return false;
  end;
  return exists (
    select 1 from public.public_teams t where t.id = v_team and t.owner_id = (select auth.uid())
  );
end;
$$;

create policy "Team owners upload logos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'team-logos' and private.owns_public_team_path(name));
create policy "Team owners replace logos"
  on storage.objects for update to authenticated
  using (bucket_id = 'team-logos' and private.owns_public_team_path(name))
  with check (bucket_id = 'team-logos' and private.owns_public_team_path(name));
create policy "Team owners remove logos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'team-logos' and private.owns_public_team_path(name));
