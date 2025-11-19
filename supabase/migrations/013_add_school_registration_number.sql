-- Migration: Add school registration number (unique identifier for each school)
-- This enables schools to have a unique registration number

-- Add registration_number column to schools table
alter table schools 
add column if not exists registration_number text unique;

-- Create index for faster lookups
create index if not exists idx_schools_registration_number on schools(registration_number);

-- Add comment
comment on column schools.registration_number is 'Unique registration number for the school';

