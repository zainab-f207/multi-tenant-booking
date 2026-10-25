import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      status: "ok",
      checks: { database: "ok" },
    });
  } catch {
    return Response.json(
      {
        status: "error",
        checks: { database: "error" },
      },
      { status: 503 }
    );
  }
}