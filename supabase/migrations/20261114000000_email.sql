-- Email delivery: notifications and invitations are emailed once (claimed by
-- setting emailed_at), and each person can turn off email per kind.
alter table public.notifications add column emailed_at timestamptz;
create index notifications_unemailed_idx on public.notifications (created_at) where emailed_at is null;
alter table public.org_invitations add column emailed_at timestamptz;
alter table public.profiles add column email_muted text[] not null default '{}';
