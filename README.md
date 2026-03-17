# Clearpath

> Daily tasks. Weekly goals. Monthly vision. All in one place.

A personal productivity app built for focus and intentional living. Plan your day, track your week, set big goals, maintain habits, and journal your progress — all in one dark-mode app that syncs across all your devices.

---

## Live App

[https://clearpath-tawny.vercel.app](https://clearpath-tawny.vercel.app)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | CSS-in-JS (inline styles) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email + password) |
| Hosting | Vercel |

---

## Features

### Today
- Add tasks for the day with P0/P1/P2/P3 priority
- Link tasks to a big goal
- Progress bar showing completion percentage
- Tasks sorted automatically by priority

### This Week
- Plan tasks across all 7 days of the current week
- Same priority and goal linking as Today
- Today highlighted — tasks added in Today appear here automatically

### Lists
- Create named lists for things to do eventually
- No dates, no pressure — just a place to capture procrastinated tasks
- Examples: Home Fixes, Errands, Side Projects

### Maintenance
- Add recurring maintenance tasks with a frequency (weekly, monthly, every 3/6 months, yearly)
- Tracks last done date and calculates next due date
- Overdue tasks highlighted in red, due soon in amber

### Big Goals
- Add goals with a timeframe and priority
- Link daily/weekly tasks to goals to track real progress
- Mark goals as complete — moves to an Achieved archive
- Reopen archived goals if needed

### Journal
- **Quick mode** — one text box, write anything, no pressure
- **Deep mode** — 4 structured prompts for deeper reflection
- Navigate to any past date to read old entries
- **Weekly Review** — end of week stats + 3 reflection prompts

### Calendar
- Monthly calendar view
- Click any date to see tasks added, completion rate, and journal entry for that day
- Green border = all done + journaled, amber = partial

### Stats
- Task completion rate over last 30 days
- Journal consistency percentage
- Most productive day of the week
- This week bar chart — tasks per day
- 30 day activity heatmap
- Completion breakdown by day of week

### Other
- 🔥 Streak tracker — counts consecutive days you've journaled
- 🏆 Longest streak tracking
- Data syncs across all devices in real time

---

## Database Schema
```sql
-- Core tables
tasks            -- (merged into week_tasks)
week_tasks       -- all tasks with date, priority, goal_id
goals            -- big goals with priority, timeframe, completed status
journal_entries  -- daily journal with quick + deep mode fields
weekly_reviews   -- weekly reflection entries
streaks          -- current and longest streak per user
lists            -- someday list containers
list_items       -- items inside each list
maintenance_tasks -- recurring maintenance with frequency + last_done
```

---

## Local Development

### Prerequisites
- Node.js v20.9.0 or higher
- A Supabase account and project
- A Vercel account (for deployment)

### Setup

1. Clone the repository
```bash
git clone https://github.com/skanda-2003/clearpath.git
cd clearpath
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env.local` file in the root:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run the development server
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

---

## Deployment

This project is deployed on Vercel with automatic deployments on every push to `main`.
```bash
git add .
git commit -m "your message"
git push
```

Vercel picks up the push and redeploys within 30-60 seconds.

---

## Branch Naming Convention
```
feat/feature-name   — new features
fix/issue-name      — bug fixes
```

---

## Roadmap

### In Pipeline
- [ ] Time blocking — assign time slots to tasks
- [ ] Daily focus mode — distraction free view of top 3 tasks
- [ ] Morning and evening journal prompts
- [ ] Mobile app (PWA) — installable on phone home screen
- [ ] Daily reminder notifications

---

## Built With

Built entirely using [Claude](https://claude.ai) — designed, architected, and coded through conversation.