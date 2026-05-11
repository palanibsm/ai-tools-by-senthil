import ToolCard from "@/components/ToolCard";
import { tools } from "@/lib/tools";

export default function HomePage() {
  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-white/70 bg-white/80 p-8 shadow-xl backdrop-blur">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-indigo-600">AI Utility Suite</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">AI Tools by Senthil</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          One modern workspace for translation, team expense tracking, screener insights, and more mini tools.
          Fast, practical, and built for daily use.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </section>
  );
}
