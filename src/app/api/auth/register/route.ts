import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { ensureAdminBootstrap, registerPendingUser, signApprovalToken } from "@/lib/auth";
import { sendTelegramAdminMessage } from "@/lib/telegram";
import { verifyCaptcha } from "@/lib/captcha";

function appBaseUrl(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const host = req.headers.get("host");
  if (!host) return "http://localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  ensureAdminBootstrap();
  const ip = clientIp(req.headers);
  const rl = checkRateLimit(`register:${ip}`, 8, 10 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });

  const body = await req.json();
  const username = String(body.username || "");
  const password = String(body.password || "");
  const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : undefined;

  const captcha = await verifyCaptcha(captchaToken);
  if (!captcha.ok) return NextResponse.json({ error: captcha.error }, { status: 400 });

  const created = registerPendingUser(username, password);
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: 400 });

  const exp = Date.now() + 15 * 60 * 1000;
  const approveToken = signApprovalToken({
    username: created.username,
    action: "approve",
    exp,
    nonce: crypto.randomBytes(12).toString("hex"),
  });
  const rejectToken = signApprovalToken({
    username: created.username,
    action: "reject",
    exp,
    nonce: crypto.randomBytes(12).toString("hex"),
  });

  const base = appBaseUrl(req);
  const approveLink = `${base}/api/admin/decision?token=${encodeURIComponent(approveToken)}`;
  const rejectLink = `${base}/api/admin/decision?token=${encodeURIComponent(rejectToken)}`;

  await sendTelegramAdminMessage(
    `New registration request\nUser: ${created.username}\nApprove: ${approveLink}\nReject: ${rejectLink}`
  );

  return NextResponse.json({ ok: true, message: "Registration submitted for admin approval" });
}
