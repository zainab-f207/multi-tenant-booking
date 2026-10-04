
CREATE FUNCTION find_tenant_id_by_stripe_customer(p_stripe_customer_id TEXT)
RETURNS TABLE ("tenantId" UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT "tenantId"
  FROM tenant_billing_accounts
  WHERE "stripeCustomerId" = p_stripe_customer_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION find_tenant_id_by_stripe_customer(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_tenant_id_by_stripe_customer(TEXT) TO "app_user";