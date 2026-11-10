# Playbook · Kanban Task Board

A polished, Linear-inspired Kanban board built with **React + TypeScript + Vite** on top of **Supabase** (Postgres, anonymous auth, Row Level Security).

- **Live demo:** _add your Vercel URL here_
- **Stack:** React 19, TypeScript, Vite, Supabase JS v2, plain CSS with design tokens (no UI kit)

## Features

**Core**
- Four-column board — To Do, In Progress, In Review, Done
- Drag and drop between and within columns, persisted to Supabase the moment you drop (optimistic UI with automatic rollback on failure)
- Create tasks with title, description, priority, due date, assignees and labels
- Guest accounts: a Supabase anonymous session is created on first visit; RLS guarantees each guest only sees their own data
- Clear loading (skeletons), empty, and error states (retry banner, toasts on failed writes)

**Advanced (all 7 implemented)**
1. **Team members & assignees** — create teammates with a color, assign several per task, avatars on cards
2. **Comments** — task detail panel with a chronological comment thread (`comments` table)
3. **Activity log** — Postgres triggers record creation, status moves, edits and assignment changes ("Moved from To Do → In Progress · 2 hours ago")
4. **Labels** — custom colored labels, multiple per task, filter the board by label
5. **Due-date indicators** — overdue cards get a red edge and badge; due today / within 2 days get an amber badge
6. **Search & filtering** — search by title (`/` to focus), filter by priority, label and assignee
7. **Board summary** — completed progress, total, in flight, due soon, overdue

**Polish**: light/dark theme, keyboard shortcuts (`N` new task, `/` search, `Esc` close, `Ctrl+Enter` submit), responsive layout with swipeable columns and long-press drag on touch, `prefers-reduced-motion` support, a one-click sample project for first-time visitors.

## Run locally

Requires Node.js 18+.

```bash
npm install
cp .env.example .env.local      # then fill in your Supabase URL and anon/publishable key
npm run dev                      # http://localhost:5173
```

### Supabase setup

1. Create a project at supabase.com (free tier).
2. **SQL Editor → New query** → paste `supabase/schema.sql` → **Run**.
3. **Authentication → Sign In / Providers** → enable **Allow anonymous sign-ins**.
4. **Project Settings → API** → copy the Project URL and the anon/publishable key into `.env.local`.

Only the public key is used in the browser. The service-role key is never needed or committed.

### Deploy (Vercel)

Import the GitHub repo in Vercel (framework preset: Vite), add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables, and deploy.

## Project structure

```
src/
  App.tsx                 page layout, filters, keyboard shortcuts
  hooks/useBoard.ts       board state + optimistic mutations with rollback
  hooks/useDragAndDrop.ts pointer-based drag and drop (mouse, pen, touch)
  lib/api.ts              every Supabase call lives here
  lib/format.ts           dates, due-state, fractional positions, colors
  lib/sample.ts           one-click sample project
  components/             Column, TaskCard, TaskDialog, TaskDrawer, Toolbar, StatsBar, …
  styles.css              design tokens (light + dark) and component styles
supabase/schema.sql       tables, triggers, RLS policies
```

## Design decisions

- **Fractional ordering.** Each task has a float `position`; dropping between two cards takes the midpoint, so a move is a single-row update.
- **Optimistic updates.** The UI never waits on the network for a drag or edit; on error the previous state is restored and a toast explains why.
- **Security in the database, not the client.** Every table has RLS. Join tables (`task_assignees`, `task_labels`, `comments`) additionally check that the referenced task, member or label belongs to the caller, so a guest can't attach data to someone else's task even with a guessed UUID. The activity log has no update/delete policy — it's append-only.
- **Activity via triggers.** Logging happens in Postgres, so it's complete no matter which client made the change.
- **Custom drag and drop.** About 300 lines, tailored to the board: a floating card that tracks the pointer 1:1, a placeholder that opens where the card will land, edge auto-scroll, Escape to cancel, and long-press on touch so scrolling still works on phones.

## Tradeoffs / what I'd do next

- **Realtime sync** across tabs/devices with Supabase Realtime channels.
- **Keyboard drag and drop** (move a focused card with arrow keys); today keyboard users change status from the detail panel.
- **Upgrade guests** to a permanent account (Supabase `linkIdentity`) so a board can follow you across devices.
- **Tests:** Playwright end-to-end tests for drag, create and RLS isolation in CI.
- Occasional position rebalancing if many drops land between the same two cards (float precision).
