CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idempotency_keys_tenantId_key_key" ON "idempotency_keys"("tenantId", "key");

CREATE INDEX "idempotency_keys_tenantId_idx" ON "idempotency_keys"("tenantId");

ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Row-Level Security for idempotency_keys
-- ============================================================
-- Same convention as users/bookings: forced RLS, scoped by
-- app.current_tenant_id, set transaction-locally by
-- withTenantContext() before every idempotency operation. Unlike
-- "sessions" (which intentionally has NO RLS, because the tenant is
-- unknown at session-lookup time), idempotency keys are only ever
-- touched AFTER getCurrentUser() has already established the tenant,
-- so there is no reason to exempt this table -- it gets the same
-- protection as bookings.

ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "idempotency_keys" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_idempotency_keys ON "idempotency_keys"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================
-- Privileges: deliberately narrower than users/bookings/tenants/roles
-- ============================================================
-- Application code only ever SELECTs (to check for an existing key)
-- and INSERTs (to claim a new key) this table -- it never UPDATEs or
-- DELETEs a row. Earlier grants (see
-- 20260918201832_grant_app_user_table_privileges) gave app_user all
-- four DML privileges on tenants/roles/users/bookings because those
-- tables genuinely need UPDATE/DELETE (e.g. PATCH/DELETE bookings).
-- idempotency_keys does not, so it gets only what's actually used.

GRANT SELECT, INSERT ON "idempotency_keys" TO "app_user";