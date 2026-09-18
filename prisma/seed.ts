import "dotenv/config";
import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { env } from "../lib/env.server";

const adapter = new PrismaPg({ connectionString: env.APP_DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ROLE = {
  ADMIN: "a0000000-0000-4000-8000-000000000001",
  MANAGER: "a0000000-0000-4000-8000-000000000002",
  STAFF: "a0000000-0000-4000-8000-000000000003",
};

const TENANT = {
  TECHNOVA: "b0000000-0000-4000-8000-000000000001",
  LAHORE_CREATIVE: "b0000000-0000-4000-8000-000000000002",
  PBC: "b0000000-0000-4000-8000-000000000003",
};

const DEV_PASSWORD_HASH = bcrypt.hashSync("Password123!", 10);


async function withTenantContext<T>(
  tenantId: string,
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    return callback(tx);
  });
}

async function main() {
  console.log("Seeding roles...");
  const roles = [
    { id: ROLE.ADMIN, name: "ADMIN" },
    { id: ROLE.MANAGER, name: "MANAGER" },
    { id: ROLE.STAFF, name: "STAFF" },
  ];
  for (const role of roles) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: { name: role.name },
      create: role,
    });
  }

  console.log("Seeding tenants...");
  const tenants = [
    { id: TENANT.TECHNOVA, name: "TechNova Solutions", slug: "technova-solutions" },
    { id: TENANT.LAHORE_CREATIVE, name: "Lahore Creative Studio", slug: "lahore-creative-studio" },
    { id: TENANT.PBC, name: "Pakistan Business Consultants", slug: "pakistan-business-consultants" },
  ];
  for (const tenant of tenants) {
    await prisma.tenant.upsert({
      where: { id: tenant.id },
      update: { name: tenant.name, slug: tenant.slug },
      create: tenant,
    });
  }

  console.log("Seeding users...");
  const users = [
    { id: "c0000000-0000-4000-8000-000000000001", tenantId: TENANT.TECHNOVA, roleId: ROLE.ADMIN, name: "Ayesha Khan", email: "ayesha.khan@technova.dev" },
    { id: "c0000000-0000-4000-8000-000000000002", tenantId: TENANT.TECHNOVA, roleId: ROLE.MANAGER, name: "Bilal Ahmed", email: "bilal.ahmed@technova.dev" },
    { id: "c0000000-0000-4000-8000-000000000003", tenantId: TENANT.TECHNOVA, roleId: ROLE.STAFF, name: "Sana Malik", email: "sana.malik@technova.dev" },
    { id: "c0000000-0000-4000-8000-000000000004", tenantId: TENANT.LAHORE_CREATIVE, roleId: ROLE.ADMIN, name: "Hamza Iqbal", email: "hamza.iqbal@lahorecreative.dev" },
    { id: "c0000000-0000-4000-8000-000000000005", tenantId: TENANT.LAHORE_CREATIVE, roleId: ROLE.STAFF, name: "Mahnoor Tariq", email: "mahnoor.tariq@lahorecreative.dev" },
    { id: "c0000000-0000-4000-8000-000000000006", tenantId: TENANT.PBC, roleId: ROLE.ADMIN, name: "Usman Farooq", email: "usman.farooq@pbc.dev" },
    { id: "c0000000-0000-4000-8000-000000000007", tenantId: TENANT.PBC, roleId: ROLE.MANAGER, name: "Zara Sheikh", email: "zara.sheikh@pbc.dev" },
  ];
  for (const user of users) {
    await withTenantContext(user.tenantId, (tx) =>
      tx.user.upsert({
        where: { id: user.id },
        update: { ...user, passwordHash: DEV_PASSWORD_HASH },
        create: { ...user, passwordHash: DEV_PASSWORD_HASH },
      })
    );
  }

  console.log("Seeding bookings...");
  const bookings: Array<{
    id: string; tenantId: string; createdById: string; title: string; description: string;
    startTime: Date; endTime: Date; status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  }> = [
    { id: "d0000000-0000-4000-8000-000000000001", tenantId: TENANT.TECHNOVA, createdById: "c0000000-0000-4000-8000-000000000002", title: "Client onboarding call", description: "Kickoff meeting with new client", startTime: new Date("2026-09-22T10:00:00Z"), endTime: new Date("2026-09-22T11:00:00Z"), status: "CONFIRMED" },
    { id: "d0000000-0000-4000-8000-000000000002", tenantId: TENANT.TECHNOVA, createdById: "c0000000-0000-4000-8000-000000000003", title: "Sprint planning", description: "Plan next two-week sprint", startTime: new Date("2026-09-23T09:00:00Z"), endTime: new Date("2026-09-23T10:30:00Z"), status: "PENDING" },
    { id: "d0000000-0000-4000-8000-000000000003", tenantId: TENANT.LAHORE_CREATIVE, createdById: "c0000000-0000-4000-8000-000000000004", title: "Brand photoshoot", description: "Product photography for new campaign", startTime: new Date("2026-09-24T13:00:00Z"), endTime: new Date("2026-09-24T16:00:00Z"), status: "CONFIRMED" },
    { id: "d0000000-0000-4000-8000-000000000004", tenantId: TENANT.LAHORE_CREATIVE, createdById: "c0000000-0000-4000-8000-000000000005", title: "Client review session", description: "Review draft designs with client", startTime: new Date("2026-09-25T11:00:00Z"), endTime: new Date("2026-09-25T12:00:00Z"), status: "PENDING" },
    { id: "d0000000-0000-4000-8000-000000000005", tenantId: TENANT.PBC, createdById: "c0000000-0000-4000-8000-000000000006", title: "Tax advisory session", description: "Quarterly tax planning meeting", startTime: new Date("2026-09-26T14:00:00Z"), endTime: new Date("2026-09-26T15:00:00Z"), status: "COMPLETED" },
    { id: "d0000000-0000-4000-8000-000000000006", tenantId: TENANT.PBC, createdById: "c0000000-0000-4000-8000-000000000007", title: "New client consultation", description: "Initial consultation for prospective client", startTime: new Date("2026-09-27T10:00:00Z"), endTime: new Date("2026-09-27T11:00:00Z"), status: "CANCELLED" },
  ];
  for (const booking of bookings) {
    await withTenantContext(booking.tenantId, (tx) =>
      tx.booking.upsert({
        where: { id: booking.id },
        update: booking,
        create: booking,
      })
    );
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });