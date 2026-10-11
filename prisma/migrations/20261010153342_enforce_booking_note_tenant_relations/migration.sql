/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,bookingId]` on the table `booking_notes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,id]` on the table `bookings` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "booking_notes" DROP CONSTRAINT "booking_notes_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "booking_notes" DROP CONSTRAINT "booking_notes_updatedById_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "booking_notes_tenantId_bookingId_key" ON "booking_notes"("tenantId", "bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_tenantId_id_key" ON "bookings"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "booking_notes" ADD CONSTRAINT "booking_notes_tenantId_bookingId_fkey" FOREIGN KEY ("tenantId", "bookingId") REFERENCES "bookings"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_notes" ADD CONSTRAINT "booking_notes_tenantId_updatedById_fkey" FOREIGN KEY ("tenantId", "updatedById") REFERENCES "users"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
