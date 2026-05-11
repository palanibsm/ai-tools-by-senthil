import ToolCard from "@/components/ToolCard";
import { tools } from "@/lib/tools";

export default function HomePage() {
  return (
    <section>
      <h1 className="text-3xl font-bold tracking-tight">AI Tools by Senthil</h1>
      <p className="mt-2 text-slate-600">
        One app, many mini tools. Choose a tool below to get started.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </section>
  );
}
