-- Migration: Add username-based authentication for students
-- Students will use username instead of email to allow multiple children per parent email

-- Add username column to profiles table (unique per school)
alter table profiles 
add column if not exists username text;

-- Add password_reset_required flag to track if student needs to reset password
alter table profiles 
add column if not exists password_reset_required boolean default false;

-- Create unique index for username per school (students can have same username in different schools)
create unique index if not exists idx_profiles_username_school on profiles(username, school_id) 
where username is not null;

-- Add comments
comment on column profiles.username is 'Username for student login (unique per school)';
comment on column profiles.password_reset_required is 'Flag to indicate if user must reset password on next login';

