-- =============================================================================
-- Per-team features: turn optional sections on or off, plus the team type
-- chosen at setup (used to pick sensible defaults).
-- =============================================================================

alter table public.organizations
  add column modules text[] not null
    default array['health', 'videos', 'practices', 'games', 'messages']
    check (modules <@ array['health', 'videos', 'practices', 'games', 'messages']::text[]),
  add column team_type text
    check (team_type in ('high_school', 'college', 'travel', 'youth', 'facility', 'other'));
