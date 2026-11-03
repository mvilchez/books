import { NextResponse } from "next/server";
import { markEmailAsVerified, createSession } from "@/lib/auth";

/**
 * GET /verify-email?token=<userId>
 *
 * Verifies the user's email address and creates a session, then redirects
 * to the account page. The token is the user's id, delivered via email after
 * signup.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", request.url));
  }

  await markEmailAsVerified(token);
  await createSession(token);

  return NextResponse.redirect(new URL("/account", request.url));
}