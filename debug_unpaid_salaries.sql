-- ============================================
-- SQL Queries to Debug Unpaid Salaries
-- School ID: e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b
-- Run these in Supabase SQL Editor
-- ============================================

-- School ID constant (replace 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b' with this value)
-- 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'

-- ============================================
-- 1. Check teacher_salary_summary view (what you see in Supabase)
-- ============================================
SELECT 
  teacher_name,
  teacher_email,
  school_id,
  total_salary_due,
  total_salary
FROM teacher_salary_summary
WHERE school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
ORDER BY total_salary_due DESC;

-- ============================================
-- 2. Check teacher_unpaid_salary_months view (what backend uses)
-- ============================================
-- This is the view the backend queries with is_unpaid = true
-- Note: Removed credit_applied and effective_paid_amount as they may not exist in all versions
SELECT 
  teacher_id,
  teacher_name,
  teacher_email,
  school_id,
  month,
  year,
  period_start,
  period_label,
  net_salary,
  paid_amount,
  pending_amount,
  payment_status,
  is_unpaid,
  days_since_period_start,
  payment_date
FROM teacher_unpaid_salary_months
WHERE school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
  AND is_unpaid = true
ORDER BY teacher_name, year DESC, month DESC;

-- ============================================
-- 3. Check unpaid_teachers_summary view (backend uses this too)
-- ============================================
SELECT 
  teacher_id,
  teacher_name,
  teacher_email,
  school_id,
  unpaid_months_count,
  total_unpaid_amount,
  max_days_unpaid,
  oldest_unpaid_month,
  latest_unpaid_month
FROM unpaid_teachers_summary
WHERE school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
ORDER BY total_unpaid_amount DESC;

-- ============================================
-- 4. Check active teachers with salary structure
-- ============================================
SELECT 
  p.id as teacher_id,
  p.full_name as teacher_name,
  p.email as teacher_email,
  p.school_id,
  p.role,
  p.approval_status,
  tss.id as salary_structure_id,
  tss.base_salary,
  tss.hra,
  tss.other_allowances,
  tss.fixed_deductions,
  (tss.base_salary + tss.hra + tss.other_allowances - tss.fixed_deductions) as expected_salary,
  tss.is_active,
  tss.effective_from,
  tss.effective_to
FROM profiles p
INNER JOIN teacher_salary_structure tss ON tss.teacher_id = p.id
WHERE p.school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
  AND p.role = 'teacher'
  AND p.approval_status = 'approved'
  AND (tss.is_active IS NULL OR tss.is_active = true)
  AND (tss.effective_to IS NULL OR tss.effective_to >= current_date)
ORDER BY p.full_name;

-- ============================================
-- 5. Check salary payments for this school
-- ============================================
SELECT 
  tsp.teacher_id,
  p.full_name as teacher_name,
  tsp.salary_month,
  tsp.salary_year,
  SUM(tsp.amount) as total_paid,
  COUNT(*) as payment_count,
  MAX(tsp.payment_date) as latest_payment_date
FROM teacher_salary_payments tsp
INNER JOIN profiles p ON p.id = tsp.teacher_id
WHERE p.school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
  AND tsp.salary_month IS NOT NULL
  AND tsp.salary_year IS NOT NULL
GROUP BY tsp.teacher_id, p.full_name, tsp.salary_month, tsp.salary_year
ORDER BY tsp.teacher_id, tsp.salary_year DESC, tsp.salary_month DESC;

-- ============================================
-- 6. Check if there are any unpaid months in the last 12 months
-- ============================================
-- This matches what the backend does (default time_scope = 'last_12_months')
SELECT 
  teacher_id,
  teacher_name,
  teacher_email,
  month,
  year,
  period_start,
  period_label,
  net_salary,
  paid_amount,
  pending_amount,
  payment_status,
  is_unpaid
FROM teacher_unpaid_salary_months
WHERE school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
  AND is_unpaid = true
  AND period_start >= date_trunc('month', current_date - interval '12 months')
  AND period_start <= date_trunc('month', current_date)
ORDER BY teacher_name, year DESC, month DESC;

-- ============================================
-- 7. Count unpaid months per teacher
-- ============================================
SELECT 
  teacher_id,
  teacher_name,
  teacher_email,
  COUNT(*) as unpaid_months_count,
  SUM(pending_amount) as total_unpaid_amount,
  MIN(period_start) as oldest_unpaid_month,
  MAX(period_start) as latest_unpaid_month
FROM teacher_unpaid_salary_months
WHERE school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
  AND is_unpaid = true
  AND period_start >= date_trunc('month', current_date - interval '12 months')
  AND period_start <= date_trunc('month', current_date)
GROUP BY teacher_id, teacher_name, teacher_email
ORDER BY total_unpaid_amount DESC;

-- ============================================
-- 8. Check for teachers with salary structure but no payments
-- ============================================
SELECT 
  p.id as teacher_id,
  p.full_name as teacher_name,
  p.email as teacher_email,
  tss.base_salary + tss.hra + tss.other_allowances - tss.fixed_deductions as expected_salary,
  COUNT(tsp.id) as payment_count
FROM profiles p
INNER JOIN teacher_salary_structure tss ON tss.teacher_id = p.id
LEFT JOIN teacher_salary_payments tsp ON tsp.teacher_id = p.id
WHERE p.school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
  AND p.role = 'teacher'
  AND p.approval_status = 'approved'
  AND (tss.is_active IS NULL OR tss.is_active = true)
GROUP BY p.id, p.full_name, p.email, tss.base_salary, tss.hra, tss.other_allowances, tss.fixed_deductions
HAVING COUNT(tsp.id) = 0
ORDER BY p.full_name;

-- ============================================
-- 9. Check RLS policies on views (if accessible)
-- ============================================
-- This might require superuser access
SELECT 
  schemaname,
  viewname,
  viewowner
FROM pg_views
WHERE viewname IN ('teacher_unpaid_salary_months', 'unpaid_teachers_summary', 'teacher_salary_summary')
ORDER BY viewname;

-- ============================================
-- 10. Compare teacher_salary_summary vs unpaid_teachers_summary
-- ============================================
-- This will show if there's a discrepancy between the two views
SELECT 
  'teacher_salary_summary' as source,
  teacher_name,
  total_salary_due,
  total_salary
FROM teacher_salary_summary
WHERE school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
  AND total_salary_due > 0

UNION ALL

SELECT 
  'unpaid_teachers_summary' as source,
  teacher_name,
  total_unpaid_amount as total_salary_due,
  0 as total_salary
FROM unpaid_teachers_summary
WHERE school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
  AND total_unpaid_amount > 0

ORDER BY teacher_name, source;
