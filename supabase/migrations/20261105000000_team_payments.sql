-- Team dues are independent of organizations.plan_tier / app subscriptions.
create table public.org_payment_accounts (
 org_id uuid primary key references public.organizations(id) on delete cascade,
 stripe_account_id text not null unique,charges_enabled boolean not null default false,payouts_enabled boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.org_payment_accounts enable row level security;
create policy "Admins see their payment account" on public.org_payment_accounts for select to authenticated using(private.has_org_role(org_id,array['admin']::public.org_role[]));
create table public.team_payment_plans (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
 payer_id uuid references public.profiles(id) on delete set null,player_id uuid references public.profiles(id) on delete set null,
 title text not null check(char_length(title) between 1 and 120),season text not null check(char_length(season) between 1 and 80),
 installment_cents integer not null check(installment_cents between 100 and 10000000),installments integer not null check(installments between 1 and 24),
 first_due date not null,currency text not null default 'usd' check(currency='usd'),
 status text not null default 'active' check(status in ('active','complete','canceled')),
 autopay_status text not null default 'off' check(autopay_status in ('off','active','past_due','canceled')),
 stripe_subscription_id text unique,stripe_checkout_id text,
 created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.team_invoices (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
 plan_id uuid not null references public.team_payment_plans(id) on delete cascade,payer_id uuid references public.profiles(id) on delete set null,
 installment_number integer not null check(installment_number between 1 and 24),due_date date not null,
 amount_cents integer not null check(amount_cents between 100 and 10000000),paid_cents integer not null default 0 check(paid_cents>=0),
 refunded_cents integer not null default 0 check(refunded_cents>=0),status text not null default 'open' check(status in ('open','paid','void','refunded')),
 stripe_checkout_id text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(plan_id,installment_number),check(paid_cents<=amount_cents and refunded_cents<=paid_cents)
);
create index team_invoices_org_due_idx on public.team_invoices(org_id,due_date);
create index team_invoices_payer_idx on public.team_invoices(payer_id,org_id);
create table public.team_payment_transactions (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
 invoice_id uuid not null references public.team_invoices(id) on delete cascade,
 kind text not null check(kind in ('payment','refund')),amount_cents integer not null check(amount_cents>0),
 method text not null check(method in ('cash','check','bank','stripe')),reference text check(char_length(reference)<=200),
 note text check(char_length(note)<=1000),request_key text not null,
 provider_payment_id text,processor_fee_cents integer check(processor_fee_cents>=0),
 created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),
 unique(org_id,request_key)
);
create unique index team_payment_provider_idx on public.team_payment_transactions(provider_payment_id) where kind='payment' and provider_payment_id is not null;
create table public.team_payment_webhooks(event_id text primary key,org_id uuid not null references public.organizations(id) on delete cascade,created_at timestamptz not null default now());
alter table public.team_payment_plans enable row level security;alter table public.team_invoices enable row level security;alter table public.team_payment_transactions enable row level security;alter table public.team_payment_webhooks enable row level security;
create policy "Admins and payers see plans" on public.team_payment_plans for select to authenticated using(private.has_org_role(org_id,array['admin']::public.org_role[]) or (payer_id=(select auth.uid()) and private.is_org_member(org_id)));
create policy "Admins and payers see invoices" on public.team_invoices for select to authenticated using(private.has_org_role(org_id,array['admin']::public.org_role[]) or (payer_id=(select auth.uid()) and private.is_org_member(org_id)));
create policy "Admins and payers see transactions" on public.team_payment_transactions for select to authenticated using(private.has_org_role(org_id,array['admin']::public.org_role[]) or exists(select 1 from public.team_invoices i where i.id=invoice_id and i.payer_id=(select auth.uid()) and private.is_org_member(i.org_id)));
create trigger team_payment_plans_updated before update on public.team_payment_plans for each row execute function private.set_updated_at();
create trigger team_invoices_updated before update on public.team_invoices for each row execute function private.set_updated_at();

create function public.create_team_payment_plan(p_org uuid,p_payer uuid,p_player uuid,p_title text,p_season text,p_cents integer,p_count integer,p_first date,p_request text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_i integer;v_date date;v_existing public.team_payment_plans%rowtype;
begin
 if not private.has_org_role(p_org,array['admin']::public.org_role[]) then raise exception 'Only admins can create dues.';end if;
 if not exists(select 1 from public.org_memberships where org_id=p_org and profile_id=p_payer) then raise exception 'Choose a payer on the team.';end if;
 if p_player is not null and not private.is_player_in_org(p_org,p_player) then raise exception 'Choose a player on this team.';end if;
 if p_count is null or p_count not between 1 and 24 or p_first is null then raise exception 'Invalid installment schedule.';end if;
 -- Request key is stored in a separate unique lookup to make a retried submission idempotent.
 perform pg_advisory_xact_lock(hashtextextended(p_org::text,0));
 select plan_id into v_id from public.team_payment_plan_requests where org_id=p_org and request_key=p_request;
 if found then
  select * into v_existing from public.team_payment_plans where id=v_id;
  if (v_existing.payer_id,v_existing.player_id,v_existing.title,v_existing.season,v_existing.installment_cents,v_existing.installments,v_existing.first_due)
    is distinct from(p_payer,p_player,trim(p_title),trim(p_season),p_cents,p_count,p_first) then raise exception 'This request already created a different plan. Refresh before creating another.';end if;
  return v_id;
 end if;
 insert into public.team_payment_plans(org_id,payer_id,player_id,title,season,installment_cents,installments,first_due,created_by)
 values(p_org,p_payer,p_player,trim(p_title),trim(p_season),p_cents,p_count,p_first,auth.uid()) returning id into v_id;
 insert into public.team_payment_plan_requests(org_id,request_key,plan_id)values(p_org,p_request,v_id);
 for v_i in 0..p_count-1 loop
  v_date:=(date_trunc('month',p_first)+make_interval(months=>v_i))::date;
  v_date:=v_date+least(extract(day from p_first)::integer,extract(day from(v_date+interval '1 month - 1 day'))::integer)-1;
  insert into public.team_invoices(org_id,plan_id,payer_id,installment_number,due_date,amount_cents)values(p_org,v_id,p_payer,v_i+1,v_date,p_cents);
 end loop;
 perform private.notify(p_payer,p_org,auth.uid(),'announcement','New payment plan: '||p_title,p_count||' installments. First due '||p_first::text,'/payments');
 return v_id;
end;$$;
-- Function references are resolved on first call; this table is intentionally not exposed for writes.
create table public.team_payment_plan_requests(org_id uuid not null references public.organizations(id) on delete cascade,request_key text not null check(char_length(request_key) between 1 and 100),plan_id uuid not null references public.team_payment_plans(id),primary key(org_id,request_key));
alter table public.team_payment_plan_requests enable row level security;

create function private.apply_team_payment(p_org uuid,p_invoice uuid,p_kind text,p_cents integer,p_method text,p_reference text,p_note text,p_request text,p_provider text default null,p_fee integer default null)
returns void language plpgsql security definer set search_path='' as $$
declare v public.team_invoices%rowtype;v_plan public.team_payment_plans%rowtype;
begin
 select * into v from public.team_invoices where id=p_invoice and org_id=p_org for update;
 if not found then raise exception 'Invoice not found.';end if;
 if exists(select 1 from public.team_payment_transactions where org_id=p_org and request_key=p_request) then
  if not exists(select 1 from public.team_payment_transactions where org_id=p_org and request_key=p_request and invoice_id=p_invoice and kind=p_kind and amount_cents=p_cents and method=p_method) then raise exception 'This request already recorded a different payment.';end if;
  return;
 end if;
 if p_method='stripe' and p_kind='payment' and exists(select 1 from public.team_payment_transactions where provider_payment_id=p_provider and kind='payment') then return;end if;
 if p_cents is null or p_cents<=0 or p_kind not in ('payment','refund') or (v.status='void' and p_kind='payment') then raise exception 'Invalid payment.';end if;
 select * into v_plan from public.team_payment_plans where id=v.plan_id for update;
 if p_method<>'stripe' and v_plan.autopay_status in ('active','past_due') then raise exception 'Stop autopay before recording offline payments.';end if;
 if p_kind='payment' and p_cents>v.amount_cents-v.paid_cents then raise exception 'Payment exceeds the remaining balance.';end if;
 if p_kind='refund' and p_cents>v.paid_cents-v.refunded_cents then raise exception 'Refund exceeds payments received.';end if;
 insert into public.team_payment_transactions(org_id,invoice_id,kind,amount_cents,method,reference,note,request_key,provider_payment_id,processor_fee_cents,created_by)
 values(p_org,p_invoice,p_kind,p_cents,p_method,p_reference,p_note,p_request,p_provider,p_fee,auth.uid());
 if p_kind='payment' then update public.team_invoices set paid_cents=paid_cents+p_cents,status=case when paid_cents+p_cents=amount_cents then 'paid' else 'open' end where id=v.id;
 else update public.team_invoices set refunded_cents=refunded_cents+p_cents,status=case when refunded_cents+p_cents=paid_cents and paid_cents=amount_cents then 'refunded' else status end where id=v.id;end if;
 if not exists(select 1 from public.team_invoices where plan_id=v.plan_id and status='open') then update public.team_payment_plans set status='complete' where id=v.plan_id and status<>'canceled';end if;
end;$$;
create function public.record_team_payment(p_org uuid,p_invoice uuid,p_kind text,p_cents integer,p_method text,p_reference text,p_note text,p_request text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.has_org_role(p_org,array['admin']::public.org_role[]) then raise exception 'Only admins can record payments.';end if;
 if p_method not in ('cash','check','bank') or p_kind not in ('payment','refund') then raise exception 'Use Stripe for online payment changes.';end if;
 if char_length(p_request) not between 1 and 100 then raise exception 'Missing request identifier.';end if;
 perform private.apply_team_payment(p_org,p_invoice,p_kind,p_cents,p_method,p_reference,p_note,p_request);
end;$$;
create function public.remind_team_invoice(p_org uuid,p_invoice uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v public.team_invoices%rowtype;
begin
 if not private.has_org_role(p_org,array['admin']::public.org_role[]) then raise exception 'Only admins can send payment reminders.';end if;
 select * into v from public.team_invoices where id=p_invoice and org_id=p_org and status='open';
 if not found then raise exception 'No balance is due.';end if;
 if exists(select 1 from public.notifications where actor_id=auth.uid() and profile_id=v.payer_id and href='/payments' and title='Payment reminder' and created_at>now()-interval '1 day') then raise exception 'A reminder was already sent to this payer today.';end if;
 perform private.notify(v.payer_id,p_org,auth.uid(),'announcement','Payment reminder','An installment of $'||to_char((v.amount_cents-v.paid_cents)/100.0,'FM9999990.00')||' is due '||v.due_date::text||'.','/payments');
end;$$;

create function public.apply_team_stripe_payment(p_event text,p_org uuid,p_invoice uuid,p_plan uuid,p_cents integer,p_provider text,p_kind text default 'payment',p_fee integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_delta integer;v_previous integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Payment processor only.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text,0));
 if exists(select 1 from public.team_payment_webhooks where event_id=p_event) then return null;end if;
 if p_kind='refund' then
  select invoice_id into v_id from public.team_payment_transactions where org_id=p_org and provider_payment_id=p_provider and kind='payment';
  if not found then raise exception 'Original payment is not recorded yet.';end if;
  select coalesce(sum(amount_cents),0)::integer into v_previous from public.team_payment_transactions where org_id=p_org and provider_payment_id=p_provider and kind='refund';
  v_delta:=p_cents-v_previous;
 else
  v_delta:=p_cents;
  if p_invoice is not null then select id into v_id from public.team_invoices where id=p_invoice and org_id=p_org;
  else select id into v_id from public.team_invoices where plan_id=p_plan and org_id=p_org and status='open' order by installment_number limit 1 for update;end if;
  if v_id is null and exists(select 1 from public.team_payment_transactions where provider_payment_id=p_provider and org_id=p_org and kind='payment') then
    insert into public.team_payment_webhooks(event_id,org_id)values(p_event,p_org);return null;
  end if;
  if v_id is null then raise exception 'No matching invoice.';end if;
 end if;
 if v_delta>0 then perform private.apply_team_payment(p_org,v_id,p_kind,v_delta,'stripe',p_provider,null,p_event,p_provider,p_fee);end if;
 insert into public.team_payment_webhooks(event_id,org_id)values(p_event,p_org);
 return v_id;
end;$$;
revoke all on function public.create_team_payment_plan(uuid,uuid,uuid,text,text,integer,integer,date,text),public.record_team_payment(uuid,uuid,text,integer,text,text,text,text),public.remind_team_invoice(uuid,uuid),public.apply_team_stripe_payment(text,uuid,uuid,uuid,integer,text,text,integer) from public;
grant execute on function public.create_team_payment_plan(uuid,uuid,uuid,text,text,integer,integer,date,text),public.record_team_payment(uuid,uuid,text,integer,text,text,text,text),public.remind_team_invoice(uuid,uuid) to authenticated;
grant execute on function public.apply_team_stripe_payment(text,uuid,uuid,uuid,integer,text,text,integer) to service_role;

revoke all on function private.apply_team_payment(uuid,uuid,text,integer,text,text,text,text,text,integer) from public;

create function public.cancel_team_payment_plan(p_org uuid,p_plan uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v public.team_payment_plans%rowtype;v_count integer;
begin
 if not private.has_org_role(p_org,array['admin']::public.org_role[]) then raise exception 'Only admins can cancel team dues.';end if;
 select * into v from public.team_payment_plans where id=p_plan and org_id=p_org for update;
 if not found then raise exception 'Plan not found.';end if;
 if v.autopay_status in ('active','past_due') then raise exception 'Stop autopay before canceling balances.';end if;
 update public.team_invoices set status='void' where plan_id=v.id and status='open';get diagnostics v_count=row_count;
 update public.team_payment_plans set status='canceled' where id=v.id;
 return v_count;
end;$$;
revoke all on function public.cancel_team_payment_plan(uuid,uuid) from public;
grant execute on function public.cancel_team_payment_plan(uuid,uuid) to authenticated;

-- Preserve account deletion after payment history exists; active mandates must be stopped first.
create function private.check_profile_autopay_before_delete() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.team_payment_plans where payer_id=old.id and autopay_status in ('active','past_due')) then
  raise exception 'Stop monthly autopay in Payments before deleting your account.';
 end if;return old;
end;$$;
create trigger profiles_check_autopay before delete on public.profiles for each row execute function private.check_profile_autopay_before_delete();
revoke all on function private.check_profile_autopay_before_delete() from public;
