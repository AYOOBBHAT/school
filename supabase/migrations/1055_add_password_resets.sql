-- ============================================
-- Password reset OTPs (persistent + secure)
-- ============================================
-- Replaces in-memory OTP storage with a DB-backed table.
-- OTPs are stored as bcrypt hashes (never store OTP in plaintext).

create table if not exists password_resets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  otp_hash text not null,
  expires_at timestamp not null,
  attempts int not null default 0,
  created_at timestamp not null default now()
);

-- Rate limiting and lookup helpers
create index if not exists idx_password_resets_profile_created_at
  on password_resets(profile_id, created_at desc);

create index if not exists idx_password_resets_profile_expires_at
  on password_resets(profile_id, expires_at desc);

-- RLS: these rows should only be accessed by service role via backend
alter table password_resets enable row level security;

drop policy if exists password_resets_no_access on password_resets;
create policy password_resets_no_access on password_resets
  for all using (false) with check (false);

-- Refresh schema cache so Supabase recognizes the new table
notify pgrst, 'reload schema';

