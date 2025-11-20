-- Migration: Create Admin User
-- This script helps you create an admin user for the platform
-- 
-- INSTRUCTIONS:
-- 1. First, create an auth user in Supabase Dashboard:
--    - Go to Authentication > Users > Add User
--    - Enter email: admin@jhelumverse.com (or your preferred email)
--    - Enter password: (choose a strong password)
--    - Check "Auto Confirm User"
--    - Click "Create User"
--    - Copy the User ID (UUID)
--
-- 2. Then run this SQL script, replacing:
--    - 'YOUR_USER_ID_HERE' with the UUID from step 1
--    - 'admin@jhelumverse.com' with your admin email
--    - 'Admin User' with your admin's full name
--
-- 3. After running this script, you can log in with the admin email/password
--    and you'll be redirected to /admin/dashboard

-- Create Admin Profile
-- Replace 'YOUR_USER_ID_HERE' with the actual user ID from Supabase Auth
INSERT INTO profiles (
  id,
  role,
  full_name,
  email,
  approval_status,
  school_id
)
VALUES (
  'connect_ayoobbhat'::uuid,  -- Replace with actual user ID
  'admin',
  'Admin User',                -- Replace with admin's full name
  'connect.ayoob.bhat@gmail.com',     -- Replace with admin's email
  'approved',
  NULL                         -- Admins don't belong to a specific school
)
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  approval_status = 'approved',
  school_id = NULL;

-- Verify the admin user was created
SELECT 
  id,
  role,
  full_name,
  email,
  approval_status,
  school_id
FROM profiles
WHERE role = 'admin';

