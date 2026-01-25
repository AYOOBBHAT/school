-- Migration: Critical Indexes for Clerk Operations
-- Purpose: Add minimum required indexes for optimal clerk fee collection performance
-- These indexes are essential for:
--   - Student ledger queries (monthly fee components by student and period)
--   - Unpaid fee queries (pending amount filtering)
--   - Payment history queries (payments by student and date)
--   - Student filtering (by school, status, and class)
-- Author: Senior SQL Optimization Engineer
-- Date: 2026-01-XX

-- ============================================
-- HELPER: Safe Index Creation
-- ============================================
-- Reuse the helper function from migration 1015
-- If it doesn't exist, create it

create or replace function create_production_index(
  p_index_name text,
  p_table_name text,
  p_index_definition text,
  p_comment text default null
)
returns void language plpgsql as $$
begin
  -- Check if table exists
  if not exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
    and table_name = p_table_name
  ) then
    return;
  end if;
  
  -- Try to create the index
  begin
    execute format('create index if not exists %I on %I %s', 
      p_index_name, 
      p_table_name, 
      p_index_definition
    );
    
    -- Add comment if provided
    if p_comment is not null then
      execute format('comment on index %I is %L', p_index_name, p_comment);
    end if;
  exception
    when others then
      -- Silently skip if column doesn't exist or other error
      null;
  end;
end;
$$;

-- ============================================
-- 1. MONTHLY FEE COMPONENTS INDEXES
-- ============================================
-- Critical for clerk ledger and payment operations

-- Index: Student ledger queries (most common clerk query)
-- Optimizes: Get all fee components for a student, ordered by most recent first
-- Used in: /student/:studentId/monthly-ledger, /student/:studentId/fee-structure
select create_production_index(
  'idx_mfc_student_school_period',
  'monthly_fee_components',
  '(school_id, student_id, period_year DESC, period_month DESC) where school_id is not null',
  'Optimizes student ledger queries: Get fee components by student, ordered by most recent period first'
);

-- Index: Unpaid fee queries (critical for analytics)
-- Optimizes: Get all unpaid components for a student
-- Used in: /analytics/unpaid, unpaid fee filtering
select create_production_index(
  'idx_mfc_student_pending',
  'monthly_fee_components',
  '(school_id, student_id) where pending_amount > 0 and school_id is not null',
  'Optimizes unpaid fee queries: Fast lookup of students with pending amounts'
);

-- ============================================
-- 2. MONTHLY FEE PAYMENTS INDEXES
-- ============================================
-- Critical for payment history and receipt queries

-- Index: Payment history queries
-- Optimizes: Get payment history for a student, ordered by most recent first
-- Used in: Payment history, receipt generation, payment reports
select create_production_index(
  'idx_payments_student_date',
  'monthly_fee_payments',
  '(school_id, student_id, payment_date DESC) where school_id is not null',
  'Optimizes payment history queries: Get payments by student, ordered by most recent first'
);

-- ============================================
-- 3. STUDENTS TABLE INDEXES
-- ============================================
-- Critical for student filtering and clerk operations

-- Index: Student filtering by school, status, and class
-- Optimizes: Get active students by class, filter by status
-- Used in: Student lists, class-based queries, fee collection workflows
select create_production_index(
  'idx_students_school_status_class',
  'students',
  '(school_id, status, class_group_id) where school_id is not null',
  'Optimizes student filtering: Fast lookup of students by school, status, and class'
);

-- ============================================
-- 4. ADDITIONAL OPTIMIZATIONS
-- ============================================
-- Additional indexes that improve clerk operations

-- Index: Monthly fee components by period (for date range queries)
-- Optimizes: Get components for a specific period range
-- Used in: Ledger queries with date filters, period-based reports
select create_production_index(
  'idx_mfc_period_range',
  'monthly_fee_components',
  '(school_id, period_year, period_month, period_start, period_end) where school_id is not null',
  'Optimizes period-based queries: Fast lookup of components by date range'
);

-- Index: Payments by receipt number (for receipt lookup)
-- Optimizes: Fast receipt lookup
-- Used in: /receipt/:paymentId, receipt validation
select create_production_index(
  'idx_payments_receipt',
  'monthly_fee_payments',
  '(school_id, receipt_number) where receipt_number is not null and school_id is not null',
  'Optimizes receipt lookup: Fast search by receipt number'
);

-- Index: Monthly fee components by status (for status-based filtering)
-- Optimizes: Get components by payment status
-- Used in: Status-based reports, filtering by paid/unpaid
select create_production_index(
  'idx_mfc_status_filter',
  'monthly_fee_components',
  '(school_id, status, student_id) where school_id is not null',
  'Optimizes status-based queries: Fast filtering by payment status'
);

-- ============================================
-- ANALYZE TABLES
-- ============================================
-- Update statistics for query planner

analyze monthly_fee_components;
analyze monthly_fee_payments;
analyze students;

-- ============================================
-- REFRESH SCHEMA CACHE
-- ============================================
-- Notify PostgREST to reload schema

NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION
-- ============================================
-- Run these queries to verify indexes were created:
--
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename IN ('monthly_fee_components', 'monthly_fee_payments', 'students')
--   AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;
--
-- Expected indexes:
--   - idx_mfc_student_school_period
--   - idx_mfc_student_pending
--   - idx_mfc_period_range
--   - idx_mfc_status_filter
--   - idx_payments_student_date
--   - idx_payments_receipt
--   - idx_students_school_status_class
