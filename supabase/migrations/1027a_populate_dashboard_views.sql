-- Migration: Populate Dashboard Materialized Views
-- Purpose: Initial data population for materialized views (run after 1027)
-- This is split into a separate migration to avoid timeout during view creation
-- Author: Senior Developer - Production Optimization
-- Date: 2026-01-XX

-- ============================================
-- POPULATE VIEWS ONE AT A TIME
-- ============================================
-- Run these sequentially to avoid timeout
-- Each refresh is independent and can be run separately if needed

-- Step 1: Populate dashboard summary (usually fastest)
refresh materialized view mv_school_dashboard_summary;

-- Step 2: Populate gender stats (may take longer)
refresh materialized view mv_school_gender_stats;

-- Step 3: Populate fee unpaid summary (may take longest if many fee components)
refresh materialized view mv_fee_unpaid_summary;

-- ============================================
-- VERIFICATION
-- ============================================
-- After running, verify views have data:
--
-- SELECT count(*) FROM mv_school_dashboard_summary;
-- SELECT count(*) FROM mv_school_gender_stats;
-- SELECT count(*) FROM mv_fee_unpaid_summary;
--
-- If any view is empty, check for errors and re-run that specific refresh
