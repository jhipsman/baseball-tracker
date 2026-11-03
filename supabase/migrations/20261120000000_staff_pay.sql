-- =============================================================================
-- Staff time & pay: each team sets how each coach is paid (hourly, per
-- session, season stipend or volunteer), coaches log time, admins approve it,
-- total it per pay period, export it and mark it paid. 9D tracks and totals;
-- the money moves however the team already pays (payroll, check, app).
-- Opt-in per team: the 'staff' module.
-- =============================================================================

alter table public.organizations drop constraint if exists organizations_modules_check;
alter table public.organizations
  add constraint organizations_modules_check
  check (modules <@ array['health', 'videos', 'practices', 'games', 'messages', 'staff']::text[]);

-- How one staff member is paid on this team.
create table public.staff_pay_rates (
  org_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  pay_type text not null default 'hourly'
    check (pay_type in ('hourly', 'per_session', 'stipend', 'volunteer')),
  -- hourly: cents per hour; per_session: cents per session.
  rate_cents integer not null default 0 check (rate_cents between 0 and 100000000),
  -- stipend: the season total and how many payments it's split into.
  stipend_cents integer not null default 0 check (stipend_cents between 0 and 1000000000),
  stipend_payments integer not null default 1 check (stipend_payments between 1 and 52),
  title text check (char_length(title) <= 80),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  primary key (org_id, profile_id)
);
alter table public.staff_pay_rates enable row level security;

create policy "Admins manage pay rates; staff read their own"
  on public.staff_pay_rates for select to authenticated
  using (
    private.has_org_role(org_id, array['admin']::public.org_role[])
    or (profile_id = (select auth.uid()) and private.is_org_staff(org_id))
  );
create policy "Admins write pay rates"
  on public.staff_pay_rates for all to authenticated
  using (private.has_org_role(org_id, array['admin']::public.org_role[]))
  with check (
    private.has_org_role(org_id, array['admin']::public.org_role[])
    and exists (
      select 1 from public.org_memberships m
      where m.org_id = staff_pay_rates.org_id
        and m.profile_id = staff_pay_rates.profile_id
        and m.role in ('admin', 'coach', 'trainer')
    )
  );

-- Pay periods: a date range the admin pays out together.
create table public.staff_pay_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'open' check (status in ('open', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  check (ends_on >= starts_on and ends_on - starts_on <= 62)
);
create index staff_pay_periods_org on public.staff_pay_periods (org_id, starts_on desc);
alter table public.staff_pay_periods enable row level security;
create policy "Admins manage pay periods"
  on public.staff_pay_periods for all to authenticated
  using (private.has_org_role(org_id, array['admin']::public.org_role[]))
  with check (private.has_org_role(org_id, array['admin']::public.org_role[]));
create policy "Staff see pay periods"
  on public.staff_pay_periods for select to authenticated
  using (private.is_org_staff(org_id));

-- Time worked. A shift has start/end (or just minutes); a session counts once.
create table public.staff_time_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  work_date date not null,
  kind text not null default 'shift' check (kind in ('shift', 'session')),
  started_at timestamptz,
  ended_at timestamptz,
  minutes integer check (minutes between 0 and 1440),
  -- What it was for (optional): a practice, game or team event, or free text.
  activity text check (char_length(activity) <= 120),
  practice_id uuid references public.practice_plans (id) on delete set null,
  game_id uuid references public.games (id) on delete set null,
  note text check (char_length(note) <= 500),
  status text not null default 'open'
    check (status in ('open', 'submitted', 'approved', 'rejected', 'paid')),
  -- Filled at approval from the coach's rate, so later rate changes don't rewrite history.
  amount_cents integer check (amount_cents >= 0),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (char_length(review_note) <= 300),
  period_id uuid references public.staff_pay_periods (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  check (ended_at is null or started_at is null or ended_at > started_at),
  check (ended_at is null or started_at is null or ended_at - started_at <= interval '24 hours')
);
create index staff_time_org_date on public.staff_time_entries (org_id, work_date desc);
create index staff_time_person on public.staff_time_entries (profile_id, work_date desc);
-- One running clock per person per team.
create unique index staff_time_one_open_clock on public.staff_time_entries (org_id, profile_id)
  where kind = 'shift' and started_at is not null and ended_at is null;
alter table public.staff_time_entries enable row level security;

create policy "Staff see their own time; admins see all"
  on public.staff_time_entries for select to authenticated
  using (
    private.has_org_role(org_id, array['admin']::public.org_role[])
    or (profile_id = (select auth.uid()) and private.is_org_staff(org_id))
  );
create policy "Staff add their own time"
  on public.staff_time_entries for insert to authenticated
  with check (
    (profile_id = (select auth.uid()) and private.is_org_staff(org_id))
    or private.has_org_role(org_id, array['admin']::public.org_role[])
  );
create policy "Staff edit their own open time; admins edit any"
  on public.staff_time_entries for update to authenticated
  using (
    private.has_org_role(org_id, array['admin']::public.org_role[])
    or (profile_id = (select auth.uid()) and status in ('open', 'submitted', 'rejected'))
  )
  with check (
    private.has_org_role(org_id, array['admin']::public.org_role[])
    or (profile_id = (select auth.uid()) and status in ('open', 'submitted', 'rejected'))
  );
create policy "Staff delete their own open time; admins delete unpaid"
  on public.staff_time_entries for delete to authenticated
  using (
    (private.has_org_role(org_id, array['admin']::public.org_role[]) and status <> 'paid')
    or (profile_id = (select auth.uid()) and status in ('open', 'rejected'))
  );

-- Only admins approve, reject or mark paid; coaches can't touch reviewed fields,
-- and paid time can't change.
create or replace function private.guard_staff_time()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean := private.has_org_role(new.org_id, array['admin']::public.org_role[]);
begin
  if new.ended_at is not null and new.started_at is not null then
    new.minutes := greatest(0, round(extract(epoch from (new.ended_at - new.started_at)) / 60));
  end if;
  if tg_op = 'UPDATE' and old.status = 'paid' then
    raise exception 'Paid time can''t be changed.' using errcode = '42501';
  end if;
  if not v_admin then
    if new.status not in ('open', 'submitted') then
      raise exception 'Only an admin can approve or pay time.' using errcode = '42501';
    end if;
    new.amount_cents := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.period_id := case when tg_op = 'UPDATE' then old.period_id else null end;
    if tg_op = 'UPDATE' then
      new.profile_id := old.profile_id;
      new.review_note := old.review_note;
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_staff_time
  before insert or update on public.staff_time_entries
  for each row execute function private.guard_staff_time();

-- Payments recorded for a person in a pay period.
create table public.staff_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  period_id uuid not null references public.staff_pay_periods (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  method text not null default 'other'
    check (method in ('payroll', 'check', 'cash', 'app', 'bank', 'other')),
  reference text check (char_length(reference) <= 120),
  paid_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  unique (period_id, profile_id)
);
alter table public.staff_payments enable row level security;
create policy "Admins manage staff payments"
  on public.staff_payments for all to authenticated
  using (private.has_org_role(org_id, array['admin']::public.org_role[]))
  with check (private.has_org_role(org_id, array['admin']::public.org_role[]));
create policy "Staff see their own payments"
  on public.staff_payments for select to authenticated
  using (profile_id = (select auth.uid()) and private.is_org_staff(org_id));

/**
 * Approve time: fixes the amount from the person's pay setup at that moment.
 * Hourly = minutes/60 × rate; per session = rate per entry; stipend and
 * volunteer time is recorded at $0 (stipends are paid by period, not by hour).
 */
create or replace function public.review_staff_time(p_ids uuid[], p_approve boolean, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.staff_time_entries t
  set status = case when p_approve then 'approved' else 'rejected' end,
      amount_cents = case
        when not p_approve then null
        when r.pay_type = 'hourly' then round(coalesce(t.minutes, 0) * r.rate_cents / 60.0)
        when r.pay_type = 'per_session' then r.rate_cents
        else 0
      end,
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      review_note = nullif(trim(p_note), '')
  from public.staff_time_entries t2
  left join public.staff_pay_rates r on r.org_id = t2.org_id and r.profile_id = t2.profile_id
  where t.id = t2.id
    and t.id = any (p_ids)
    and t.status in ('submitted', 'open', 'rejected', 'approved')
    and (t.ended_at is not null or t.started_at is null)
    and private.has_org_role(t.org_id, array['admin']::public.org_role[]);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.review_staff_time(uuid[], boolean, text) from public, anon;
grant execute on function public.review_staff_time(uuid[], boolean, text) to authenticated;

/**
 * Pay a period: records one payment per person (approved time in the range plus
 * any stipend payment given), marks that time paid and the period paid.
 */
create or replace function public.pay_staff_period(
  p_period uuid,
  p_payments jsonb -- [{profile_id, amount_cents, method, reference}]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.staff_pay_periods;
  p jsonb;
  v_count integer := 0;
begin
  select * into v from public.staff_pay_periods where id = p_period for update;
  if v.id is null or not private.has_org_role(v.org_id, array['admin']::public.org_role[]) then
    raise exception 'Only an admin can pay staff.' using errcode = '42501';
  end if;
  if v.status = 'paid' then
    raise exception 'This pay period is already paid.' using errcode = 'P0001';
  end if;
  for p in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    insert into public.staff_payments (org_id, period_id, profile_id, amount_cents, method, reference, created_by)
    values (
      v.org_id, v.id, (p ->> 'profile_id')::uuid,
      greatest(0, coalesce((p ->> 'amount_cents')::integer, 0)),
      coalesce(nullif(p ->> 'method', ''), 'other'),
      nullif(trim(p ->> 'reference'), ''),
      (select auth.uid())
    );
    v_count := v_count + 1;
  end loop;
  update public.staff_time_entries
  set status = 'paid', period_id = v.id
  where org_id = v.org_id
    and status = 'approved'
    and work_date between v.starts_on and v.ends_on;
  update public.staff_pay_periods set status = 'paid', paid_at = now() where id = v.id;
  return v_count;
end;
$$;
revoke execute on function public.pay_staff_period(uuid, jsonb) from public, anon;
grant execute on function public.pay_staff_period(uuid, jsonb) to authenticated;
