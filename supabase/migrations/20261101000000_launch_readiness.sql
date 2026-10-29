-- =============================================================================
-- Launch readiness: parental consent for under-13s, account deletion,
-- billing fields (written only by the Stripe webhook), and in-app feedback.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Birthdate at signup + parental consent (COPPA)
-- -----------------------------------------------------------------------------

-- Copy the birthdate given at signup (if any) onto the profile.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_birth date;
begin
  begin
    v_birth := nullif(new.raw_user_meta_data ->> 'birth_date', '')::date;
  exception when others then
    v_birth := null;
  end;
  if v_birth is not null and (v_birth < '1940-01-01' or v_birth > current_date) then
    v_birth := null;
  end if;
  insert into public.profiles (id, email, full_name, avatar_url, birth_date)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    v_birth
  );
  return new;
end;
$$;

-- One consent record per child. The parent must sign in with the verified
-- email the child named, so the consent comes from that adult's account.
create table public.parental_consents (
  id              uuid primary key default gen_random_uuid(),
  child_id        uuid not null unique references public.profiles (id) on delete cascade,
  parent_email    text not null check (parent_email = lower(parent_email) and parent_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  token           uuid not null unique default gen_random_uuid(),
  requested_at    timestamptz not null default now(),
  parent_id       uuid references public.profiles (id) on delete set null,
  parent_name     text check (char_length(parent_name) between 2 and 120),
  consented_at    timestamptz,
  revoked_at      timestamptz
);

alter table public.parental_consents enable row level security;

create policy "Child and consenting parent see the consent"
  on public.parental_consents for select to authenticated
  using (child_id = (select auth.uid()) or parent_id = (select auth.uid()));

-- Under 13 (by profile birthdate) and no active consent.
create or replace function private.needs_parental_consent(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile
      and p.birth_date is not null
      and p.birth_date > (current_date - interval '13 years')::date
      and not exists (
        select 1 from public.parental_consents c
        where c.child_id = p.id and c.consented_at is not null and c.revoked_at is null
      )
  );
$$;

create or replace function public.consent_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not private.needs_parental_consent((select auth.uid())) then 'ok'
    when exists (select 1 from public.parental_consents c
                 where c.child_id = (select auth.uid()) and c.revoked_at is not null) then 'revoked'
    when exists (select 1 from public.parental_consents c
                 where c.child_id = (select auth.uid())) then 'pending'
    else 'needed'
  end;
$$;

-- The child names a parent's email; returns the token for the consent link.
create or replace function public.request_parental_consent(p_parent_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(p_parent_email));
  v_token uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if v_email = (select email from public.profiles where id = v_uid) then
    raise exception 'Use a parent or guardian''s email, not your own' using errcode = '22023';
  end if;
  insert into public.parental_consents (child_id, parent_email)
  values (v_uid, v_email)
  on conflict (child_id) do update
    set parent_email = excluded.parent_email,
        token = gen_random_uuid(),
        requested_at = now(),
        parent_id = null, parent_name = null, consented_at = null, revoked_at = null
    where public.parental_consents.consented_at is null
       or public.parental_consents.revoked_at is not null
  returning token into v_token;
  if v_token is null then
    select token into v_token from public.parental_consents where child_id = v_uid;
  end if;
  return v_token;
end;
$$;

-- What the parent sees on the consent page (only for the named parent's account).
create or replace function public.get_consent_request(p_token uuid)
returns table (
  child_name text,
  child_email text,
  parent_email text,
  email_matches boolean,
  consented boolean,
  revoked boolean,
  teams text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p.full_name, p.email), p.email, c.parent_email,
         c.parent_email = private.current_verified_email(),
         c.consented_at is not null, c.revoked_at is not null,
         array(select o.name from public.org_memberships m
               join public.organizations o on o.id = m.org_id
               where m.profile_id = c.child_id order by o.name)
  from public.parental_consents c
  join public.profiles p on p.id = c.child_id
  where c.token = p_token;
$$;

create or replace function public.give_parental_consent(p_token uuid, p_parent_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_c public.parental_consents;
begin
  select * into v_c from public.parental_consents where token = p_token for update;
  if not found then
    raise exception 'This permission link is no longer valid' using errcode = 'P0002';
  end if;
  if v_uid is null or v_uid = v_c.child_id
     or v_c.parent_email is distinct from private.current_verified_email() then
    raise exception 'Sign in as the parent or guardian this link was sent to' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_parent_name, ''))) < 2 then
    raise exception 'Type your full name' using errcode = '22023';
  end if;
  update public.parental_consents
  set parent_id = v_uid, parent_name = trim(p_parent_name),
      consented_at = now(), revoked_at = null
  where id = v_c.id;
end;
$$;

-- The consenting parent can withdraw consent (the child is locked out again).
create or replace function public.revoke_parental_consent(p_child uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.parental_consents set revoked_at = now()
  where child_id = p_child and parent_id = (select auth.uid()) and consented_at is not null;
$$;

revoke execute on function public.consent_status() from public, anon;
revoke execute on function public.request_parental_consent(text) from public, anon;
revoke execute on function public.get_consent_request(uuid) from public, anon;
revoke execute on function public.give_parental_consent(uuid, text) from public, anon;
revoke execute on function public.revoke_parental_consent(uuid) from public, anon;
grant execute on function public.consent_status() to authenticated;
grant execute on function public.request_parental_consent(text) to authenticated;
grant execute on function public.get_consent_request(uuid) to authenticated;
grant execute on function public.give_parental_consent(uuid, text) to authenticated;
grant execute on function public.revoke_parental_consent(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Delete my account
-- -----------------------------------------------------------------------------

-- Deletes the caller's login and profile (cascades to their logs, videos rows,
-- memberships). Refused while they own a team: transfer or delete it first.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.organizations where owner_id = v_uid) then
    raise exception 'You own a team. Delete the team (or ask us to transfer it) before deleting your account.'
      using errcode = 'P0001';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- -----------------------------------------------------------------------------
-- Billing (Stripe). Plans: free | pro ("Team") | enterprise ("Club").
-- Only the server's Stripe webhook (service role) may change these columns.
-- -----------------------------------------------------------------------------

alter table public.organizations
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique,
  add column plan_status text check (plan_status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid')),
  add column plan_renews_at timestamptz;

create or replace function private.protect_billing_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.plan_tier, new.stripe_customer_id, new.stripe_subscription_id, new.plan_status, new.plan_renews_at)
         is distinct from
         (old.plan_tier, old.stripe_customer_id, old.stripe_subscription_id, old.plan_status, old.plan_renews_at) then
    raise exception 'Plan changes go through billing' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger organizations_protect_billing
  before update on public.organizations
  for each row execute function private.protect_billing_columns();

-- -----------------------------------------------------------------------------
-- In-app feedback (read by the app's owner in the Supabase dashboard)
-- -----------------------------------------------------------------------------

create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references public.profiles (id) on delete set null,
  org_id      uuid references public.organizations (id) on delete set null,
  role        text,
  path        text check (char_length(path) <= 300),
  kind        text not null default 'idea' check (kind in ('confusing', 'bug', 'idea', 'praise')),
  message     text not null check (char_length(message) between 1 and 4000),
  user_agent  text check (char_length(user_agent) <= 400),
  created_at  timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "Users send feedback"
  on public.feedback for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and (org_id is null or private.is_org_member(org_id))
  );

create policy "Users see their own feedback"
  on public.feedback for select to authenticated
  using (profile_id = (select auth.uid()));
