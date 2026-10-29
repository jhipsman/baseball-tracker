-- Durable runner outcomes and field locations. Existing games/plays remain unchanged.
alter table public.game_plays
  add column play_details jsonb
    check (play_details is null or coalesce((
      jsonb_typeof(play_details) = 'object'
      and play_details ->> 'version' = '1'
      and jsonb_typeof(play_details -> 'moves') = 'array'
    ), false));

alter table public.game_plays drop constraint game_plays_kind_check;
alter table public.game_plays add constraint game_plays_kind_check
  check (kind in ('pa', 'steal', 'sub', 'half_end', 'runner', 'bases'));

comment on column public.game_plays.play_details is
  'Versioned runner movements, contact/location, third-out ruling, or an explicit base snapshot. Null for legacy plays.';

-- Reconciliation snapshots are scorer tools, not viewer-facing play events.
create policy "Only staff view base snapshots"
  on public.game_plays as restrictive for select to authenticated
  using (kind <> 'bases' or private.is_org_staff(org_id));
