-- Migration: Enforce RLS Policy Coverage
-- Purpose: Guardrail to prevent silent RLS failures and accidental service-role usage
--          Ensures all RLS-enabled tables have SELECT policies
-- Author: Senior SQL Developer
-- Date: 2026-01-19

-- ============================================
-- CONTEXT & RATIONALE
-- ============================================
-- In a multi-tenant Supabase SaaS:
-- 1. RLS must be enabled on all tables with user data
-- 2. If RLS is enabled but no SELECT policy exists, queries will:
--    - Return 0 rows (silent failure)
--    - Force developers to use service role (security risk)
-- 3. This migration acts as a guardrail to catch this misconfiguration
--
-- This migration does NOT:
-- - Add business policies (that's done in other migrations)
-- - Modify data
-- - Drop tables
--
-- This migration DOES:
-- - Check for tables with RLS enabled but no SELECT policies
-- - FAIL with clear error if misconfiguration found
-- - Provide verification query for ongoing monitoring

-- ============================================
-- PART A: DETECT TABLES WITH RLS BUT NO SELECT POLICIES
-- ============================================

do $$
declare
  v_tables_without_policies text[];
  v_table_name text;
  v_policy_count integer;
  v_error_message text;
begin
  -- Find all tables in public schema with RLS enabled but no SELECT policies
  select array_agg(tablename order by tablename)
  into v_tables_without_policies
  from (
    select 
      t.tablename,
      c.relname as table_relname
    from pg_tables t
    join pg_class c on c.relname = t.tablename
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = t.schemaname
    where t.schemaname = 'public'
      and c.relkind = 'r'  -- Only regular tables (not views, sequences, etc.)
      and c.relrowsecurity = true  -- RLS is enabled
      and not exists (
        -- Check if any SELECT policy exists for this table
        select 1
        from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = t.tablename
          and p.policyname is not null
          and (
            -- SELECT policies
            p.cmd = 'SELECT' or
            -- Policies that apply to SELECT (cmd = '*' or cmd = 'r')
            p.cmd = '*' or
            p.cmd = 'r'
          )
      )
  ) problematic_tables;

  -- If any tables found, fail with clear error message
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

  -- If we reach here, all RLS-enabled tables have SELECT policies
  raise notice 'RLS Policy Coverage Check: PASSED - All RLS-enabled tables have SELECT policies';
end $$;

-- ============================================
-- PART B: VERIFICATION QUERY
-- ============================================
-- Run this query to see RLS status and policy counts for all tables
-- This helps identify potential issues before they cause problems

/*
-- Verification Query: RLS Status and Policy Coverage
-- Run this in Supabase SQL Editor to monitor RLS policy coverage

select 
  t.tablename as table_name,
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
from pg_tables t
join pg_class c on c.relname = t.tablename
join pg_namespace n on n.oid = c.relnamespace and n.nspname = t.schemaname
left join (
  select 
    tablename,
    count(*) filter (where cmd = 'SELECT' or cmd = '*' or cmd = 'r') as select_policy_count,
    count(*) as total_policy_count
  from pg_policies
  where schemaname = 'public'
  group by tablename
) policy_counts on policy_counts.tablename = t.tablename
where t.schemaname = 'public'
  and c.relkind = 'r'  -- Only regular tables
order by 
  case 
    when c.relrowsecurity = true and coalesce(policy_counts.select_policy_count, 0) = 0 
    then 1  -- Show problematic tables first
    else 2
  end,
  t.tablename;
*/

-- ============================================
-- PART C: SUMMARY
-- ============================================
-- This migration serves as a guardrail to ensure:
-- 1. No tables have RLS enabled without SELECT policies
-- 2. Developers cannot accidentally create tables with RLS but no policies
-- 3. Silent RLS failures are caught early
-- 4. Service-role usage is not forced due to missing policies
--
-- If this migration fails:
-- - Review the listed tables
-- - Add appropriate SELECT policies in a separate migration
-- - Or disable RLS if the table doesn't need it
--
-- This migration is:
-- ✅ Idempotent (safe to run multiple times)
-- ✅ Production-safe (read-only check, no data modification)
-- ✅ Fail-fast (catches issues immediately)

-- ============================================
-- REFRESH SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';
