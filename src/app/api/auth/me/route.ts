import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const sid = req.cookies.get("sid")?.value;
  const session = getSession(sid);
  if (!session) return NextResponse.json({ authenticated: false });
  return NextResponse.json({
    authenticated: true,
    username: session.username,
    role: session.role,
  });
}
