"use client";

import { useEffect, useMemo, useState } from "react";

type Sector = { name: string; path: string; url: string };
type SectorData = {
  sectorName: string;
  sourceUrl: string;
  columns: string[];
  rows: Array<{ name: string; companyPath: string; metrics: Record<string, string> }>;
};

const numberFromValue = (value: string) => {
  const normalized = value.replace(/,/g, "").replace(/%/g, "").trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

export default function ScreenerAnalysisPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [data, setData] = useState<SectorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [minMarketCap, setMinMarketCap] = useState("");
  const [maxPE, setMaxPE] = useState("");

  useEffect(() => {
    (async () => {
      setError("");
      const res = await fetch("/api/screener/sectors", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || "Failed to load sectors");
        return;
      }
      setSectors(payload.sectors || []);
      if ((payload.sectors || []).length > 0) {
        setSelectedPath(payload.sectors[0].path);
      }
    })();
  }, []);

  const loadSector = async () => {
    if (!selectedPath) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/screener/sector-data?path=${encodeURIComponent(selectedPath)}`, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || "Failed to load sector data");
        return;
      }
      setData(payload);
    } catch {
      setError("Network error while loading sector data");
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const searchLower = search.trim().toLowerCase();
    const minMc = minMarketCap ? Number(minMarketCap) : null;
    const maxPe = maxPE ? Number(maxPE) : null;

    return data.rows.filter((row) => {
      if (searchLower && !row.name.toLowerCase().includes(searchLower)) return false;

      if (minMc !== null) {
        const mc = numberFromValue(row.metrics["Mar Cap"] || "");
        if (mc === null || mc < minMc) return false;
      }

      if (maxPe !== null) {
        const pe = numberFromValue(row.metrics["P/E"] || "");
        if (pe === null || pe > maxPe) return false;
      }

      return true;
    });
  }, [data, search, minMarketCap, maxPE]);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Screener Analysis</h1>
      <p className="text-slate-600">Browse sector data from Screener and filter companies quickly.</p>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="font-semibold">Load Sector</h2>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <select
            className="rounded border px-3 py-2"
            value={selectedPath}
            onChange={(e) => setSelectedPath(e.target.value)}
          >
            <option value="">Select sector</option>
            {sectors.map((s) => (
              <option key={s.path} value={s.path}>
                {s.name}
              </option>
            ))}
          </select>
          <button className="rounded-lg border px-3 py-2 hover:bg-slate-50" onClick={loadSector} disabled={loading || !selectedPath}>
            {loading ? "Loading..." : "Load companies"}
          </button>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>

      {data && (
        <>
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold">Filters</h2>
            <p className="text-sm text-slate-600">
              Sector: <strong>{data.sectorName}</strong> · Source: <a className="underline" href={data.sourceUrl} target="_blank">Screener</a>
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                className="rounded border px-3 py-2"
                placeholder="Search company name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <input
                className="rounded border px-3 py-2"
                type="number"
                placeholder="Min Market Cap (Cr)"
                value={minMarketCap}
                onChange={(e) => setMinMarketCap(e.target.value)}
              />
              <input
                className="rounded border px-3 py-2"
                type="number"
                placeholder="Max P/E"
                value={maxPE}
                onChange={(e) => setMaxPE(e.target.value)}
              />
            </div>
            <p className="text-sm text-slate-600">Showing {filteredRows.length} of {data.rows.length} companies.</p>
          </div>

          <div className="rounded-xl border bg-white p-4 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  {data.columns.map((col) => (
                    <th key={col} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr key={`${row.name}-${idx}`} className="border-b last:border-0">
                    {data.columns.map((col) => {
                      const val = row.metrics[col] || "-";
                      if (col === "Name" && row.companyPath) {
                        return (
                          <td key={col} className="px-3 py-2 whitespace-nowrap">
                            <a className="text-blue-700 underline" href={`https://www.screener.in${row.companyPath}`} target="_blank">
                              {val}
                            </a>
                          </td>
                        );
                      }
                      return <td key={col} className="px-3 py-2 whitespace-nowrap">{val}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
