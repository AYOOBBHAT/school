-- Migration: Refresh PostgREST schema cache
-- This migration ensures PostgREST can see all tables including teacher_assignments
-- Run this if you're getting "Could not find the table in the schema cache" errors

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';

-- Alternative method: Use pg_notify function
SELECT pg_notify('pgrst', 'reload schema');

-- Verify teacher_assignments table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'teacher_assignments'
  ) THEN
    RAISE EXCEPTION 'teacher_assignments table does not exist. Please run migration 003_add_teacher_assignments.sql first.';
  END IF;
END $$;

