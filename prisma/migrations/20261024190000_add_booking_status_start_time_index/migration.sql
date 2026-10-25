-- Build the index concurrently to reduce write blocking during index creation.
-- PostgreSQL requires CREATE INDEX CONCURRENTLY to run outside a transaction.
CREATE INDEX CONCURRENTLY "bookings_tenant_status_starttime_idx"
ON "bookings" ("tenantId", "status", "startTime");
