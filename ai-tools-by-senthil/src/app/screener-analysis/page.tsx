"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

type TableRow = Record<string, string>;

const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export default function ScreenerAnalysisPage() {
  const [rows, setRows] = useState<TableRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const handleUpload = async (file: File) => {
    setError("");
    setRows([]);
    setColumns([]);
    setFilters({});
    setFileName(file.name);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });

      const firstSheetName = wb.SheetNames[0];
      if (!firstSheetName) {
        setError("No sheets found in this Excel file.");
        return;
      }

      setSheetName(firstSheetName);
      const ws = wb.Sheets[firstSheetName];

      // Read first tab exactly as-is (header row + values)
      const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(ws, {
        header: 1,
        defval: "",
        raw: false,
      });

      if (!matrix.length) {
        setError("First sheet is empty.");
        return;
      }

      const headerRow = (matrix[0] ?? []).map((h) => String(h ?? "").trim());
      const hasAnyHeader = headerRow.some((h) => h.length > 0);

      if (!hasAnyHeader) {
        setError("Header row is empty in first sheet.");
        return;
      }

      const resolvedHeaders = headerRow.map((h, i) => (h ? h : `Column_${i + 1}`));
      setColumns(resolvedHeaders);

      const dataRows: TableRow[] = matrix
        .slice(1)
        .map((rawRow) => {
          const out: TableRow = {};
          resolvedHeaders.forEach((col, i) => {
            out[col] = String(rawRow?.[i] ?? "").trim();
          });
          return out;
        })
        .filter((r) => resolvedHeaders.some((c) => (r[c] ?? "") !== ""));

      setRows(dataRows);
      const initialFilters: Record<string, string> = {};
      resolvedHeaders.forEach((c) => {
        initialFilters[c] = "";
      });
      setFilters(initialFilters);
    } catch {
      setError("Failed to parse Excel. Please upload a valid .xlsx/.xls file.");
    }
  };

  const filteredRows = useMemo(() => {
    if (!rows.length) return [];

    return rows.filter((row) => {
      return columns.every((col) => {
        const filterValue = (filters[col] ?? "").trim();
        if (!filterValue) return true;
        const cellValue = String(row[col] ?? "");
        return normalize(cellValue).includes(normalize(filterValue));
      });
    });
  }, [rows, columns, filters]);

  const handleDownloadCsv = () => {
    if (!columns.length) return;

    const aoa: string[][] = [columns];
    for (const row of filteredRows) {
      aoa.push(columns.map((c) => row[c] ?? ""));
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FilteredData");
    const base = fileName.replace(/\.(xlsx|xls)$/i, "") || "screener-data";
    XLSX.writeFile(wb, `${base}-filtered.csv`, { bookType: "csv" });
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Screener Analysis (Excel Upload)</h1>
      <p className="text-slate-600">
        Upload an Excel file. We read only the <strong>1st tab</strong>, keep all columns as-is, allow per-column
        filtering, and let you download filtered CSV.
      </p>

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
        {fileName && (
          <p className="text-sm text-slate-600">
            Loaded: {fileName}
            {sheetName ? ` (Sheet: ${sheetName})` : ""}
          </p>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>

      {rows.length > 0 && (
        <>
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Filters (each column)</h2>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Download CSV (Filtered)
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Showing {filteredRows.length} of {rows.length} rows.
            </p>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {columns.map((col) => (
                <label key={col} className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">{col}</span>
                  <input
                    className="w-full rounded border px-3 py-2"
                    placeholder={`Filter ${col}`}
                    value={filters[col] ?? ""}
                    onChange={(e) => setFilters((prev) => ({ ...prev, [col]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  {columns.map((col) => (
                    <th key={col} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    {columns.map((col) => (
                      <td key={col} className="px-3 py-2 whitespace-nowrap">
                        {row[col] || ""}
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
