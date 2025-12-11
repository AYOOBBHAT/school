-- Migration: Add address column to profiles table
-- This allows storing address information for students, parents, and other users

-- Add address column to profiles table
alter table profiles
  add column if not exists address text;

-- Add comment
comment on column profiles.address is 'Address of the user (student, parent, staff, etc.)';

-- Refresh schema cache so PostgREST picks up the new column
notify pgrst, 'reload schema';

