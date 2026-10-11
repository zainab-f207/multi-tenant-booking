-- DropForeignKey
ALTER TABLE "booking_notes" DROP CONSTRAINT "booking_notes_tenantId_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "booking_notes" DROP CONSTRAINT "booking_notes_tenantId_updatedById_fkey";

-- DropIndex
DROP INDEX "bookings_tenantId_id_key";

-- AddForeignKey
ALTER TABLE "booking_notes" ADD CONSTRAINT "booking_notes_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_notes" ADD CONSTRAINT "booking_notes_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
