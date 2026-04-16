# Web vs mobile: signup and auth (read-only comparison)

This document compares **how signup and school access are presented and implemented** on web vs mobile, based on the current codebase. **No web, mobile, or backend changes** are implied here—only facts and product/UX implications.

If your product rule is **“students are added by the principal; they should not self-register via the app,”** the main behavioral gap is on **mobile signup**, not on web signup.

---

## High-level summary

| Area | Web | Mobile |
|------|-----|--------|
| **Public signup page** | One flow: **create a new school (principal)** only | Two-step choice: **create school (principal)** **or** **join existing school** |
| **Principal signup API** | `POST /auth/signup-principal` | Same: `POST /auth/signup-principal` |
| **“Join school” self-signup API** | **Not exposed** from the web signup page | `POST /auth/signup-join` via **Join Existing School** |
| **Join code after principal signup** | Shown on success (for sharing with staff/parents/students per copy) | Principal flow does not mirror the web’s dedicated “success + copy join code” screen in the same way (implementation differs) |
| **Student creation** | Principal (logged in): `POST /principal-users/students` (see `docs/student-create-principal-flow.md`) | Same endpoint exists for principal flows; **not** the same as `signup-join` |
| **Login** | Email/password **or** username + school code (join code or registration number) | Same modes |

---

## Web signup (what exists today)

### Route and UI

- **Route**: `/signup` → `apps/web/src/pages/Signup.tsx`
- **User-facing purpose**: **“Create Your School”** — principal onboarding only.
- There is **no** “Join existing school” or `signup-join` form on this page.

### API

- **Request**: `POST /auth/signup-principal`
- **Body**: principal + school fields (`email`, `password`, `full_name`, `phone`, `school_name`, `school_address`, `school_registration_number`, `contact_phone`, `contact_email`, etc.—as collected in the form).

### After success

- If the response includes `school.join_code`, the UI shows a **success screen** with the **join code** and copy affordance, then points the user to login.
- That join code is framed in copy as something to **share** with teachers/students/parents—not as “student self-signup on this same page.”

---

## Mobile signup (what exists today)

### Screen and flows

- **Screen**: `apps/mobile/src/screens/SignupScreen.tsx`
- **State machine**: `step` is `'type' | 'principal' | 'join'`.

#### Step `type` (“Create Account”)

Presents two actions:

1. **Create New School (Principal)** → `step === 'principal'`
2. **Join Existing School** → `step === 'join'`

The second option is the one you called out: **“Join Existing School”** is **mobile-only** relative to the web `/signup` page (web has no equivalent entry point on signup).

#### Principal path (`principal`)

- Collects the same **principal + school** style fields as web (including `school_registration_number`).
- Calls `authService.signupPrincipal(...)` → `POST /auth/signup-principal`  
  (`apps/mobile/src/shared/services/auth.service.ts`).

#### Join path (`join`)

- Titled **“Join School”**; collects name, email, password, **join code**, optional roll number when `joinData.role === 'student'`.
- Calls `authService.signupJoin(...)` → `POST /auth/signup-join`  
  (`apps/mobile/src/shared/services/auth.service.ts`).

**Note:** `joinData` includes a `role` field defaulting to `'student'`. The visible join form snippet focuses on join-code enrollment; if role selection is not shown in UI, behavior still centers on the join-code signup concept.

### Backend endpoint for join signup

- Implemented at `POST /auth/signup-join` in `apps/backend/src/routes/auth.ts` (mobile calls this; web signup page does not).

---

## Students: “added by principal” vs mobile “join school”

### Intended principal-driven student onboarding (both platforms, API-level)

- Principals create students via **`POST /principal-users/students`** (authenticated principal), with credentials/profile data as required by that route.
- Documented in **`docs/student-create-principal-flow.md`**.

### Mobile-only alternative path

- **`signup-join`** is a **separate** onboarding path: a user can attempt to attach to a school using a **join code** (and related fields), without going through the principal “add student” UI.

**Product implication:** if students must **only** be created by the principal, then exposing **Join Existing School** on mobile signup is **inconsistent** with web’s signup UX and can contradict that policy—even though the backend still supports `signup-join`.

---

## Login (for completeness—web vs mobile are broadly aligned)

### Web

- `apps/web/src/pages/Login.tsx`
- **Email login**: Supabase email/password path.
- **Username login**: `POST /auth/login-username` with `join_code` **or** `registration_number` as the “school code.”

### Mobile

- `apps/mobile/src/screens/LoginScreen.tsx`
- Same conceptual split: **email** vs **username** modes; username mode calls `POST /auth/login-username` with join code or registration number.

So **login** parity is relatively good; the largest **signup** divergence is the **extra mobile-only join-school registration** entry point.

---

## Documentation / setup references

- `apps/mobile/MOBILE_SETUP.md` mentions signup to join with join code (setup doc, not runtime behavior).

---

## Suggested alignment direction (documentation only—no code here)

If mobile should match web’s **signup surface**:

- **Signup** should mirror web: **principal creates school only** on the signup screen.
- **Students** arrive via **principal create student** (and then use **username + school code login**, consistent with web login patterns).
- Any future need for **teacher/clerk self-serve join** should be an explicit product decision; today web signup does not advertise it, while mobile signup does via **Join Existing School**.

---

## File index (for reviewers)

| Concern | Web | Mobile |
|---------|-----|--------|
| Signup UI | `apps/web/src/pages/Signup.tsx` | `apps/mobile/src/screens/SignupScreen.tsx` |
| Principal signup client | inline `fetch` to `/auth/signup-principal` | `apps/mobile/src/shared/services/auth.service.ts` → `signupPrincipal` |
| Join signup client | *(not on web signup page)* | `auth.service.ts` → `signupJoin` → `/auth/signup-join` |
| Login UI | `apps/web/src/pages/Login.tsx` | `apps/mobile/src/screens/LoginScreen.tsx` |
| Backend: principal signup | `apps/backend/src/routes/auth.ts` (`/signup-principal`) | same |
| Backend: join signup | `apps/backend/src/routes/auth.ts` (`/signup-join`) | same |
