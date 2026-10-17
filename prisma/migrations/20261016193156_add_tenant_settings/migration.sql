
CREATE TABLE "tenant_settings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "defaultBookingDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_settings_tenantId_key"
ON "tenant_settings"("tenantId");

ALTER TABLE "tenant_settings"
ADD CONSTRAINT "tenant_settings_tenantId_fkey"
FOREIGN KEY ("tenantId")
REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_settings" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tenant_settings
ON "tenant_settings"
USING (
    "tenantId" = current_setting('app.current_tenant_id', true)::uuid
)
WITH CHECK (
    "tenantId" = current_setting('app.current_tenant_id', true)::uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE
ON "tenant_settings" TO "app_user";
