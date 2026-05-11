"use client";

import { useMemo, useState } from "react";

type Person = { name: string; paid: number };

type Settlement = { from: string; to: string; amount: number };

function calculateSettlements(people: Person[]): Settlement[] {
  const total = people.reduce((sum, p) => sum + p.paid, 0);
  const avg = total / people.length;

  const debtors = people
    .map((p) => ({ name: p.name, balance: +(p.paid - avg).toFixed(2) }))
    .filter((p) => p.balance < 0)
    .map((p) => ({ ...p, balance: Math.abs(p.balance) }));

  const creditors = people
    .map((p) => ({ name: p.name, balance: +(p.paid - avg).toFixed(2) }))
    .filter((p) => p.balance > 0);

  const result: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].balance, creditors[j].balance);
    result.push({ from: debtors[i].name, to: creditors[j].name, amount: +amount.toFixed(2) });

    debtors[i].balance = +(debtors[i].balance - amount).toFixed(2);
    creditors[j].balance = +(creditors[j].balance - amount).toFixed(2);

    if (debtors[i].balance <= 0) i++;
    if (creditors[j].balance <= 0) j++;
  }

  return result;
}

export default function ExpenseSplitterPage() {
  const [people, setPeople] = useState<Person[]>([
    { name: "Senthil", paid: 0 },
    { name: "Friend 1", paid: 0 }
  ]);

  const settlements = useMemo(() => {
    if (people.length < 2 || people.some((p) => !p.name.trim())) return [];
    return calculateSettlements(people);
  }, [people]);

  const addPerson = () => {
    setPeople((prev) => [...prev, { name: `Friend ${prev.length}`, paid: 0 }]);
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Expense Splitter</h1>
      <p className="text-slate-600">Enter how much each person paid. We will compute who owes whom.</p>

      <div className="space-y-3 rounded-xl border bg-white p-4">
        {people.map((person, idx) => (
          <div className="grid gap-2 sm:grid-cols-2" key={idx}>
            <input
              className="rounded-lg border px-3 py-2"
              value={person.name}
              onChange={(e) => {
                const next = [...people];
                next[idx].name = e.target.value;
                setPeople(next);
              }}
              placeholder="Name"
            />
            <input
              className="rounded-lg border px-3 py-2"
              type="number"
              min={0}
              value={person.paid}
              onChange={(e) => {
                const next = [...people];
                next[idx].paid = Number(e.target.value || 0);
                setPeople(next);
              }}
              placeholder="Amount paid"
            />
          </div>
        ))}

        <button
          onClick={addPerson}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          + Add person
        </button>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 font-semibold">Settlement</h2>
        {settlements.length === 0 ? (
          <p className="text-sm text-slate-600">Add valid names and amounts to see results.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {settlements.map((s, i) => (
              <li key={i} className="rounded-lg bg-slate-50 px-3 py-2">
                <strong>{s.from}</strong> pays <strong>{s.to}</strong>: ₹{s.amount}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
