import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

type ParseResult = {
  description: string;
  amount: number | null;
  paidBy: string;
  participants: string[];
};

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function parseExpenseWithOpenAI(transcript: string, members: string[]): Promise<ParseResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not configured");

  const model = "gpt-4o-mini";

  const prompt = `Extract expense details from this voice text and return STRICT JSON.

Known members: ${members.join(", ") || "(none)"}
Voice text: ${transcript}

Rules:
- description: short string, what was purchased/spent for.
- amount: number only (no currency symbol). If unknown, return null.
- paidBy: choose one from known members when possible; else empty string.
- participants: array of names who shared the expense. Prefer known members.
- Return only valid JSON object with keys: description, amount, paidBy, participants.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You extract structured expense data. Return JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI error: ${t}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim() || "{}";
  const parsed = safeJsonParse<Partial<ParseResult>>(content) || {};

  const participants = Array.isArray(parsed.participants)
    ? parsed.participants.map((p) => String(p || "").trim()).filter(Boolean)
    : [];

  const amountRaw = parsed.amount;
  const amount = typeof amountRaw === "number" && Number.isFinite(amountRaw) ? amountRaw : null;

  const out: ParseResult = {
    description: String(parsed.description || "").trim(),
    amount,
    paidBy: String(parsed.paidBy || "").trim(),
    participants,
  };

  return out;
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req.headers);
    const rl = checkRateLimit(`expense-parse:${ip}`, 30, 60 * 1000);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const body = (await req.json()) as { transcript?: string; members?: string[] };
    const transcript = String(body.transcript || "").trim();
    const members = Array.isArray(body.members) ? body.members.map((m) => String(m || "").trim()).filter(Boolean) : [];

    if (!transcript) return NextResponse.json({ error: "transcript is required" }, { status: 400 });

    const parsed = await parseExpenseWithOpenAI(transcript, members);
    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "expense parsing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
