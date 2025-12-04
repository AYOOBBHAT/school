-- Migration: Ensure fee_type column exists in fee_categories
-- This migration ensures the fee_type column exists and refreshes the schema cache

-- ============================================
-- Add fee_type column if it doesn't exist
-- ============================================
DO $$
BEGIN
  -- Check if fee_type column exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'fee_categories' 
    AND column_name = 'fee_type'
  ) THEN
    -- Add the fee_type column
    ALTER TABLE fee_categories
    ADD COLUMN fee_type text CHECK (fee_type IN ('tuition', 'transport', 'uniform', 'admission', 'annual', 'term', 'optional', 'custom')) NOT NULL DEFAULT 'optional';
    
    -- Update existing rows to have a default fee_type
    UPDATE fee_categories 
    SET fee_type = 'optional' 
    WHERE fee_type IS NULL;
    
    RAISE NOTICE 'Added fee_type column to fee_categories table';
  ELSE
    RAISE NOTICE 'fee_type column already exists in fee_categories table';
  END IF;
END $$;

-- ============================================
-- Ensure the check constraint is correct
-- ============================================
-- Drop existing constraint if it exists and doesn't include 'custom'
DO $$
BEGIN
  -- Check if constraint exists and needs updating
  IF EXISTS (
    SELECT 1 
    FROM information_schema.check_constraints 
    WHERE constraint_name LIKE '%fee_categories_fee_type%'
  ) THEN
    -- Drop the old constraint
    ALTER TABLE fee_categories DROP CONSTRAINT IF EXISTS fee_categories_fee_type_check;
    
    -- Add the new constraint with 'custom' included
    ALTER TABLE fee_categories
    ADD CONSTRAINT fee_categories_fee_type_check 
    CHECK (fee_type IN ('tuition', 'transport', 'uniform', 'admission', 'annual', 'term', 'optional', 'custom'));
    
    RAISE NOTICE 'Updated fee_type constraint to include custom';
  END IF;
END $$;

-- ============================================
-- Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

