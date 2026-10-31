-- Season registration: a shareable link where a family signs up a player,
-- signs the waiver, and (when there's a fee) gets a payment plan they can pay
-- online. Plus daily automatic payment reminders.

create table public.registration_forms (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  token           uuid not null unique default gen_random_uuid(),
  title           text not null check (char_length(title) between 1 and 120),
  season          text not null check (char_length(season) between 1 and 80),
  fee_cents       integer not null default 0 check (fee_cents between 0 and 10000000),
  -- 1 = pay in full only; up to 12 monthly payments.
  installments_max integer not null default 1 check (installments_max between 1 and 12),
  -- First payment due; null = due the day they register.
  first_due       date,
  waiver_text     text not null check (char_length(waiver_text) between 20 and 20000),
  capacity        integer check (capacity between 1 and 500),
  open            boolean not null default true,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index registration_forms_org_idx on public.registration_forms (org_id, created_at desc);
create trigger registration_forms_updated before update on public.registration_forms
  for each row execute function private.set_updated_at();
alter table public.registration_forms enable row level security;

create policy "Admins see registration forms"
  on public.registration_forms for select to authenticated
  using (private.has_org_role(org_id, array['admin']::public.org_role[]));
create policy "Admins create registration forms"
  on public.registration_forms for insert to authenticated
  with check (private.has_org_role(org_id, array['admin']::public.org_role[]) and created_by = (select auth.uid()));
create policy "Admins edit registration forms"
  on public.registration_forms for update to authenticated
  using (private.has_org_role(org_id, array['admin']::public.org_role[]))
  with check (private.has_org_role(org_id, array['admin']::public.org_role[]));
create policy "Admins delete registration forms"
  on public.registration_forms for delete to authenticated
  using (private.has_org_role(org_id, array['admin']::public.org_role[]));

create table public.team_registrations (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations (id) on delete cascade,
  form_id            uuid not null references public.registration_forms (id) on delete cascade,
  submitted_by       uuid references public.profiles (id) on delete set null,
  parent_name        text not null check (char_length(parent_name) between 1 and 120),
  parent_email       text not null check (char_length(parent_email) <= 254),
  parent_phone       text not null check (char_length(parent_phone) between 7 and 30),
  player_name        text not null check (char_length(player_name) between 1 and 120),
  player_birth_date  date not null,
  player_email       text check (char_length(player_email) <= 254),
  player_position    public.player_position,
  emergency_name     text not null check (char_length(emergency_name) between 1 and 120),
  emergency_phone    text not null check (char_length(emergency_phone) between 7 and 30),
  emergency_relation text check (char_length(emergency_relation) <= 60),
  medical_notes      text check (char_length(medical_notes) <= 2000),
  -- The waiver exactly as shown, who signed it and when.
  waiver_text        text not null,
  waiver_signed_name text not null check (char_length(waiver_signed_name) between 2 and 120),
  waiver_signed_at   timestamptz not null default now(),
  installments       integer not null default 1 check (installments between 1 and 12),
  plan_id            uuid references public.team_payment_plans (id) on delete set null,
  player_invite_id   uuid references public.org_invitations (id) on delete set null,
  player_id          uuid references public.profiles (id) on delete set null,
  status             text not null default 'registered' check (status in ('registered', 'withdrawn')),
  created_at         timestamptz not null default now()
);
create index team_registrations_form_idx on public.team_registrations (form_id, created_at desc);
create unique index team_registrations_once
  on public.team_registrations (form_id, submitted_by, lower(player_name), player_birth_date);
alter table public.team_registrations enable row level security;

create policy "Admins and the family see registrations"
  on public.team_registrations for select to authenticated
  using (
    private.has_org_role(org_id, array['admin']::public.org_role[])
    or submitted_by = (select auth.uid())
  );
create policy "Admins update registrations"
  on public.team_registrations for update to authenticated
  using (private.has_org_role(org_id, array['admin']::public.org_role[]))
  with check (private.has_org_role(org_id, array['admin']::public.org_role[]));

-- What a family sees before signing in: never the roster, only the offer.
create function public.get_registration_form(p_token uuid)
returns table (
  form_id uuid, team_name text, title text, season text, fee_cents integer,
  installments_max integer, first_due date, waiver_text text, open boolean, spots_left integer
)
language sql stable security definer set search_path = '' as $$
  select f.id, o.name, f.title, f.season, f.fee_cents, f.installments_max, f.first_due,
         f.waiver_text, f.open,
         case when f.capacity is null then null
              else greatest(0, f.capacity - (select count(*)::integer from public.team_registrations r
                                             where r.form_id = f.id and r.status = 'registered')) end
  from public.registration_forms f
  join public.organizations o on o.id = f.org_id
  where f.token = p_token;
$$;
revoke all on function public.get_registration_form(uuid) from public;
grant execute on function public.get_registration_form(uuid) to anon, authenticated;

-- Monthly due dates, keeping the day of month (clamped to short months).
create function private.installment_due(p_first date, p_index integer)
returns date language sql immutable set search_path = '' as $$
  select (date_trunc('month', p_first) + make_interval(months => p_index))::date
    + least(extract(day from p_first)::integer,
            extract(day from (date_trunc('month', p_first) + make_interval(months => p_index + 1) - interval '1 day'))::integer) - 1;
$$;

create function public.submit_registration(p_token uuid, p_data jsonb, p_installments integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text := private.current_verified_email();
  f public.registration_forms%rowtype;
  v_role public.org_role;
  v_id uuid;
  v_plan uuid;
  v_invite uuid;
  v_count integer;
  v_cents integer;
  v_first date;
  v_birth date;
  v_player_email text;
  v_pos text;
  v_admin record;
  i integer;
  t text;
begin
  if v_uid is null then raise exception 'Sign in to register.' using errcode = '42501'; end if;
  if v_email is null then raise exception 'Confirm your email address first, then try again.'; end if;
  select * into f from public.registration_forms where token = p_token for update;
  if not found then raise exception 'This registration link is not valid.'; end if;
  if not f.open then raise exception 'Registration is closed.'; end if;
  if f.capacity is not null and (select count(*) from public.team_registrations
      where form_id = f.id and status = 'registered') >= f.capacity then
    raise exception 'Registration is full.';
  end if;

  select role into v_role from public.org_memberships where org_id = f.org_id and profile_id = v_uid;
  if v_role is not null and v_role <> 'parent' then
    raise exception 'You are already on this team as a %. Sign in with a parent account to register a player.', v_role;
  end if;

  -- Required fields (trimmed); the app validates too, this is the guarantee.
  foreach t in array array['parent_name','parent_phone','player_name','player_birth_date',
                           'emergency_name','emergency_phone','waiver_signed_name'] loop
    if nullif(trim(p_data ->> t), '') is null then raise exception 'Fill in every required field.'; end if;
  end loop;
  begin
    v_birth := (p_data ->> 'player_birth_date')::date;
  exception when others then raise exception 'Enter the player''s birthdate.';
  end;
  if v_birth > current_date - interval '4 years' or v_birth < current_date - interval '30 years' then
    raise exception 'Check the player''s birthdate.';
  end if;
  v_player_email := lower(nullif(trim(p_data ->> 'player_email'), ''));
  if v_player_email is not null and v_player_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Check the player''s email address.';
  end if;
  v_pos := nullif(p_data ->> 'player_position', '');
  if v_pos is not null and v_pos <> all (array['P','C','1B','2B','SS','3B','OF','DH','UTIL']) then v_pos := null; end if;
  v_count := case when f.fee_cents = 0 then 1 else least(greatest(coalesce(p_installments, 1), 1), f.installments_max) end;

  if v_role is null then
    insert into public.org_memberships (org_id, profile_id, role) values (f.org_id, v_uid, 'parent');
  end if;

  insert into public.team_registrations (
    org_id, form_id, submitted_by, parent_name, parent_email, parent_phone, player_name,
    player_birth_date, player_email, player_position, emergency_name, emergency_phone,
    emergency_relation, medical_notes, waiver_text, waiver_signed_name, installments
  ) values (
    f.org_id, f.id, v_uid, left(trim(p_data ->> 'parent_name'), 120), v_email,
    left(trim(p_data ->> 'parent_phone'), 30), left(trim(p_data ->> 'player_name'), 120), v_birth,
    v_player_email, v_pos::public.player_position, left(trim(p_data ->> 'emergency_name'), 120),
    left(trim(p_data ->> 'emergency_phone'), 30), left(nullif(trim(p_data ->> 'emergency_relation'), ''), 60),
    left(nullif(trim(p_data ->> 'medical_notes'), ''), 2000), f.waiver_text,
    left(trim(p_data ->> 'waiver_signed_name'), 120), v_count
  ) returning id into v_id;

  if f.fee_cents > 0 then
    v_cents := ceil(f.fee_cents::numeric / v_count)::integer;
    v_first := greatest(coalesce(f.first_due, current_date), current_date);
    insert into public.team_payment_plans (org_id, payer_id, title, season, installment_cents,
      installments, first_due, created_by)
    values (f.org_id, v_uid, left(f.title || ' · ' || trim(p_data ->> 'player_name'), 120), f.season,
      v_cents, v_count, v_first, v_uid)
    returning id into v_plan;
    for i in 0 .. v_count - 1 loop
      insert into public.team_invoices (org_id, plan_id, payer_id, installment_number, due_date, amount_cents)
      values (f.org_id, v_plan, v_uid, i + 1, private.installment_due(v_first, i), v_cents);
    end loop;
    update public.team_registrations set plan_id = v_plan where id = v_id;
  end if;

  -- Older players get their own login; when they accept, they're linked to this parent.
  if v_player_email is not null and v_player_email <> v_email
     and not exists (select 1 from public.org_invitations
                     where org_id = f.org_id and email = v_player_email and accepted_at is null) then
    insert into public.org_invitations (org_id, email, role, invited_by)
    values (f.org_id, v_player_email, 'player', v_uid) returning id into v_invite;
    update public.team_registrations set player_invite_id = v_invite where id = v_id;
  end if;

  for v_admin in select profile_id from public.org_memberships
                 where org_id = f.org_id and role = 'admin' loop
    perform private.notify(v_admin.profile_id, f.org_id, v_uid, 'announcement',
      'New registration: ' || trim(p_data ->> 'player_name'),
      f.title || ' · registered by ' || trim(p_data ->> 'parent_name'), '/registration');
  end loop;
  return v_id;
end;
$$;
revoke all on function public.submit_registration(uuid, jsonb, integer) from public;
grant execute on function public.submit_registration(uuid, jsonb, integer) to authenticated;

-- Tie a registration to the player's account: parent link, payment plan, birthdate.
create function private.link_registration(p_reg uuid, p_player uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.team_registrations%rowtype;
begin
  select * into r from public.team_registrations where id = p_reg for update;
  if not found then return; end if;
  update public.team_registrations set player_id = p_player where id = r.id;
  if r.submitted_by is not null and r.submitted_by <> p_player then
    insert into public.parent_links (org_id, parent_id, player_id)
    values (r.org_id, r.submitted_by, p_player) on conflict do nothing;
  end if;
  if r.plan_id is not null then
    update public.team_payment_plans set player_id = p_player where id = r.plan_id and player_id is null;
  end if;
  update public.profiles set birth_date = r.player_birth_date where id = p_player and birth_date is null;
  if r.player_position is not null then
    update public.org_memberships set position = r.player_position
    where org_id = r.org_id and profile_id = p_player and position is null;
  end if;
end;
$$;
revoke all on function private.link_registration(uuid, uuid) from public;

create function private.registration_invite_accepted()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_reg uuid;
begin
  if new.accepted_at is not null and old.accepted_at is null and new.role = 'player' then
    for v_reg in select id from public.team_registrations where player_invite_id = new.id loop
      perform private.link_registration(v_reg, new.accepted_by);
    end loop;
  end if;
  return new;
end;
$$;
create trigger org_invitations_registration_link
  after update of accepted_at on public.org_invitations
  for each row execute function private.registration_invite_accepted();

-- Coaches can link a registration to a player already on the team (e.g. no email given).
create function public.link_registration_player(p_org uuid, p_reg uuid, p_player uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_org_role(p_org, array['admin']::public.org_role[])
     or not private.is_player_in_org(p_org, p_player) then
    raise exception 'Choose a player on this team.';
  end if;
  if not exists (select 1 from public.team_registrations where id = p_reg and org_id = p_org) then
    raise exception 'Registration not found.';
  end if;
  perform private.link_registration(p_reg, p_player);
end;
$$;
revoke all on function public.link_registration_player(uuid, uuid, uuid) from public;
grant execute on function public.link_registration_player(uuid, uuid, uuid) to authenticated;

-- Daily: 3 days before, on the day, and 3 and 7 days late. Skips autopay plans
-- (Stripe charges those) and anyone already reminded about that invoice today.
create function public.send_payment_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare v record; v_sent integer := 0; v_title text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Scheduler only.'; end if;
  for v in
    select i.*, p.title as plan_title
    from public.team_invoices i
    join public.team_payment_plans p on p.id = i.plan_id
    where i.status = 'open' and i.payer_id is not null and i.paid_cents < i.amount_cents
      and p.status = 'active' and p.autopay_status not in ('active', 'past_due')
      and i.due_date - current_date in (3, 0, -3, -7)
  loop
    v_title := case when v.due_date < current_date then 'Payment overdue' else 'Payment reminder' end;
    if exists (select 1 from public.notifications n where n.profile_id = v.payer_id
               and n.href = '/payments' and n.title = v_title
               and n.created_at > now() - interval '20 hours') then continue; end if;
    perform private.notify(v.payer_id, v.org_id, null, 'announcement', v_title,
      v.plan_title || ': $' || to_char((v.amount_cents - v.paid_cents) / 100.0, 'FM9999990.00')
        || case when v.due_date < current_date then ' was due ' else ' is due ' end
        || to_char(v.due_date, 'Mon FMDD') || '.', '/payments');
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;
revoke all on function public.send_payment_reminders() from public;
grant execute on function public.send_payment_reminders() to service_role;
