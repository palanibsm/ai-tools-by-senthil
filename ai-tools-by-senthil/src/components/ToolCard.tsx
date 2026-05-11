import Link from "next/link";
import type { ToolItem } from "@/lib/tools";

export default function ToolCard({ tool }: { tool: ToolItem }) {
  const isLive = tool.status === "live";

  return (
    <div className="group rounded-2xl border border-white/70 bg-white/90 p-5 shadow-md transition hover:-translate-y-1 hover:shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{tool.name}</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            isLive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {isLive ? "Live" : "Coming Soon"}
        </span>
      </div>
      <p className="mb-5 text-sm text-slate-600">{tool.description}</p>
      {isLive ? (
        <Link
          href={tool.slug}
          className="inline-flex rounded-lg bg-gradient-to-r from-slate-900 to-indigo-700 px-3 py-2 text-sm font-medium text-white transition hover:opacity-95"
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
