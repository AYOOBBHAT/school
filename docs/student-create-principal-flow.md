# Principal “Add Student” flow (Web + Backend + Mobile)

This document explains how **principal-created students** are created end-to-end, why you can see **`400 Validation failed`** responses, and how **`fee_config.transport_route_id`** interacts with Joi validation.

## Endpoints involved

### Create student (principal)

- **HTTP**: `POST /principal-users/students`
- **Backend file**: `apps/backend/src/routes/principal-users.ts`
- **Auth**: requires a valid **Supabase JWT** in `Authorization: Bearer <access_token>` (enforced by backend auth middleware + role checks).

### Supporting endpoints (UI loads options)

- **Class list (minimal)**: `GET /class-groups` (added for dropdowns; returns `{ class_groups: [{ id, name }] }`)
- **Class list (rich)**: `GET /classes` (includes classifications/subjects; heavier)
- **Sections**: `GET /classes/:classId/sections`
- **Default fees for UI**: `GET /principal-users/classes/:classId/default-fees`

## Web flow (what gets sent)

### Where the request is built

- **UI**: `apps/web/src/pages/principal/students/StudentsManagement.tsx`
  - Blocks submit when transport is enabled and routes exist but no valid route is selected.
  - Only shows transport toggles when the class has **at least one** default transport route; otherwise transport stays off.
  - Passes `fee_config` through **`sanitizePrincipalStudentCreateFeeConfig`** before `createStudent`.
- **Payload sanitizer (shared logic)**: `apps/web/src/utils/feeConfigPayload.ts`
  - `sanitizePrincipalStudentCreateFeeConfig` — create (`POST /principal-users/students`)
  - `sanitizePrincipalStudentAdminFeeConfig` — admin update (`PUT /students-admin/:id`) when `effective_from_date` is present
- **API wrapper (second line of defense)**: `apps/web/src/services/principal.service.ts`
  - `createStudent` / `updateStudent` sanitize `fee_config` again before `JSON.stringify`, so empty `transport_route_id` never reaches the wire as `""`.

### Typical payload fields

The web “Add Student” modal collects student + guardian fields and includes:

- **`class_group_id`**: UUID (required by backend validation)
- **`fee_config`**: object built from UI state (`feeConfig` in the page), then normalized for the API

The important part for your reported error is **`fee_config`** always being included when a class is selected (web currently includes fee configuration alongside student creation). **`transport_route_id` must never be sent as `""`** — the UI and sanitizer enforce **omit** or **valid UUID**; when transport is off, **`transport_route_id` is omitted** from the JSON object.

## Backend validation (why your error happens)

### Student schema

In `apps/backend/src/routes/principal-users.ts`, `addStudentSchema` includes:

- **`class_group_id`**: required UUID
- **`fee_config`**: optional, but if present must match `feeConfigSchema`

### Fee config schema (transport)

`feeConfigSchema` includes:

- **`transport_enabled`**: boolean (defaults to `true` if omitted)
- **`transport_route_id`**: `Joi.string().uuid().allow(null).optional()`

Interpretation:

- **`optional()`** means the field may be **omitted entirely**.
- **`allow(null)`** means **`null` is valid**.
- **`Joi.string().uuid()` does not accept an empty string** `""`.

So this combination fails validation:

- `transport_enabled: true`
- `transport_route_id: ""`  ← empty string

Joi error you observed:

- **`"fee_config.transport_route_id" is not allowed to be empty`**
- type **`string.empty`**

This is **not** an authentication failure. A missing/invalid JWT would typically surface as **`401`**, not a **`400`** with structured validation `details`.

### What happens after validation

If validation passes, the route creates:

1. Auth user (Supabase admin)
2. `profiles` row
3. `students` row (includes `class_group_id`, optional `section_id`, etc.)
4. Optional fee setup logic when `fee_config` is present (separate from Joi; transport route is only used if truthy)

## Mobile flow

### Principal student screen

- **UI**: `apps/mobile/src/features/principal/screens/StudentsScreen.tsx`
  - Edit/update: validates transport (if enabled and routes exist, a route must be chosen); uses `sanitizePrincipalStudentAdminFeeConfig` for outgoing `fee_config`.
- **Payload sanitizer**: `apps/mobile/src/shared/utils/feeConfigPayload.ts` (same rules as web: no `""` for `transport_route_id`; omit when transport disabled)
- **API**: `apps/mobile/src/shared/services/principal.service.ts`
  - `createStudent` / `updateStudent` sanitize `fee_config` before `api.post` / `api.put` if present.

### Practical difference vs web

Mobile’s “Add Student” path may still **omit** `fee_config` on create (unlike web, which always sends fee UI state when a class is selected). If `fee_config` **is** included (now or later), the service layer strips invalid empty-string UUID fields so Joi does not see `transport_route_id: ""`.

## Debugging checklist (fast)

### If response is `400` with `{ error: "Validation failed", details: [...] }`

- Read `details[].field` and `details[].message`
- Common gotchas:
  - **`fee_config.transport_route_id`**: `""` is invalid; use **`null`**, omit the field, or provide a **UUID**
  - **`transport_enabled: true`** implies you should either **select a route** or **disable transport** before submit

### If response is `401` / “Missing bearer token”

- Web: ensure API calls attach `Authorization` (recent work centralized this in `apps/web/src/services/apiClient.ts` + refactors in services)
- Mobile: ensure `apps/mobile/src/shared/services/api.ts` waits for session and fails fast if token missing for protected routes

## Client payload conventions (implemented + Joi alignment)

Web and mobile follow these rules so **`fee_config` matches `feeConfigSchema`**:

### Transport off

- `transport_enabled: false`
- **`transport_route_id` is omitted** from the serialized object (not `""`)
- never send `""` for optional UUID fields in `fee_config`

### Transport on

- `transport_enabled: true`
- **`transport_route_id`**: valid route **UUID** only; UI blocks submit if routes exist but none selected
- If the class has **no** transport routes, the client keeps transport **off** and does not send a route field

### Transport on but user hasn’t picked a route yet

- **Web / mobile (edit)**: submit is blocked until a route is selected or transport is disabled
- Sanitizers still avoid sending `""` if any caller passes empty string in state

## Related: class assignment errors (historical)

If you previously saw failures due to class selection:

- Backend requires **`class_group_id` UUID** and verifies it belongs to the principal’s **`school_id`**
- Web/mobile should populate dropdown **values** with **UUID**, labels with **human-readable class name**

See also:

- `GET /class-groups` implementation: `apps/backend/src/routes/class-groups.ts`
