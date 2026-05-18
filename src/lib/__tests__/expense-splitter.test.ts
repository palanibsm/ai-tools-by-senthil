import { describe, expect, test } from "vitest";
import {
  buildSummary,
  validateExpenseInput,
  normalizeShares,
  type DraftExpenseInput,
  type Expense,
} from "@/lib/expense-splitter";

describe("expense splitter parity with python MVP", () => {
  test("summary initially empty", () => {
    const summary = buildSummary([]);
    expect(summary.totalExpenses).toBe(0);
    expect(summary.balances).toEqual({});
    expect(summary.settlements).toEqual([]);
  });

  test("single expense balances", () => {
    const expenses: Expense[] = [
      {
        description: "Lunch",
        amount: 900,
        paidBy: "Alice",
        participants: ["Alice", "Bob", "Cara"],
      },
    ];

    const summary = buildSummary(expenses);
    expect(summary.balances.Alice).toBe(600);
    expect(summary.balances.Bob).toBe(-300);
    expect(summary.balances.Cara).toBe(-300);
  });

  test("multiple expenses settlement", () => {
    const expenses: Expense[] = [
      {
        description: "Lunch",
        amount: 900,
        paidBy: "Alice",
        participants: ["Alice", "Bob", "Cara"],
      },
      {
        description: "Taxi",
        amount: 300,
        paidBy: "Bob",
        participants: ["Alice", "Bob", "Cara"],
      },
    ];

    const summary = buildSummary(expenses);
    expect(summary.balances.Alice).toBe(500);
    expect(summary.balances.Bob).toBe(-100);
    expect(summary.balances.Cara).toBe(-400);

    const normalized = new Set(summary.settlements.map((s) => `${s.from}|${s.to}|${s.amount.toFixed(2)}`));
    expect(normalized.has("Bob|Alice|100.00")).toBe(true);
    expect(normalized.has("Cara|Alice|400.00")).toBe(true);
  });
});

describe("validation", () => {
  test("rejects invalid amount", () => {
    const payload: DraftExpenseInput = {
      description: "Bad",
      amount: "0",
      paidBy: "Alice",
      participants: ["Alice", "Bob"],
    };

    const validation = validateExpenseInput(payload);
    expect(validation.ok).toBe(false);
  });

  test("payer auto-included when missing from participants", () => {
    const payload: DraftExpenseInput = {
      description: "Snacks",
      amount: "200",
      paidBy: "Alice",
      participants: ["Bob", "Cara"],
    };

    const validation = validateExpenseInput(payload);
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.value.participants).toContain("Alice");
    }
  });
});

describe("optional enhancement: custom shares", () => {
  test("normalize shares to participant set and percentages", () => {
    const shares = normalizeShares(["A", "B", "C"], { A: 50, B: 30, C: 20 });
    expect(shares).toEqual({ A: 50, B: 30, C: 20 });
  });

  test("custom share settlement", () => {
    const expenses: Expense[] = [
      {
        description: "Trip hotel",
        amount: 1000,
        paidBy: "Alice",
        participants: ["Alice", "Bob"],
        shareMode: "custom",
        shares: { Alice: 70, Bob: 30 },
      },
    ];

    const summary = buildSummary(expenses);
    expect(summary.balances.Alice).toBe(300);
    expect(summary.balances.Bob).toBe(-300);
    expect(summary.settlements).toEqual([{ from: "Bob", to: "Alice", amount: 300 }]);
  });
});
