# Web Application — Authentication Audit Report

**Scope:** Web app only (`apps/web`)  
**Focus:** Supabase session, token expiration, refresh, and auth state

---

## 1. Supabase Client

| Check | Result | Details |
|-------|--------|--------|
| 1. Where Supabase client is created | **PASS** | `apps/web/src/utils/supabase.ts` — `getSupabaseClient()` creates the client (lines 6–14). |
| 2. Only ONE Supabase client | **PASS** | Single singleton; only `createClient` in the web app is in `utils/supabase.ts`. All other files import `supabase` from `../utils/supabase` or `../../../utils/supabase`. |
| 3. Client configured with auth options | **FAIL** | **File:** `apps/web/src/utils/supabase.ts` (lines 7–11). Client is created with only URL and anon key; **no `auth` option** is passed. Required explicit config is missing: `persistSession`, `autoRefreshToken`, `detectSessionInUrl`. |
| 4. Exported from shared file and reused | **PASS** | `supabase` is exported from `utils/supabase.ts` and imported across pages, components, and services. |
| 5. No multiple createClient() | **PASS** | No other `createClient()` in `apps/web/src`. |

**Category: Supabase Client — FAIL** (missing explicit auth config).

---

## 2. Login Flow

| Check | Result | Details |
|-------|--------|--------|
| 6. Login implementation location | **PASS** | `apps/web/src/pages/Login.tsx` — `handleSubmit` (lines 17–190). |
| 7. Uses signInWithPassword or signInWithOAuth | **PASS** | Email: `supabase.auth.signInWithPassword({ email, password })` (lines 71–73). Username: backend `POST /auth/login-username` then `supabase.auth.setSession(result.session)` (lines 41–58) — full session is set in Supabase, not only a token. |
| 8. Backend login that only stores access_token | **PASS** | Username flow uses backend but then calls `setSession(result.session)`; it does **not** only store access_token. No fail. |
| 9. Manual storage of access_token in localStorage/sessionStorage | **PASS** | No `localStorage` or `sessionStorage` usage for tokens in the web app. Token is used in memory only (e.g. for profile fetch). |

**Category: Login Flow — PASS**

---

## 3. Session Storage

| Check | Result | Details |
|-------|--------|--------|
| 10. Session managed by Supabase | **PASS** | No manual session store. Supabase client manages session (browser default persistence when no custom storage is set). |
| 11. No manual storage of access_token/refresh_token | **PASS** | Grep: no `access_token`, `refresh_token`, `setItem`, or `localStorage`/`sessionStorage` for tokens. |
| 12. Uses getSession() for current session | **PASS** | Token for API calls is obtained via `(await supabase.auth.getSession()).data.session?.access_token` (or equivalent) across the app. |

**Category: Session Storage — PASS**

---

## 4. Refresh Handling

| Check | Result | Details |
|-------|--------|--------|
| 13. No incorrect manual refreshSession | **PASS** | No custom `refreshSession()` or manual refresh logic in the web app. |
| 14. Supabase autoRefreshToken | **CONDITIONAL** | Not set explicitly. Browser default for `@supabase/supabase-js` is `autoRefreshToken: true`. Audit requires **explicit** config — see Supabase Client FAIL. |
| 15. Refresh not dependent on manually stored tokens | **PASS** | Session/refresh are handled by Supabase only; no manual token storage. |

**Category: Refresh Handling — PASS** (behavior correct; config not explicit).

---

## 5. API Request Layer

| Check | Result | Details |
|-------|--------|--------|
| 16. API request layer | **PASS** | Requests use `fetch()` with token from `supabase.auth.getSession()` (no central axios wrapper; each call gets token via getSession). |
| 17. Authorization uses getSession().session.access_token | **PASS** | Pattern used: `const token = (await supabase.auth.getSession()).data.session?.access_token` then `Authorization: \`Bearer ${token}\``. Verified in e.g. `UnpaidFeeAnalytics.tsx`, `analyticsService.ts`, `usePrincipalAuth.ts`, `StudentsManagement.tsx`, `FeeManagement.tsx`, and others. |
| 18. No Authorization from localStorage | **PASS** | No token read from localStorage for headers. |

**Category: API Layer — PASS**

---

## 6. Auth State Management

| Check | Result | Details |
|-------|--------|--------|
| 19. Auth state via onAuthStateChange | **FAIL** | **File:** `apps/web/src/App.tsx` and entire `apps/web/src`. No `supabase.auth.onAuthStateChange()` subscription. Auth is checked per-route in hooks (e.g. `usePrincipalAuth`, `useClerkAuth`, `useTeacherAuth`, `useStudentAuth`) with a one-time `getSession()` on mount. |
| 20. Auth state on login, logout, refresh | **PARTIAL** | Login/logout: no global listener; user is sent to a route and that route’s hook runs getSession(). Refresh: token is refreshed by Supabase in the background; the next getSession() (on next request or mount) returns the new token, but there is no listener to update UI on TOKEN_REFRESHED. |

**Category: Auth State Management — FAIL** (onAuthStateChange not used).

---

## Critical Failure Conditions (Strict)

| Condition | Present? | File/Line |
|-----------|----------|-----------|
| Multiple Supabase clients | No | — |
| Manual token storage | No | — |
| Backend login only + manual token | No | Login uses setSession(full session) for username flow. |
| Missing autoRefreshToken | **Yes (not explicit)** | `apps/web/src/utils/supabase.ts` — no `auth` options. |
| Missing persistSession | **Yes (not explicit)** | Same file. |
| Manual refresh with wrong client | No | — |
| Token from localStorage instead of session | No | — |

---

## Exact Files / Lines for Issues

1. **Missing auth config**  
   - **File:** `apps/web/src/utils/supabase.ts`  
   - **Lines:** 7–11  
   - **Issue:** `createClient(import.meta.env.VITE_SUPABASE_URL || '', import.meta.env.VITE_SUPABASE_ANON_KEY || '')` — no second-argument `auth` object with `persistSession`, `autoRefreshToken`, `detectSessionInUrl`.

2. **No onAuthStateChange**  
   - **File:** `apps/web/src/App.tsx` (and no other file in `apps/web/src`)  
   - **Issue:** No subscription to `supabase.auth.onAuthStateChange()` for app-wide auth state (login, logout, token refresh).

---

## Fixes Required

1. **Supabase client** (`apps/web/src/utils/supabase.ts`):  
   Add explicit auth config when creating the client, for example:
   ```ts
   createClient(url, key, {
     auth: {
       persistSession: true,
       autoRefreshToken: true,
       detectSessionInUrl: true, // or false if no OAuth
     },
   });
   ```

2. **Auth state** (e.g. `App.tsx` or a dedicated AuthProvider):  
   Subscribe to `supabase.auth.onAuthStateChange()` and drive app auth state (user, loading, redirect to login) from it, so login, logout, and TOKEN_REFRESHED are reflected without relying only on per-route getSession().

---

## Category Summary

| Category | Result |
|----------|--------|
| Supabase Client | **FAIL** |
| Login Flow | **PASS** |
| Session Storage | **PASS** |
| Refresh Handling | **PASS** |
| API Layer | **PASS** |
| Auth State Management | **FAIL** |

---

## Final Verdict

**AUTH WILL NOT NECESSARILY BREAK AFTER TOKEN EXPIRY** in current code: the web app uses `getSession()` at request time (and on route mount), and Supabase’s browser defaults are `persistSession: true` and `autoRefreshToken: true`, so refresh and persistence usually work.

However, the implementation **does not meet the strict audit criteria**:

- Auth options are **not explicit** (missing `persistSession`, `autoRefreshToken`, `detectSessionInUrl`), so behavior depends on library defaults and could change or differ in non-browser environments.
- There is **no** `onAuthStateChange()` usage, so auth state is not centrally managed and UI does not react to token refresh or session changes.

**Recommendation:** Treat as **not production-ready from an audit perspective** until:

1. Supabase client is configured with explicit `auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true or false }`.
2. Auth state is managed (or at least updated) using `supabase.auth.onAuthStateChange()`.

After those changes, the web app can be considered **SAFE FOR PRODUCTION** from a session/refresh/inactivity perspective.
