import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

function randomPassword(): string {
  return randomBytes(12).toString("base64url");
}

async function main() {
  const id = process.env.DEFAULT_OWNER_ID ?? "marino";
  const email = process.env.DEFAULT_OWNER_EMAIL ?? "marino@books.local";
  const name = process.env.DEFAULT_OWNER_NAME ?? "Marino";
  const envPassword = process.env.DEFAULT_OWNER_PASSWORD?.trim();

  let user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
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
      data: {
        id,
        email,
        name,
        passwordHash: hashPassword(pw),
        role: "ADMIN",
      },
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
      console.log("Updated password hash from DEFAULT_OWNER_PASSWORD.");
      if (generated) {
        console.log(`Generated initial password (store it safely): ${passwordToSet}`);
      }
    }
  }

  const ownerId = user.id;
  const validIds = (await prisma.user.findMany({ select: { id: true } })).map(
    (u) => u.id,
  );
  const orphaned = await prisma.book.count({
    where: { userId: { notIn: validIds } },
  });
  if (orphaned > 0) {
    const res = await prisma.book.updateMany({
      where: { userId: { notIn: validIds } },
      data: { userId: ownerId },
    });
    console.log(`Reassigned ${res.count} orphaned book(s) to ${ownerId}`);
  } else {
    console.log("No orphaned books.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());