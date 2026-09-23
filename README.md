# Multi-Tenant Booking

A Week 1 internship project: a multi-tenant booking application built with Next.js, Prisma, and PostgreSQL Row-Level Security (RLS) for database-enforced tenant isolation.

## Week 1 Scope

This repository currently implements the **data and security foundation** of the application: schema, migrations, seed data, RLS policies, a tenant-context helper, an RBAC permission model, and a validated (but non-functional) authentication UI. It does not yet include real authentication, sessions, or any API routes/server actions wired to the database. See "Authentication Status" and "Future Work" below for exactly what is and isn't implemented.

## Technology Stack

Based on `package.json`:

| Package | Version | Purpose |
|---|---|---|
| next | 16.3.5 | App Router framework |
| react / react-dom | 19.2.8 | UI |
| typescript | ^5 | Type checking |
| tailwindcss / @tailwindcss/postcss | ^4 | Styling |
| prisma / @prisma/client | ^7.10.0 | ORM |
| @prisma/adapter-pg | ^7.10.0 | Prisma driver adapter for `pg` |
| pg | ^8.23.0 | PostgreSQL driver |
| zod | ^4.6.5 | Environment + form validation |
| bcryptjs | ^3.0.3 | Password hashing used by the seed data; real authentication is future work |
| dotenv | ^17.4.2 | Loads `.env` for scripts |
| tsx | ^4.23.13 (dev) | Runs TypeScript scripts (seed, RLS test) |

PostgreSQL 16 (`postgres:16-alpine`) runs via Docker Compose.

## Project Structure

```text
app/
  page.tsx                  Landing page
  login/page.tsx             Login UI (demo — see Authentication Status)
  register/page.tsx          Register UI (demo)
  onboarding/page.tsx        Organization onboarding UI (demo)
  forgot-password/page.tsx   Password reset request UI (demo)
components/auth/             Shared auth UI building blocks
lib/
  env.server.ts               Zod-validated environment variables
  prisma.ts                   Shared Prisma client (connects as app_user)
  tenant-context.ts           withTenantContext() helper
  rbac.ts                     Permission / role model
  auth/current-user.ts        Placeholder seam for future session lookup
  validation/auth.ts          Zod schemas for the auth forms
prisma/
  schema.prisma                Data model
  seed.ts                      Seed script
  migrations/
    20260918112814_init_multi_tenant_foundation/    Schema + RLS policies
    20260918201832_grant_app_user_table_privileges/ app_user grants
docker-compose.yml             PostgreSQL 16 service definition
docker/initdb/
  01-create-app-role.sh        Creates app_user on a fresh volume only
scripts/
  test-rls.ts                   RLS / tenant isolation test
```

## Data Model (ERD)

```mermaid
erDiagram
    TENANT ||--o{ USER : "has"
    TENANT ||--o{ BOOKING : "has"
    ROLE ||--o{ USER : "assigned to"
    USER ||--o{ BOOKING : "creates (createdById)"

    TENANT {
        uuid id PK
        string name
        string slug UK
        datetime createdAt
        datetime updatedAt
    }
    ROLE {
        uuid id PK
        string name UK
        datetime createdAt
        datetime updatedAt
    }
    USER {
        uuid id PK
        uuid tenantId FK
        uuid roleId FK
        string name
        string email
        string passwordHash
        datetime createdAt
        datetime updatedAt
    }
    BOOKING {
        uuid id PK
        uuid tenantId FK
        uuid createdById FK
        string title
        string description
        datetime startTime
        datetime endTime
        string status
        datetime createdAt
        datetime updatedAt
    }
```

`User` has a unique constraint on `(tenantId, email)` — the same email can exist in different tenants, but not twice within one tenant. `Booking.status` is a Postgres enum: `PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`.

## Tenant Isolation / Security Flow

```mermaid
flowchart TD
    A["Application runtime (lib/prisma.ts) connects as app_user"] --> B["app_user is configured with NOBYPASSRLS"]
    B --> C["withTenantContext(tenantId, callback) opens one Prisma transaction"]
    C --> D["SELECT set_config('app.current_tenant_id', tenantId, true) — transaction-local, same tx"]
    D --> E["Tenant query runs on the SAME transaction via the tx client"]
    E --> F["PostgreSQL RLS policy checks: row.tenantId = current_setting('app.current_tenant_id', true)"]
    F -->|context matches row| G["Row returned"]
    F -->|context missing or different tenant| H["Row filtered out — 0 rows, not an error"]
```

This is enforced at the database engine level, on `users` and `bookings` only. `tenants` is intentionally not RLS-protected in this Week 1 architecture because it represents the organization/tenant directory rather than tenant-scoped application data. `roles` is also shared reference data, used the same way by every tenant.

## Database Roles

| Role | Used for | Can bypass RLS? |
|---|---|---|
| `booking_dev` | Prisma CLI migrations / database administration (`DATABASE_URL`) | Yes — superuser, by design, needed to create/alter tables |
| `app_user` | Application runtime + seed script (`APP_DATABASE_URL`) | No — configured with `NOBYPASSRLS` |

Separating these matters because RLS is meaningless if the connection running normal queries can ignore it. `lib/prisma.ts` — the Prisma client used by the application runtime — connects through `APP_DATABASE_URL`, keeping normal application queries separate from the privileged migration role.

## RBAC

Defined in `lib/rbac.ts`. Roles and permissions, as actually coded:

| Role | Permissions |
|---|---|
| `ADMIN` | `MANAGE_ORGANIZATION`, `MANAGE_USERS`, `MANAGE_ROLES`, `MANAGE_BOOKINGS`, `CREATE_BOOKINGS`, `VIEW_BOOKINGS` |
| `MANAGER` | `MANAGE_BOOKINGS`, `CREATE_BOOKINGS`, `VIEW_BOOKINGS` |
| `STAFF` | `CREATE_BOOKINGS`, `VIEW_BOOKINGS` |

`roleHasPermission()` and `requirePermission()` are authorization helper functions defined in `lib/rbac.ts`. RBAC is currently a foundation only: no API route or server action calls `requirePermission()` yet, because no such routes exist in the repository yet. It is not connected to a live authenticated request path.

## Authentication Status

Real, server-side, cookie-based session authentication now exists for `/login`. `/register`, `/onboarding`, and `/forgot-password` remain demo UI (client-side Zod validation, simulated success message) — building real account creation for those is out of scope for this phase.

- `POST /api/auth/login` — validates credentials with Zod, looks up the user via `find_user_for_login()` (see "Session Security Design"), verifies the password with `bcryptjs`, creates a server-side session, and sets an httpOnly cookie. Returns the same generic "Invalid email or password" error whether the email doesn't exist or the password is wrong.
- `POST /api/auth/logout` — deletes the server-side session and clears the cookie. Safe to call repeatedly.
- `getCurrentUser()` (`lib/auth/current-user.ts`) now reads the session cookie, looks it up, and returns `{ id, tenantId, roleName, email }`, or throws `UnauthenticatedError` if there is no valid session. `AuthNotImplementedError` no longer exists.
- `/dashboard` is a temporary placeholder authenticated page proving the flow works end-to-end — it is **not** the Week 2 booking dashboard.

**Known limitations:**
- Only the four seeded Week 1 development users can log in; there is no real registration flow yet.
- Login looks up by email only and returns the first match; if the same email were ever seeded in two different tenants (not the case today), only one would be reachable. A future "choose your organization" step would resolve this.
- "Remember me" is captured by the form but does not yet change session length — every session is a flat 7-day expiry.
- No brute-force/rate-limiting protection exists on the login endpoint yet.
- Expired sessions are only cleaned up opportunistically on lookup, not by a scheduled job.

## Session Security Design

- **Cookie contents**: an httpOnly cookie (`session_token`) holds only an opaque, cryptographically random 256-bit token — never a JWT, never any user/tenant/role information. `sameSite=lax`, `secure` in production, 7-day expiry.
- **Server-side storage**: only a SHA-256 hash of the token is stored, in a new `Session` table. Reading that table alone never yields a usable, replayable token.
- **Why `Session` is not RLS-protected**: a session lookup has to happen *before* the tenant is known — the tenant is what the lookup discovers. RLS scoped by `app.current_tenant_id` would make that lookup impossible. Safety instead comes from the token being a 256-bit random value looked up by exact match, and `app_user` only holding the privileges explicitly granted on this table.
- **The login-lookup problem**: `users` has `FORCE ROW LEVEL SECURITY`. A plain query for "find user by email" with no tenant context set would always return zero rows — that's the same guarantee `npm run test:rls` verifies ("no context → 0 users"), now working against login. Rather than weaken that policy, login calls `find_user_for_login(email)`, a `SECURITY DEFINER` SQL function owned by `booking_dev` (a superuser, which always bypasses RLS). `app_user` is granted `EXECUTE` on this one function only — it still cannot query `users` directly without tenant context for anything else. This is the standard PostgreSQL pattern for a narrow, auditable exception to RLS, rather than a blanket bypass.
- **No new environment variable/secret was introduced.** The token is already 256 bits of true randomness before hashing, so it does not need a server-side pepper the way a low-entropy secret (like a password) would.

## Client-Side Validation

`lib/validation/auth.ts` defines four Zod schemas:

- `loginSchema` — email format, non-empty password, optional remember-me
- `registerSchema` — full name, email, 8+ character password, confirm-password match
- `onboardingSchema` — organization name, URL-safe slug (`^[a-z0-9]+(-[a-z0-9]+)*$`), admin name/email, password, confirm-password match
- `forgotPasswordSchema` — email format only

Password confirmation mismatches and other cross-field rules use Zod's `.refine()` and report the error on the `confirmPassword` field specifically.

## Environment Variables

Documented by name only — real values live in your local `.env` (git-ignored) and are validated at startup by `lib/env.server.ts`.

| Variable | Purpose |
|---|---|
| `POSTGRES_DB` | Database name (Docker Compose) |
| `POSTGRES_USER` | Bootstrap role name (`booking_dev`) |
| `POSTGRES_PASSWORD` | Bootstrap role password |
| `POSTGRES_PORT` | Host port Postgres is exposed on |
| `DATABASE_URL` | Connection string for `booking_dev` — Prisma CLI migrations only |
| `APP_DB_USER` | Application role name (`app_user`) |
| `APP_DB_PASSWORD` | Application role password |
| `APP_DATABASE_URL` | Connection string for `app_user` — used by the app runtime and the seed script |

`lib/env.server.ts` validates all eight with Zod at import time (`POSTGRES_PORT` as an integer 1–65535, both URLs as valid URL strings) and throws a clear error listing exactly which variable is missing or malformed if validation fails.

## Docker PostgreSQL Setup

`docker-compose.yml` runs a single `postgres:16-alpine` service (`multi-tenant-booking-db`) with a persistent named volume (`multi-tenant-booking-postgres-data`) and a healthcheck.

### Fresh Clone / New Volume

```bash
docker compose up -d
```

When PostgreSQL initializes a new/empty data volume, it automatically runs every script in `docker/initdb/` exactly once. `01-create-app-role.sh` creates the `app_user` role (`LOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOBYPASSRLS`) using `APP_DB_USER`/`APP_DB_PASSWORD` from `.env`. This behavior is based on how the official PostgreSQL Docker image documents `docker-entrypoint-initdb.d`; it has not yet been separately verified in this repository against a true fresh-clone, fresh-volume run.

### Existing Volume

PostgreSQL skips `docker/initdb/` entirely once a data directory already contains a database, so this script has no effect on an already-running setup.

## Setup Commands

```bash
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev
```

`npx prisma migrate dev` applies both migrations in order: the initial schema + RLS policies, then the `app_user` table-privilege grants (`GRANT SELECT, INSERT, UPDATE, DELETE` on `tenants`, `roles`, `users`, `bookings`).

## Seed Data

`prisma/seed.ts` connects as `app_user` (`APP_DATABASE_URL`) and uses fixed UUIDs with `upsert`, so it is safe to run repeatedly. Actual seeded data:

- **3 roles**: ADMIN, MANAGER, STAFF
- **3 tenants**: TechNova Solutions, Lahore Creative Studio, Pakistan Business Consultants
- **7 users** across the three tenants (3 for TechNova, 2 for Lahore Creative, 2 for Pakistan Business Consultants)
- **6 bookings** (2 per tenant), with statuses spanning `PENDING`, `CONFIRMED`, `COMPLETED`, and `CANCELLED`

All seeded users share one development password hash generated from a fixed placeholder password — this exists only to satisfy the `passwordHash` NOT NULL column and has no relationship to real authentication, which is not implemented.

Users and bookings are inserted using `withTenantContext(tenantId, ...)` so each insert passes the same RLS policies that runtime queries would.

## Testing Tenant Isolation

```bash
npm run test:rls
```

Runs `scripts/test-rls.ts`, which connects as `app_user` (never `booking_dev`, since that role bypasses RLS) and verifies:

- No tenant context set → 0 users, 0 bookings visible
- TechNova Solutions context → exactly 3 users, 2 bookings visible
- Lahore Creative Studio context → exactly 2 users, 2 bookings visible
- While scoped to TechNova, explicitly querying for Lahore Creative's `tenantId` returns 0 rows

## Testing Authentication

```bash
npm run test:auth
```

Runs `scripts/test-auth.ts`, using the same `find_user_for_login()` path the real login route uses (not a plain Prisma query, which RLS would block the same way it would in production). Verifies:

- The seeded TechNova admin can be found and their role resolves
- The correct development password verifies; a wrong password is rejected
- A successful "login" creates a session whose lookup returns the expected `userId`, `tenantId`, `roleName`, and `email`
- An invalid/garbage token is rejected
- An expired session is rejected
- Logout invalidates the session, and calling logout again does not throw

`getCurrentUser()` itself reads Next.js's request-scoped `cookies()` API and can only run inside a real request, so it isn't covered by this script — verify it manually: run `npm run dev`, log in at `/login` with a seeded user, confirm you land on `/dashboard` showing the correct email/tenant/role, then log out and confirm you're redirected back to `/login`.

## Verification Commands

```bash
npx prisma validate
npx tsc --noEmit
npm run lint
npm run build
npm run test:rls
npm run test:auth
```

## Security Boundaries

- RLS on `users`/`bookings`, enforced by PostgreSQL itself, is the actual security boundary — not application code.
- `withTenantContext()` is a convention that makes the correct pattern easy; it does not prevent other code from querying `prisma` directly without it. If that happened, RLS still fails closed (0 rows), it does not leak data.
- `app_user` is configured with `NOBYPASSRLS`, so the application runtime role cannot bypass PostgreSQL RLS.
- `tenants` and `roles` are intentionally not RLS-protected (see "Tenant Isolation / Security Flow" above).
- RBAC permission helpers are defined in `lib/rbac.ts`; they are not yet connected to a live authenticated request path.

## Week 1 Completion Checklist

- [x] Next.js App Router project with TypeScript + Tailwind CSS 4
- [x] Zod-validated environment variables
- [x] Docker Compose PostgreSQL 16 setup
- [x] Schema: Tenant, User, Role, Booking
- [x] Database migrations
- [x] Realistic, repeatable seed data
- [x] PostgreSQL RLS enforcing tenant isolation on `users` / `bookings`
- [x] `app_user` role with `NOBYPASSRLS`, separate from the migration role
- [x] Transaction-scoped tenant-context helper (`withTenantContext`)
- [x] RBAC permission model (ADMIN/MANAGER/STAFF)
- [x] Repeatable RLS isolation test (`npm run test:rls`)
- [x] Tailwind auth UI: onboarding, login, register, forgot-password
- [x] Client-side Zod validation on all four auth forms
- [x] README documentation with Mermaid ERD and tenant-isolation/security flow

## Future Work

The following are explicitly not implemented and should not be assumed to exist:

- Real organization/user/booking creation via API routes or server actions (registration/onboarding remain demo UI)
- Booking management API routes / server actions (Week 2, later phases)
- RBAC checks actually guarding live authenticated server operations
- Email delivery for password reset
- Rate limiting / brute-force protection on login
- Scheduled cleanup of expired sessions
- Support for the same email existing in more than one tenant at login time

