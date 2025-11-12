-- Debug Query: Check for pending approvals
-- Run this in Supabase SQL Editor to see what's in the database

-- 1. Check all profiles and their approval status
SELECT 
  id,
  full_name,
  email,
  role,
  school_id,
  approval_status,
  created_at
FROM profiles
ORDER BY created_at DESC;

-- 2. Check pending profiles specifically
SELECT 
  id,
  full_name,
  email,
  role,
  school_id,
  approval_status,
  created_at
FROM profiles
WHERE approval_status = 'pending'
ORDER BY created_at DESC;

-- 3. Check students table
SELECT 
  s.id,
  s.profile_id,
  s.school_id,
  s.status,
  p.full_name,
  p.email,
  p.approval_status,
  p.role
FROM students s
LEFT JOIN profiles p ON s.profile_id = p.id
ORDER BY s.created_at DESC;

-- 4. Check if there are any profiles with NULL approval_status
SELECT 
  id,
  full_name,
  email,
  role,
  school_id,
  approval_status,
  created_at
FROM profiles
WHERE approval_status IS NULL;

-- 5. Get school IDs to verify matching
SELECT 
  id,
  name,
  join_code
FROM schools
ORDER BY created_at DESC;

-- 6. Check profiles grouped by school and approval status
SELECT 
  school_id,
  approval_status,
  role,
  COUNT(*) as count
FROM profiles
GROUP BY school_id, approval_status, role
ORDER BY school_id, approval_status, role;

