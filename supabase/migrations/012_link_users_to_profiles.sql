-- ============================================
-- LINK AUTH USERS TO PROFILES AND CREATE STUDENTS
-- ============================================
-- Run this AFTER creating auth users
-- 
-- INSTRUCTIONS:
-- 1. First, create auth users via:
--    - App signup flow, OR
--    - Supabase Dashboard > Authentication > Add User
-- 2. Update the email addresses in the queries below to match your created users
-- 3. Run this script
-- ============================================

-- ============================================
-- OPTION 1: Manual Profile Creation
-- ============================================
-- Update the email addresses and run these queries one by one

-- Create Principal Profile
-- UPDATE: Change 'principal@demoschool.edu' to your principal's email
INSERT INTO profiles (id, school_id, role, full_name, email, phone, approval_status)
SELECT 
  au.id,
  s.id,
  'principal',
  'Principal John Doe',
  au.email,
  '+91-9876543211',
  'approved'
FROM auth.users au
CROSS JOIN schools s
WHERE au.email = 'principal@demoschool.edu'  -- UPDATE THIS EMAIL
AND s.name = 'Demo School'
ON CONFLICT (id) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  role = 'principal',
  approval_status = 'approved';

-- Create Clerk Profile
-- UPDATE: Change 'clerk@demoschool.edu' to your clerk's email
INSERT INTO profiles (id, school_id, role, full_name, email, phone, approval_status)
SELECT 
  au.id,
  s.id,
  'clerk',
  'Clerk Jane Smith',
  au.email,
  '+91-9876543212',
  'approved'
FROM auth.users au
CROSS JOIN schools s
WHERE au.email = 'clerk@demoschool.edu'  -- UPDATE THIS EMAIL
AND s.name = 'Demo School'
ON CONFLICT (id) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  role = 'clerk',
  approval_status = 'approved';

-- Create Teacher Profiles
-- UPDATE: Change emails to match your teacher users
INSERT INTO profiles (id, school_id, role, full_name, email, phone, approval_status)
SELECT 
  au.id,
  s.id,
  'teacher',
  'Teacher ' || row_number() OVER (ORDER BY au.email),
  au.email,
  '+91-98765' || LPAD((row_number() OVER (ORDER BY au.email) + 10)::text, 5, '0'),
  'approved'
FROM auth.users au
CROSS JOIN schools s
WHERE au.email IN ('teacher1@demoschool.edu', 'teacher2@demoschool.edu')  -- UPDATE THESE EMAILS
AND s.name = 'Demo School'
ON CONFLICT (id) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  role = 'teacher',
  approval_status = 'approved';

-- Create Student Profiles
-- UPDATE: Change email pattern to match your student users
INSERT INTO profiles (id, school_id, role, full_name, email, phone, approval_status)
SELECT 
  au.id,
  s.id,
  'student',
  'Student ' || row_number() OVER (ORDER BY au.email),
  au.email,
  '+91-98765' || LPAD((row_number() OVER (ORDER BY au.email) + 20)::text, 5, '0'),
  'approved'
FROM auth.users au
CROSS JOIN schools s
WHERE au.email LIKE 'student%@demoschool.edu'  -- UPDATE THIS PATTERN
AND s.name = 'Demo School'
ON CONFLICT (id) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  role = 'student',
  approval_status = 'approved';

-- ============================================
-- CREATE STUDENT RECORDS
-- ============================================
-- This assigns students to classes and sections

-- Assign students to Grade 1, Section A
INSERT INTO students (profile_id, class_group_id, section_id, roll_number, admission_date, status, school_id)
SELECT 
  p.id,
  cg.id,
  sec.id,
  'ROLL-' || LPAD((row_number() OVER (ORDER BY p.id))::text, 3, '0'),
  CURRENT_DATE - INTERVAL '1 year',
  'active',
  p.school_id
FROM profiles p
CROSS JOIN class_groups cg
CROSS JOIN sections sec
WHERE p.role = 'student'
AND p.school_id = (SELECT id FROM schools WHERE name = 'Demo School' LIMIT 1)
AND cg.school_id = p.school_id
AND cg.name = 'Grade 1'
AND sec.class_group_id = cg.id
AND sec.name = 'A'
AND NOT EXISTS (
  SELECT 1 FROM students s WHERE s.profile_id = p.id
)
LIMIT 10;

-- Assign remaining students to Grade 2, Section A
INSERT INTO students (profile_id, class_group_id, section_id, roll_number, admission_date, status, school_id)
SELECT 
  p.id,
  cg.id,
  sec.id,
  'ROLL-' || LPAD((100 + row_number() OVER (ORDER BY p.id))::text, 3, '0'),
  CURRENT_DATE - INTERVAL '1 year',
  'active',
  p.school_id
FROM profiles p
CROSS JOIN class_groups cg
CROSS JOIN sections sec
WHERE p.role = 'student'
AND p.school_id = (SELECT id FROM schools WHERE name = 'Demo School' LIMIT 1)
AND cg.school_id = p.school_id
AND cg.name = 'Grade 2'
AND sec.class_group_id = cg.id
AND sec.name = 'A'
AND NOT EXISTS (
  SELECT 1 FROM students s WHERE s.profile_id = p.id
)
LIMIT 10;

-- ============================================
-- ASSIGN STUDENTS TO TRANSPORT ROUTES
-- ============================================
-- Assign first 5 students to Route A
INSERT INTO student_transport (student_id, route_id, school_id, stop_name, is_active)
SELECT 
  s.id,
  tr.id,
  s.school_id,
  'Stop ' || row_number() OVER (ORDER BY s.id),
  true
FROM students s
CROSS JOIN transport_routes tr
WHERE s.school_id = (SELECT id FROM schools WHERE name = 'Demo School' LIMIT 1)
AND tr.school_id = s.school_id
AND tr.route_name = 'Route A'
AND NOT EXISTS (
  SELECT 1 FROM student_transport st 
  WHERE st.student_id = s.id AND st.is_active = true
)
LIMIT 5;

-- Assign next 5 students to Route B
INSERT INTO student_transport (student_id, route_id, school_id, stop_name, is_active)
SELECT 
  s.id,
  tr.id,
  s.school_id,
  'Stop ' || row_number() OVER (ORDER BY s.id),
  true
FROM students s
CROSS JOIN transport_routes tr
WHERE s.school_id = (SELECT id FROM schools WHERE name = 'Demo School' LIMIT 1)
AND tr.school_id = s.school_id
AND tr.route_name = 'Route B'
AND NOT EXISTS (
  SELECT 1 FROM student_transport st 
  WHERE st.student_id = s.id AND st.is_active = true
)
LIMIT 5;

-- ============================================
-- CREATE PARENT PROFILES AND LINK TO STUDENTS
-- ============================================
-- UPDATE: Change email pattern to match your parent users
INSERT INTO profiles (id, school_id, role, full_name, email, phone, approval_status)
SELECT 
  au.id,
  s.id,
  'parent',
  'Parent of ' || p.full_name,
  au.email,
  '+91-98765' || LPAD((row_number() OVER (ORDER BY au.email) + 50)::text, 5, '0'),
  'approved'
FROM auth.users au
CROSS JOIN schools s
CROSS JOIN profiles p
WHERE au.email LIKE 'parent%@demoschool.edu'  -- UPDATE THIS PATTERN
AND s.name = 'Demo School'
AND p.role = 'student'
AND p.school_id = s.id
ON CONFLICT (id) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  role = 'parent',
  approval_status = 'approved';

-- Link parents to students (one parent per student)
INSERT INTO student_guardians (student_id, guardian_profile_id, relationship)
SELECT 
  s.id,
  p.id,
  'parent'
FROM students s
CROSS JOIN profiles p
WHERE s.school_id = (SELECT id FROM schools WHERE name = 'Demo School' LIMIT 1)
AND p.role = 'parent'
AND p.school_id = s.school_id
AND NOT EXISTS (
  SELECT 1 FROM student_guardians sg WHERE sg.student_id = s.id
)
LIMIT 10;

-- ============================================
-- QUICK REFERENCE: EMAIL PATTERNS TO CREATE
-- ============================================
-- Create these users in Supabase Dashboard > Authentication:
--
-- Principal:
--   - principal@demoschool.edu
--
-- Clerk:
--   - clerk@demoschool.edu
--
-- Teachers:
--   - teacher1@demoschool.edu
--   - teacher2@demoschool.edu
--
-- Students:
--   - student1@demoschool.edu
--   - student2@demoschool.edu
--   - student3@demoschool.edu
--   ... (up to 20 students)
--
-- Parents:
--   - parent1@demoschool.edu
--   - parent2@demoschool.edu
--   ... (one per student)
--
-- After creating users, update the email addresses in this script
-- and run it again.
-- ============================================

