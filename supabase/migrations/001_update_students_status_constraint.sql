-- Migration: Update students table status constraint to allow 'pending'
-- This migration updates the check constraint on the students.status column
-- to include 'pending' as a valid status value and sets it as the default.

-- Step 1: Drop the existing constraint
ALTER TABLE students 
DROP CONSTRAINT IF EXISTS students_status_check;

-- Step 2: Add the new constraint that allows 'active', 'inactive', and 'pending'
ALTER TABLE students
ADD CONSTRAINT students_status_check 
CHECK (status IN ('active', 'inactive', 'pending'));

-- Step 3: Update the default value to 'pending' for new records
ALTER TABLE students
ALTER COLUMN status SET DEFAULT 'pending';

-- Step 4: Optionally, update existing students with null or invalid status to 'pending'
-- (Only if you want to migrate existing data)
-- UPDATE students SET status = 'pending' WHERE status IS NULL OR status NOT IN ('active', 'inactive', 'pending');

COMMENT ON COLUMN students.status IS 'Student status: active (approved and enrolled), inactive (inactive/left), pending (awaiting approval)';

