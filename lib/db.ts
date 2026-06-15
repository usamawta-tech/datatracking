import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

let _client: PrismaClient | null = null;

function getClient(): PrismaClient {
  if (_client) return _client;

  if (process.env.NODE_ENV === "production") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaD1 } = require("@prisma/adapter-d1");
    const { env } = getCloudflareContext();
    _client = new PrismaClient({ adapter: new PrismaD1(env.DB) });
  } else {
    const dbUrl =
      process.env.DATABASE_URL ??
      `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
    const adapter = new PrismaLibSql({
      url: dbUrl,
      ...(process.env.DATABASE_AUTH_TOKEN
        ? { authToken: process.env.DATABASE_AUTH_TOKEN }
        : {}),
    });
    _client = new PrismaClient({ adapter, log: ["error"] });
  }

  return _client;
}

// Proxy defers client creation to first use (inside a request),
// avoiding getCloudflareContext() being called at module load time.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getClient() as any)[prop]; // eslint-disable-line @typescript-eslint/no-explicit-any
  },
});
