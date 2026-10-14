import { PrismaClient } from "@prisma/client";

/**
 * Shared `PrismaClient` singleton (Step 2.3).
 *
 * Next.js dev mode hot-reloads modules on every edit. Instantiating a
 * `PrismaClient` per reload leaks a connection pool each time and eventually
 * exhausts MariaDB's `max_connections`. Caching the instance on `globalThis`
 * keeps exactly one client across reloads; in production the module is
 * evaluated once, so the global cache is simply unused.
 *
 * Always import the client from here — never `new PrismaClient()` inline.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
