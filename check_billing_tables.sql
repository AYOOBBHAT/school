-- Check if billing-related tables exist in your database
-- Run this in Supabase SQL Editor to see which tables exist

-- ============================================
-- Check if billing tables exist
-- ============================================

SELECT 
  'fee_bills' as table_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fee_bills') 
    THEN '✅ EXISTS' 
    ELSE '❌ DOES NOT EXIST' 
  END as status,
  (SELECT COUNT(*) FROM fee_bills) as row_count
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fee_bills')

UNION ALL

SELECT 
  'fee_bill_items' as table_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fee_bill_items') 
    THEN '✅ EXISTS' 
    ELSE '❌ DOES NOT EXIST' 
  END as status,
  (SELECT COUNT(*) FROM fee_bill_items) as row_count
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fee_bill_items')

UNION ALL

SELECT 
  'fee_payments' as table_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fee_payments') 
    THEN '✅ EXISTS' 
    ELSE '❌ DOES NOT EXIST' 
  END as status,
  (SELECT COUNT(*) FROM fee_payments) as row_count
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fee_payments')

UNION ALL

SELECT 
  'optional_fees' as table_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'optional_fees') 
    THEN '✅ EXISTS' 
    ELSE '❌ DOES NOT EXIST' 
  END as status,
  (SELECT COUNT(*) FROM optional_fees) as row_count
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'optional_fees')

UNION ALL

SELECT 
  'student_custom_fees' as table_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_custom_fees') 
    THEN '✅ EXISTS' 
    ELSE '❌ DOES NOT EXIST' 
  END as status,
  (SELECT COUNT(*) FROM student_custom_fees) as row_count
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_custom_fees');

-- ============================================
-- Alternative: Simple check (easier to read)
-- ============================================

-- Uncomment below to see all tables that match billing-related names:

/*
SELECT 
  table_name,
  'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'fee_bills',
    'fee_bill_items', 
    'fee_payments',
    'optional_fees',
    'student_custom_fees'
  )
ORDER BY table_name;
*/

-- ============================================
-- Check if migration 012 was applied
-- ============================================

-- Check migration history (if you have a migrations table)
-- SELECT * FROM supabase_migrations.schema_migrations 
-- WHERE version LIKE '%012%' OR name LIKE '%remove_optional_and_billing%'
-- ORDER BY version DESC;
