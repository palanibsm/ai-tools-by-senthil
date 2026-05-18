import { NextRequest, NextResponse } from "next/server";
import { logoutSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const sid = req.cookies.get("sid")?.value;
  if (sid) logoutSession(sid);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("sid", "", { path: "/", maxAge: 0 });
  return res;
}
