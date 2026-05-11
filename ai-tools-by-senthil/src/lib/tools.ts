export type ToolItem = {
  name: string;
  slug: string;
  description: string;
  status: "live" | "coming-soon";
};

export const tools: ToolItem[] = [
  {
    name: "Expense Splitter",
    slug: "/expensesplitter",
    description: "Split group expenses and calculate who owes whom.",
    status: "live"
  },
  {
    name: "Language Translator",
    slug: "/language-translator",
    description: "Translate from source language to destination language in real-time.",
    status: "live"
  },
  { name: "Screener Analysis", slug: "/screener-analysis", description: "Browse and filter Screener sector companies.", status: "live" },
  { name: "Tool 4", slug: "/tool-4", description: "Coming soon.", status: "coming-soon" },
  { name: "Tool 5", slug: "/tool-5", description: "Coming soon.", status: "coming-soon" },
  { name: "Tool 6", slug: "/tool-6", description: "Coming soon.", status: "coming-soon" },
  { name: "Tool 7", slug: "/tool-7", description: "Coming soon.", status: "coming-soon" },
  { name: "Tool 8", slug: "/tool-8", description: "Coming soon.", status: "coming-soon" },
  { name: "Tool 9", slug: "/tool-9", description: "Coming soon.", status: "coming-soon" },
  { name: "Tool 10", slug: "/tool-10", description: "Coming soon.", status: "coming-soon" }
];
