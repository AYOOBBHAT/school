# Forgot password / reset password (Web + Mobile)

This repo implements password recovery via backend `/auth/*` endpoints and a **web UI** flow. The **mobile app currently does not expose a “Forgot password” UI** (no screens/services reference these endpoints), so password recovery is effectively **web-only** unless you add a mobile screen later.

## Web app (Vite / React) flow

### Entry points (routes)

- `apps/web/src/App.tsx`
  - `GET /forgot-password` → `apps/web/src/pages/ForgotPassword.tsx`
  - `GET /reset-password` → `apps/web/src/pages/ResetPassword.tsx`

### A) “Forgot password” (OTP) flow

**UI:** `apps/web/src/pages/ForgotPassword.tsx`

This is a 2-step flow:

#### Step 1 — request OTP

The page supports two modes:

- **Student mode**: user provides `username` + either `join_code` OR `registration_number`
  - `POST ${API_URL}/auth/forgot-password-request`
  - Body:
    - `username` (string)
    - `join_code` (string, uppercase) **or** `registration_number` (string)

- **Email mode** (Principal/Teacher/Clerk): user provides `email`
  - `POST ${API_URL}/auth/forgot-password-request-email`
  - Body:
    - `email` (string)

On success, the UI advances to Step 2.

#### Step 2 — verify OTP + set new password

- `POST ${API_URL}/auth/forgot-password-verify`
- Body:
  - Always:
    - `otp` (6-digit string)
    - `new_password` (string, min length 8)
  - Plus identifiers depending on mode:
    - **Student mode**: `username` + (`join_code` OR `registration_number`)
    - **Email mode**: `email`

On success, the UI shows a success message and redirects to `/login` after ~2 seconds.

### B) “Reset password” (authenticated) flow

**UI:** `apps/web/src/pages/ResetPassword.tsx`

This is used when the user already has a Supabase session in the browser (the screen checks session on mount).

1) The page calls `supabase.auth.getSession()` and if there is no session it redirects to `/login`.
2) On submit it calls:

- `POST ${API_URL}/auth/reset-password`
- Headers:
  - `Authorization: Bearer <session.access_token>`
  - `Content-Type: application/json`
- Body:
  - `new_password` (string, min length 8)

Then it redirects the user based on their role (looked up from the `profiles` table using the web Supabase client).

### API_URL used by web

- `apps/web/src/utils/api.ts`:
  - `API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'`

## Backend (Express) implementation

**Router file:** `apps/backend/src/routes/auth.ts` (mounted at `/auth`)

### `POST /auth/reset-password`

- Requires `Authorization: Bearer <access_token>`
- Validates password length
- Verifies token via anon-key Supabase client using the provided bearer header
- Updates password via **admin** API (`adminSupabase.auth.admin.updateUserById`)
- Clears `profiles.password_reset_required`

### `POST /auth/forgot-password-request` (student)

- Input: `username` + (`join_code` OR `registration_number`)
- Looks up school by join code or registration number
- Looks up student profile by `username + school_id + role=student`
- Generates a 6-digit OTP and stores it in an **in-memory Map** (10 minute expiry)
- For now, the OTP is logged server-side (`console.log([OTP for ...])`)
- Response is intentionally generic (does not reveal whether user/school exists)

### `POST /auth/forgot-password-request-email` (principal/teacher/clerk)

- Input: `email`
- Looks up profile by email and role in `[principal, teacher, clerk]`
- Generates OTP, stores in the same in-memory Map, logs OTP
- Response is generic

### `POST /auth/forgot-password-verify`

- Input: `otp` + `new_password` + identifiers (see Web Step 2)
- Validates OTP exists and not expired
- Re-validates identity context:
  - **Student flow**: matches username and school (join code / registration number)
  - **Email flow**: matches email
- Updates the user’s password via **admin** API
- Clears `profiles.password_reset_required`
- Deletes OTP from the store

### Important production notes

- **OTP storage is in-memory** (`Map`) in the running backend process:
  - OTPs are lost on deploy/restart.
  - OTPs will not work reliably if you have multiple backend instances.
  - For production you should store OTPs in Redis or a database (the code comments mention this).
- The backend responses are designed to avoid account enumeration (generic messages on request endpoints).

## Mobile app (React Native / Expo)

At the moment, there is **no “forgot password” / “reset password” UI flow implemented in mobile**:

- No `ForgotPassword` / `ResetPassword` screens exist under `apps/mobile/src`.
- No mobile services call `/auth/forgot-password-*` or `/auth/reset-password`.

### What mobile does today

- Mobile login is implemented in `apps/mobile/src/screens/LoginScreen.tsx`.
- Password recovery is not available from the app UI; users must use the **web** flow (or you can add a mobile screen to call the same backend endpoints).

