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

function toAbsoluteUrl(path: string) {
  return `${SCREENER_BASE}${path}`;
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
  const normalizedPath = pathOrUrl.startsWith("http")
    ? new URL(pathOrUrl).pathname
    : pathOrUrl;

  if (!normalizedPath.startsWith("/market/")) {
    throw new Error("Invalid sector path. It must start with /market/");
  }

  const url = toAbsoluteUrl(normalizedPath);
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; ai-tools-by-senthil/1.0)",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to load sector page: ${res.status}`);
  }

  const html = await res.text();
  const $ = load(html);

  const sectorName = $("h1").first().text().trim() || normalizedPath;
  const table = $("table.data-table").first();

  if (!table.length) {
    throw new Error("No data table found on Screener sector page.");
  }

  const columns = table
    .find("tr")
    .first()
    .find("th")
    .map((_, th) => $(th).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);

  const rows: ScreenerCompany[] = [];

  table.find("tbody tr").slice(1).each((_, tr) => {
    const cells = $(tr).find("td");
    if (!cells.length) return;

    const firstNameLink = $(cells[1]).find("a").first();
    const name = firstNameLink.text().replace(/\s+/g, " ").trim();
    const companyPath = firstNameLink.attr("href") || "";

    if (!name) return;

    const metrics: Record<string, string> = {};
    cells.each((cellIndex, td) => {
      const key = columns[cellIndex] || `col_${cellIndex}`;
      const val = $(td).text().replace(/\s+/g, " ").trim();
      metrics[key] = val;
    });

    rows.push({
      name,
      companyPath,
      metrics,
    });
  });

  return {
    sectorName,
    sourceUrl: url,
    columns,
    rows,
  };
}
