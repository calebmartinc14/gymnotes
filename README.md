# GymNotes

A small workout tracker for logging sets, reps and weight — and seeing what that means for **your** body.

Works in English and Spanish, offline-first, and syncs to your own Supabase project when you sign in. No account required: you can also keep everything local to the browser.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

For a production build:

```bash
npm run build
npm run preview
```

### Quality checks

```bash
npm run test          # unit tests (Vitest)
npm run test:coverage # coverage report
npm run typecheck     # tsc
npm run lint          # ESLint
npm run format        # Prettier
```

## What it does

- **Log workouts** — pick from 35+ exercises (or add your own), then enter date, sets, reps and weight.
- **Bodyweight movements** — pull-ups, dips, push-ups and more record bodyweight as the load (plus any added weight), so they still produce volume and e1RM.
- **Edit or delete sessions** — fix a typo or remove an entry from the Progress history.
- **Estimated 1RM** — every session gets an Epley-estimated one-rep max from your best set, so progress is visible even when reps change.
- **Progress charts** — track estimated strength or volume over time, absolutely or relative to bodyweight.
- **Strength standards** — compare the big five lifts (bench, squat, deadlift, overhead press, barbell row) to approximate bodyweight standards, age-adjusted.
- **Body context** — age, height and weight feed a BMI reading and every bodyweight-relative number.
- **Personal records** — PRs are detected automatically (your first session is a baseline, not a PR), with recent bests on the dashboard.
- **English & Spanish** — the whole interface is translated; the language is auto-detected from the browser and can be switched any time.
- **Optional cloud sync** — with a Supabase project configured, data syncs to your account across devices, while staying cached locally for offline use.
- **Installable & offline** — a web manifest and service worker let you install GymNotes and use it without a connection.
- **Deep links** — tabs are reflected in the URL (`#/progress/bench-press`), so refresh and the back button behave.
- **Sample data** — 12 weeks of realistic sessions to explore the app instantly.

## Languages

The UI ships in **English** and **Spanish**. On first load the language is chosen from `navigator.language` (anything starting with `es` becomes Spanish), then the choice is stored under `gymnotes:locale` and wins on later visits. Use the `EN / ES` switch in the top bar.

All strings live in `src/lib/locales/en.ts` and `src/lib/locales/es.ts`. The Spanish dictionary is typed against the English keys, so adding a new key makes the build fail until it is translated.

## Cloud sync with Supabase

Supabase is optional. If it is not configured, GymNotes runs exactly as before — local-only, no accounts, no network.

### 1. Create the database

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates the `profiles`, `custom_exercises` and `workouts` tables with Row Level Security so each user only sees their own rows.

### 2. Point the app at it

Copy `.env.example` to `.env.local` and fill in the values from **Project Settings → API**:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Restart `npm run dev`. A sign-in screen appears with email + password accounts (Supabase Auth). "Continue without an account" keeps the app local-only.

> Email confirmation is on by default. Turn it off in **Authentication → Providers → Email** if you want instant sign-in during development.

### How sync behaves

- **Supabase is the source of truth.** On sign-in the app loads your rows; writes go straight to Supabase.
- **localStorage is the offline cache.** The current state is always mirrored under `gymnotes:v1` so the app still opens without a connection. If a cloud write fails, changes stay on the device and a banner explains it.
- **Bring local data up.** If your account is empty but this browser has data, GymNotes offers to upload it. You can also use **Profile → Upload this device** at any time.
- **Import / demo / reset** replace the whole dataset for the signed-in user.

## How the strength comparison works

1. **Estimate 1RM** from your best set: `weight × (1 + reps / 30)`.
2. **Divide by bodyweight** — e.g. a 90 kg bench at 80 kg bodyweight is `1.13×`.
3. **Adjust for age** — the target ratio is shifted using an approximate age factor (1.0 in your twenties, declining gradually with age).
4. **Compare to standards** — five levels from Untrained to Elite, using approximate bodyweight multiples for drug-free lifters.
5. **BMI** uses height + weight for context. The ratio itself is per kilogram of bodyweight.

These standards are a compass, not a verdict. They are approximations, not medical or coaching advice.

## Data & backups

Local cache lives under the `gymnotes:v1` key in `localStorage`; cloud rows live in your Supabase project.

- **Profile → Export backup** downloads a JSON snapshot.
- **Import backup** restores one, validating dates, profile ranges and versions and reporting anything it had to skip.
- With a cloud account, **Upload this device** copies the local snapshot into your account.
- Open tabs stay in sync — changing data in one tab updates the others.
- If the browser blocks storage (private mode, quota), a warning banner appears instead of failing silently.

## Tech

React 19 + TypeScript + Vite. Charts are hand-built SVG, no chart library. Styling is plain CSS split by area under `src/styles/`. Calculations, storage and the Supabase row mappers are pure modules covered by Vitest unit tests.

```
src/
  components/   pages, chart, icons, auth screen, language switch, shared UI
  data/         exercise library + demo generator
  lib/          calculations, strength standards, storage, i18n (+ locales), supabase, auth, remote (+ tests)
  styles/       base, layout, page-specific CSS, auth, responsive
public/         favicon, web manifest, service worker
supabase/       schema.sql (tables + Row Level Security)
```

### Environment variables

| Variable                 | Purpose                                            |
| ------------------------ | -------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Your Supabase project URL.                         |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (safe to ship; RLS protects data). |

Both are optional. Leave them unset to run in local-only mode.
