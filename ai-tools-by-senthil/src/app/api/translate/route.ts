import { NextRequest, NextResponse } from "next/server";
import translate from "translate-google";

export const runtime = "nodejs";

const MAX_WORDS = 1000;

const countWords = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      text?: string;
      source?: string;
      target?: string;
    };

    const text = String(body.text || "").trim();
    const source = String(body.source || "auto").trim();
    const target = String(body.target || "ta").trim();

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    if (countWords(text) > MAX_WORDS) {
      return NextResponse.json({ error: "maximum 1000 words allowed" }, { status: 400 });
    }

    if (!target) {
      return NextResponse.json({ error: "target is required" }, { status: 400 });
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
