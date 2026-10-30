-- Player Health: a coach-set playing status (with a return-to-throw plan) and
-- "handled" marks on workload alerts, so the Today board only shows what still
-- needs a decision.

create type public.health_status as enum ('full', 'limited', 'out');

create table public.player_health_status (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  player_id   uuid not null references public.profiles (id) on delete cascade,
  status      public.health_status not null default 'full',
  reason      text check (char_length(reason) <= 200),
  return_date date,
  -- Return-to-throw steps: [{"label": "Light catch 30 ft", "done": false}, ...]
  plan        jsonb not null default '[]'::jsonb
              check (jsonb_typeof(plan) = 'array' and jsonb_array_length(plan) <= 12),
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (org_id, player_id)
);

create trigger player_health_status_updated
  before update on public.player_health_status
  for each row execute function private.set_updated_at();

alter table public.player_health_status enable row level security;

create policy "Staff, the player, and their parents see health status"
  on public.player_health_status for select to authenticated
  using (
    private.is_org_staff(org_id)
    or (player_id = (select auth.uid()) and private.is_org_member(org_id))
    or private.is_parent_of(org_id, player_id)
  );

create policy "Staff set health status"
  on public.player_health_status for insert to authenticated
  with check (private.is_org_staff(org_id) and private.is_player_in_org(org_id, player_id));

create policy "Staff update health status"
  on public.player_health_status for update to authenticated
  using (private.is_org_staff(org_id))
  with check (private.is_org_staff(org_id) and private.is_player_in_org(org_id, player_id));

create policy "Staff clear health status"
  on public.player_health_status for delete to authenticated
  using (private.is_org_staff(org_id));

create table public.health_alert_acks (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  player_id  uuid not null references public.profiles (id) on delete cascade,
  -- Stable per alert occurrence, e.g. "pain:2026-11-02" or "spike:2026-11-02".
  alert_key  text not null check (char_length(alert_key) between 1 and 64),
  note       text check (char_length(note) <= 200),
  acked_by   uuid references public.profiles (id) on delete set null,
  acked_at   timestamptz not null default now(),
  unique (org_id, player_id, alert_key)
);

alter table public.health_alert_acks enable row level security;

create policy "Staff see handled alerts"
  on public.health_alert_acks for select to authenticated
  using (private.is_org_staff(org_id));

create policy "Staff mark alerts handled"
  on public.health_alert_acks for insert to authenticated
  with check (
    acked_by = (select auth.uid())
    and private.is_org_staff(org_id)
    and private.is_player_in_org(org_id, player_id)
  );

create policy "Staff reopen alerts"
  on public.health_alert_acks for delete to authenticated
  using (private.is_org_staff(org_id));
