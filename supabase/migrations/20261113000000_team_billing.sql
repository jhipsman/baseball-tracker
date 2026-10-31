-- 9D subscriptions: every team starts with a 30-day free trial (no card),
-- then subscribes through Stripe. Demo teams are never billed. Only the
-- server's Stripe webhook (service role) changes billing columns.

alter table public.organizations add column trial_ends_at timestamptz;

-- New teams: 30 days from creation. Existing teams: a fresh 30 days from now.
update public.organizations set trial_ends_at = now() + interval '30 days' where trial_ends_at is null;
alter table public.organizations alter column trial_ends_at set default (now() + interval '30 days');

create or replace function private.protect_billing_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.plan_tier, new.stripe_customer_id, new.stripe_subscription_id, new.plan_status, new.plan_renews_at, new.trial_ends_at)
         is distinct from
         (old.plan_tier, old.stripe_customer_id, old.stripe_subscription_id, old.plan_status, old.plan_renews_at, old.trial_ends_at) then
    raise exception 'Plan changes go through billing' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Stripe events already applied (webhooks can arrive twice).
create table public.billing_events (
  event_id    text primary key,
  created_at  timestamptz not null default now()
);
alter table public.billing_events enable row level security;

-- Daily: tell team admins 7 days and 1 day before their free trial ends.
create function public.send_trial_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare v record; v_admin uuid; v_sent integer := 0; v_days integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Scheduler only.'; end if;
  for v in
    select id, trial_ends_at from public.organizations
    where not is_demo
      and coalesce(plan_status, '') not in ('active', 'trialing', 'past_due')
      and trial_ends_at::date - current_date in (7, 1)
  loop
    v_days := v.trial_ends_at::date - current_date;
    for v_admin in select profile_id from public.org_memberships where org_id = v.id and role = 'admin' loop
      if exists (select 1 from public.notifications n where n.profile_id = v_admin and n.org_id = v.id
                 and n.href = '/settings#billing' and n.created_at > now() - interval '20 hours') then
        continue;
      end if;
      perform private.notify(v_admin, v.id, null, 'announcement',
        'Free trial ends ' || case when v_days = 1 then 'tomorrow' else 'in 7 days' end,
        'Subscribe to keep managing your team. Everything you''ve set up stays put.',
        '/settings#billing');
      v_sent := v_sent + 1;
    end loop;
  end loop;
  return v_sent;
end;
$$;
revoke all on function public.send_trial_reminders() from public;
grant execute on function public.send_trial_reminders() to service_role;
