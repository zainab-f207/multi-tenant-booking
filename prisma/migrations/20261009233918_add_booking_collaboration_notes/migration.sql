-- Create booking notes
CREATE TABLE "booking_notes" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_notes_pkey" PRIMARY KEY ("id")
);

-- Unique constraints required for tenant-safe foreign keys
CREATE UNIQUE INDEX "users_tenantId_id_key"
ON "users"("tenantId", "id");

CREATE UNIQUE INDEX "bookings_tenantId_id_key"
ON "bookings"("tenantId", "id");

-- One note per booking
CREATE UNIQUE INDEX "booking_notes_bookingId_key"
ON "booking_notes"("bookingId");

CREATE INDEX "booking_notes_tenantId_idx"
ON "booking_notes"("tenantId");

CREATE INDEX "booking_notes_tenantId_updatedAt_idx"
ON "booking_notes"("tenantId", "updatedAt");

-- Every note must belong to a valid tenant
ALTER TABLE "booking_notes"
ADD CONSTRAINT "booking_notes_tenantId_fkey"
FOREIGN KEY ("tenantId")
REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- The booking must belong to the same tenant as the note
ALTER TABLE "booking_notes"
ADD CONSTRAINT "booking_notes_tenantId_bookingId_fkey"
FOREIGN KEY ("tenantId", "bookingId")
REFERENCES "bookings"("tenantId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- The last editor must belong to the same tenant as the note
ALTER TABLE "booking_notes"
ADD CONSTRAINT "booking_notes_tenantId_updatedById_fkey"
FOREIGN KEY ("tenantId", "updatedById")
REFERENCES "users"("tenantId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable and force row-level security
ALTER TABLE "booking_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_notes" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_booking_notes
ON "booking_notes"
USING (
    "tenantId" = current_setting('app.current_tenant_id', true)::uuid
)
WITH CHECK (
    "tenantId" = current_setting('app.current_tenant_id', true)::uuid
);

-- Give the existing application database user table access.
-- RLS continues to restrict which tenant's rows it can access.
GRANT SELECT, INSERT, UPDATE, DELETE
ON "booking_notes" TO "app_user";