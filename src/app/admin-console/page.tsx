"use client";

import { useEffect, useState } from "react";

type User = { username: string; status: string; role: string; createdAt: number };

export default function AdminConsolePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Unauthorized");
      return;
    }
    setUsers(data.users || []);
  }

  async function remove(username: string) {
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Failed");
      return;
    }
    setMsg(`Removed: ${username}`);
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Admin Console</h1>
      <p className="text-slate-600">Manage users (remove/disable by deletion in quick mode).</p>
      {msg && <p className="text-sm">{msg}</p>}
      <div className="rounded-xl border bg-white p-4">
        <ul className="space-y-2 text-sm">
          {users.map((u) => (
            <li key={u.username} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
              <span>
                <strong>{u.username}</strong> — {u.role} — {u.status}
              </span>
              <button className="text-red-600 hover:underline" onClick={() => remove(u.username)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
