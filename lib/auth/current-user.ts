

import { cookies } from "next/headers";
import { lookupSession, SESSION_COOKIE_NAME } from "../session";

export interface CurrentUser {
  id: string;
  tenantId: string;
  roleName: string;
  email: string;
}

export class UnauthenticatedError extends Error {
  constructor(message = "Not authenticated.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}


export async function getCurrentUser(): Promise<CurrentUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    throw new UnauthenticatedError("No session cookie present.");
  }

  const session = await lookupSession(token);

  if (!session) {
    throw new UnauthenticatedError("Session is invalid or has expired.");
  }

  return {
    id: session.userId,
    tenantId: session.tenantId,
    roleName: session.roleName,
    email: session.email,
  };
}