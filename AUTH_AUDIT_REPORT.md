# Authentication Audit Report — Supabase Session Architecture

**Scope:** Mobile React Native app + Backend (Supabase auth)  
**Date:** Audit performed against current codebase

---

## BACKEND CHECKS

### 1. All login routes return full Supabase session `{ user: session.user, session }`

| Route | Expected | Actual | Result |
|-------|----------|--------|--------|
| POST /auth/login | `{ user: session.user, session }` | `return res.json({ user: session.user, session })` (auth.ts:473–476) | **PASS** |
| POST /auth/login-username | Same | `return res.json({ user: session.user, session, password_reset_required })` (auth.ts:609–613) | **PASS** |
| POST /auth/signup-principal (when session exists) | Same | `return res.status(201).json({ user: session.user, session, school, redirect })` (auth.ts:163–167) | **PASS** |
| POST /auth/signup-principal (when sign-in fails) | session can be null | Returns `session: null` (auth.ts:153–158) | **PASS** |
| POST /auth/signup-join | N/A (no sign-in) | Does not return session | **PASS** |

**Verdict: PASS**

---

### 2. Session includes access_token, refresh_token, expires_at, expires_in, token_type

Backend returns the **Supabase** `session` object from `signInWithPassword()` / `signInData.session` without modification. Supabase Session type includes: `access_token`, `refresh_token`, `expires_at`, `expires_in`, `token_type`, `user`.

**Files:** `apps/backend/src/routes/auth.ts` (login, login-username, signup-principal)  
**Verdict: PASS**

---

### 3. Backend does NOT use jwt.sign()

**Grep:** No `jwt.sign` in `apps/backend/src`.  
**Verdict: PASS**

---

### 4. Auth middleware uses supabase.auth.getUser(token), NOT jwt.verify()

**File:** `apps/backend/src/middleware/auth.ts`

- `extractBearerToken(req)` (lines 19–26).
- `const { data, error } = await supabase.auth.getUser(token)` (lines 32–38).
- No `jwt.verify` in codebase.

**Verdict: PASS**

---

### 5. Backend is stateless / does NOT store sessions

No in-memory or DB session store; no session table or Redis. Auth is Bearer JWT only.

**Verdict: PASS**

---

### 6. All protected routes use auth middleware

**File:** `apps/backend/src/index.ts` (lines 155–159)

- All requests that do **not** start with `/auth` go through `authMiddleware`.
- `/auth` is public (login, signup, forgot-password, etc.).
- All other mounts (`/fees`, `/students`, `/marks`, etc.) are protected.

**Verdict: PASS**

---

## MOBILE CHECKS

### 7. Only ONE Supabase client in the mobile app

**Grep:** `createClient` appears only in `apps/mobile/src/shared/lib/supabase.ts` (line 13).  
`api.ts`, `auth.service.ts`, `auth.ts`, `AuthContext.tsx` import `supabase` from `../lib/supabase` or `../shared/lib/supabase`.

**Verdict: PASS**

---

### 8. Supabase client config: storage, autoRefreshToken, persistSession, detectSessionInUrl

**File:** `apps/mobile/src/shared/lib/supabase.ts` (lines 13–19)

```ts
auth: {
  storage: AsyncStorage,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
}
```

**Verdict: PASS**

---

### 9. Mobile does NOT manually store access_token in AsyncStorage

- No `TOKEN_KEY` or `AsyncStorage.setItem(..., token)` for access token.
- Only `USER_KEY` is used, for app **user profile** (e.g. `JSON.stringify(response.user)`), not for the token.
- Session/tokens are stored by Supabase via `auth.storage: AsyncStorage`.

**Files checked:** `auth.ts`, `api.ts`, `auth.service.ts`  
**Verdict: PASS**

---

### 10. Mobile does NOT manually refresh tokens

No `refreshSession()`, no manual refresh logic. Supabase client has `autoRefreshToken: true`.

**Verdict: PASS**

---

### 11. Mobile uses supabase.auth.setSession(session) after login

**File:** `apps/mobile/src/shared/services/auth.service.ts`

- `setSessionAndReturn()` (lines 21–27) calls `await supabase.auth.setSession(session)`.
- Used by `login()`, `loginUsername()`, and when `signupPrincipal` / `signupJoin` return a session.

**Verdict: PASS**

---

### 12. Mobile uses supabase.auth.getSession() for API requests

**File:** `apps/mobile/src/shared/services/api.ts` (lines 28–31)

- Before each request: `const { data: { session } } = await supabase.auth.getSession();`
- Token: `const token = session?.access_token ?? null;` then `Authorization: Bearer ${token}`.

**Verdict: PASS**

---

### 13. Mobile does NOT create multiple createClient() instances

Single `createClient` in `apps/mobile/src/shared/lib/supabase.ts`; rest of app imports that instance.

**Verdict: PASS**

---

### 14. AuthContext loads session using Supabase, not AsyncStorage for session

**File:** `apps/mobile/src/navigation/AuthContext.tsx`

- Initial load: `authService.loadStoredAuth()` then `authService.getCurrentUser()`.
- **File:** `apps/mobile/src/shared/services/auth.ts` — `loadStoredAuth()` (lines 82–104):
  - First calls `await supabase.auth.getSession()`.
  - If no session → clears USER_KEY and returns false.
  - If session exists → loads app user from AsyncStorage (USER_KEY) and returns true.
- Session gate is Supabase; only the **app user profile** is read from AsyncStorage.

**Verdict: PASS**

---

### 15. Logout uses supabase.auth.signOut()

**File:** `apps/mobile/src/shared/services/auth.ts` (lines 59–63)

- `logout()` calls `await supabase.auth.signOut()`, then `AsyncStorage.removeItem(USER_KEY)` and clears in-memory user.

**Verdict: PASS**

---

## REFRESH FLOW CHECK

### 16. Refresh token present and stored

Backend returns full `session` (Supabase), which includes `refresh_token`. Mobile calls `supabase.auth.setSession(session)`, so Supabase persists the session (including refresh token) via `auth.storage: AsyncStorage`.

**Verdict: PASS**

---

### 17. Refresh works automatically

`autoRefreshToken: true` on the single Supabase client. Supabase SDK handles refresh when the access token is expired or about to expire.

**Verdict: PASS**

---

### 18. Expired access token refreshed automatically

Same as above; no custom logic; Supabase handles it.

**Verdict: PASS**

---

### 19. User does NOT need to log in again after inactivity

With `persistSession: true`, `autoRefreshToken: true`, and full session (with refresh_token) returned from backend and set via `setSession()`, the session persists and refreshes. User does not need to re-login after inactivity for token expiry alone.

**Verdict: PASS**

---

### 20. Session persists across app restart

`persistSession: true` and `storage: AsyncStorage` ensure the session (and refresh token) are stored and restored on app restart. `loadStoredAuth()` uses `getSession()` so the app state reflects the restored session.

**Verdict: PASS**

---

## CRITICAL ISSUE (Production Blocker)

### Backend returns `user: session.user` (Supabase User); mobile expects app User shape

- **Backend** returns `user: session.user` (Supabase Auth User: `id`, `email`, `app_metadata`, etc.).
- **Mobile** treats this as the app **User** type: `id`, `email`, `role`, `full_name`, `schoolId`, `schoolName`.
- **Usage:** Navigation and features use `user.role`, `user.schoolId`, `user.schoolName`, `user.full_name` (e.g. `LoginScreen.tsx`, `PrincipalStack.tsx`, `AppNavigator.tsx`, `TeacherStack.tsx`, `ClerkStack.tsx`, `StudentStack.tsx`, `EnterMarksScreen.tsx`, `MarkAttendanceScreen.tsx`).
- **Result:** Supabase User does not have top-level `role`, `schoolId`, `schoolName`, `full_name`. Those are either in `app_metadata` or only in the backend profile. So `user.role` (and similar) can be **undefined**, breaking role-based navigation and any UI that expects app User fields.

**Files involved:**

- Backend: `apps/backend/src/routes/auth.ts` (login and login-username responses).
- Mobile: `apps/mobile/src/shared/services/auth.service.ts` (passes `response.user` into `setSessionAndReturn` and up to `auth.ts` which stores it in USER_KEY); all screens that read `user.role`, `user.schoolId`, etc.

**Required fix (choose one or combine):**

1. **Backend:** In addition to `user` and `session`, return an app **profile** object (e.g. `profile: { id, email, role, full_name, schoolId, schoolName }`) from `/auth/login` and `/auth/login-username`, and have mobile store and use that as the app User; or  
2. **Mobile:** After login, call `/auth/profile` (or equivalent) and use the response as the app User; or  
3. **Mobile:** Map `session.user` to app User using `user.app_metadata?.role`, `user.app_metadata?.school_id`, and fetch or derive `full_name` and `schoolName` (e.g. from profile API or metadata).

Until one of these is done, role-based routing and any UI depending on `user.role` / `user.schoolId` / `user.schoolName` / `user.full_name` are **not safe for production**.

---

## SUMMARY TABLE

| # | Check | Result |
|---|--------|--------|
| 1 | Login routes return full session | PASS |
| 2 | Session has required fields | PASS |
| 3 | No jwt.sign | PASS |
| 4 | Auth uses getUser(token), no jwt.verify | PASS |
| 5 | Backend stateless | PASS |
| 6 | Protected routes use auth middleware | PASS |
| 7 | Single Supabase client (mobile) | PASS |
| 8 | Client config (storage, autoRefresh, persist, detectSessionInUrl) | PASS |
| 9 | No manual access_token in AsyncStorage | PASS |
| 10 | No manual token refresh | PASS |
| 11 | setSession(session) after login | PASS |
| 12 | getSession() for API requests | PASS |
| 13 | No multiple createClient (mobile) | PASS |
| 14 | AuthContext session from Supabase | PASS |
| 15 | Logout uses signOut() | PASS |
| 16 | Refresh token present and stored | PASS |
| 17 | Auto refresh works | PASS |
| 18 | Expired token refreshed automatically | PASS |
| 19 | No re-login after inactivity (for token) | PASS |
| 20 | Session persists across app restart | PASS |

---

## FILES WITH ISSUES

| File | Issue |
|------|--------|
| `apps/backend/src/routes/auth.ts` | Returns `user: session.user` (Supabase User) only; no app profile for mobile. |
| `apps/mobile/src/shared/services/auth.service.ts` | Passes backend `response.user` (Supabase User) as app User. |
| `apps/mobile/src/shared/services/auth.ts` | Stores `response.user` (Supabase User) in USER_KEY; consumers expect app User shape. |

---

## EXACT FIXES REQUIRED

1. **Backend** (`apps/backend/src/routes/auth.ts`):  
   For POST `/auth/login` and POST `/auth/login-username`, keep returning `{ user: session.user, session }` (and optional extras). In addition, return an app profile object, e.g.  
   `profile: { id: profile.id, email: profile.email, role: profile.role, full_name: profile.full_name, schoolId: profile.school_id || '', schoolName }`  
   so the mobile can use it as the app User without changing Supabase session contract.

2. **Mobile** (`apps/mobile/src/shared/services/auth.service.ts`):  
   For login and login-username responses, if the backend includes `profile`, use `response.profile` (and optionally still pass `response.user` where needed) and pass the profile as the app User into `setSessionAndReturn(session, profileUser)`. Store and expose that profile user in auth/AuthContext so all role/schoolId/schoolName/full_name usage stays correct.

3. **Mobile** (`apps/mobile/src/shared/services/auth.ts`):  
   Ensure the object stored in USER_KEY and returned from `getCurrentUser()` is the app User (profile), not the raw Supabase user, so that `user.role`, `user.schoolId`, etc. are always defined after login.

---

## FINAL VERDICT

**NOT SAFE FOR PRODUCTION**

Reason: Session and refresh architecture (backend + mobile) is correct and production-grade, but the **app User shape** (role, schoolId, schoolName, full_name) is not provided by the backend in the login response and is not mapped on the mobile. The app uses `user.role` and related fields for navigation and features; with the current payload these can be undefined, causing broken navigation and incorrect behavior. Apply the fixes above (backend profile in login response + mobile use and store profile as app User), then re-verify to consider the system **SAFE FOR PRODUCTION**.
