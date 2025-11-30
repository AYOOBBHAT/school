-- Migration: Remove optional fees, student custom fees, fee bills and payments
-- Purpose: Drop tables, policies, triggers and helper functions related to optional fees, custom fees, billing and payment tracking.
-- IMPORTANT: Backup your database before running this migration. Review backend code to remove RPC calls and endpoints that reference these objects.

-- ============================================
-- 1. Drop RLS policies that reference these tables
-- ============================================

-- Fee payments
DROP POLICY IF EXISTS mt_fee_payments_select ON fee_payments;
DROP POLICY IF EXISTS mt_fee_payments_modify ON fee_payments;

-- Fee bill items
DROP POLICY IF EXISTS mt_fee_bill_items_select ON fee_bill_items;
DROP POLICY IF EXISTS mt_fee_bill_items_modify ON fee_bill_items;

-- Fee bills
DROP POLICY IF EXISTS mt_fee_bills_select ON fee_bills;
DROP POLICY IF EXISTS mt_fee_bills_modify ON fee_bills;

-- Student custom fees
DROP POLICY IF EXISTS mt_student_custom_fees_select ON student_custom_fees;
DROP POLICY IF EXISTS mt_student_custom_fees_modify ON student_custom_fees;

-- Optional fees
DROP POLICY IF EXISTS mt_optional_fees_select ON optional_fees;
DROP POLICY IF EXISTS mt_optional_fees_modify ON optional_fees;

-- ============================================
-- 2. Drop triggers that update updated_at columns
-- ============================================

-- These triggers were created to keep updated_at columns in sync
DROP TRIGGER IF EXISTS update_fee_bills_updated_at ON fee_bills;
DROP TRIGGER IF EXISTS update_fee_payments_updated_at ON fee_payments;
DROP TRIGGER IF EXISTS update_student_custom_fees_updated_at ON student_custom_fees;
DROP TRIGGER IF EXISTS update_optional_fees_updated_at ON optional_fees;
DROP TRIGGER IF EXISTS update_fee_bill_items_updated_at ON fee_bill_items;

-- Also drop trigger that updated bill status on payment
DROP TRIGGER IF EXISTS update_bill_status_on_payment ON fee_payments;

-- ============================================
-- 3. Drop helper functions used specifically for billing
-- ============================================
DROP FUNCTION IF EXISTS update_fee_bill_status();
DROP FUNCTION IF EXISTS generate_bill_number(uuid);
DROP FUNCTION IF EXISTS generate_payment_number(uuid);

-- Note: do NOT drop general purpose helper `update_updated_at_column()` if other migrations rely on it.

-- ============================================
-- 4. Drop the tables (in an order that respects FK constraints)
-- ============================================

-- fee_payments references fee_bills and students
DROP TABLE IF EXISTS fee_payments CASCADE;

-- fee_bill_items references fee_bills and various fee tables
DROP TABLE IF EXISTS fee_bill_items CASCADE;

-- fee_bills references students
DROP TABLE IF EXISTS fee_bills CASCADE;

-- student_custom_fees references students
DROP TABLE IF EXISTS student_custom_fees CASCADE;

-- optional_fees is standalone (may be referenced by bill items)
DROP TABLE IF EXISTS optional_fees CASCADE;

-- ============================================
-- 5. Clean up any leftover objects (indexes, sequences)
-- ============================================
-- (Most such objects are dropped automatically with CASCADE; add manual drops here if you know of any.)

-- ============================================
-- 6. Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 7. Developer Notes
-- ============================================
-- After applying this migration you MUST:
-- 1) Remove or update backend code that calls RPCs `generate_bill_number` or `generate_payment_number`, or that queries/updates the dropped tables (`fee_bills`, `fee_bill_items`, `fee_payments`, `optional_fees`, `student_custom_fees`).
--    Files likely affected include: `apps/backend/src/routes/fees-comprehensive.ts`, `apps/backend/src/routes/payments.ts`, and any billing-related services.
-- 2) Remove frontend pages/components that display bills, payments, optional fees, or student overrides.
-- 3) Review other migrations or SQL files for references to these objects and update documentation.
-- 4) Take a database backup BEFORE running this migration on production.

-- End of migration
