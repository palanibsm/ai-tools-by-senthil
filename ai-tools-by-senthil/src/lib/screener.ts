import { load } from "cheerio";

const SCREENER_BASE = "https://www.screener.in";
const USER_AGENT = "Mozilla/5.0 (compatible; ai-tools-by-senthil/1.0)";

const PREFERRED_COLUMN_LABELS = [
  "Price to Earning",
  "Price to book value",
  "Market Capitalization",
  "EPS",
  "Debt to equity",
  "OPM",
  "Profit growth 3Years",
];

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

type AuthSession = {
  cookieHeader: string;
  csrfToken?: string;
  updatedAt: number;
};

let cachedAuth: AuthSession | null = null;

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

function getSetCookieValues(res: Response): string[] {
  const headersObj = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headersObj.getSetCookie === "function") {
    return headersObj.getSetCookie();
  }
  const raw = res.headers.get("set-cookie");
  if (!raw) return [];
  return raw.split(/,(?=\s*[^;]+=[^;]+)/g);
}

function cookieHeaderToMap(cookieHeader: string) {
  const map = new Map<string, string>();
  cookieHeader
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((part) => {
      const eq = part.indexOf("=");
      if (eq <= 0) return;
      map.set(part.slice(0, eq), part.slice(eq + 1));
    });
  return map;
}

function mergeCookies(existing: string, setCookies: string[]) {
  const map = cookieHeaderToMap(existing);
  for (const setCookie of setCookies) {
    const firstPair = setCookie.split(";")[0]?.trim();
    if (!firstPair) continue;
    const eq = firstPair.indexOf("=");
    if (eq <= 0) continue;
    map.set(firstPair.slice(0, eq), firstPair.slice(eq + 1));
  }
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function extractCsrfFromHtml(html: string) {
  const $ = load(html);
  return (
    $("input[name='csrfmiddlewaretoken']").first().attr("value") ||
    $("meta[name='csrf-token']").attr("content") ||
    ""
  ).trim();
}

function normalizeLoose(input: string) {
  return input.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

async function applyPreferredColumns(nextPath: string, cookieHeader: string) {
  const setupUrl = `${SCREENER_BASE}/user/columns/?next=${encodeURIComponent(nextPath)}`;

  const setupRes = await fetch(setupUrl, {
    headers: {
      "user-agent": USER_AGENT,
      cookie: cookieHeader,
      referer: `${SCREENER_BASE}${nextPath}`,
    },
    cache: "no-store",
  });

  if (!setupRes.ok) {
    throw new Error(`Failed to open Screener column settings: ${setupRes.status}`);
  }

  const setupHtml = await setupRes.text();
  if (isLoginHtml(setupHtml)) {
    throw new Error("Screener session is not authenticated while opening column settings.");
  }

  const $ = load(setupHtml);
  const csrf = extractCsrfFromHtml(setupHtml);
  if (!csrf) {
    throw new Error("Missing CSRF token in Screener column settings.");
  }

  const desired = new Set(PREFERRED_COLUMN_LABELS.map((x) => normalizeLoose(x)));
  const selectedValues: string[] = [];

  $("input[type='checkbox']").each((_, el) => {
    const input = $(el);
    const value = (input.attr("value") || "").trim();
    if (!value) return;

    const label =
      (input.closest("label").text() || input.parent().text() || input.next("label").text() || "")
        .replace(/\s+/g, " ")
        .trim();

    if (!label) return;
    const norm = normalizeLoose(label);
    if (desired.has(norm)) {
      selectedValues.push(value);
    }
  });

  if (!selectedValues.length) {
    // If UI markup changes, do not block data fetch; fallback to default columns.
    return cookieHeader;
  }

  const form = new URLSearchParams();
  form.set("csrfmiddlewaretoken", csrf);

  // Include hidden fields to preserve server expectations.
  $("input[type='hidden']").each((_, el) => {
    const name = ($(el).attr("name") || "").trim();
    const value = ($(el).attr("value") || "").trim();
    if (!name || name === "csrfmiddlewaretoken") return;
    form.append(name, value);
  });

  for (const v of selectedValues) {
    form.append("columns", v);
  }

  const postRes = await fetch(setupUrl, {
    method: "POST",
    headers: {
      "user-agent": USER_AGENT,
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader,
      referer: setupUrl,
    },
    body: form.toString(),
    redirect: "manual",
    cache: "no-store",
  });

  const merged = mergeCookies(cookieHeader, getSetCookieValues(postRes));
  return merged || cookieHeader;
}

function hasCreds() {
  return Boolean(process.env.SCREENER_EMAIL && process.env.SCREENER_PASSWORD);
}

function isLoginHtml(html: string) {
  const norm = html.toLowerCase();
  return norm.includes("name=\"password\"") && norm.includes("/login/");
}

async function getAuthenticatedSession(forceRefresh = false): Promise<AuthSession | null> {
  if (!hasCreds()) return null;

  const tenMinutes = 10 * 60 * 1000;
  if (!forceRefresh && cachedAuth && Date.now() - cachedAuth.updatedAt < tenMinutes) {
    return cachedAuth;
  }

  const loginPageRes = await fetch(`${SCREENER_BASE}/login/`, {
    headers: { "user-agent": USER_AGENT },
    cache: "no-store",
  });

  if (!loginPageRes.ok) {
    throw new Error(`Failed to load Screener login page: ${loginPageRes.status}`);
  }

  const loginPageHtml = await loginPageRes.text();
  const csrfToken = extractCsrfFromHtml(loginPageHtml);
  const initialCookies = mergeCookies("", getSetCookieValues(loginPageRes));

  if (!csrfToken) {
    throw new Error("Failed to obtain Screener CSRF token.");
  }

  const form = new URLSearchParams();
  form.set("username", process.env.SCREENER_EMAIL || "");
  form.set("password", process.env.SCREENER_PASSWORD || "");
  form.set("csrfmiddlewaretoken", csrfToken);

  const loginRes = await fetch(`${SCREENER_BASE}/login/`, {
    method: "POST",
    headers: {
      "user-agent": USER_AGENT,
      "content-type": "application/x-www-form-urlencoded",
      referer: `${SCREENER_BASE}/login/`,
      cookie: initialCookies,
    },
    body: form.toString(),
    redirect: "manual",
    cache: "no-store",
  });

  const cookieHeader = mergeCookies(initialCookies, getSetCookieValues(loginRes));

  // Successful login generally redirects (302) and sets authenticated session cookie.
  if (![301, 302, 303].includes(loginRes.status) && loginRes.status !== 200) {
    throw new Error(`Screener login failed with status ${loginRes.status}`);
  }

  const auth: AuthSession = {
    cookieHeader,
    csrfToken,
    updatedAt: Date.now(),
  };
  cachedAuth = auth;
  return auth;
}

async function fetchWithOptionalAuth(url: string) {
  const session = await getAuthenticatedSession();
  const baseHeaders: Record<string, string> = {
    "user-agent": USER_AGENT,
  };

  const runFetch = async (cookieHeader?: string) => {
    const headers = { ...baseHeaders };
    if (cookieHeader) headers.cookie = cookieHeader;
    return fetch(url, { headers, cache: "no-store" });
  };

  let res = await runFetch(session?.cookieHeader);
  let html = await res.text();

  // Cookie expired: refresh once and retry
  if (session && isLoginHtml(html)) {
    const refreshed = await getAuthenticatedSession(true);
    res = await runFetch(refreshed?.cookieHeader);
    html = await res.text();
  }

  if (!res.ok) {
    throw new Error(`Failed to load Screener page: ${res.status}`);
  }

  return { html };
}

export async function fetchScreenerSectors(): Promise<ScreenerSector[]> {
  const { html } = await fetchWithOptionalAuth(`${SCREENER_BASE}/explore/`);
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

  // If credentials exist, align Screener column preferences for this sector before extraction.
  // This mirrors: Browse Sector -> Edit Columns -> keep selected -> Save Columns.
  const authSession = await getAuthenticatedSession();
  if (authSession?.cookieHeader) {
    try {
      const updatedCookie = await applyPreferredColumns(normalizedPath, authSession.cookieHeader);
      cachedAuth = {
        ...authSession,
        cookieHeader: updatedCookie,
        updatedAt: Date.now(),
      };
    } catch {
      // Non-fatal: continue with whatever columns are available.
    }
  }

  const fetchPage = async (page: number) => {
    const url = page <= 1 ? baseUrl : `${baseUrl}?page=${page}`;
    const { html } = await fetchWithOptionalAuth(url);
    return { html };
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
