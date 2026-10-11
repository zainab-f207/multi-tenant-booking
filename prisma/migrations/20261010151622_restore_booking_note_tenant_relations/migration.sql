-- Restore the composite unique key needed by the booking relationship.
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_tenantId_id_key"
ON "bookings" ("tenantId", "id");

-- Remove the old foreign keys that do not include tenantId.
ALTER TABLE "booking_notes"
DROP CONSTRAINT "booking_notes_bookingId_fkey";

ALTER TABLE "booking_notes"
DROP CONSTRAINT "booking_notes_updatedById_fkey";

-- Ensure each note references a booking in the same tenant.
ALTER TABLE "booking_notes"
ADD CONSTRAINT "booking_notes_tenantId_bookingId_fkey"
FOREIGN KEY ("tenantId", "bookingId")
REFERENCES "bookings" ("tenantId", "id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Ensure the note's updater belongs to the same tenant.
ALTER TABLE "booking_notes"
ADD CONSTRAINT "booking_notes_tenantId_updatedById_fkey"
FOREIGN KEY ("tenantId", "updatedById")
REFERENCES "users" ("tenantId", "id")
ON DELETE RESTRICT
ON UPDATE CASCADE;