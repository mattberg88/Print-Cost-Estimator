import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Admin auth. Set ADMIN_PASSWORD in the Vercel project's environment
 * variables. The session cookie is an HMAC derived from the password, so
 * changing the password signs everyone out.
 */
export const ADMIN_COOKIE = "a3d_admin";
export const ADMIN_MAX_AGE = 60 * 60 * 12; // 12 hours

function password() {
  return process.env.ADMIN_PASSWORD || "";
}

export function adminConfigured() {
  return password().length > 0;
}

export function sessionToken() {
  return createHmac("sha256", password()).update("artifactory3d-admin-v1").digest("hex");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(attempt: string) {
  if (!adminConfigured()) return false;
  // Compare HMACs so lengths always match.
  const h = (s: string) => createHmac("sha256", "pw-check").update(s).digest("hex");
  return safeEqual(h(attempt), h(password()));
}

export function isAdmin(req: NextRequest) {
  if (!adminConfigured()) return false;
  const c = req.cookies.get(ADMIN_COOKIE)?.value;
  return !!c && safeEqual(c, sessionToken());
}
