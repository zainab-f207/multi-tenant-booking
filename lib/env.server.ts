
import { z } from "zod";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/env.server.ts was imported in client code. This file must only be used on the server."
  );
}

const envSchema = z.object({
  POSTGRES_DB: z.string().min(1, "POSTGRES_DB is required"),
  POSTGRES_USER: z.string().min(1, "POSTGRES_USER is required"),
  POSTGRES_PASSWORD: z.string().min(1, "POSTGRES_PASSWORD is required"),

  POSTGRES_PORT: z.coerce
    .number({ message: "POSTGRES_PORT must be a number" })
    .int("POSTGRES_PORT must be an integer")
    .min(1, "POSTGRES_PORT must be >= 1")
    .max(65535, "POSTGRES_PORT must be <= 65535"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .url("DATABASE_URL must be a valid connection URL"),

  APP_DB_USER: z.string().min(1, "APP_DB_USER is required"),
  APP_DB_PASSWORD: z.string().min(1, "APP_DB_PASSWORD is required"),

  APP_DATABASE_URL: z
    .string()
    .min(1, "APP_DATABASE_URL is required")
    .url("APP_DATABASE_URL must be a valid connection URL"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid or missing environment variables:");
    console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
    throw new Error(
      "Invalid environment variables. Check the console output above and fix your .env file."
    );
  }

  return parsed.data;
}

export const env = loadEnv();