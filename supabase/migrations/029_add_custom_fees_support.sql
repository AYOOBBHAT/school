-- Migration: Custom Fees Support
-- This migration documents and ensures proper support for custom fees feature
-- Custom fees are stored in optional_fee_definitions with fee_type='custom' categories
-- Custom fees can apply to a specific class (class_group_id) or all classes (class_group_id = NULL)

-- ============================================
-- Verify fee_categories supports 'custom' type
-- ============================================
-- The fee_categories table already has fee_type check constraint that includes 'custom'
-- This is verified in migration 021_comprehensive_fee_management.sql
-- No changes needed here

-- ============================================
-- Ensure optional_fee_definitions supports NULL class_group_id
-- ============================================
-- The optional_fee_definitions.class_group_id column already allows NULL
-- This allows custom fees to apply to "All Classes"
-- The unique constraint (class_group_id, fee_category_id, fee_cycle, effective_from)
-- works correctly with NULLs in PostgreSQL (NULLs are considered distinct)

-- Add a comment to document this feature
comment on column optional_fee_definitions.class_group_id is 
  'Class this fee applies to. NULL means the fee applies to all classes.';

-- ============================================
-- Verify student_fee_overrides supports custom fees
-- ============================================
-- The student_fee_overrides table already supports:
-- - fee_category_id (references fee_categories, can be used for custom fees)
-- - discount_amount (for discounts)
-- - is_full_free (for exemptions)
-- - effective_from/effective_to (for versioning)
-- No changes needed

-- Add a comment to document custom fee overrides
comment on table student_fee_overrides is 
  'Fee overrides for students including discounts and exemptions. fee_category_id can reference custom fee categories (fee_type=custom).';

-- ============================================
-- Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

