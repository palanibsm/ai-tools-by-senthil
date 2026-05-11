import type {
  DraftExpenseInput,
  Expense,
  Settlement,
  Shares,
  Summary,
  ValidationResult,
} from "@/lib/expense-splitter.types";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const uniqueNames = (names: string[]) => Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));

export function normalizeShares(participants: string[], shares: Shares): Shares {
  const people = uniqueNames(participants);
  const normalized: Shares = {};

  for (const person of people) {
    const raw = Number(shares[person] ?? 0);
    normalized[person] = Number.isFinite(raw) && raw >= 0 ? raw : 0;
  }

  return normalized;
}

function splitByShares(amount: number, participants: string[], shares?: Shares): Record<string, number> {
  const people = uniqueNames(participants);
  if (people.length === 0) {
    return {};
  }

  if (!shares) {
    const equalShare = round2(amount / people.length);
    return Object.fromEntries(people.map((p) => [p, equalShare]));
  }

  const normalized = normalizeShares(people, shares);
  const totalWeight = Object.values(normalized).reduce((sum, n) => sum + n, 0);

  if (totalWeight <= 0) {
    const equalShare = round2(amount / people.length);
    return Object.fromEntries(people.map((p) => [p, equalShare]));
  }

  const result: Record<string, number> = {};
  for (const person of people) {
    result[person] = round2((amount * normalized[person]) / totalWeight);
  }

  return result;
}

export function computeBalances(expenses: Expense[]): Record<string, number> {
  const balances: Record<string, number> = {};

  for (const exp of expenses) {
    const amount = Number(exp.amount);
    const paidBy = exp.paidBy;
    const participants = uniqueNames(exp.participants);

    if (!Number.isFinite(amount) || amount <= 0 || !paidBy || participants.length === 0) {
      continue;
    }

    const effectiveParticipants = participants.includes(paidBy) ? participants : [...participants, paidBy];

    balances[paidBy] = round2((balances[paidBy] ?? 0) + amount);

    const shares = exp.shareMode === "custom" ? splitByShares(amount, effectiveParticipants, exp.shares) : splitByShares(amount, effectiveParticipants);

    for (const person of effectiveParticipants) {
      balances[person] = round2((balances[person] ?? 0) - (shares[person] ?? 0));
    }
  }

  for (const person of Object.keys(balances)) {
    if (Math.abs(balances[person]) < 0.01) balances[person] = 0;
    balances[person] = round2(balances[person]);
  }

  return balances;
}

export function computeSettlements(balances: Record<string, number>): Settlement[] {
  const creditors: Array<[string, number]> = [];
  const debtors: Array<[string, number]> = [];

  for (const [person, bal] of Object.entries(balances)) {
    if (bal > 0) creditors.push([person, round2(bal)]);
    else if (bal < 0) debtors.push([person, round2(Math.abs(bal))]);
  }

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const [debtor, owes] = debtors[i];
    const [creditor, receives] = creditors[j];
    const amount = round2(Math.min(owes, receives));

    if (amount > 0) {
      settlements.push({ from: debtor, to: creditor, amount });
    }

    debtors[i][1] = round2(owes - amount);
    creditors[j][1] = round2(receives - amount);

    if (debtors[i][1] <= 0) i += 1;
    if (creditors[j][1] <= 0) j += 1;
  }

  return settlements;
}

export function buildSummary(expenses: Expense[]): Summary {
  const balances = computeBalances(expenses);
  return {
    totalExpenses: round2(expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)),
    balances,
    settlements: computeSettlements(balances),
  };
}

export function validateExpenseInput(payload: DraftExpenseInput): ValidationResult {
  const description = String(payload.description || "").trim();
  const paidBy = String(payload.paidBy || "").trim();
  const amount = Number(payload.amount);
  let participants = uniqueNames(payload.participants || []);

  if (!description || !paidBy || participants.length === 0) {
    return { ok: false, error: "description, paidBy, participants are required" };
  }

  if (!Number.isFinite(amount)) {
    return { ok: false, error: "amount must be a number" };
  }

  if (amount <= 0) {
    return { ok: false, error: "amount must be greater than zero" };
  }

  if (!participants.includes(paidBy)) {
    participants = [...participants, paidBy];
  }

  const shareMode = payload.shareMode === "custom" ? "custom" : "equal";
  let shares: Shares | undefined;

  if (shareMode === "custom") {
    shares = normalizeShares(participants, payload.shares || {});
    const sum = Object.values(shares).reduce((s, n) => s + n, 0);
    if (sum <= 0) {
      return { ok: false, error: "custom shares must have positive total" };
    }
  }

  return {
    ok: true,
    value: {
      description,
      amount: round2(amount),
      paidBy,
      participants,
      shareMode,
      shares,
    },
  };
}

export type { DraftExpenseInput, Expense, Shares, Summary, Settlement } from "@/lib/expense-splitter.types";
