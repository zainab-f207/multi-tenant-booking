

import { randomBytes, createHash } from "node:crypto";
import { prisma } from "./prisma";
import { withTenantContext } from "./tenant-context";

export const SESSION_COOKIE_NAME = "session_token";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
  tenantId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex"); // 256 bits of randomness
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { userId, tenantId, tokenHash, expiresAt },
  });

  return { token, expiresAt };
}

export interface SessionLookupResult {
  userId: string;
  tenantId: string;
  roleName: string;
  email: string;
}


export async function lookupSession(token: string): Promise<SessionLookupResult | null> {
  const tokenHash = hashSessionToken(token);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {

    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  const user = await withTenantContext(session.tenantId, (tx) =>
    tx.user.findUnique({
      where: { id: session.userId },
      include: { role: true },
    })
  );

  if (!user) return null;

  return {
    userId: session.userId,
    tenantId: session.tenantId,
    roleName: user.role.name,
    email: user.email,
  };
}


export async function deleteSession(token: string): Promise<void> {
  const tokenHash = hashSessionToken(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}