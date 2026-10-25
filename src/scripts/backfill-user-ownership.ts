import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

function randomPassword(): string {
  return randomBytes(12).toString("base64url");
}

async function main() {
  const email = process.env.DEFAULT_OWNER_EMAIL ?? "marino@books.local";
  const name = process.env.DEFAULT_OWNER_NAME ?? "Marino";
  const id = process.env.DEFAULT_OWNER_ID ?? "marino";
  const envPassword = process.env.DEFAULT_OWNER_PASSWORD?.trim();

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.findUnique({ where: { id } });
  }

  let passwordToSet: string | null = envPassword && envPassword.length ? envPassword : null;
  let generated = false;
  if (!passwordToSet && (!user || user.passwordHash === "!")) {
    passwordToSet = randomPassword();
    generated = true;
  }

  if (!user) {
    const pw = passwordToSet ?? randomPassword();
    user = await prisma.user.create({
      data: { id, email, name, passwordHash: hashPassword(pw), role: "ADMIN" },
    });
    console.log(`Created default user ${email} (id: ${id})`);
    if (generated || !envPassword) {
      console.log(`Generated initial password (store it safely): ${pw}`);
    }
  } else {
    console.log(`Using existing user ${email} (id: ${user.id})`);
    if (passwordToSet) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(passwordToSet) },
      });
      console.log("Updated password hash.");
      if (generated) {
        console.log(`Generated initial password (store it safely): ${passwordToSet}`);
      }
    }
  }

  console.log("Backfill complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());