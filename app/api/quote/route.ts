import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { computeOrder } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const result = computeOrder(body, isAdmin(req));
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
