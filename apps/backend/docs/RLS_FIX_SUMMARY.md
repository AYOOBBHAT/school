# RLS Fix Implementation Summary

## ✅ Completed Changes

### 1. **Database Migration: RLS Policy Fix** (`1010_fix_schools_rls_with_profile_fallback.sql`)

Created a robust RLS policy that:
- ✅ Checks JWT custom claims (`auth_claim('school_id')`) first
- ✅ Falls back to profiles table if JWT claim is missing
- ✅ Uses helper function `user_school_id()` for clean code
- ✅ Ensures RLS is enabled on schools table

**Key Function:**
```sql
create or replace function user_school_id()
returns uuid language sql stable as $$
  select coalesce(
    auth_claim('school_id')::uuid,
    (select school_id from profiles where id = auth.uid())
  );
$$;
```

### 2. **Login Endpoint: Session Refresh** (`apps/backend/src/routes/auth.ts`)

Updated `/auth/login` to:
- ✅ Set `app_metadata` with `school_id` and `role` for JWT claims
- ✅ Refresh session immediately after updating metadata
- ✅ Return new token with updated claims in the same request
- ✅ Fallback gracefully if refresh fails

### 3. **School Info Endpoint: Enhanced Error Handling** (`apps/backend/src/routes/school.ts`)

Improved `/school/info` to:
- ✅ Use user-context Supabase client (not service role)
- ✅ Distinguish RLS denial from missing data
- ✅ Provide clear error messages for debugging
- ✅ Log detailed information for troubleshooting

### 4. **Service Role Documentation** (`apps/backend/docs/SERVICE_ROLE_USAGE.md`)

Created comprehensive documentation:
- ✅ Clear guidelines on when service role is allowed
- ✅ List of endpoints that need refactoring
- ✅ Examples of correct user-context client usage
- ✅ Security best practices

---

## 🚀 Next Steps (Required)

### Step 1: Run Database Migrations

**In Supabase Dashboard → SQL Editor:**

1. Run `supabase/migrations/1010_fix_schools_rls_with_profile_fallback.sql`
   - This fixes the RLS policy to check profiles table as fallback

2. (Optional) Run `supabase/migrations/1011_set_app_metadata_for_existing_users.sql`
   - This is a documentation file - actual update happens on next login
   - Or run the Node.js script provided in the migration file

### Step 2: Test the Fix

1. **Log out and log back in** (to get new JWT with app_metadata)
2. **Test `/school/info` endpoint** - should now work
3. **Verify RLS is working** - try accessing another school's data (should fail)

### Step 3: Monitor Logs

Watch for:
- `[school/info] RLS DENIAL` messages (indicates RLS is blocking correctly)
- `[login] Login successful` with token details
- Any 403 errors (should now have clear messages)

---

## 🔒 Security Improvements

### Before:
- ❌ Service role used for `/school/info` (bypassed RLS)
- ❌ JWT didn't have `school_id` claim
- ❌ RLS policy only checked JWT (failed if claim missing)
- ❌ No clear error messages for RLS denials

### After:
- ✅ User-context client used (RLS enforced)
- ✅ JWT includes `school_id` and `role` in app_metadata
- ✅ RLS policy checks both JWT and profiles table
- ✅ Clear error messages distinguish RLS denial from missing data
- ✅ Comprehensive documentation prevents future mistakes

---

## 📋 Endpoints Status

| Endpoint | Client Type | RLS Enforced | Status |
|----------|------------|--------------|--------|
| `/school/info` | User-context | ✅ Yes | ✅ Fixed |
| `/auth/login` | Anon + Service (limited) | ✅ Yes | ✅ Fixed |
| `/staff-admin` | Service role | ⚠️ Needs refactoring | ⚠️ TODO |
| `/students-admin` | Service role | ⚠️ Needs refactoring | ⚠️ TODO |

---

## 🐛 Troubleshooting

### Issue: Still getting 404 "School not found"

**Possible causes:**
1. Migration not run - RLS policy still old
2. User hasn't logged in again - JWT doesn't have app_metadata
3. Profile missing school_id - Check profiles table

**Solution:**
1. Verify migration `1010_fix_schools_rls_with_profile_fallback.sql` ran successfully
2. Have user log out and log back in
3. Check `profiles.school_id` for the user

### Issue: Getting 403 "Access denied"

**This is correct behavior!** RLS is working and blocking access. Check:
1. User's `profiles.school_id` matches the school they're trying to access
2. User's role is 'principal' or 'clerk'
3. JWT has correct `app_metadata` (check after login)

---

## 📝 Code Review Checklist

When reviewing PRs that use Supabase:

- [ ] Does it use `req.supabase` (user-context) for user-facing endpoints?
- [ ] Is service role only used for background jobs/admin?
- [ ] Are RLS policies defined for all tables accessed?
- [ ] Does error handling distinguish RLS denial from missing data?
- [ ] Is app_metadata set for new users?

---

**Last Updated:** 2026-01-19  
**Author:** Senior Software Engineer
