import nodemailer, { type Transporter } from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || "Books Tracker <noreply@books.local>";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

/** Send an email. Returns true when sent, false when SMTP is not configured. */
export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    // SMTP not configured — log instead of failing the request.
    console.warn(
      `[email skipped] SMTP not configured. To: ${to} Subject: ${subject}`,
    );
    return false;
  }
  await transport.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
  return true;
}

/** Send a profile-changed notification email. */
export async function sendProfileChangedEmail({
  to,
  name,
  email,
  changedName,
  changedEmail,
}: {
  to: string;
  name: string | null;
  email: string;
  changedName: boolean;
  changedEmail: boolean;
}): Promise<boolean> {
  const changes: string[] = [];
  if (changedName) changes.push(`name to "${name ?? ""}"`);
  if (changedEmail) changes.push(`email address to "${email}"`);
  const changeList = changes.join(" and ");

  const subject = "Your Books Tracker profile was updated";
  const text = `Hello,

Your Books Tracker profile has been updated: ${changeList}.

If you did not make this change, please contact support immediately.

— Books Tracker`;

  const html = `
    <p>Hello,</p>
    <p>Your Books Tracker profile has been updated: <strong>${changeList}</strong>.</p>
    <p>If you did not make this change, please contact support immediately.</p>
    <p>— Books Tracker</p>
  `;

  return sendEmail({ to, subject, text, html });
}

/** Send a password-reset link to a verified account. */
export async function sendPasswordResetEmail({
  to,
  token,
}: {
  to: string;
  token: string;
}): Promise<boolean> {
  const appUrl =
    process.env.APP_URL ||
    (process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000");
  if (!appUrl) {
    throw new Error("APP_URL must be configured to send password reset links.");
  }

  const appBaseUrl = new URL(appUrl);
  if (
    !["http:", "https:"].includes(appBaseUrl.protocol) ||
    (process.env.NODE_ENV === "production" && appBaseUrl.protocol !== "https:")
  ) {
    throw new Error("APP_URL must use HTTP or HTTPS, and HTTPS in production.");
  }

  const resetUrl = new URL("/reset-password", appBaseUrl);
  resetUrl.searchParams.set("token", token);
  const link = resetUrl.toString();
  const safeLink = link.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

  const sent = await sendEmail({
    to,
    subject: "Reset your Books Tracker password",
    text: `Use this link to reset your password. It expires in one hour and can only be used once:\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Use the link below to reset your password. It expires in one hour and can only be used once.</p><p><a href="${safeLink}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
  if (!sent) {
    // SMTP not configured — print the reset link to the logs so it can be used directly.
    console.warn(
      `[password reset] SMTP not configured. Reset link for ${to}: ${link}`,
    );
  }
  return sent;
}
