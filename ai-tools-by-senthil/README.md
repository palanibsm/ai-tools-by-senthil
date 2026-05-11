# AI Tools by Senthil

A multi-tool Next.js application that bundles practical AI/utility workflows into one product.

## Current app status
There are currently **3 built and listed apps** on the home page:
- **Expense Splitter** → `/expensesplitter`
- **Language Translator** → `/language-translator`
- **Screener Analysis** → `/screener-analysis`

## Route map (current)
### Public tool routes
- `/` (home)
- `/expensesplitter`
- `/language-translator`
- `/screener-analysis`

### Additional routes available in codebase
- `/eng-2-tamil`
- `/admin-console`
- `/tool-3` to `/tool-10` (placeholders)

### API routes
- `/api/translate`
- `/api/speech-log`
- `/api/expense-parse`
- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/admin/users`
- `/api/admin/decision`

## High-level architecture
- Frontend: Next.js App Router + React + Tailwind CSS
- APIs: Route handlers under `src/app/api/*`
- Authentication: Cookie/session endpoints under `/api/auth/*`

## Folder map
- `src/app/*`: Route pages
- `src/app/api/*`: Server endpoints
- `src/components/*`: Shared UI components
- `src/lib/*`: Business logic + tool metadata
- `src/styles/*`: Global styling

## Run locally
1. Install deps: `npm install`
2. Start dev server: `npm run dev`
3. Open: `http://localhost:3000`

## Environment notes
- Set `OPENAI_API_KEY` for OpenAI-backed features.
