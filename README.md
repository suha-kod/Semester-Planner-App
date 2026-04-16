# Tracker — Semester HQ

Your intelligent university semester command centre, built with Next.js.

## Tech stack

- **Next.js 15** (App Router)
- **React 19**
- **Zustand** — global state management
- **IndexedDB** (via `idb`) — persistent local storage, no server needed
- **Tailwind CSS** — utility styling + custom CSS design tokens
- **Chart.js** — study hours and grade charts
- **TypeScript** — fully typed throughout

## Getting started locally

```bash
# 1. Install dependencies
npm install

# 2. Run dev server
npm run dev

# 3. Open http://localhost:3000
```

## Deploy to Vercel

### Option A — Vercel CLI (fastest)
```bash
npm install -g vercel
vercel
```

### Option B — GitHub + Vercel dashboard
1. Push this folder to a GitHub repo
2. Go to vercel.com → New Project → Import your repo
3. Vercel auto-detects Next.js — just click Deploy
4. Done. Your Tracker is live at a `*.vercel.app` URL

No environment variables needed for Phase 1 — everything runs in the browser.

## File structure

```
tracker/
├── app/                    # Next.js pages (App Router)
│   ├── layout.tsx          # Root layout, fonts, AppShell
│   ├── globals.css         # Design tokens, base styles
│   ├── page.tsx            # Redirects → /dashboard
│   ├── dashboard/page.tsx
│   ├── units/page.tsx
│   ├── assessments/page.tsx
│   ├── planner/page.tsx
│   ├── insights/page.tsx
│   └── settings/page.tsx
├── components/
│   ├── layout/             # AppShell, Sidebar, Icons
│   ├── setup/              # SetupWizard
│   ├── dashboard/          # StudyHoursModal
│   └── ui/                 # Modal, Toast, all primitives
├── lib/
│   ├── db.ts               # IndexedDB read/write
│   ├── store.ts            # Zustand store + all actions
│   ├── migrations.ts       # Schema versioning
│   ├── weeks.ts            # Date + week utilities
│   ├── risk.ts             # Difficulty-weighted risk engine
│   └── priority.ts         # AI recommendations logic
├── types/index.ts          # All TypeScript interfaces
└── public/manifest.json    # PWA manifest
```

## Data persistence

All data is stored in **IndexedDB** in the user's browser. No account, no server, no cloud.

- Auto-saves on every action via Zustand → IndexedDB
- Export/import via JSON file (Settings page)
- Copy/paste data between browser sessions using clipboard

## Adding features (Phase 2+)

Because of the modular architecture:
- Add a new page: create `app/newpage/page.tsx`
- Add new data: extend `types/index.ts` + add migration in `lib/migrations.ts` + add action to `lib/store.ts`
- Existing user data is never lost — migrations upgrade old schemas forward

## Phase roadmap

| Phase | Status | Features |
|-------|--------|---------|
| 1 | ✅ Done | Dashboard, Units, Assessments, Planner, Insights, Settings, Setup wizard |
| 2 | Planned | Advanced charts, grade trajectory, exam prep tracking, consistency analysis |
| 3 | Planned | AI brief extraction (Claude API), AI weekly plans, AI recommendations |
