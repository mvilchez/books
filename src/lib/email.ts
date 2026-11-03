import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || "Books Tracker <noreply@books.local>";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
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