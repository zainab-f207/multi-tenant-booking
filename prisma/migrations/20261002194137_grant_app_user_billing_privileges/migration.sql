-- Defensive: re-assert schema usage in case this is ever replayed after a
-- schema-recreating reset (see the Week 2 grant-loss incident).
GRANT USAGE ON SCHEMA public TO app_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON "tenant_billing_accounts" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "subscriptions" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "invoices" TO app_user;

-- Narrow on purpose: an event row is either absent or permanently processed.
-- The app never updates or deletes one.
GRANT SELECT, INSERT ON "processed_stripe_events" TO app_user;