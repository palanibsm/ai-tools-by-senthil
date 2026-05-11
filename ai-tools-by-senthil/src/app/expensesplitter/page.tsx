"use client";

import { useMemo, useRef, useState } from "react";
import { buildSummary, validateExpenseInput, type DraftExpenseInput, type Expense } from "@/lib/expense-splitter";

type SpeechRecognitionType = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionType;
    SpeechRecognition?: new () => SpeechRecognitionType;
  }
}

export default function ExpenseSplitterPage() {
  const [members, setMembers] = useState<string[]>(["Senthil", "Friend 1"]);
  const [newMember, setNewMember] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [message, setMessage] = useState<string>("");
  const [currency, setCurrency] = useState<"SGD" | "INR" | "USD" | "EUR">("SGD");
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [isParsingVoice, setIsParsingVoice] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);

  const [draft, setDraft] = useState<DraftExpenseInput>({
    description: "",
    amount: "",
    paidBy: "Senthil",
    participants: ["Senthil", "Friend 1"],
    shareMode: "equal",
    shares: { Senthil: 50, "Friend 1": 50 },
  });

  const summary = useMemo(() => buildSummary(expenses), [expenses]);

  const addMember = () => {
    const name = newMember.trim();
    if (!name || members.includes(name)) return;

    const nextMembers = [...members, name];
    setMembers(nextMembers);
    setDraft((prev) => ({
      ...prev,
      participants: [...new Set([...prev.participants, name])],
      shares: { ...(prev.shares || {}), [name]: 0 },
      paidBy: prev.paidBy || name,
    }));
    setNewMember("");
  };

  const removeMember = (name: string) => {
    const nextMembers = members.filter((m) => m !== name);
    setMembers(nextMembers);
    setDraft((prev) => {
      const nextShares = { ...(prev.shares || {}) };
      delete nextShares[name];

      return {
        ...prev,
        paidBy: prev.paidBy === name ? nextMembers[0] || "" : prev.paidBy,
        participants: prev.participants.filter((p) => p !== name),
        shares: nextShares,
      };
    });
  };

  const toggleParticipant = (name: string) => {
    setDraft((prev) => {
      const already = prev.participants.includes(name);
      const participants = already ? prev.participants.filter((p) => p !== name) : [...prev.participants, name];
      return { ...prev, participants };
    });
  };

  const normalizeMemberMatch = (name: string) => name.trim().toLowerCase();

  const applyParsedExpense = (parsed: {
    description?: string;
    amount?: number | null;
    paidBy?: string;
    participants?: string[];
  }) => {
    setDraft((prev) => {
      const next = { ...prev };

      if (parsed.description && parsed.description.trim()) {
        next.description = parsed.description.trim();
      }

      if (typeof parsed.amount === "number" && Number.isFinite(parsed.amount) && parsed.amount > 0) {
        next.amount = String(parsed.amount);
      }

      if (parsed.paidBy) {
        const foundPayer = members.find((m) => normalizeMemberMatch(m) === normalizeMemberMatch(parsed.paidBy || ""));
        if (foundPayer) next.paidBy = foundPayer;
      }

      if (Array.isArray(parsed.participants) && parsed.participants.length > 0) {
        const matched = parsed.participants
          .map((p) => members.find((m) => normalizeMemberMatch(m) === normalizeMemberMatch(p || "")))
          .filter((v): v is string => Boolean(v));

        if (matched.length > 0) {
          const withPayer = next.paidBy ? [...new Set([next.paidBy, ...matched])] : [...new Set(matched)];
          next.participants = withPayer;
        }
      }

      return next;
    });
  };

  const parseVoiceExpense = async (transcript: string) => {
    const text = transcript.trim();
    if (!text) return;

    setIsParsingVoice(true);
    setMessage("Parsing voice expense...");
    try {
      const res = await fetch("/api/expense-parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript: text, members }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Voice parse failed: ${data.error || "Unknown error"}`);
        return;
      }

      applyParsedExpense(data);
      setMessage("Voice parsed and fields updated");
    } catch {
      setMessage("Voice parse failed due to network issue");
    } finally {
      setIsParsingVoice(false);
    }
  };

  const toggleVoice = () => {
    const speechSupported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!speechSupported) {
      setMessage("Speech input is not supported in this browser");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechCtor) return;

    const recognition = new SpeechCtor();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;

    let finalTranscript = "";
    let latestTranscript = "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript = `${finalTranscript} ${t}`.trim();
        else interim += t;
      }
      latestTranscript = `${finalTranscript} ${interim}`.trim();
      setVoiceTranscript(latestTranscript);
    };

    recognition.onerror = (event) => {
      setMessage(`Speech error: ${event?.error || "unknown"}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      const text = finalTranscript || latestTranscript;
      if (text.trim()) parseVoiceExpense(text);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setVoiceTranscript("");
    setIsListening(true);
    setMessage("Listening... speak expense details");
  };

  const addExpense = () => {
    const result = validateExpenseInput(draft);
    if (!result.ok) {
      setMessage(`Error: ${result.error}`);
      return;
    }

    setExpenses((prev) => [...prev, result.value]);
    setMessage("Expense added");
    setDraft((prev) => ({
      ...prev,
      description: "",
      amount: "",
      participants: prev.paidBy ? [...new Set([prev.paidBy, ...prev.participants])] : prev.participants,
    }));
  };

  const resetAll = () => {
    setExpenses([]);
    setMessage("Reset done");
  };

  const toTwo = (n: number) => n.toFixed(2);
  const currencySymbol: Record<typeof currency, string> = {
    SGD: "S$",
    INR: "₹",
    USD: "$",
    EUR: "€",
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Team Expense Splitter</h1>
      <p className="text-slate-600">Add members and expenses, then see who should pay whom.</p>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="font-semibold">Members</h2>
        <div className="flex gap-2">
          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="e.g., Alice"
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
          />
          <button className="rounded-lg border px-3 py-2 hover:bg-slate-50" onClick={addMember}>
            Add member
          </button>
        </div>

        {members.length === 0 ? (
          <p className="text-sm text-slate-500">No members yet</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {members.map((m) => (
              <li key={m} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
                <span>{m}</span>
                <button className="text-red-600 hover:underline" onClick={() => removeMember(m)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Add Expense</h2>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm text-white ${isListening ? "bg-red-600 hover:bg-red-500" : "bg-slate-900 hover:bg-slate-700"}`}
            onClick={toggleVoice}
            disabled={isParsingVoice}
          >
            {isListening ? "Stop Mic" : isParsingVoice ? "Parsing..." : "Voice Fill"}
          </button>
        </div>

        {voiceTranscript && <p className="text-xs text-slate-500">Heard: {voiceTranscript}</p>}

        <div className="grid gap-2 sm:grid-cols-4">
          <input
            className="rounded-lg border px-3 py-2"
            placeholder="Description (Lunch)"
            value={draft.description}
            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
          />
          <input
            className="rounded-lg border px-3 py-2"
            type="number"
            step="0.01"
            placeholder={`Amount (${currency})`}
            value={draft.amount}
            onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.target.value }))}
          />
          <select
            className="rounded-lg border px-3 py-2"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as typeof currency)}
            aria-label="Currency"
          >
            <option value="SGD">SGD (S$)</option>
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </select>
          <select
            className="rounded-lg border px-3 py-2"
            value={draft.paidBy}
            onChange={(e) => setDraft((prev) => ({ ...prev, paidBy: e.target.value }))}
          >
            <option value="">Select payer</option>
            {members.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Participants</p>
          <div className="flex flex-wrap gap-3 text-sm">
            {members.map((m) => (
              <label key={m} className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={draft.participants.includes(m)}
                  onChange={() => toggleParticipant(m)}
                />
                {m}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">Share mode (optional enhancement)</p>
          <div className="flex gap-4 text-sm">
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                checked={(draft.shareMode || "equal") === "equal"}
                onChange={() => setDraft((prev) => ({ ...prev, shareMode: "equal" }))}
              />
              Equal split
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                checked={draft.shareMode === "custom"}
                onChange={() => setDraft((prev) => ({ ...prev, shareMode: "custom" }))}
              />
              Custom shares
            </label>
          </div>

          {draft.shareMode === "custom" && (
            <div className="grid gap-2 sm:grid-cols-3">
              {draft.participants.map((p) => (
                <label key={p} className="text-sm">
                  {p} %
                  <input
                    className="mt-1 w-full rounded border px-2 py-1"
                    type="number"
                    min={0}
                    value={draft.shares?.[p] ?? 0}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        shares: {
                          ...(prev.shares || {}),
                          [p]: Number(e.target.value || 0),
                        },
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        <button className="rounded-lg border px-3 py-2 hover:bg-slate-50" onClick={addExpense}>
          Add expense
        </button>
        {message && <p className="text-sm text-slate-600">{message}</p>}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 font-semibold">Expenses</h2>
        {expenses.length === 0 ? (
          <p className="text-sm text-slate-500">No expenses yet</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {expenses.map((e, i) => (
              <li key={`${e.description}-${i}`} className="rounded bg-slate-50 px-3 py-2">
                {e.description}: {currencySymbol[currency]}{toTwo(e.amount)} paid by <strong>{e.paidBy}</strong> for [{e.participants.join(", ")}]
                {e.shareMode === "custom" ? " (custom shares)" : ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="font-semibold">Summary</h2>
        <p>
          <strong>Total:</strong> {currencySymbol[currency]}{toTwo(summary.totalExpenses)}
        </p>

        <div>
          <h3 className="font-medium">Balances</h3>
          {Object.keys(summary.balances).length === 0 ? (
            <p className="text-sm text-slate-500">No balances yet</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {Object.entries(summary.balances).map(([name, amount]) => (
                <li key={name}>
                  {name}: {currencySymbol[currency]}{toTwo(amount)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="font-medium">Who pays whom</h3>
          {summary.settlements.length === 0 ? (
            <p className="text-sm text-slate-500">All settled ✅</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {summary.settlements.map((s, i) => (
                <li key={`${s.from}-${s.to}-${i}`}>
                  <strong>{s.from}</strong> pays <strong>{s.to}</strong>: {currencySymbol[currency]}{toTwo(s.amount)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <button className="rounded-lg border px-3 py-2 hover:bg-slate-50" onClick={resetAll}>
          Reset event
        </button>
      </div>
    </section>
  );
}
