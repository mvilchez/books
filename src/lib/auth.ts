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
  emailVerified: boolean;
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
    emailVerified: session.user.emailVerified,
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
    sameSite: "strict",
    secure: true,
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
  // Rotating the password must invalidate every existing session so a stolen
  // cookie cannot survive a password change.
  await prisma.session.deleteMany({ where: { userId } });
}

/** Find a verified user without selecting password credentials. */
export async function findVerifiedUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email, emailVerified: true },
    select: { id: true, email: true },
  });
}

/** Create or replace the user's one active password-reset token. */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.passwordResetToken.upsert({
    where: { userId },
    update: {
      tokenHash: sha256(token),
      expiresAt,
    },
    create: {
      userId,
      tokenHash: sha256(token),
      expiresAt,
    },
  });
  return token;
}

/** Consume a valid reset token, update the password, and revoke all sessions. */
export async function resetPasswordWithToken(
  token: string,
  password: string,
): Promise<boolean> {
  const tokenHash = sha256(token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true },
  });
  if (!resetToken || resetToken.expiresAt <= new Date()) {
    return false;
  }
  const passwordHash = hashPassword(password);

  return prisma.$transaction(async (transaction) => {
    const now = new Date();
    const consumed = await transaction.passwordResetToken.deleteMany({
      where: {
        id: resetToken.id,
        tokenHash,
        expiresAt: { gt: now },
      },
    });
    if (consumed.count !== 1) {
      return false;
    }

    await transaction.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });
    await transaction.session.deleteMany({
      where: { userId: resetToken.userId },
    });
    return true;
  });
}

/** Find a user by email (includes passwordHash). */
export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

/** Find an unverified user by email, or null. */
export async function getUnverifiedUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, emailVerified: true, passwordHash: true },
  });
}

/** Mark the user's email as verified. */
export async function markEmailAsVerified(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true },
  });
}

/** Update the signed-in user's profile (name and/or email). */
export async function updateUserProfile(
  userId: string,
  data: { name: string | null; email: string; emailVerified?: boolean },
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data,
  });
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