import Link from "next/link";
import type { ToolItem } from "@/lib/tools";

export default function ToolCard({ tool }: { tool: ToolItem }) {
  const isLive = tool.status === "live";

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{tool.name}</h3>
        <span
          className={`rounded-full px-2 py-1 text-xs ${
            isLive ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {isLive ? "Live" : "Coming Soon"}
        </span>
      </div>
      <p className="mb-4 text-sm text-slate-600">{tool.description}</p>
      {isLive ? (
        <Link
          href={tool.slug}
          className="inline-flex rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Open tool
        </Link>
      ) : (
        <button
          disabled
          className="inline-flex cursor-not-allowed rounded-lg bg-slate-200 px-3 py-2 text-sm font-medium text-slate-500"
        >
          Not available yet
        </button>
      )}
    </div>
  );
}
