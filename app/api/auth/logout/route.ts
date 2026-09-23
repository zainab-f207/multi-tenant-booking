

import { NextRequest } from "next/server";
import { deleteSession, SESSION_COOKIE_NAME } from "@/lib/session";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      await deleteSession(token);
    }

    const response = apiSuccess({ loggedOut: true });
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err) {
    return handleApiError(err);
  }
}