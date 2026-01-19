do $$
declare
  v_tables_without_policies text[];
  v_error_message text;
begin
  select array_agg(relname order by relname)
  into v_tables_without_policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity = true
    and not (c.relname like 'pg\_%' escape '\')
    and not (c.relname like '\_%' escape '\')
    and not exists (
      select 1
      from pg_policy pol
      where pol.polrelid = c.oid
        and (pol.polcmd = 'r' or pol.polcmd = '*')
    );

  if v_tables_without_policies is not null and array_length(v_tables_without_policies, 1) > 0 then
    v_error_message := format(
      'RLS POLICY COVERAGE VIOLATION: %s table(s) have RLS enabled but no SELECT policies exist. ' ||
      'This will cause silent query failures or force service-role usage. ' ||
      'Affected tables: %s. ' ||
      'Action required: Add SELECT policies to these tables or disable RLS if not needed.',
      array_length(v_tables_without_policies, 1),
      array_to_string(v_tables_without_policies, ', ')
    );
    raise exception '%', v_error_message;
  end if;

  raise notice 'RLS Policy Coverage Check: PASSED - All RLS-enabled tables have SELECT policies';
end $$;

/*
select 
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  coalesce(policy_counts.select_policy_count, 0) as select_policy_count,
  coalesce(policy_counts.total_policy_count, 0) as total_policy_count,
  case 
    when c.relrowsecurity = true and coalesce(policy_counts.select_policy_count, 0) = 0 
    then '⚠️ RLS ENABLED BUT NO SELECT POLICY'
    when c.relrowsecurity = true and coalesce(policy_counts.select_policy_count, 0) > 0
    then '✅ RLS ENABLED WITH SELECT POLICIES'
    when c.relrowsecurity = false
    then 'ℹ️ RLS DISABLED'
    else '❓ UNKNOWN'
  end as status
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join (
  select 
    pol.polrelid,
    count(*) filter (where pol.polcmd = 'r' or pol.polcmd = '*') as select_policy_count,
    count(*) as total_policy_count
  from pg_policy pol
  group by pol.polrelid
) policy_counts on policy_counts.polrelid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'
  and not (c.relname like 'pg\_%' escape '\')
  and not (c.relname like '\_%' escape '\')
order by 
  case 
    when c.relrowsecurity = true and coalesce(policy_counts.select_policy_count, 0) = 0 
    then 1
    else 2
  end,
  c.relname;
*/

NOTIFY pgrst, 'reload schema';
