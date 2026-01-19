# Migration Run Guide
**Date:** 2026-01-19

---

## ⚠️ Important: Which Files to Run

### ✅ **MUST RUN** (Actual Migrations)

These are SQL migrations that modify your database schema:

1. **`1010_fix_schools_rls_with_profile_fallback.sql`** ✅ **RUN THIS**
   - Fixes RLS policy for schools table
   - Creates `user_school_id()` helper function
   - **Action:** Run in Supabase SQL Editor

2. **`1012_final_rls_security_audit_and_fix.sql`** ✅ **RUN THIS**
   - Enables RLS on all tables (only if they exist)
   - Grants permissions on views
   - **Action:** Run in Supabase SQL Editor

3. **`1013_audit_and_secure_views.sql`** ✅ **RUN THIS**
   - Grants SELECT permissions on views to authenticated users
   - Documents view security
   - **Action:** Run in Supabase SQL Editor

### ❌ **DO NOT RUN** (Not Migrations)

These files are **NOT migrations** and should **NOT** be run:

1. **`debug-pending-approvals.sql`** ❌ **DO NOT RUN**
   - This is a **debug query file** for troubleshooting
   - Contains SELECT queries only
   - **Action:** Use for debugging only, not as a migration

2. **`fix_missing_school.sql`** ❌ **DOES NOT EXIST**
   - This file was deleted
   - **Action:** Ignore

3. **`schema.sql`** ❌ **DO NOT RUN**
   - This is the main schema file (reference only)
   - Supabase uses migrations, not schema.sql
   - **Action:** Reference only, do not run

4. **`1011_set_app_metadata_for_existing_users.sql`** ❌ **DO NOT RUN**
   - This is **documentation only**
   - Contains comments and Node.js script example
   - **Action:** Read for reference, app_metadata is set automatically on login

---

## 📋 Step-by-Step Instructions

### Step 1: Run Migration 1010
```sql
-- File: 1010_fix_schools_rls_with_profile_fallback.sql
-- Run this in Supabase SQL Editor
```

**What it does:**
- Creates `user_school_id()` helper function
- Updates `schools_read_own` RLS policy to check profiles table as fallback
- Ensures RLS is enabled on schools table

### Step 2: Run Migration 1012
```sql
-- File: 1012_final_rls_security_audit_and_fix.sql
-- Run this in Supabase SQL Editor
```

**What it does:**
- Enables RLS on all tables (only if they exist)
- Grants SELECT permissions on views
- Safe to run multiple times (checks if tables exist first)

### Step 3: Run Migration 1013
```sql
-- File: 1013_audit_and_secure_views.sql
-- Run this in Supabase SQL Editor
```

**What it does:**
- Grants SELECT permissions on all views to authenticated users
- Documents view security status
- Safe to run multiple times

---

## ✅ Verification

After running migrations, verify with these queries:

### Check RLS is enabled:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
WHERE schemaname = 'public' 
  AND rowsecurity = true
ORDER BY tablename;
```

### Check views exist:
```sql
SELECT viewname 
FROM pg_views 
WHERE schemaname = 'public'
ORDER BY viewname;
```

### Check helper function exists:
```sql
SELECT proname, prosecdef 
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' 
  AND proname = 'user_school_id';
```

---

## 🚨 Important Notes

1. **Run migrations in order:** 1010 → 1012 → 1013
2. **Do NOT run debug files** as migrations
3. **Do NOT run schema.sql** - it's reference only
4. **Migration 1011** is documentation only - no SQL to run
5. **All migrations are idempotent** - safe to run multiple times

---

## 📝 Summary

**Files to RUN:**
- ✅ `1010_fix_schools_rls_with_profile_fallback.sql`
- ✅ `1012_final_rls_security_audit_and_fix.sql`
- ✅ `1013_audit_and_secure_views.sql`

**Files to IGNORE:**
- ❌ `debug-pending-approvals.sql` (debug queries only)
- ❌ `fix_missing_school.sql` (deleted)
- ❌ `schema.sql` (reference only)
- ❌ `1011_set_app_metadata_for_existing_users.sql` (documentation only)

---

**Last Updated:** 2026-01-19
