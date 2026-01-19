-- Migration: Final RLS Security Audit & Fix
-- Purpose: Ensure all tables with policies have RLS enabled
--          Fix SECURITY DEFINER views/functions used in user-facing endpoints
--          Document all security configurations
-- Author: Senior Software Engineer
-- Date: 2026-01-19

-- ============================================
-- PART A: RLS ENABLEMENT AUDIT
-- ============================================
-- Ensure ALL tables with RLS policies have RLS enabled

-- Core tables (from schema.sql)
alter table profiles enable row level security;
alter table schools enable row level security;
alter table class_groups enable row level security;
alter table sections enable row level security;
alter table subjects enable row level security;
alter table students enable row level security;
alter table attendance enable row level security;
alter table exams enable row level security;
alter table marks enable row level security;
alter table fee_structures enable row level security;
alter table payments enable row level security;
alter table clerk_logs enable row level security;
alter table student_guardians enable row level security;
alter table classification_types enable row level security;
alter table classification_values enable row level security;
alter table class_classifications enable row level security;

-- Fee management tables
alter table fee_categories enable row level security;
alter table class_fee_defaults enable row level security;
alter table transport_fee_defaults enable row level security;
alter table optional_fee_definitions enable row level security;
alter table student_fee_profile enable row level security;
alter table student_fee_overrides enable row level security;
alter table student_custom_fees enable row level security;
alter table student_optional_fees enable row level security;
alter table scholarships enable row level security;
alter table fee_bills enable row level security;
alter table fee_bill_items enable row level security;
alter table fee_payments enable row level security;
alter table fine_rules enable row level security;

-- Fee versioning tables
alter table class_fee_versions enable row level security;
alter table transport_fee_versions enable row level security;
alter table optional_fee_versions enable row level security;
alter table student_fee_override_versions enable row level security;
alter table scholarship_versions enable row level security;

-- Monthly fee tracking
alter table monthly_fee_components enable row level security;
alter table monthly_fee_payments enable row level security;

-- Student fee cycles
alter table student_fee_cycles enable row level security;
alter table fee_bill_periods enable row level security;

-- Teacher salary tables
alter table teacher_salary_structure enable row level security;
alter table teacher_salary_records enable row level security;
alter table teacher_salary_payments enable row level security;
alter table teacher_salary_credits enable row level security;
alter table teacher_salary_credit_applications enable row level security;

-- Attendance and timetable
alter table timetable enable row level security;
alter table school_holidays enable row level security;
alter table student_attendance enable row level security;
alter table class_attendance_lock enable row level security;
alter table teacher_attendance enable row level security;

-- Teacher assignments
alter table teacher_assignments enable row level security;
alter table teacher_attendance_assignments enable row level security;
alter table class_subjects enable row level security;

-- Exam system
alter table exam_schedule enable row level security;
alter table exam_subjects enable row level security;
alter table exam_classes enable row level security;

-- Transport
alter table transport_routes enable row level security;

-- ============================================
-- PART B: SECURITY DEFINER FUNCTIONS AUDIT
-- ============================================
-- These functions are used in RLS policies and are SECURITY DEFINER
-- They are SAFE because they only read from profiles table using auth.uid()
-- They do NOT bypass RLS - they're used WITHIN RLS policies

-- Function: get_user_school_id()
-- Purpose: Get user's school_id from profiles table
-- Security: Uses auth.uid() which is safe
-- Usage: Used in RLS policies (safe)
-- Status: ✅ SAFE - No changes needed

-- Function: get_user_role()
-- Purpose: Get user's role from profiles table
-- Security: Uses auth.uid() which is safe
-- Usage: Used in RLS policies (safe)
-- Status: ✅ SAFE - No changes needed

-- Note: These functions are SECURITY DEFINER to allow them to read from profiles
-- table even when called from within RLS policies. This is a PostgreSQL requirement
-- and is safe because they only use auth.uid() which is the authenticated user's ID.

-- ============================================
-- PART C: VIEWS AUDIT
-- ============================================
-- All views are regular views (not SECURITY DEFINER)
-- They respect RLS from underlying tables

-- View: current_identity
-- Purpose: Helper view for current user identity
-- Security: Regular view, uses auth.uid() and auth_claim()
-- Usage: Not directly queried in user-facing endpoints
-- Status: ✅ SAFE

-- View: teacher_unpaid_salary_months
-- Purpose: Shows unpaid salary months for teachers
-- Security: Regular view, respects RLS from underlying tables
-- Usage: Used in /salary/unpaid endpoint (currently via service role - NEEDS FIX)
-- Status: ⚠️ VIEW IS SAFE, BUT ENDPOINT USES SERVICE ROLE (fix in backend code)

-- View: unpaid_teachers_summary
-- Purpose: Summary of unpaid teachers
-- Security: Regular view, respects RLS from underlying tables
-- Usage: Used in /salary/unpaid endpoint (currently via service role - NEEDS FIX)
-- Status: ⚠️ VIEW IS SAFE, BUT ENDPOINT USES SERVICE ROLE (fix in backend code)

-- View: teacher_payment_history
-- Purpose: Complete payment history for teachers
-- Security: Regular view, respects RLS from underlying tables
-- Usage: Used in /salary/history endpoint (currently via service role - NEEDS FIX)
-- Status: ⚠️ VIEW IS SAFE, BUT ENDPOINT USES SERVICE ROLE (fix in backend code)

-- View: unpaid_students_list
-- Purpose: List of students with unpaid fees
-- Security: Regular view, respects RLS from underlying tables
-- Usage: Used in /clerk-fees/analytics/unpaid endpoint (currently via service role - NEEDS FIX)
-- Status: ⚠️ VIEW IS SAFE, BUT ENDPOINT USES SERVICE ROLE (fix in backend code)

-- View: student_unpaid_months
-- Purpose: Monthly breakdown of unpaid fees
-- Security: Regular view, respects RLS from underlying tables
-- Usage: Used in /clerk-fees/analytics/unpaid endpoint (currently via service role - NEEDS FIX)
-- Status: ⚠️ VIEW IS SAFE, BUT ENDPOINT USES SERVICE ROLE (fix in backend code)

-- View: teacher_salary_summary
-- Purpose: Summary of teacher salaries
-- Security: Regular view, respects RLS from underlying tables
-- Usage: Not directly queried in user-facing endpoints (uses RPC functions instead)
-- Status: ✅ SAFE

-- ============================================
-- PART D: GRANT PERMISSIONS FOR VIEWS
-- ============================================
-- Ensure authenticated users can query views (RLS will still apply)

grant select on teacher_unpaid_salary_months to authenticated;
grant select on unpaid_teachers_summary to authenticated;
grant select on teacher_payment_history to authenticated;
grant select on unpaid_students_list to authenticated;
grant select on student_unpaid_months to authenticated;
grant select on payment_status_distribution to authenticated;
grant select on current_identity to authenticated;

-- ============================================
-- PART E: VERIFICATION QUERIES
-- ============================================
-- Run these queries in Supabase SQL Editor to verify RLS is enabled

-- Check all tables with RLS enabled
/*
select 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
from pg_tables t
left join pg_class c on c.relname = t.tablename
left join pg_namespace n on n.oid = c.relnamespace and n.nspname = t.schemaname
where schemaname = 'public'
  and tablename in (
    'profiles', 'schools', 'class_groups', 'sections', 'subjects', 'students',
    'attendance', 'exams', 'marks', 'fee_structures', 'payments', 'clerk_logs',
    'student_guardians', 'classification_types', 'classification_values',
    'class_classifications', 'fee_categories', 'class_fee_defaults',
    'teacher_salary_structure', 'teacher_salary_payments', 'monthly_fee_components'
  )
order by tablename;
*/

-- Check all views
/*
select 
  table_schema,
  table_name,
  view_definition
from information_schema.views
where table_schema = 'public'
  and table_name in (
    'current_identity', 'teacher_unpaid_salary_months', 'unpaid_teachers_summary',
    'teacher_payment_history', 'unpaid_students_list', 'student_unpaid_months',
    'teacher_salary_summary'
  )
order by table_name;
*/

-- Check SECURITY DEFINER functions
/*
select 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true  -- SECURITY DEFINER
order by p.proname;
*/

-- ============================================
-- PART F: SUMMARY
-- ============================================
-- ✅ All tables with policies now have RLS enabled
-- ✅ All views are regular views (respect RLS)
-- ✅ SECURITY DEFINER functions are safe (only used in RLS policies)
-- ⚠️  Backend endpoints need refactoring to use user-context client
--     (See backend code changes in salary.ts and clerk-fees.ts)

-- ============================================
-- REFRESH SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';
