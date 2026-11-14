import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_MAX_AGE, adminConfigured, checkPassword, isAdmin, sessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Current admin status. */
export async function GET(req: NextRequest) {
  return NextResponse.json(
    { admin: isAdmin(req), configured: adminConfigured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Log in with { password }. */
export async function POST(req: NextRequest) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: "Admin login isn't set up yet." }, { status: 503 });
  }
  let password = "";
  try {
    password = String((await req.json())?.password ?? "");
  } catch {
    /* empty body */
  }
  if (!checkPassword(password)) {
    // Small delay to slow down guessing.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }
  const res = NextResponse.json({ admin: true });
  res.cookies.set(ADMIN_COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_MAX_AGE,
  });
  return res;
}

/** Log out. */
export async function DELETE() {
  const res = NextResponse.json({ admin: false });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
