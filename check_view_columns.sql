-- ============================================
-- Check what columns exist in teacher_unpaid_salary_months view
-- Run this first to see what columns are available
-- ============================================

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'teacher_unpaid_salary_months'
ORDER BY ordinal_position;
