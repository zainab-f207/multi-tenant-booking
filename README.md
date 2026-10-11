# Multi-Tenant Booking Platform

A secure, full-stack multi-tenant booking platform built with **Next.js, PostgreSQL, Prisma, TypeScript, Tailwind CSS, and Stripe**.

The application is designed around a strict multi-tenant architecture where each tenant's data is isolated at the database level using **PostgreSQL Row-Level Security (RLS)**. It includes authentication, role-based access control, booking management, idempotent APIs, subscription billing, Stripe webhooks, invoice history, and a Stripe Billing Portal.

This project was developed as part of a structured remote internship project covering full-stack development, database design, security, multi-tenancy, payments, and production-oriented backend practices.

---

## Project Overview

The platform supports multiple independent organizations (tenants) using the same application and database while ensuring that one tenant cannot access another tenant's protected data.

Each authenticated user belongs to exactly one tenant and has a role that determines what they are allowed to do.

The application currently includes:

* Secure cookie-based authentication
* Multi-tenant data isolation using PostgreSQL RLS
* Role-based access control (RBAC)
* Booking management
* Server-side validation using Zod
* API pagination and filtering
* Idempotency protection for booking operations
* Stripe customer management
* Stripe subscription Checkout
* Secure Stripe webhook processing
* Subscription state synchronization
* Invoice history
* Stripe Billing Portal
* Pricing and subscription UI
* Tenant-aware billing
* Automated verification scripts
* Docker-based PostgreSQL development environment

---

# Technology Stack

## Frontend

* Next.js 16.3.5
* React 19
* TypeScript
* Tailwind CSS 4
* Next.js App Router

## Backend

* Next.js Route Handlers
* TypeScript
* Zod
* Prisma ORM
* PostgreSQL
* Prisma PostgreSQL adapter (`PrismaPg`)

## Authentication & Security

* HTTP-only session cookies
* SHA-256 hashed session tokens
* bcrypt password hashing
* Role-Based Access Control (RBAC)
* PostgreSQL Row-Level Security (RLS)
* Transaction-local tenant context
* Stripe webhook signature verification
* Idempotency protection
* Server-side tenant resolution

## Payments

* Stripe
* Stripe Checkout
* Stripe Billing Portal
* Stripe Webhooks
* Subscription synchronization
* Invoice synchronization

## Development

* Docker Compose
* PostgreSQL 16
* Prisma migrations
* ESLint
* Git / GitHub

---

# Architecture

The application follows a multi-tenant architecture where the authenticated user's tenant is always determined on the server.

The client is **not trusted to provide or select a tenant ID** when accessing protected tenant data.

The general request flow is:

```text
Browser
   │
   ▼
Next.js App Router
   │
   ├── Authentication
   │       │
   │       ▼
   │   Session Cookie
   │       │
   │       ▼
   │   Current User
   │       │
   │       ▼
   │   Tenant ID + Role
   │
   ├── API Route
   │       │
   │       ▼
   │   Validation / RBAC
   │       │
   │       ▼
   │   Tenant Context
   │       │
   │       ▼
   │   PostgreSQL + RLS
   │
   └── Stripe Webhook
           │
           ▼
      Signature Verification
           │
           ▼
      Stripe Customer Lookup
           │
           ▼
      Tenant Resolution
           │
           ▼
      PostgreSQL + RLS
```

---

# Multi-Tenancy

Multi-tenancy is one of the main architectural requirements of the project.

Every protected tenant-owned record is associated with a tenant, and PostgreSQL RLS policies enforce access at the database level.

The application uses:

```text
Authenticated User
       ↓
User.tenantId
       ↓
app.current_tenant_id
       ↓
PostgreSQL RLS
       ↓
Only records belonging to that tenant
```

The tenant ID is derived from the authenticated session on the server.

A user cannot switch tenants simply by changing a request parameter.

This provides protection at both the application and database layers.

---

# PostgreSQL Row-Level Security

PostgreSQL Row-Level Security is enabled and forced on the main tenant-owned tables.

The application sets the current tenant inside a transaction using a transaction-local PostgreSQL setting:

```text
app.current_tenant_id
```

RLS policies then compare the current tenant context with the tenant ID stored on the records.

This means that even if an application query accidentally requests another tenant's record, PostgreSQL prevents the row from being returned.

The runtime application uses the restricted:

```text
app_user
```

database role.

The administrative database role:

```text
booking_dev
```

is used for development and database administration tasks.

This separation prevents the normal application connection from bypassing RLS.

---

# Authentication

Authentication is implemented using server-side sessions rather than JWT bearer tokens.

After successful login:

1. The server verifies the user's password.
2. A secure random session token is generated.
3. A SHA-256 hash of the token is stored in the database.
4. The raw token is placed in an HTTP-only cookie.
5. Subsequent requests use the cookie to identify the authenticated user.

The cookie is configured with:

* HTTP-only
* SameSite `lax`
* Secure in production
* Seven-day maximum age

The server-side `getCurrentUser()` function resolves the authenticated user's:

* User ID
* Tenant ID
* Role ID
* Role name
* Email

The application does not use JWT or Authorization Bearer headers for normal authentication.

---

# Roles and Permissions

The application currently supports three roles:

| Role    | Description                                              |
| ------- | -------------------------------------------------------- |
| ADMIN   | Full tenant administration and billing management        |
| MANAGER | Can manage/view permitted business data and view billing |
| STAFF   | Regular operational access without billing management    |

Billing permissions are separated into:

| Permission     | ADMIN | MANAGER | STAFF |
| -------------- | ----: | ------: | ----: |
| View Billing   |   Yes |     Yes |    No |
| Manage Billing |   Yes |      No |    No |

The server checks permissions before allowing protected operations.

Frontend restrictions are also applied for usability, but the backend remains the actual security boundary.

---

# Database Design

The application uses PostgreSQL with Prisma.

The main entities include:

* Tenants
* Roles
* Users
* Sessions
* Bookings
* Idempotency Keys
* Tenant Billing Accounts
* Subscriptions
* Invoices
* Processed Stripe Events

The billing-related relationships are:

```text
Tenant
  │
  ├── TenantBillingAccount
  │        │
  │        └── Stripe Customer
  │
  ├── Subscription
  │        │
  │        └── Stripe Subscription
  │
  └── Invoice
           │
           └── Stripe Invoice
```

Stripe events are tracked separately through `ProcessedStripeEvent` because webhook deduplication is a global concern and must occur before tenant-specific processing.

---

# Booking Management

The booking system supports:

* Listing bookings
* Pagination
* Filtering
* Creating bookings
* Viewing a booking
* Updating bookings
* Deleting bookings
* Booking status management
* Request validation
* Tenant isolation
* Idempotent operations

Supported booking statuses include:

```text
PENDING
CONFIRMED
CANCELLED
COMPLETED
```

All booking operations are tenant-aware.

A user from one tenant cannot retrieve, modify, or delete bookings belonging to another tenant.

---

# Idempotency

Idempotency protection is implemented for operations where repeating the same request should not create duplicate records.

An idempotency key is supplied through the request header.

The server stores the key and associates it with the tenant and operation.

If the same request is submitted again using the same idempotency key, the application prevents an unintended duplicate operation.

This is particularly important for network retries and repeated client requests.

---

# Validation

API input is validated using **Zod**.

Validation is performed on the server rather than trusting the frontend.

Invalid requests return structured API errors instead of allowing malformed data to reach the database.

For billing, the client only sends the allowed plan identifier:

```text
planKey
```

Stripe price IDs are resolved server-side from environment configuration.

This prevents clients from supplying arbitrary Stripe price IDs.

---

# Stripe Billing

The Week 3 implementation introduces subscription billing using Stripe.

The billing architecture contains four main billing models:

### TenantBillingAccount

Stores the relationship between an application tenant and its Stripe Customer.

Each tenant has at most one billing account.

### Subscription

Stores the current Stripe subscription state for a tenant.

It includes information such as:

* Stripe subscription ID
* Stripe price ID
* Application plan key
* Subscription status
* Current billing period end
* Cancellation state
* Last processed Stripe event timestamp

### Invoice

Stores invoice information synchronized from Stripe.

It includes:

* Stripe invoice ID
* Amount paid
* Currency
* Invoice status
* Hosted invoice URL
* Billing period start
* Billing period end

### ProcessedStripeEvent

Stores Stripe event IDs that have already been processed.

This prevents duplicate webhook processing.

---

# Stripe Customer Management

Before creating a subscription Checkout Session, the application ensures that the tenant has a Stripe Customer.

If an existing billing account is present, its Stripe Customer ID is reused.

If no billing account exists, a new Stripe Customer is created and associated with the tenant.

The Stripe customer creation operation uses an idempotency key based on the tenant ID to reduce the risk of duplicate Stripe Customers during retries.

Because Stripe and PostgreSQL are separate systems, they cannot participate in one atomic database transaction. This distributed consistency limitation is documented and handled through retry-safe application logic.

---

# Stripe Checkout

The application provides a server-side endpoint for creating Stripe subscription Checkout Sessions:

```text
POST /api/billing/checkout
```

The flow is:

```text
User
 ↓
Select Plan
 ↓
POST /api/billing/checkout
 ↓
Authenticate User
 ↓
Check MANAGE_BILLING permission
 ↓
Resolve Tenant from Session
 ↓
Validate planKey
 ↓
Resolve Stripe Price ID server-side
 ↓
Create/reuse Stripe Customer
 ↓
Create Stripe Checkout Session
 ↓
Return Checkout URL
```

Only users with the `MANAGE_BILLING` permission can create checkout sessions.

The client cannot choose another tenant's ID.

The Billing UI calls `POST /api/billing/checkout` only after the user explicitly selects a plan. Opening the Billing page does not automatically create a Checkout Session.

If the required Stripe configuration is missing, the endpoint returns a sanitized HTTP `503 Service Unavailable` response. The frontend displays a friendly configuration message instead of exposing internal server errors.

Stripe Price IDs are resolved on the server, and Checkout success alone does not mean the subscription is active in the local database. The application relies on verified Stripe webhooks to synchronize subscription state.

---

# Stripe Webhooks

Stripe webhooks are handled through:

```text
POST /api/webhooks/stripe
```

Webhook requests are verified using Stripe's signature verification mechanism.

The raw request body is read before attempting to parse the event because Stripe signature verification requires the original payload.

The endpoint requires:

```text
stripe-signature
```

and verifies it using:

```text
STRIPE_WEBHOOK_SECRET
```

Invalid or missing signatures are rejected.

---

# Supported Stripe Events

The application currently handles:

```text
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

Unknown but validly signed Stripe events are safely recorded and ignored.

This allows the webhook endpoint to remain forward-compatible with Stripe events that are not currently required by the application.

---

# Duplicate Webhook Protection

Stripe may retry webhook events.

To prevent the same event from being processed more than once, the application stores Stripe event IDs in:

```text
ProcessedStripeEvent
```

The event is claimed inside the same transaction as the corresponding business update.

This is important because if the business update fails, the transaction rolls back and Stripe can retry the event.

Concurrent duplicate processing is also protected by the unique Stripe event ID constraint.

---

# Stripe Event Ordering

Webhook events may not always arrive in the same order they were generated.

Subscription records therefore store:

```text
lastStripeEventAt
```

When a subscription event is received, the application checks the event timestamp before applying the update.

Older subscription events are ignored rather than overwriting newer subscription state.

This helps prevent stale webhook events from reverting the local subscription state.

---

# Stripe Tenant Resolution

Stripe webhooks do not have an application session cookie.

Therefore, the webhook must determine which application tenant owns the Stripe Customer.

The application resolves the tenant using the verified Stripe Customer ID.

A restricted PostgreSQL `SECURITY DEFINER` function is used for this lookup:

```text
find_tenant_id_by_stripe_customer(...)
```

The function has a narrow purpose and is explicitly granted only to the application database role.

After the tenant is resolved, tenant-specific writes are executed under the appropriate RLS tenant context.

---

# Subscription Synchronization

The local subscription record is treated as a synchronized representation of Stripe's subscription state.

The webhook handler updates information such as:

* Subscription status
* Stripe price ID
* Application plan key
* Current period end
* Cancel-at-period-end state
* Last Stripe event timestamp

The plan key is determined from the configured Stripe price IDs.

If a Stripe price does not match a configured application plan, the subscription can be represented as:

```text
unrecognized
```

rather than incorrectly assigning it to an application plan.

The current billing period end is read from the subscription item data provided by Stripe.

---

# Invoice History

Billing history is available through:

```text
GET /api/billing/invoices
```

The endpoint returns invoices belonging to the authenticated tenant.

Invoice records are synchronized from Stripe webhook events.

The billing UI can display information such as:

* Invoice status
* Amount paid
* Currency
* Billing period
* Hosted invoice URL

Tenant isolation is enforced through PostgreSQL RLS.

---

# Stripe Billing Portal

The application also provides a Billing Portal endpoint:

```text
POST /api/billing/portal
```

The portal session is created for the authenticated tenant's Stripe Customer.

Creating a portal session requires a Stripe Customer ID already stored for the tenant. The application does not silently create a Stripe Customer just to open the Billing Portal, so the local UI may show that the portal is unavailable when no Stripe Customer is configured. Portal access also depends on the Stripe Billing Portal being configured in Stripe.

Only users with billing management permission can create a Billing Portal session.

Real use of the Stripe Billing Portal has not been verified locally.

---

# Billing UI

The billing page is available at:

```text
/dashboard/billing
```

The page includes:

* Current subscription information
* Available plans and plan selection for ADMIN users
* Billing history
* Stripe Billing Portal access for ADMIN users when a Stripe Customer exists
* Subscription status
* Checkout flow

Billing access follows the application's RBAC rules.

### ADMIN

Can:

* View billing
* Start checkout
* Manage billing
* Access Billing Portal when a Stripe Customer exists

### MANAGER

Can:

* View billing
* View subscription and billing history

Cannot:

* Change plans
* Perform billing-management actions

### STAFF

* Does not see Billing in navigation
* Cannot access the Billing page
* Billing APIs remain protected by server-side authorization

---

# Webhook-Driven UI State

The application does not assume that returning from Stripe Checkout means the subscription is already active in the local database.

Instead, the flow is:

```text
Application
    ↓
Stripe Checkout
    ↓
Payment / Subscription
    ↓
Stripe Webhook
    ↓
Webhook Verification
    ↓
Database Synchronization
    ↓
Billing UI Reads Local State
```

This avoids displaying a false "active subscription" state before Stripe's webhook has updated the application database.

---

# API Endpoints

## Authentication

```text
POST /api/auth/login
POST /api/auth/logout
```

## Bookings

```text
GET    /api/bookings
POST   /api/bookings
GET    /api/bookings/[id]
PATCH  /api/bookings/[id]
DELETE /api/bookings/[id]
```

## Billing

```text
GET  /api/billing/subscription
GET  /api/billing/invoices
POST /api/billing/checkout
POST /api/billing/portal
```

## Stripe

```text
POST /api/webhooks/stripe
```

All protected application endpoints derive the tenant from the authenticated server-side session.

---

# Project Structure

```text
multi-tenant-booking/
│
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   └── logout/
│   │   │
│   │   ├── bookings/
│   │   │
│   │   ├── billing/
│   │   │   ├── checkout/
│   │   │   ├── invoices/
│   │   │   ├── portal/
│   │   │   └── subscription/
│   │   │
│   │   └── webhooks/
│   │       └── stripe/
│   │
│   ├── dashboard/
│   │   └── billing/
│   │
│   └── ...
│
├── components/
│   └── billing/
│       └── BillingPanel.tsx
│
├── lib/
│   ├── billing/
│   │   ├── checkout.ts
│   │   ├── errors.ts
│   │   ├── plans.ts
│   │   ├── portal.ts
│   │   ├── prisma-errors.ts
│   │   ├── stripe-client.ts
│   │   ├── stripe-customer.ts
│   │   ├── tenant-lookup.ts
│   │   ├── validation.ts
│   │   └── webhook-sync.ts
│   │
│   ├── api/
│   │   └── billing-client.ts
│   │
│   ├── env.server.ts
│   ├── prisma.ts
│   ├── stripe.ts
│   └── ...
│
├── prisma/
│   ├── migrations/
│   └── schema.prisma
│
├── scripts/
│   ├── test-auth.ts
│   ├── test-bookings.ts
│   ├── test-idempotency.ts
│   ├── test-tenant-security.ts
│   ├── test-billing-foundation.ts
│   ├── test-billing-checkout.ts
│   ├── test-stripe-webhook.ts
│   ├── test-billing-subscription.ts
│   ├── test-billing-history.ts
│   └── test-billing-portal.ts
│
├── docker-compose.yml
├── prisma.config.ts
├── package.json
└── README.md
```

---

# Environment Variables

Create a `.env` file based on `.env.example`.

Example development configuration:

```env
DATABASE_URL=postgresql://booking_dev:password@localhost:5432/multi_tenant_booking

APP_DATABASE_URL=postgresql://app_user:password@localhost:5432/multi_tenant_booking

SESSION_SECRET=your-session-secret

APP_BASE_URL=http://localhost:3000

STRIPE_SECRET_KEY=your-stripe-secret-key

STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

STRIPE_PRICE_ID_BASIC=your-basic-price-id

STRIPE_PRICE_ID_PRO=your-pro-price-id
```

Do not commit real credentials or secrets to Git.

The Stripe price IDs are kept server-side and are not accepted directly from the client.

---

# Local Setup

## 1. Clone the repository

```bash
git clone https://github.com/zainab-f207/multi-tenant-booking.git
cd multi-tenant-booking
```

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment variables

Create a `.env` file using `.env.example` as a reference.

For Stripe functionality, configure the required Stripe values.

## 4. Start PostgreSQL

The project uses Docker Compose for PostgreSQL.

```bash
docker compose up -d
```

Verify that the PostgreSQL container is running:

```bash
docker ps
```

## 5. Generate Prisma Client

```bash
npx prisma generate
```

## 6. Run database migrations

```bash
npx prisma migrate dev
```

## 7. Seed development data

Run the project's configured seed command if available in the current repository configuration.

The development seed creates tenants, roles, and users for testing the multi-tenant and RBAC functionality.

## 8. Start the application

```bash
npm run dev
```

The application will normally be available at:

```text
http://localhost:3000
```

---

# Development Seed Data

The development environment contains three example tenants.

### Tenant 1

```text
TechNova Solutions
slug: technova-solutions
```

### Tenant 2

```text
Lahore Creative Studio
slug: lahore-creative-studio
```

### Tenant 3

```text
Pakistan Business Consultants
slug: pakistan-business-consultants
```

Example users include:

```text
ayesha.khan@technova.dev
bilal.ahmed@technova.dev
sana.malik@technova.dev

hamza.iqbal@lahorecreative.dev
mahnoor.tariq@lahorecreative.dev

usman.farooq@pbc.dev
zara.sheikh@pbc.dev
```

Development seed password:

```text
Password123!
```

These credentials are intended only for local development and testing.

---

# Testing

The project contains dedicated verification scripts for the major security and application areas.

Run the standard verification commands:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Core Tests

### Row-Level Security

```bash
npm run test:rls
```

Verifies that tenant-owned records cannot be accessed across tenant boundaries.

### Authentication

```bash
npm run test:auth
```

Tests authentication and session behavior.

### Bookings

```bash
npm run test:bookings
```

Tests booking API behavior.

### Idempotency

```bash
npm run test:idempotency
```

Tests duplicate-request protection.

### Tenant Security

```bash
npm run test:tenant-security
```

Verifies that tenant IDs supplied by clients cannot be used to bypass server-side tenant resolution.

---

# Billing Tests

### Billing Foundation

```bash
npm run test:billing-foundation
```

Tests billing database and permission foundations.

### Checkout

```bash
npm run test:billing-checkout
```

Tests checkout validation, permissions, Stripe customer reuse, and checkout logic.

If real Stripe credentials are not configured, the real Stripe API portion is skipped.

### Stripe Webhooks

```bash
npm run test:stripe-webhook
```

This test verifies application-level webhook processing, including event mapping, duplicate handling, stale-event protection, and tenant isolation. Local signature tests verify the application's signature-validation behavior using test secrets; they do not prove that Stripe delivered an event to the application.

Actual external testing requires Stripe test-mode credentials and a configured webhook endpoint. A tool such as the Stripe CLI can forward events from Stripe to the local application. Real Stripe-hosted Checkout/API testing and a webhook actually delivered by Stripe were not completed locally.

The Stripe integration itself is implemented. The limitation concerns external end-to-end verification, not completion of the application's billing implementation.

### Subscription

```bash
npm run test:billing-subscription
```

Tests subscription-related billing behavior.

### Billing History

```bash
npm run test:billing-history
```

Tests invoice retrieval, tenant isolation, and billing permissions.

### Billing Portal

```bash
npm run test:billing-portal
```

Tests Billing Portal authorization and session creation logic.

---

# Security Considerations

Security is enforced at multiple levels.

## Server-Side Tenant Resolution

The tenant is derived from the authenticated user's session.

The client cannot select a tenant for protected operations.

## PostgreSQL RLS

Tenant-owned records are protected by database-level RLS policies.

## Restricted Database Role

The normal application uses `app_user`, which does not bypass RLS.

## Role-Based Access Control

Protected operations check the user's role before execution.

## Password Hashing

Passwords are stored using bcrypt hashes rather than plaintext passwords.

## Session Security

Session tokens are stored as hashes in the database and delivered to the browser through an HTTP-only cookie.

## Input Validation

API input is validated using Zod.

## Stripe Signature Verification

Webhook requests are verified using Stripe's official signature mechanism before processing.

## Webhook Deduplication

Processed Stripe event IDs are stored to prevent duplicate processing.

## Stale Event Protection

Subscription events are checked against the most recently processed event timestamp.

## Server-Side Stripe Price Mapping

The client submits only a plan key. Stripe price IDs are resolved on the server.

---

# Week 1 — Project Foundation

The first phase established the core full-stack project foundation.

Key areas included:

* Next.js application setup
* TypeScript
* Tailwind CSS
* PostgreSQL
* Docker Compose
* Prisma
* Database schema
* Database migrations
* Tenant model
* User model
* Role model
* Booking model
* Development seed data
* Environment configuration
* Project documentation

The initial architecture was designed around multi-tenancy from the beginning rather than adding tenant isolation later.

---

# Week 2 — Authentication, RBAC, Bookings & Tenant Security

The second phase focused on application functionality and security.

Implemented features included:

* Cookie-based authentication
* Server-side sessions
* Password hashing
* Role-based authorization
* Booking CRUD
* Pagination
* Filtering
* Validation
* Idempotency
* PostgreSQL RLS
* Tenant context
* Tenant isolation testing
* Security verification scripts

The main security principle established during this phase was:

> The authenticated user's tenant is the source of truth.

This principle is also used by the billing system introduced in Week 3.

---

# Week 3 — Payments, Webhooks & Pricing

The third phase introduced Stripe-based subscription billing.

Implemented functionality includes:

* Stripe Customer management
* Subscription Checkout
* Pricing UI
* Subscription status
* Stripe webhook verification
* Duplicate webhook protection
* Subscription synchronization
* Stale event protection
* Invoice synchronization
* Billing history
* Stripe Billing Portal
* Billing RBAC
* Tenant-aware billing
* Billing API endpoints
* Billing verification scripts

The billing architecture was designed so that Stripe remains the external payment system while PostgreSQL stores the application's synchronized billing state.

---

# Stripe and Database Consistency

Stripe and PostgreSQL are separate systems and cannot participate in one atomic transaction.

For example:

```text
Application
    │
    ├── Stripe API
    │
    └── PostgreSQL
```

A Stripe operation can succeed while a subsequent database operation fails.

The implementation therefore uses:

* Stripe idempotency keys where appropriate
* Existing Stripe Customer reuse
* Database uniqueness constraints
* Transactional webhook processing
* Processed event tracking
* Retry-safe webhook behavior

There is still a distributed consistency boundary between Stripe and PostgreSQL. This is a known architectural limitation rather than something hidden by the implementation.

---

# Known Limitations

## Application-Level Testing

The Stripe integration is implemented, and application-level Stripe logic and webhook processing are tested locally. These automated tests do not require a live Stripe API account.

## Real External Stripe Testing

Real external Stripe Checkout/API end-to-end testing was not completed locally. It requires a Stripe account, API credentials, configured Products/Prices, and webhook configuration. Stripe's standard payment account availability does not currently include Pakistan, so I could not legitimately obtain a standard Stripe payment account or credentials for this project from Pakistan. No account from another country was used.

## Stripe Dashboard Configuration

Billing Portal sessions require both a stored Stripe Customer for the tenant and Stripe Billing Portal configuration. No real Stripe Billing Portal session was opened locally.

## Distributed Stripe/PostgreSQL State

Stripe and PostgreSQL cannot be committed atomically.

The application uses retry-safe mechanisms and idempotency, but distributed systems can still require reconciliation in unusual failure scenarios.

## Development Credentials

The seed users and development password are for local testing only and must not be used in production.

---

# Production Considerations

Before deploying the application to production, the following should be reviewed:

* Use production database credentials
* Use a strong session secret
* Enable HTTPS
* Configure secure cookies
* Configure production Stripe keys
* Configure Stripe webhook endpoints
* Configure production Stripe Price IDs
* Configure Stripe Billing Portal settings
* Review database permissions
* Review RLS policies
* Configure monitoring and logging
* Rotate development credentials
* Remove or replace development seed credentials
* Test Stripe subscription lifecycle events
* Test webhook retries and duplicate events
* Establish a billing reconciliation strategy

---

# Git Workflow

The project is maintained using Git.

The main branch is:

```text
main
```

Development work is committed in focused changes so that database, authentication, booking, security, and billing milestones can be tracked independently.

---

# Project Goals

The main goals of the project are:

1. Build a practical full-stack application using modern web technologies.
2. Understand multi-tenant architecture.
3. Enforce tenant isolation at the database level.
4. Implement authentication and RBAC securely.
5. Build reliable booking APIs.
6. Handle duplicate requests safely.
7. Integrate Stripe subscription billing.
8. Process Stripe webhooks securely.
9. Synchronize external payment state with application state.
10. Build a usable subscription and billing interface.
11. Develop testing and verification habits for security-sensitive features.

---

# Summary

This project demonstrates a complete multi-tenant full-stack application with both business functionality and security-focused backend architecture.

The application combines:

```text
Next.js
   +
TypeScript
   +
PostgreSQL
   +
Prisma
   +
Row-Level Security
   +
Cookie-Based Authentication
   +
RBAC
   +
Booking Management
   +
Idempotency
   +
Stripe Checkout
   +
Stripe Webhooks
   +
Subscription Management
   +
Invoice History
   +
Billing Portal
```

The most important architectural principle throughout the project is that **tenant isolation is enforced by the backend and database rather than being trusted to the frontend**.

Stripe billing extends the same principle into the payment layer by resolving billing ownership from verified Stripe Customer information and synchronizing Stripe events into tenant-scoped application records.

The result is a practical foundation for a production-oriented SaaS-style multi-tenant booking platform.
