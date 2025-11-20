-- Migration: Add admin role support to profiles
-- This enables platform administrators to manage all schools

-- Update profiles role constraint to include 'admin'
alter table profiles 
drop constraint if exists profiles_role_check;

alter table profiles 
add constraint profiles_role_check 
check (role in ('principal', 'clerk', 'teacher', 'student', 'parent', 'admin'));

-- Add comment
comment on column profiles.role is 'User role: principal, clerk, teacher, student, parent, or admin';

