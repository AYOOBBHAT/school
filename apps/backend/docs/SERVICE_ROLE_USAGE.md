# Service Role Key Usage Guidelines

## ⚠️ CRITICAL SECURITY RULE

**The Supabase `SUPABASE_SERVICE_ROLE_KEY` MUST NEVER be used for user-facing endpoints.**

The service role key bypasses ALL Row Level Security (RLS) policies, which means:
- **No tenant isolation** - Users could access data from other schools
- **Complete data breach risk** - If exposed, attackers have full database access
- **Violates SaaS security model** - Multi-tenant applications require strict isolation

---

## ✅ ALLOWED Use Cases

The service role key may ONLY be used for:

### 1. **Background Jobs & Scheduled Tasks**
- CSV imports
- Year-end promotions
- Salary generation
- Automated reports
- Data migrations

### 2. **Admin Operations** (Admin role only)
- Platform-wide analytics
- System configuration
- User management (admin dashboard)

### 3. **Authentication Middleware** (Limited)
- Profile lookup during authentication (to get role/school_id)
- **MUST NOT** be used for actual data queries in endpoints

### 4. **n8n Workflows**
- Automated workflows that need system-level access

---

## ❌ FORBIDDEN Use Cases

**NEVER use service role for:**

1. ❌ **Login flows** - Use anon key with user JWT
2. ❌ **Dashboard endpoints** - Use user-context client
3. ❌ **`/school/info`** - Use user-context client with RLS
4. ❌ **`/staff-admin`** - Should use user-context client (needs refactoring)
5. ❌ **`/students-admin`** - Should use user-context client (needs refactoring)
6. ❌ **Any endpoint that returns user-specific data**

---

## 📋 Current Service Role Usage Audit

### ✅ Correctly Using Service Role

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `authMiddleware` | Profile lookup during auth | ✅ OK (limited use) |
| `/admin/schools` | Admin-only platform view | ✅ OK |
| Background scripts | CSV imports, salary generation | ✅ OK |

### ⚠️ Needs Refactoring (Use User-Context Client)

| Endpoint | Current | Should Be |
|----------|---------|-----------|
| `/staff-admin` | Service role | User-context client |
| `/students-admin` | Service role | User-context client |
| `/school/info` | ✅ Fixed - Now uses user-context | ✅ Correct |

---

## 🔧 How to Use User-Context Client

### In Endpoints (Correct Pattern)

```typescript
// ✅ CORRECT: Use req.supabase (user-context client)
router.get('/info', requireRoles(['principal']), async (req, res) => {
  const { supabase, user } = req; // supabase has user's JWT token
  
  // RLS automatically enforces tenant isolation
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .eq('id', user.schoolId)
    .maybeSingle();
    
  // RLS ensures user can only access their school's data
});
```

### In Middleware (Limited Service Role Use)

```typescript
// ✅ OK: Service role for profile lookup only
const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
const { data: profile } = await adminSupabase
  .from('profiles')
  .select('role, school_id')
  .eq('id', user.id)
  .single();

// Then create user-context client for actual queries
const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: `Bearer ${token}` } }
});
```

---

## 🛡️ RLS Policy Requirements

All user-facing endpoints must have RLS policies that:

1. ✅ Check `auth.uid()` for user identity
2. ✅ Check `auth_claim('school_id')` or `user_school_id()` for tenant isolation
3. ✅ Check `auth_claim('role')` for role-based access
4. ✅ Use profiles table as fallback if JWT claims missing

Example RLS Policy:
```sql
create policy schools_read_own on schools
  for select using (
    id = user_school_id()  -- Checks both JWT and profiles
    and (
      auth_claim('role') in ('principal', 'clerk')
      or exists (
        select 1 from profiles 
        where id = auth.uid() 
        and role in ('principal', 'clerk')
        and school_id = schools.id
      )
    )
  );
```

---

## 📝 Migration Checklist

When refactoring an endpoint to use user-context client:

- [ ] Remove service role client creation
- [ ] Use `req.supabase` instead
- [ ] Verify RLS policy exists and is correct
- [ ] Test with different users from different schools
- [ ] Verify no cross-school data leakage
- [ ] Update this document

---

## 🚨 If You Must Use Service Role

If you absolutely need service role for a specific operation:

1. **Document why** in code comments
2. **Add to this file** with justification
3. **Ensure it's not user-facing**
4. **Add audit logging** for security monitoring
5. **Get senior engineer approval**

---

**Last Updated:** 2026-01-19  
**Maintained By:** Backend Team
