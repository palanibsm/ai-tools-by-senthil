import { NextRequest, NextResponse } from "next/server";
import { getSession, listUsers, removeUser } from "@/lib/auth";

function requireAdmin(req: NextRequest) {
  const sid = req.cookies.get("sid")?.value;
  const session = getSession(sid);
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ users: listUsers() });
}

export async function DELETE(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const username = String(body.username || "").toLowerCase().trim();
  if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });
  if (username === admin.username) return NextResponse.json({ error: "cannot remove self" }, { status: 400 });

  const removed = removeUser(username);
  return NextResponse.json({ ok: removed });
}
