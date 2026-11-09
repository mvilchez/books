"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  findUserByEmail,
  getUnverifiedUserByEmail,
  createUser,
  createPasswordResetToken,
  findVerifiedUserByEmail,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  findUserById,
  updateUserPassword,
  getCurrentUser,
  markEmailAsVerified,
  updateUserProfile,
  resetPasswordWithToken,
} from "@/lib/auth";
import { sendPasswordResetEmail, sendProfileChangedEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

const passwordResetRequestMessage =
  "If an account exists for that email, a password reset link will be sent.";

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const passwordResetRequestSchema = z.object({
  email: z.string().trim().email(),
});

const passwordResetSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(1),
});

/** Start password recovery without revealing whether an email is registered. */
export async function requestPasswordResetAction(formData: FormData) {
  const parsed = passwordResetRequestSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: "Enter a valid email address." };
  }

  const { email } = parsed.data;
  const rateLimit = checkRateLimit(`password-reset:${email.toLowerCase()}`, {
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return { success: passwordResetRequestMessage };
  }

  const user = await findVerifiedUserByEmail(email);
  if (!user) {
    return { success: passwordResetRequestMessage };
  }

  const token = await createPasswordResetToken(user.id);
  try {
    await sendPasswordResetEmail({ to: user.email, token });
  } catch (error) {
    console.error("Failed to send password reset email:", error);
  }

  return { success: passwordResetRequestMessage };
}

/** Change a password using a valid, single-use reset token. */
export async function resetPasswordAction(formData: FormData) {
  const parsed = passwordResetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: "Invalid or expired reset link, or invalid password." };
  }

  const { token, password, confirmPassword } = parsed.data;
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const reset = await resetPasswordWithToken(token, password);
  if (!reset) {
    return { error: "This reset link is invalid or expired. Request a new one." };
  }
  return { success: "Password reset. You can now log in." };
}

/** Verify the email address linked to the given token and create a session. */
async function verifyEmailAction(formData: FormData) {
  const token = formData.get("token");
  if (typeof token !== "string" || !token) {
    return { error: "Invalid verification token." };
  }

  const user = await findUserByEmail(token);
  if (!user || user.emailVerified) {
    return { error: "This verification link has expired or was already used." };
  }

  await markEmailAsVerified(user.id);
  await createSession(user.id);
  redirect("/account");
}

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

  const existing = await getUnverifiedUserByEmail(email);
  if (existing && existing.emailVerified) {
    return { error: "An account with that email already exists." };
  }

  const user = await createUser({ name: name ?? null, email, password });

  // Email is not yet verified. The signup flow does not create a session and
  // does not land the user on the dashboard until email verification is complete.
  return { token: user.id };
}

export async function verifyEmail(formData: FormData) {
  return verifyEmailAction(formData);
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

  const rateLimit = checkRateLimit(`login:${email}`, {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return { error: "Too many login attempts. Please try again later." };
  }

  const user = await getUnverifiedUserByEmail(email);
  if (!user || user.emailVerified === false || !verifyPassword(password, user.passwordHash)) {
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
  await destroySession();
  return { success: "Password updated. All sessions were revoked; please log in again." };
}

const updateProfileSchema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email(),
});

/** Update the signed-in user's name and/or email address. */
export async function saveProfileAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: null, error: "Not authenticated." };
  }

  const parsed = updateProfileSchema.safeParse({
    name: formData.get("name") || undefined,
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { success: null, error: "Invalid input. Check the values and try again." };
  }
  const { name, email } = parsed.data;

  if (email !== user.email) {
    const existing = await findUserByEmail(email);
    if (existing) {
      return { success: null, error: "An account with that email already exists." };
    }
  }

  await updateUserProfile(user.id, {
    name: name ?? null,
    email,
    ...(email !== user.email ? { emailVerified: false } : {}),
  });

  // Notify the user when their name or email changed.
  const changedName = user.name !== name;
  const changedEmail = user.email !== email;
  if (changedName || changedEmail) {
    await sendProfileChangedEmail({
      to: email,
      name: name ?? null,
      email,
      changedName,
      changedEmail,
    }).catch((err) => {
      console.error("Failed to send profile-change email:", err);
    });
  }

  // Re-validate ownership on next request; the user's id is unchanged, so all
  // existing sessions remain valid.
  return { success: "Profile saved.", error: null };
}

