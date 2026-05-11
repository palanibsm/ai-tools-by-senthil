import { NextRequest, NextResponse } from "next/server";
import translate from "translate-google";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_WORDS = 1000;

const countWords = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
};

async function translateWithOpenAI(text: string, source: string, target: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not configured");

  const model = "gpt-4o-mini";
  const prompt = `Translate the following text from ${source} to ${target}. Return ONLY translated text without notes.\n\nText:\n${text}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: "You are a precise translation engine." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI error: ${t}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || "";
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req.headers);
    const baseRl = checkRateLimit(`translate:${ip}`, 60, 60 * 1000);
    if (!baseRl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const body = (await req.json()) as {
      text?: string;
      source?: string;
      target?: string;
      provider?: "free" | "openai";
    };

    const text = String(body.text || "").trim();
    const source = String(body.source || "auto").trim();
    const target = String(body.target || "ta").trim();
    const provider = body.provider === "openai" ? "openai" : "free";

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    if (countWords(text) > MAX_WORDS) {
      return NextResponse.json({ error: "maximum 1000 words allowed" }, { status: 400 });
    }

    if (!target) {
      return NextResponse.json({ error: "target is required" }, { status: 400 });
    }

    if (provider === "openai") {
      const sid = req.cookies.get("sid")?.value;
      const session = getSession(sid);
      if (!session) {
        return NextResponse.json({ error: "Login required for OpenAI provider" }, { status: 401 });
      }

      const openaiRl = checkRateLimit(`translate-openai:${session.username}`, 40, 60 * 60 * 1000);
      if (!openaiRl.allowed) return NextResponse.json({ error: "OpenAI quota limit reached. Try later." }, { status: 429 });

      const translatedText = await translateWithOpenAI(text, source, target);
      return NextResponse.json({ translatedText });
    }

    const translated = await translate(text, {
      from: source === "auto" ? "auto" : source,
      to: target,
    });

    return NextResponse.json({ translatedText: translated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "translation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
