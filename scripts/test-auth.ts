

import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { createSession, lookupSession, deleteSession, hashSessionToken } from "../lib/session";

const SEEDED_EMAIL = "ayesha.khan@technova.dev";

const SEEDED_PASSWORD = "Password123!";
const WRONG_PASSWORD = "definitely-wrong-password";

interface LoginLookupRow {
  id: string;
  tenantId: string;
  roleId: string;
  passwordHash: string;
  name: string;
  email: string;
}

function check(label: string, ok: boolean) {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}`);
  return ok;
}

async function main() {
  console.log("=== Authentication / Session Test (connecting as app_user) ===\n");
  let allPassed = true;

  const rows = await prisma.$queryRaw<LoginLookupRow[]>`
    SELECT * FROM find_user_for_login(${SEEDED_EMAIL})
  `;
  const found = rows[0];
  allPassed &&= check("Seeded user found via find_user_for_login()", !!found);
  if (!found) {
    console.error("Cannot continue. Did you run `npx prisma db seed` and apply the new migrations?");
    await prisma.$disconnect();
    process.exit(1);
  }

  const role = await prisma.role.findUnique({ where: { id: found.roleId } });
  allPassed &&= check("Role resolves for seeded user", !!role);

  const correctPasswordOk = await bcrypt.compare(SEEDED_PASSWORD, found.passwordHash);
  allPassed &&= check("Correct password verifies", correctPasswordOk);

  const wrongPasswordOk = await bcrypt.compare(WRONG_PASSWORD, found.passwordHash);
  allPassed &&= check("Wrong password is rejected", !wrongPasswordOk);

  const { token } = await createSession(found.id, found.tenantId);

  const session = await lookupSession(token);
  allPassed &&= check("Session lookup succeeds after creation (two-step)", !!session);
  allPassed &&= check("Session userId matches", session?.userId === found.id);
  allPassed &&= check("Session tenantId matches", session?.tenantId === found.tenantId);
  allPassed &&= check("Session roleName matches (loaded via withTenantContext)", session?.roleName === role?.name);
  allPassed &&= check("Session email matches (loaded via withTenantContext)", session?.email === found.email);

  const invalidLookup = await lookupSession("not-a-real-token");
  allPassed &&= check("Invalid token is rejected", invalidLookup === null);

  const { token: expiredToken } = await createSession(found.id, found.tenantId);
  await prisma.session.update({
    where: { tokenHash: hashSessionToken(expiredToken) },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const expiredLookup = await lookupSession(expiredToken);
  allPassed &&= check("Expired session is rejected", expiredLookup === null);

  await deleteSession(token);
  const afterLogout = await lookupSession(token);
  allPassed &&= check("Session invalidated after logout", afterLogout === null);

  await deleteSession(token); // repeated call, should not throw
  allPassed &&= check("Repeated logout does not throw", true);

  console.log(`\nOverall: ${allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`);

  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Test script error:", e);
  await prisma.$disconnect();
  process.exit(1);
});