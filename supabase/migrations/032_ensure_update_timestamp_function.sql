-- Migration: Ensure update_updated_at_column function exists
-- This function is used by triggers to update the updated_at column

-- ============================================
-- 1. Create update_updated_at_column function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. Add comment
-- ============================================
COMMENT ON FUNCTION update_updated_at_column() IS 
  'Automatically updates the updated_at column to current timestamp when a row is updated';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
