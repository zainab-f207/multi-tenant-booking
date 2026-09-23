
CREATE FUNCTION find_user_for_login(p_email TEXT)
RETURNS TABLE (
  id UUID,
  "tenantId" UUID,
  "roleId" UUID,
  "passwordHash" TEXT,
  name TEXT,
  email TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, "tenantId", "roleId", "passwordHash", name, email
  FROM users
  WHERE email = p_email
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION find_user_for_login(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_user_for_login(TEXT) TO "app_user";