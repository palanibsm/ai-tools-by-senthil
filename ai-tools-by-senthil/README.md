# AI Tools by Senthil

A single Next.js app hosting multiple mini tools under one domain.

## Routes
- `/` - Home page with all tools
- `/expensesplitter` - Expense Splitter (members, expense log, equal/custom shares, settlement)
- `/eng-2-tamil` - Language Translator (source → destination, typing + speech, real-time)

## Tech Stack
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS

## Run locally
```bash
cd ai-tools-by-senthil
npm install
npm run dev
```

## Run tests
```bash
npm test
```

Open: `http://localhost:3000`

## Deploy to Vercel
### One-time setup
```bash
cd ai-tools-by-senthil
npm install
npm run vercel:pull
```

### Production deploy
```bash
npm run vercel:build
npm run vercel:deploy
```

Or direct:
```bash
vercel --prod --yes
```

Project name should be: `ai-tools-by-senthil`

Expected URLs:
- `https://ai-tools-by-senthil.vercel.app/`
- `https://ai-tools-by-senthil.vercel.app/expensesplitter`
- `https://ai-tools-by-senthil.vercel.app/eng-2-tamil`
