"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type AuthState = { authenticated: boolean; username?: string; role?: "admin" | "user" };

export default function Navbar() {
  const [auth, setAuth] = useState<AuthState>({ authenticated: false });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");

  const panelRef = useRef<HTMLDivElement | null>(null);

  async function refreshAuth() {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await res.json();
    setAuth(data);
  }

  useEffect(() => {
    refreshAuth();
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (panelRef.current && !panelRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function onRegister() {
    setMsg("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    setMsg(data.message || data.error || (res.ok ? "Registered" : "Failed"));
  }

  async function onLogin() {
    setMsg("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Login failed");
      return;
    }
    setMsg("Logged in");
    setPassword("");
    await refreshAuth();
    setOpen(false);
  }

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMsg("Logged out");
    await refreshAuth();
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/40 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          AI Tools by Senthil
        </Link>

        <div className="flex items-center gap-3">
          <Link className="rounded-full px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900" href="/">
            Home
          </Link>

          <div className="relative" ref={panelRef}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              {auth.authenticated ? `${auth.username} (${auth.role})` : "Login"}
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                {auth.authenticated ? (
                  <div className="space-y-3 text-sm">
                    <p className="text-slate-600">Logged in as <strong>{auth.username}</strong> ({auth.role})</p>
                    <div className="flex gap-2">
                      {auth.role === "admin" && (
                        <Link
                          href="/admin-console"
                          onClick={() => setOpen(false)}
                          className="rounded-lg border px-3 py-2 hover:bg-slate-50"
                        >
                          Admin console
                        </Link>
                      )}
                      <button className="rounded-lg border px-3 py-2 hover:bg-slate-50" onClick={onLogout}>Logout</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <p className="font-medium text-slate-700">OpenAI access login</p>
                    <input
                      className="w-full rounded-lg border px-3 py-2"
                      placeholder="User ID"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                    <input
                      className="w-full rounded-lg border px-3 py-2"
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button className="rounded-lg border px-3 py-2 hover:bg-slate-50" onClick={onRegister}>Register</button>
                      <button className="rounded-lg bg-slate-900 px-3 py-2 text-white hover:bg-slate-700" onClick={onLogin}>Login</button>
                    </div>
                  </div>
                )}
                {msg && <p className="mt-3 text-xs text-slate-600">{msg}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
