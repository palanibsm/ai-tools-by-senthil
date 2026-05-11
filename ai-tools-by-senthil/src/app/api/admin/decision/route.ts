import { NextRequest, NextResponse } from "next/server";
import { approveUser, markApprovalTokenUsed, rejectUser, verifyApprovalToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const parsed = verifyApprovalToken(token);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { username, action, nonce } = parsed.payload;
  const ok = action === "approve" ? approveUser(username) : rejectUser(username);
  markApprovalTokenUsed(nonce);

  if (!ok) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:24px"><h2>${action === "approve" ? "Approved" : "Rejected"} user: ${username}</h2></body></html>`,
    { headers: { "content-type": "text/html" } }
  );
}
