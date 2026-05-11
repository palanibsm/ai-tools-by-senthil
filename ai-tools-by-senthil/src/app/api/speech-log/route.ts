import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const event = String(body?.event || "unknown");
    const error = body?.error ? String(body.error) : undefined;
    const message = body?.message ? String(body.message) : undefined;
    const lang = body?.lang ? String(body.lang) : undefined;
    const ua = req.headers.get("user-agent") || "unknown";

    console.info("[speech-log]", {
      event,
      error,
      message,
      lang,
      ua,
      at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
