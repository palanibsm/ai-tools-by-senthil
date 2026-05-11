"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Language = { code: string; name: string; speechLocale: string };

type AuthState = { authenticated: boolean; username?: string; role?: "admin" | "user" };

const LANGUAGES: Language[] = [
  { code: "en", name: "English", speechLocale: "en-US" },
  { code: "ta", name: "Tamil", speechLocale: "ta-IN" },
  { code: "te", name: "Telugu", speechLocale: "te-IN" },
  { code: "hi", name: "Hindi", speechLocale: "hi-IN" },
  { code: "ml", name: "Malayalam", speechLocale: "ml-IN" },
  { code: "kn", name: "Kannada", speechLocale: "kn-IN" },
  { code: "mr", name: "Marathi", speechLocale: "mr-IN" },
  { code: "bn", name: "Bengali", speechLocale: "bn-IN" },
  { code: "gu", name: "Gujarati", speechLocale: "gu-IN" },
  { code: "pa", name: "Punjabi", speechLocale: "pa-IN" },
  { code: "ur", name: "Urdu", speechLocale: "ur-IN" },
  { code: "ar", name: "Arabic", speechLocale: "ar-SA" },
  { code: "fr", name: "French", speechLocale: "fr-FR" },
  { code: "de", name: "German", speechLocale: "de-DE" },
  { code: "es", name: "Spanish", speechLocale: "es-ES" },
  { code: "it", name: "Italian", speechLocale: "it-IT" },
  { code: "pt", name: "Portuguese", speechLocale: "pt-PT" },
  { code: "ru", name: "Russian", speechLocale: "ru-RU" },
  { code: "ja", name: "Japanese", speechLocale: "ja-JP" },
  { code: "ko", name: "Korean", speechLocale: "ko-KR" },
];

const SOURCE_KEY = "translator.source";
const TARGET_KEY = "translator.target";
const MAX_WORDS = 1000;

const countWords = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
};

const clampToWordLimit = (text: string) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= MAX_WORDS) return text;
  return words.slice(0, MAX_WORDS).join(" ");
};

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

export default function LanguageTranslatorPage() {
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("ta");
  const [provider, setProvider] = useState<"free" | "openai">("free");
  const [inputText, setInputText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [limitHit, setLimitHit] = useState(false);

  const [auth, setAuth] = useState<AuthState>({ authenticated: false });

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const speechRetryCountRef = useRef(0);
  const speechRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speechSupported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  async function refreshAuth() {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await res.json();
    setAuth(data);
    if (!data.authenticated && provider === "openai") setProvider("free");
  }

  useEffect(() => {
    const savedSource = localStorage.getItem(SOURCE_KEY);
    const savedTarget = localStorage.getItem(TARGET_KEY);
    if (savedSource && LANGUAGES.some((l) => l.code === savedSource)) setSourceLang(savedSource);
    if (savedTarget && LANGUAGES.some((l) => l.code === savedTarget)) setTargetLang(savedTarget);
    refreshAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => localStorage.setItem(SOURCE_KEY, sourceLang), [sourceLang]);
  useEffect(() => localStorage.setItem(TARGET_KEY, targetLang), [targetLang]);

  useEffect(() => {
    return () => {
      if (speechRetryTimerRef.current) clearTimeout(speechRetryTimerRef.current);
    };
  }, []);

  const sourceLocale = useMemo(() => LANGUAGES.find((l) => l.code === sourceLang)?.speechLocale || "en-US", [sourceLang]);

  const logSpeechEvent = async (payload: Record<string, unknown>) => {
    try {
      await fetch("/api/speech-log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Ignore telemetry failures
    }
  };

  useEffect(() => {
    if (!inputText.trim()) {
      setTranslatedText("");
      setIsTranslating(false);
      setErrorMsg("");
      return;
    }

    if (sourceLang === targetLang) {
      setTranslatedText(inputText);
      setIsTranslating(false);
      setErrorMsg("");
      return;
    }

    if (provider === "openai" && !auth.authenticated) {
      setErrorMsg("Login required for OpenAI provider");
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const reqId = ++requestIdRef.current;
      setIsTranslating(true);
      setErrorMsg("");
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: inputText, source: sourceLang, target: targetLang, provider }),
        });
        const data = await res.json();
        if (reqId !== requestIdRef.current) return;
        if (!res.ok) {
          setErrorMsg(data.error || "Translation failed");
          return;
        }
        setTranslatedText(data.translatedText || "");
      } catch {
        if (reqId !== requestIdRef.current) return;
        setErrorMsg("Network issue while translating");
      } finally {
        if (reqId === requestIdRef.current) setIsTranslating(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputText, sourceLang, targetLang, provider, auth.authenticated]);

  const updateInputWithLimit = (nextText: string) => {
    const nextCount = countWords(nextText);
    if (nextCount > MAX_WORDS) {
      setInputText(clampToWordLimit(nextText));
      setLimitHit(true);
      return;
    }
    setInputText(nextText);
    setLimitHit(false);
  };

  const toggleSpeech = () => {
    setErrorMsg("");
    if (!speechSupported) return setErrorMsg("Speech input not supported in this browser.");
    if (isListening) {
      if (speechRetryTimerRef.current) clearTimeout(speechRetryTimerRef.current);
      speechRetryCountRef.current = 0;
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechCtor) return;

    const recognition = new SpeechCtor();
    recognition.lang = sourceLocale;
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalTranscript = inputText;

    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript = `${finalTranscript} ${transcript}`.trim();
        else interimTranscript += transcript;
      }
      const combined = `${finalTranscript} ${interimTranscript}`.trim();
      updateInputWithLimit(combined);
      if (countWords(combined) >= MAX_WORDS) {
        recognition.stop();
        setIsListening(false);
      }
    };

    recognition.onerror = (event) => {
      const errorCode = event?.error || "unknown";
      const msg = event?.message || "";
      logSpeechEvent({ event: "speech_error", error: errorCode, message: msg, lang: sourceLocale });

      if (errorCode === "network" && speechRetryCountRef.current < 2) {
        speechRetryCountRef.current += 1;
        const retryInMs = speechRetryCountRef.current * 800;
        setErrorMsg(`Speech network issue. Retrying (${speechRetryCountRef.current}/2)...`);
        if (speechRetryTimerRef.current) clearTimeout(speechRetryTimerRef.current);
        speechRetryTimerRef.current = setTimeout(() => {
          try {
            recognition.start();
          } catch {
            setErrorMsg("Speech service temporarily unavailable. Please tap Start Mic again.");
            setIsListening(false);
          }
        }, retryInMs);
        return;
      }

      setErrorMsg(errorCode === "network" ? "Speech service temporarily unavailable. Please retry." : (msg || `Speech error: ${errorCode}`));
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      logSpeechEvent({ event: "speech_end", lang: sourceLocale });
    };

    recognition.start();
    logSpeechEvent({ event: "speech_start", lang: sourceLocale });
    recognitionRef.current = recognition;
    speechRetryCountRef.current = 0;
    setIsListening(true);
  };

  const wordCount = countWords(inputText);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Source → Destination Translator</h1>
      <p className="text-slate-600">Free translator is public. OpenAI translator requires approved login.</p>

      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700 p-4 text-white shadow-lg">
        <h2 className="font-semibold">OpenAI Access</h2>
        <p className="mt-1 text-sm text-slate-200">
          {auth.authenticated
            ? `Logged in as ${auth.username} (${auth.role}). You can use OpenAI provider.`
            : "Login from the top-right menu to enable OpenAI provider."}
        </p>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <label className="text-sm font-medium">Source language
            <select className="mt-1 w-full rounded-lg border px-3 py-2" value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
              {LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
            </select>
          </label>
          <button onClick={() => { setSourceLang(targetLang); setTargetLang(sourceLang); }} className="h-10 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50" type="button">Swap</button>
          <label className="text-sm font-medium">Destination language
            <select className="mt-1 w-full rounded-lg border px-3 py-2" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
              {LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
            </select>
          </label>
        </div>

        <label className="text-sm font-medium">Provider
          <select
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={provider}
            onChange={(e) => {
              const p = e.target.value as "free" | "openai";
              if (p === "openai" && !auth.authenticated) {
                setErrorMsg("Login required for OpenAI provider");
                return;
              }
              setProvider(p);
            }}
          >
            <option value="free">Free</option>
            <option value="openai">OpenAI (login required)</option>
          </select>
        </label>

        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">Input ({wordCount}/{MAX_WORDS} words)</p>
          <button onClick={toggleSpeech} type="button" className={`rounded-lg px-3 py-2 text-sm text-white ${isListening ? "bg-red-600 hover:bg-red-500" : "bg-slate-900 hover:bg-slate-700"}`}>
            {isListening ? "Stop Mic" : "Start Mic"}
          </button>
        </div>

        <textarea className="min-h-36 w-full rounded-lg border px-3 py-2" placeholder="Type or speak..." value={inputText} onChange={(e) => updateInputWithLimit(e.target.value)} />

        {limitHit && <p className="text-sm text-amber-700">1000-word limit reached.</p>}
        {errorMsg && <p className="text-sm text-red-700">{errorMsg}</p>}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Translated output</h2>
          {isTranslating && <span className="text-sm text-slate-500">Translating...</span>}
        </div>
        <textarea className="min-h-36 w-full rounded-lg border bg-slate-50 px-3 py-2" value={translatedText} readOnly />
      </div>
    </section>
  );
}
