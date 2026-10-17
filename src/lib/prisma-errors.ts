/**
 * Prisma error predicates (PLAN.md — Encapsulation Validation).
 *
 * Server actions translate well-known Prisma error codes into user-facing
 * messages without importing `@prisma/client` at runtime.
 */
import { Prisma } from "@prisma/client";

/** P2002 — unique constraint violation (duplicate natural key). */
export function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/** P2025 — a record required by the operation was not found. */
export function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"
  );
}
