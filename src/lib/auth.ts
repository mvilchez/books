"use server";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
};

const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Read the current user from the session cookie (cached per render pass). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = sha256(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role as "USER" | "ADMIN",
  };
});

/** Require an authenticated user, redirecting to /login otherwise. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Create a session row + set the cookie. Returns the raw token. */
export async function createSession(userId: string): Promise<string> {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { tokenHash, userId, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return rawToken;
}

/** Destroy the current session (cookie + row). */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session
      .delete({ where: { tokenHash: sha256(token) } })
      .catch(() => {});
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** Find a user by id (includes passwordHash). */
export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

/** Update a user's password. */
export async function updateUserPassword(userId: string, password: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashPassword(password) },
  });
}

/** Find a user by email (includes passwordHash). */
export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

/** Create a new user with a hashed password. */
export async function createUser(input: {
  name?: string | null;
  email: string;
  password: string;
}) {
  return prisma.user.create({
    data: {
      name: input.name ?? null,
      email: input.email,
      passwordHash: hashPassword(input.password),
    },
  });
}
export { hashPassword, verifyPassword };