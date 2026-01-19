-- ============================================
-- FIX MISSING SCHOOL FOR PRINCIPAL
-- ============================================
-- This script fixes the issue where a principal's profile has a school_id
-- that doesn't exist in the schools table.
-- ============================================

-- Step 1: Check if the school exists
SELECT id, name, join_code, created_at 
FROM schools 
WHERE id = 'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b';

-- Step 2: Check the principal's profile
SELECT id, email, role, school_id, full_name 
FROM profiles 
WHERE email = 'ayoob193221@gmail.com';

-- Step 3: Check all existing schools
SELECT id, name, join_code, created_at 
FROM schools 
ORDER BY created_at DESC;

-- ============================================
-- OPTION A: Create the missing school
-- ============================================
-- If you want to create the school with the expected ID:
INSERT INTO schools (id, name, join_code, contact_email, payment_status)
VALUES (
  'e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b',
  'Your School Name',  -- UPDATE THIS
  'SCHOOL123',          -- UPDATE THIS - generate a unique join code
  'ayoob193221@gmail.com',
  'paid'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- OPTION B: Update profile to point to existing school
-- ============================================
-- If you have an existing school, update the profile to point to it:
-- First, find an existing school ID:
-- SELECT id, name FROM schools LIMIT 1;

-- Then update the profile (replace 'EXISTING_SCHOOL_ID' with actual school ID):
-- UPDATE profiles 
-- SET school_id = 'EXISTING_SCHOOL_ID'  -- Replace with actual school ID
-- WHERE email = 'ayoob193221@gmail.com';

-- ============================================
-- OPTION C: Create a new school and update profile
-- ============================================
-- Create a new school with auto-generated ID:
DO $$
DECLARE
  new_school_id uuid;
BEGIN
  -- Create new school
  INSERT INTO schools (name, join_code, contact_email, payment_status)
  VALUES (
    'Your School Name',  -- UPDATE THIS
    'SCHOOL' || substr(md5(random()::text), 1, 6),  -- Auto-generate join code
    'ayoob193221@gmail.com',
    'paid'
  )
  RETURNING id INTO new_school_id;

  -- Update profile to point to new school
  UPDATE profiles 
  SET school_id = new_school_id
  WHERE email = 'ayoob193221@gmail.com';

  RAISE NOTICE 'Created school with ID: %', new_school_id;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================
-- After running one of the options above, verify:
SELECT 
  p.id as profile_id,
  p.email,
  p.role,
  p.school_id,
  s.id as school_exists,
  s.name as school_name
FROM profiles p
LEFT JOIN schools s ON s.id = p.school_id
WHERE p.email = 'ayoob193221@gmail.com';
