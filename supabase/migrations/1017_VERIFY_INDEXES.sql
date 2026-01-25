-- Verification Query: Check All Critical Clerk Indexes
-- Run this after migration 1017 to verify all indexes were created successfully

-- ============================================
-- 1. Monthly Fee Components Indexes
-- ============================================
SELECT 
  'monthly_fee_components' as table_name,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'monthly_fee_components'
  AND indexname IN (
    'idx_mfc_student_school_period',
    'idx_mfc_student_pending',
    'idx_mfc_period_range',
    'idx_mfc_status_filter'
  )
ORDER BY indexname;

-- ============================================
-- 2. Monthly Fee Payments Indexes
-- ============================================
SELECT 
  'monthly_fee_payments' as table_name,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'monthly_fee_payments'
  AND indexname IN (
    'idx_payments_student_date',
    'idx_payments_receipt'
  )
ORDER BY indexname;

-- ============================================
-- 3. Students Table Indexes
-- ============================================
SELECT 
  'students' as table_name,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'students'
  AND indexname = 'idx_students_school_status_class'
ORDER BY indexname;

-- ============================================
-- 4. Summary: All Critical Indexes
-- ============================================
SELECT 
  tablename,
  COUNT(*) as index_count,
  array_agg(indexname ORDER BY indexname) as index_names
FROM pg_indexes 
WHERE tablename IN ('monthly_fee_components', 'monthly_fee_payments', 'students')
  AND indexname IN (
    'idx_mfc_student_school_period',
    'idx_mfc_student_pending',
    'idx_mfc_period_range',
    'idx_mfc_status_filter',
    'idx_payments_student_date',
    'idx_payments_receipt',
    'idx_students_school_status_class'
  )
GROUP BY tablename
ORDER BY tablename;

-- ============================================
-- 5. Expected Results
-- ============================================
-- monthly_fee_components: 4 indexes
--   - idx_mfc_student_school_period
--   - idx_mfc_student_pending
--   - idx_mfc_period_range
--   - idx_mfc_status_filter
--
-- monthly_fee_payments: 2 indexes
--   - idx_payments_student_date
--   - idx_payments_receipt
--
-- students: 1 index
--   - idx_students_school_status_class
--
-- Total: 7 indexes
