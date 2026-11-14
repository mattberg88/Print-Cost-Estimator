import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Admin auth. Set these in the Vercel project's environment variables:
 *   ADMIN_USERNAME  (optional, defaults to "Artifart")
 *   ADMIN_PASSWORD  (required; admin login is disabled without it)
 * The password is never stored in the code. The session cookie is an HMAC
 * derived from the credentials, so changing either signs everyone out.
 */
export const ADMIN_COOKIE = "a3d_admin";
export const ADMIN_MAX_AGE = 60 * 60 * 12; // 12 hours

const username = () => process.env.ADMIN_USERNAME || "Artifart";
const password = () => process.env.ADMIN_PASSWORD || "";

export function adminConfigured() {
  return password().length > 0;
}

export function sessionToken() {
  return createHmac("sha256", password()).update(`artifactory3d-admin-v2:${username()}`).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Compare fixed-length digests so input length doesn't leak timing.
const digest = (s: string) => createHmac("sha256", "a3d-cred-check").update(s).digest("hex");

export function checkCredentials(user: string, pass: string) {
  if (!adminConfigured()) return false;
  const userOk = safeEqual(digest(user.trim().toLowerCase()), digest(username().toLowerCase()));
  const passOk = safeEqual(digest(pass), digest(password()));
  return userOk && passOk;
}

export function isAdmin(req: NextRequest) {
  if (!adminConfigured()) return false;
  const c = req.cookies.get(ADMIN_COOKIE)?.value;
  return !!c && safeEqual(c, sessionToken());
}
