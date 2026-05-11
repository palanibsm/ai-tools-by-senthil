"use client";

import { useState } from "react";

export default function EngToTamilPage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const translate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      // Starter placeholder logic.
      // Replace with real API call in next iteration.
      await new Promise((r) => setTimeout(r, 500));
      setOutput(`தமிழாக்கம் (demo): ${input}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">English → Tamil Converter</h1>
      <p className="text-slate-600">Starter page. Next step: wire this to a real translation API.</p>

      <div className="space-y-3 rounded-xl border bg-white p-4">
        <textarea
          className="min-h-32 w-full rounded-lg border px-3 py-2"
          placeholder="Type English text..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          onClick={translate}
          disabled={loading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "Converting..." : "Convert"}
        </button>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-2 font-semibold">Tamil Output</h2>
        <p className="text-slate-800">{output || "Output will appear here."}</p>
      </div>
    </section>
  );
}
