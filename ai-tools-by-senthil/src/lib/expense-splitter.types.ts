export type ShareMode = "equal" | "custom";

export type Shares = Record<string, number>;

export type Expense = {
  description: string;
  amount: number;
  paidBy: string;
  participants: string[];
  shareMode?: ShareMode;
  shares?: Shares;
};

export type DraftExpenseInput = {
  description: string;
  amount: string;
  paidBy: string;
  participants: string[];
  shareMode?: ShareMode;
  shares?: Shares;
};

export type Settlement = {
  from: string;
  to: string;
  amount: number;
};

export type Summary = {
  totalExpenses: number;
  balances: Record<string, number>;
  settlements: Settlement[];
};

export type ValidationResult =
  | { ok: true; value: Expense }
  | { ok: false; error: string };
