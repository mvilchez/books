"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { findUserByEmail, createUser, hashPassword, verifyPassword, createSession, destroySession, findUserById, updateUserPassword, getCurrentUser } from "@/lib/auth";

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    name: formData.get("name") || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Invalid input. Check email and password (min 8 chars)." };
  }
  const { name, email, password } = parsed.data;

  const existing = await findUserByEmail(email);
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const user = await createUser({ name: name ?? null, email, password });

  await createSession(user.id);
  redirect("/");
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Invalid email or password." };
  }
  const { email, password } = parsed.data;

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "Invalid email or password." };
  }

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(1),
});

export async function changePasswordAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated." };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: "Invalid input. New password must be at least 8 characters." };
  }
  const { currentPassword, newPassword, confirmPassword } = parsed.data;

  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation do not match." };
  }

  const dbUser = await findUserById(user.id);
  if (!dbUser || !verifyPassword(currentPassword, dbUser.passwordHash)) {
    return { error: "Current password is incorrect." };
  }

  await updateUserPassword(user.id, newPassword);
  return { success: "Password updated successfully." };
}

