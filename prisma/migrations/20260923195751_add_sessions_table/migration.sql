-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_tenantId_idx" ON "sessions"("tenantId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- RLS decision for "sessions": intentionally NOT enabled.
-- ============================================================
-- Session lookup happens BEFORE the application knows which tenant a
-- request belongs to -- the whole point of the lookup is to discover
-- the tenant. Enabling RLS scoped by app.current_tenant_id here (the
-- same way users/bookings are protected) would make it impossible to
-- find a session in the first place, since no tenant context exists
-- yet at that point in the request lifecycle. This mirrors why
-- "tenants" itself is not RLS-protected: some tables must be
-- queryable before tenant context can be established.
--
-- Sessions remain safe despite no RLS because:
--   1. Every lookup filters on "tokenHash", a unique index on an
--      unguessable, cryptographically random value (32 bytes from
--      Node's crypto.randomBytes) never derivable from a userId or
--      tenantId.
--   2. The raw session token is only ever sent to the browser inside
--      an httpOnly cookie; only its SHA-256 hash is stored here, so
--      reading this table alone does not yield a usable, replayable
--      token.
--   3. app_user only receives the privileges explicitly GRANTed
--      below -- no broader access than users/bookings already have.

GRANT SELECT, INSERT, UPDATE, DELETE ON "sessions" TO "app_user";