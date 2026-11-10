-- =============================================================================
-- Signed-out visitors (the `anon` role) could call most privileged functions.
-- Each one checks who is calling, so nothing was exposed, but Supabase gives
-- `anon` its own execute right on every new function, and `revoke ... from
-- public` alone does not remove that. Take it away everywhere except the three
-- functions that signed-out pages really use:
--   get_registration_form   the public season-registration offer (/join)
--   public_team_games       9D Leagues public team pages
--   public_teams_games      9D Leagues public scoreboards
-- =============================================================================

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig,
           exists (
             select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
             where a.grantee = 0 and a.privilege_type = 'EXECUTE'
           ) as open_to_all
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname not in ('get_registration_form', 'public_team_games', 'public_teams_games')
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    -- Open to everyone: keep it for signed-in people and the server, then close it.
    if f.open_to_all then
      execute format('grant execute on function %s to authenticated, service_role', f.sig);
      execute format('revoke execute on function %s from public', f.sig);
    end if;
    execute format('revoke execute on function %s from anon', f.sig);
  end loop;
end;
$$;

-- Pin the search path on the shared updated_at trigger (Supabase security lint).
alter function private.set_updated_at() set search_path = '';
