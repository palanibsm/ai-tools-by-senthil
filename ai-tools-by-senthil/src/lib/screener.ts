import { load } from "cheerio";

const SCREENER_BASE = "https://www.screener.in";

export type ScreenerSector = {
  name: string;
  path: string;
  url: string;
};

export type ScreenerCompany = {
  name: string;
  companyPath: string;
  metrics: Record<string, string>;
};

export type ScreenerSectorTable = {
  sectorName: string;
  sourceUrl: string;
  columns: string[];
  rows: ScreenerCompany[];
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
  "Price to Earning": ["P/E", "PE"],
  "Price to book value": ["CMP / BV", "CMP/BV", "P/BV", "P/B"],
  "Market Capitalization": ["Mar Cap Rs.Cr.", "Mar Cap", "Mar Cap Rs. Cr.", "Mkt Cap"],
  EPS: ["EPS 12M Rs.", "EPS TTM", "EPS"],
  "Debt to equity": ["Debt / Eq", "Debt/Eq", "Debt to Equity"],
  OPM: ["OPM %", "OPM"],
  "Profit growth 3Years": ["Profit Var 3Yrs", "Profit Var 3Yrs %", "Profit growth 3Years"],
};

function toAbsoluteUrl(path: string) {
  return `${SCREENER_BASE}${path}`;
}

function normalizeHeader(input: string) {
  return input.replace(/\s+/g, " ").replace(/[\.:]/g, "").trim().toLowerCase();
}

function findPageCount(html: string) {
  const m = html.match(/Showing page\s*(\d+)\s*of\s*(\d+)/i);
  if (!m) return 1;
  const total = Number(m[2]);
  return Number.isFinite(total) && total > 0 ? total : 1;
}

function parseSectorPageRows(html: string) {
  const $ = load(html);
  const table = $("table.data-table").first();

  if (!table.length) {
    throw new Error("No data table found on Screener sector page.");
  }

  const rawColumns = table
    .find("tr")
    .first()
    .find("th")
    .map((_, th) => $(th).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);

  const rawRows: ScreenerCompany[] = [];
  table.find("tbody tr").each((_, tr) => {
    const cells = $(tr).find("td");
    if (!cells.length) return;

    const firstNameLink = $(cells[1]).find("a").first();
    const name = firstNameLink.text().replace(/\s+/g, " ").trim();
    const companyPath = firstNameLink.attr("href") || "";
    if (!name) return;

    const metrics: Record<string, string> = {};
    cells.each((cellIndex, td) => {
      const key = rawColumns[cellIndex] || `col_${cellIndex}`;
      const val = $(td).text().replace(/\s+/g, " ").trim();
      metrics[key] = val;
      metrics[`col_${cellIndex}`] = val;
    });

    rawRows.push({ name, companyPath, metrics });
  });

  const sectorName = $("h1").first().text().trim();
  return { sectorName, rawColumns, rawRows };
}

function pickMetric(metrics: Record<string, string>, aliases: string[]) {
  const entries = Object.entries(metrics);
  for (const alias of aliases) {
    const target = normalizeHeader(alias);
    const found = entries.find(([k]) => normalizeHeader(k) === target);
    if (found) return found[1];
  }
  return "-";
}

function remapRowMetrics(row: ScreenerCompany): ScreenerCompany {
  const picked: Record<string, string> = {};
  for (const col of OUTPUT_COLUMNS) {
    picked[col] = pickMetric(row.metrics, COLUMN_ALIASES[col]);
  }
  return {
    name: row.name,
    companyPath: row.companyPath,
    metrics: picked,
  };
}

export async function fetchScreenerSectors(): Promise<ScreenerSector[]> {
  const res = await fetch(`${SCREENER_BASE}/explore/`, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; ai-tools-by-senthil/1.0)",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to load screener sectors: ${res.status}`);
  }

  const html = await res.text();
  const $ = load(html);
  const seen = new Set<string>();
  const sectors: ScreenerSector[] = [];

  $("a[href^='/market/']").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    const name = $(el).text().trim();
    if (!href || !name || seen.has(href)) return;
    seen.add(href);
    sectors.push({ name, path: href, url: toAbsoluteUrl(href) });
  });

  return sectors.sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchScreenerSectorTable(pathOrUrl: string): Promise<ScreenerSectorTable> {
  const normalizedPath = pathOrUrl.startsWith("http") ? new URL(pathOrUrl).pathname : pathOrUrl;

  if (!normalizedPath.startsWith("/market/")) {
    throw new Error("Invalid sector path. It must start with /market/");
  }

  const baseUrl = toAbsoluteUrl(normalizedPath);
  const fetchPage = async (page: number) => {
    const url = page <= 1 ? baseUrl : `${baseUrl}?page=${page}`;
    const res = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; ai-tools-by-senthil/1.0)",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Failed to load sector page: ${res.status}`);
    }

    return { url, html: await res.text() };
  };

  const first = await fetchPage(1);
  const pageCount = findPageCount(first.html);

  const allRows: ScreenerCompany[] = [];
  const seen = new Set<string>();

  const appendRows = (rows: ScreenerCompany[]) => {
    for (const row of rows) {
      const key = `${row.companyPath}::${row.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allRows.push(remapRowMetrics(row));
    }
  };

  const firstParsed = parseSectorPageRows(first.html);
  appendRows(firstParsed.rawRows);

  for (let page = 2; page <= pageCount; page++) {
    const next = await fetchPage(page);
    const parsed = parseSectorPageRows(next.html);
    appendRows(parsed.rawRows);
  }

  return {
    sectorName: firstParsed.sectorName || normalizedPath,
    sourceUrl: baseUrl,
    columns: [...OUTPUT_COLUMNS],
    rows: allRows,
  };
}
