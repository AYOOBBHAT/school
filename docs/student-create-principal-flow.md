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
- **API wrapper**: `apps/web/src/services/principal.service.ts` (`createStudent(...)`)

### Typical payload fields

The web “Add Student” modal collects student + guardian fields and includes:

- **`class_group_id`**: UUID (required by backend validation)
- **`fee_config`**: object built from UI state (`feeConfig` in the page)

The important part for your reported error is **`fee_config`** always being included when a class is selected (web currently includes fee configuration alongside student creation).

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

## Mobile flow (how it differs today)

### Principal student screen

- **UI**: `apps/mobile/src/features/principal/screens/StudentsScreen.tsx`
- **API**: `apps/mobile/src/shared/services/principal.service.ts` (`createStudent`)

### Practical difference vs web

Mobile’s “Add Student” path is primarily collecting student + guardian fields. It does **not** mirror the web’s full “fee configuration” block on create in the same way.

So you may see:

- The **same backend endpoint** (`POST /principal-users/students`)
- But **different payload shapes** depending on whether `fee_config` is included

If mobile later sends `fee_config` with the same `transport_route_id: ""` pattern, it will hit the **same Joi validation error**.

## Debugging checklist (fast)

### If response is `400` with `{ error: "Validation failed", details: [...] }`

- Read `details[].field` and `details[].message`
- Common gotchas:
  - **`fee_config.transport_route_id`**: `""` is invalid; use **`null`**, omit the field, or provide a **UUID**
  - **`transport_enabled: true`** implies you should either **select a route** or **disable transport** before submit

### If response is `401` / “Missing bearer token”

- Web: ensure API calls attach `Authorization` (recent work centralized this in `apps/web/src/services/apiClient.ts` + refactors in services)
- Mobile: ensure `apps/mobile/src/shared/services/api.ts` waits for session and fails fast if token missing for protected routes

## Recommended client payload conventions (conceptual)

These are **not** enforced as “business rules” everywhere yet, but they align with Joi and avoid `400`s:

### Transport off

- `transport_enabled: false`
- omit `transport_route_id` **or** set `transport_route_id: null`
- never send `""`

### Transport on

- `transport_enabled: true`
- `transport_route_id: "<uuid>"`

### Transport on but user hasn’t picked a route yet

- Prefer **UI blocking** submit until a route is selected, **or**
- set `transport_enabled: false` until a route exists, **or**
- omit `transport_route_id` entirely (do not send `""`)

## Related: class assignment errors (historical)

If you previously saw failures due to class selection:

- Backend requires **`class_group_id` UUID** and verifies it belongs to the principal’s **`school_id`**
- Web/mobile should populate dropdown **values** with **UUID**, labels with **human-readable class name**

See also:

- `GET /class-groups` implementation: `apps/backend/src/routes/class-groups.ts`
