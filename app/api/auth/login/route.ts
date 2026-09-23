
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/auth";
import { createSession, SESSION_COOKIE_NAME } from "@/lib/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days, matches lib/session.ts TTL

interface LoginLookupRow {
  id: string;
  tenantId: string;
  roleId: string;
  passwordHash: string;
  name: string;
  email: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    const rows = await prisma.$queryRaw<LoginLookupRow[]>`
      SELECT * FROM find_user_for_login(${email})
    `;
    const found = rows[0];

 
    if (!found) {
      return apiError("INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }

    const passwordOk = await bcrypt.compare(password, found.passwordHash);
    if (!passwordOk) {
      return apiError("INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }

    // Roles are shared reference data, not RLS-protected -- a normal,
    // safe query with no tenant context required.
    const role = await prisma.role.findUnique({ where: { id: found.roleId } });
    if (!role) {
      return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
    }

    const { token, expiresAt } = await createSession(found.id, found.tenantId);

    const response = apiSuccess({
      id: found.id,
      tenantId: found.tenantId,
      roleName: role.name,
      email: found.email,
      name: found.name,
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
      expires: expiresAt,
    });

    return response;
  } catch (err) {
    return handleApiError(err);
  }
}