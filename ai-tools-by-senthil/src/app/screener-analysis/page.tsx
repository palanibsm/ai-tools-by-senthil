"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

type UploadRow = {
  name: string;
  metrics: Record<string, string>;
};

const OUTPUT_COLUMNS = [
  "Price to Earning",
  "Price to book value",
  "Market Capitalization",
  "EPS",
  "Debt to equity",
  "OPM",
  "Profit growth 3Years",
] as const;

const COLUMN_ALIASES: Record<(typeof OUTPUT_COLUMNS)[number], string[]> = {
  "Price to Earning": ["P/E", "PE", "Price to Earning"],
  "Price to book value": ["CMP / BV", "CMP/BV", "Price to book value", "P/B"],
  "Market Capitalization": ["Mar Cap Rs.Cr.", "Mar Cap", "Market Capitalization", "Mkt Cap"],
  EPS: ["EPS 12M Rs.", "EPS", "EPS TTM"],
  "Debt to equity": ["Debt / Eq", "Debt/Eq", "Debt to equity"],
  OPM: ["OPM %", "OPM"],
  "Profit growth 3Years": ["Profit Var 3Yrs", "Profit Var 3Yrs %", "Profit growth 3Years"],
};

const normalize = (s: string) => s.replace(/\s+/g, " ").replace(/[\.:]/g, "").trim().toLowerCase();

const pickValue = (row: Record<string, unknown>, aliases: string[]) => {
  const entries = Object.entries(row);
  for (const a of aliases) {
    const target = normalize(a);
    const match = entries.find(([k]) => normalize(k) === target);
    if (match && match[1] !== undefined && match[1] !== null && String(match[1]).trim() !== "") {
      return String(match[1]).trim();
    }
  }
  return "-";
};

const numberFromValue = (value: string) => {
  const normalized = value.replace(/,/g, "").replace(/%/g, "").trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

export default function ScreenerAnalysisPage() {
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [minMarketCap, setMinMarketCap] = useState("");
  const [maxPE, setMaxPE] = useState("");

  const handleUpload = async (file: File) => {
    setError("");
    setRows([]);
    setFileName(file.name);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      if (!jsonRows.length) {
        setError("Excel file is empty.");
        return;
      }

      const parsed: UploadRow[] = jsonRows
        .map((r) => {
          const name = String(r["Name"] ?? r["name"] ?? "").trim();
          if (!name) return null;
          const metrics: Record<string, string> = {};
          for (const col of OUTPUT_COLUMNS) {
            metrics[col] = pickValue(r, COLUMN_ALIASES[col]);
          }
          return { name, metrics };
        })
        .filter((r): r is UploadRow => Boolean(r));

      setRows(parsed);
    } catch {
      setError("Failed to parse Excel. Please upload .xlsx exported from Screener.");
    }
  };

  const filteredRows = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    const minMc = minMarketCap ? Number(minMarketCap) : null;
    const maxPe = maxPE ? Number(maxPE) : null;

    return rows.filter((row) => {
      if (searchLower && !row.name.toLowerCase().includes(searchLower)) return false;

      if (minMc !== null) {
        const mc = numberFromValue(row.metrics["Market Capitalization"] || "");
        if (mc === null || mc < minMc) return false;
      }

      if (maxPe !== null) {
        const pe = numberFromValue(row.metrics["Price to Earning"] || "");
        if (pe === null || pe > maxPe) return false;
      }

      return true;
    });
  }, [rows, search, minMarketCap, maxPE]);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Screener Analysis (Excel Upload)</h1>
      <p className="text-slate-600">Upload Screener Excel export and analyze only the selected columns.</p>

      <div className="rounded-xl border bg-white p-4 space-y-2">
        <h2 className="font-semibold">How to export from Screener (manual steps)</h2>
        <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-1">
          <li>Login to Screener with your account.</li>
          <li>Go to <strong>Browse Sectors</strong> and open the target sector (example: Capital Markets).</li>
          <li>Click <strong>Edit Columns</strong>.</li>
          <li>Keep only these columns: Price to Earning, Price to book value, Market Capitalization, EPS, Debt to equity, OPM, Profit growth 3Years.</li>
          <li>Click <strong>Save Columns</strong>.</li>
          <li>Go back to the sector company table and ensure all pages are visible for that sector.</li>
          <li>Click <strong>Export</strong> and download the Excel file.</li>
          <li>Upload that Excel file below.</li>
        </ol>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="font-semibold">Upload Excel</h2>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
          className="block w-full rounded border px-3 py-2"
        />
        {fileName && <p className="text-sm text-slate-600">Loaded: {fileName}</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>

      {rows.length > 0 && (
        <>
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold">Filters</h2>
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
            <p className="text-sm text-slate-600">Showing {filteredRows.length} of {rows.length} companies.</p>
          </div>

          <div className="rounded-xl border bg-white p-4 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Name</th>
                  {OUTPUT_COLUMNS.map((col) => (
                    <th key={col} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr key={`${row.name}-${idx}`} className="border-b last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap">{row.name}</td>
                    {OUTPUT_COLUMNS.map((col) => (
                      <td key={col} className="px-3 py-2 whitespace-nowrap">
                        {row.metrics[col] || "-"}
                      </td>
                    ))}
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
