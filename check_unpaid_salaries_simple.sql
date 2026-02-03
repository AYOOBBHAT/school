-- ============================================
-- Simple SQL Queries to Check Unpaid Salaries
-- School ID: e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b
-- Run these in Supabase SQL Editor
-- ============================================

-- Query 1: Check teacher_salary_summary (what you see in table editor)
SELECT 
  teacher_name,
  teacher_email,
  total_salary_due,
  total_salary_paid,
  pending_salary
FROM teacher_salary_summary
WHERE school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
  AND total_salary_due > 0
ORDER BY total_salary_due DESC;

-- Query 2: Check teacher_unpaid_salary_months (what backend uses)
-- This should show unpaid months in the last 12 months
-- Note: Using * to get all columns (works regardless of view version)
SELECT 
  teacher_name,
  teacher_email,
  month,
  year,
  period_label,
  net_salary,
  paid_amount,
  pending_amount,
  payment_status,
  is_unpaid,
  period_start
FROM teacher_unpaid_salary_months
WHERE school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
  AND is_unpaid = true
  AND period_start >= date_trunc('month', current_date - interval '12 months')
  AND period_start <= date_trunc('month', current_date)
ORDER BY teacher_name, year DESC, month DESC;

-- Query 3: Check unpaid_teachers_summary (backend uses this for summary)
SELECT 
  teacher_name,
  teacher_email,
  unpaid_months_count,
  total_unpaid_amount,
  max_days_unpaid,
  oldest_unpaid_month,
  latest_unpaid_month
FROM unpaid_teachers_summary
WHERE school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
ORDER BY total_unpaid_amount DESC;

-- Query 4: Count unpaid months per teacher (last 12 months)
SELECT 
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
GROUP BY teacher_name, teacher_email
ORDER BY total_unpaid_amount DESC;

-- Query 5: Check ALL unpaid months (no date filter) - to see if date range is the issue
SELECT 
  teacher_name,
  teacher_email,
  month,
  year,
  period_label,
  pending_amount,
  payment_status,
  period_start,
  (current_date - period_start) as days_ago
FROM teacher_unpaid_salary_months
WHERE school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
  AND is_unpaid = true
ORDER BY teacher_name, year DESC, month DESC;

-- Query 6: Check if teachers have salary structure but no payments
SELECT 
  p.full_name as teacher_name,
  p.email as teacher_email,
  tss.base_salary + tss.hra + tss.other_allowances - tss.fixed_deductions as expected_salary,
  COUNT(tsp.id) as payment_count,
  COALESCE(SUM(tsp.amount), 0) as total_paid
FROM profiles p
INNER JOIN teacher_salary_structure tss ON tss.teacher_id = p.id
LEFT JOIN teacher_salary_payments tsp ON tsp.teacher_id = p.id
WHERE p.school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
  AND p.role = 'teacher'
  AND p.approval_status = 'approved'
  AND (tss.is_active IS NULL OR tss.is_active = true)
GROUP BY p.id, p.full_name, p.email, tss.base_salary, tss.hra, tss.other_allowances, tss.fixed_deductions
ORDER BY p.full_name;
