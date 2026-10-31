-- Whole-athlete health, part 3: a game-day medical card. Families keep
-- allergies, medications, conditions and emergency contacts up to date; the
-- team's coaches see every card (pre-filled from registration until a family
-- edits it) with tap-to-call, plus the team's field emergency plan.

create table public.player_medical (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  player_id   uuid not null references public.profiles (id) on delete cascade,
  allergies   text check (char_length(allergies) <= 300),
  medications text check (char_length(medications) <= 300),
  conditions  text check (char_length(conditions) <= 500),
  -- [{"name": "...", "phone": "...", "relation": "..."}], up to 3
  contacts    jsonb not null default '[]'::jsonb
              check (jsonb_typeof(contacts) = 'array' and jsonb_array_length(contacts) <= 3),
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (org_id, player_id)
);
create trigger player_medical_updated
  before update on public.player_medical
  for each row execute function private.set_updated_at();
alter table public.player_medical enable row level security;

create policy "Staff, the player, and their parents see the medical card"
  on public.player_medical for select to authenticated
  using (
    private.is_org_staff(org_id)
    or (player_id = (select auth.uid()) and private.is_org_member(org_id))
    or private.is_parent_of(org_id, player_id)
  );
create policy "Staff, the player, or a parent fill in the medical card"
  on public.player_medical for insert to authenticated
  with check (
    updated_by = (select auth.uid())
    and private.is_player_in_org(org_id, player_id)
    and (private.is_org_staff(org_id) or player_id = (select auth.uid())
         or private.is_parent_of(org_id, player_id))
  );
create policy "Staff, the player, or a parent update the medical card"
  on public.player_medical for update to authenticated
  using (private.is_org_staff(org_id) or player_id = (select auth.uid())
         or private.is_parent_of(org_id, player_id))
  with check (
    updated_by = (select auth.uid())
    and (private.is_org_staff(org_id) or player_id = (select auth.uid())
         or private.is_parent_of(org_id, player_id))
  );

-- Nearest hospital, AED, who calls 911… (admins edit it in the Medical tab).
alter table public.organizations
  add column emergency_plan text check (char_length(emergency_plan) <= 1000);

-- Every active player's card for coaches: the family's own card, else what
-- they gave at registration (registration rows are admin-only otherwise).
create function public.medical_cards(p_org uuid)
returns table (
  player_id uuid, full_name text, jersey_number integer, birth_date date,
  allergies text, medications text, conditions text, registration_notes text,
  contacts jsonb, updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select m.profile_id,
         coalesce(nullif(p.full_name, ''), p.email),
         m.jersey_number,
         p.birth_date,
         pm.allergies, pm.medications, pm.conditions,
         r.medical_notes,
         case when coalesce(jsonb_array_length(pm.contacts), 0) > 0 then pm.contacts
              when r.id is not null then jsonb_build_array(
                jsonb_build_object('name', r.parent_name, 'phone', r.parent_phone, 'relation', 'Parent / guardian'),
                jsonb_build_object('name', r.emergency_name, 'phone', r.emergency_phone,
                                   'relation', coalesce(r.emergency_relation, 'Emergency contact')))
              else '[]'::jsonb end,
         pm.updated_at
  from public.org_memberships m
  join public.profiles p on p.id = m.profile_id
  left join public.player_medical pm on pm.org_id = m.org_id and pm.player_id = m.profile_id
  left join lateral (
    select * from public.team_registrations tr
    where tr.org_id = m.org_id and tr.player_id = m.profile_id and tr.status = 'registered'
    order by tr.created_at desc limit 1
  ) r on true
  where m.org_id = p_org and m.role = 'player' and m.status <> 'inactive'
    and private.is_org_staff(p_org)
  order by coalesce(nullif(p.full_name, ''), p.email);
$$;
revoke all on function public.medical_cards(uuid) from public;
grant execute on function public.medical_cards(uuid) to authenticated;
