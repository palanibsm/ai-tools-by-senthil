import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appDir = path.join(root, "src", "app");
const toolsFile = path.join(root, "src", "lib", "tools.ts");

const titleCase = (s) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

function getLiveApps() {
  const text = fs.readFileSync(toolsFile, "utf8");
  const rx = /name:\s*"([^"]+)"[\s\S]*?slug:\s*"([^"]+)"[\s\S]*?status:\s*"live"/g;
  const apps = [];
  let m;
  while ((m = rx.exec(text)) !== null) {
    apps.push({ name: m[1], slug: m[2] });
  }
  return apps;
}

function getPageRoutes() {
  const entries = fs.readdirSync(appDir, { withFileTypes: true });
  const routes = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name === "api" || e.name.startsWith("(")) continue;
    const pagePath = path.join(appDir, e.name, "page.tsx");
    if (fs.existsSync(pagePath)) routes.push(`/${e.name}`);
  }
  routes.sort((a, b) => a.localeCompare(b));
  return routes;
}

function getApiRoutes() {
  const apiRoot = path.join(appDir, "api");
  const routes = [];

  function walk(dir, prefix = "") {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, `${prefix}/${e.name}`);
      if (e.isFile() && e.name === "route.ts") routes.push(`/api${prefix}`);
    }
  }

  if (fs.existsSync(apiRoot)) walk(apiRoot);
  routes.sort((a, b) => a.localeCompare(b));
  return routes;
}

function buildReadme() {
  const liveApps = getLiveApps();
  const pageRoutes = getPageRoutes();
  const apiRoutes = getApiRoutes();

  const publicPrimary = ["/", ...liveApps.map((a) => a.slug)];
  const additional = pageRoutes.filter((r) => !publicPrimary.includes(r));

  return `# AI Tools by Senthil

A multi-tool Next.js application that bundles practical AI/utility workflows into one product.

## Current app status
There are currently **${liveApps.length} built and listed apps** on the home page:
${liveApps.map((a) => `- **${a.name}** → \`${a.slug}\``).join("\n")}

## Route map (auto-generated)
### Public tool routes
${publicPrimary.map((r) => `- \`${r}\``).join("\n")}

### Additional routes available in codebase
${additional.length ? additional.map((r) => `- \`${r}\``).join("\n") : "- None"}

### API routes
${apiRoutes.map((r) => `- \`${r}\``).join("\n")}

## High-level architecture
- Frontend: Next.js App Router + React + Tailwind CSS
- APIs: Route handlers under \`src/app/api/*\`
- Authentication: Cookie/session endpoints under \`/api/auth/*\`

## Folder map
- \`src/app/*\`: Route pages
- \`src/app/api/*\`: Server endpoints
- \`src/components/*\`: Shared UI components
- \`src/lib/*\`: Business logic + tool metadata
- \`src/styles/*\`: Global styling

## Run locally
1. Install deps: \`npm install\`
2. Start dev server: \`npm run dev\`
3. Open: \`http://localhost:3000\`

## Keep docs updated
- Run \`npm run docs:routes\` after adding/removing pages or API routes.

## Environment notes
- Set \`OPENAI_API_KEY\` for OpenAI-backed features.
`;
}

const nextReadme = buildReadme();
fs.writeFileSync(path.join(root, "README.md"), nextReadme);
fs.writeFileSync(path.join(root, "readmd.me"), nextReadme);

console.log("Updated README.md and readmd.me from current routes.");
