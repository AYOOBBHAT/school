-- ============================================
-- Diagnostic Query: Why aren't unpaid salaries showing?
-- School ID: e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b
-- ============================================

-- This query checks if the view is generating rows for teachers
-- and compares with what should be unpaid

-- Step 1: Check what months the view generates (last 12 months)
SELECT 
  date_trunc('month', generate_series(
    date_trunc('month', current_date - interval '12 months'),
    date_trunc('month', current_date),
    '1 month'::interval
  ))::date as expected_month,
  extract(month from date_trunc('month', generate_series(
    date_trunc('month', current_date - interval '12 months'),
    date_trunc('month', current_date),
    '1 month'::interval
  )))::integer as expected_month_num,
  extract(year from date_trunc('month', generate_series(
    date_trunc('month', current_date - interval '12 months'),
    date_trunc('month', current_date),
    '1 month'::interval
  )))::integer as expected_year
ORDER BY expected_year DESC, expected_month_num DESC;

-- Step 2: Check teachers with salary structure and see if they should have unpaid months
SELECT 
  p.full_name as teacher_name,
  p.email as teacher_email,
  tss.base_salary + tss.hra + tss.other_allowances - tss.fixed_deductions as expected_salary,
  tss.effective_from,
  tss.effective_to,
  tss.is_active,
  -- Count how many months they should have (from effective_from to now, max 12 months)
  CASE 
    WHEN tss.effective_from IS NULL THEN 0
    WHEN tss.effective_from > current_date THEN 0
    ELSE LEAST(
      12,
      EXTRACT(EPOCH FROM (current_date - GREATEST(tss.effective_from, current_date - interval '12 months'))) / 2592000
    )::integer
  END as expected_months_count,
  -- Count actual unpaid months in view
  (SELECT COUNT(*) 
   FROM teacher_unpaid_salary_months tum
   WHERE tum.teacher_id = p.id
     AND tum.school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
     AND tum.is_unpaid = true
  ) as actual_unpaid_months_count,
  -- Count total payments
  (SELECT COUNT(*) 
   FROM teacher_salary_payments tsp
   WHERE tsp.teacher_id = p.id
  ) as total_payments_count
FROM profiles p
INNER JOIN teacher_salary_structure tss ON tss.teacher_id = p.id
WHERE p.school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
  AND p.role = 'teacher'
  AND p.approval_status = 'approved'
  AND (tss.is_active IS NULL OR tss.is_active = true)
ORDER BY p.full_name;

-- Step 3: Check if view has ANY rows for this school (even if not unpaid)
SELECT 
  COUNT(*) as total_rows_in_view,
  COUNT(DISTINCT teacher_id) as unique_teachers,
  COUNT(*) FILTER (WHERE is_unpaid = true) as unpaid_rows,
  MIN(period_start) as oldest_period,
  MAX(period_start) as newest_period
FROM teacher_unpaid_salary_months
WHERE school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b';

-- Step 4: Check specific teachers from your Query 6 results
-- (hilal, showkat ah, teststaff, waseem)
SELECT 
  tum.teacher_name,
  tum.teacher_email,
  tum.month,
  tum.year,
  tum.period_label,
  tum.net_salary,
  tum.paid_amount,
  tum.pending_amount,
  tum.payment_status,
  tum.is_unpaid,
  tum.period_start
FROM teacher_unpaid_salary_months tum
WHERE tum.school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
  AND tum.teacher_email IN ('teacher@gmail.com', 'showkat@gmail.com', 'acv@gmail.com', 'waseem@gmail.com')
ORDER BY tum.teacher_name, tum.year DESC, tum.month DESC;

-- Step 5: Check if effective_from date is preventing months from being generated
SELECT 
  p.full_name as teacher_name,
  p.email as teacher_email,
  tss.effective_from,
  tss.effective_to,
  current_date as today,
  date_trunc('month', current_date - interval '12 months') as view_start_date,
  CASE 
    WHEN tss.effective_from IS NULL THEN 'NO EFFECTIVE FROM DATE - VIEW WONT GENERATE MONTHS'
    WHEN tss.effective_from > date_trunc('month', current_date) THEN 'EFFECTIVE FROM IS IN FUTURE - NO MONTHS YET'
    WHEN tss.effective_from > date_trunc('month', current_date - interval '12 months') THEN 'EFFECTIVE FROM IS WITHIN LAST 12 MONTHS - SOME MONTHS SHOULD EXIST'
    ELSE 'EFFECTIVE FROM IS OLDER THAN 12 MONTHS - ALL 12 MONTHS SHOULD EXIST'
  END as status
FROM profiles p
INNER JOIN teacher_salary_structure tss ON tss.teacher_id = p.id
WHERE p.school_id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b'
  AND p.role = 'teacher'
  AND p.approval_status = 'approved'
  AND (tss.is_active IS NULL OR tss.is_active = true)
ORDER BY p.full_name;
