-- Migration: Add gender column to profiles for reporting
-- Allows principals to view gender-wise breakdowns for students and staff

alter table profiles
  add column if not exists gender text;

comment on column profiles.gender is 'Optional gender label for reporting (e.g., Male, Female, Other).';

-- Refresh schema cache so PostgREST picks up the new column
notify pgrst, 'reload schema';


