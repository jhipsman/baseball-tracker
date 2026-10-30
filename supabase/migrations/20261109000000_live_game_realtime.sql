-- Live game view: push game changes (score, count, bases) to viewers the moment
-- the scorer saves. Realtime checks each subscriber against the games table's
-- row-level security, so viewers only receive games they can already read.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games'
     ) then
    alter publication supabase_realtime add table public.games;
  end if;
end $$;
