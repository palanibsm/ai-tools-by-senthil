import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { ensureAdminBootstrap, loginUser } from "@/lib/auth";
import { verifyCaptcha } from "@/lib/captcha";

export async function POST(req: NextRequest) {
  ensureAdminBootstrap();
  const ip = clientIp(req.headers);
  const rl = checkRateLimit(`login:${ip}`, 12, 10 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });

  const body = await req.json();
  const username = String(body.username || "");
  const password = String(body.password || "");
  const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : undefined;

  const captcha = await verifyCaptcha(captchaToken);
  if (!captcha.ok) return NextResponse.json({ error: captcha.error }, { status: 400 });

  const login = loginUser(username, password);
  if (!login.ok) return NextResponse.json({ error: login.error }, { status: 401 });

  const res = NextResponse.json({ ok: true, username: login.username, role: login.role });
  res.cookies.set("sid", login.sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
