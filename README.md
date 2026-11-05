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
- **Training calendar** — browse workouts by date, review completed habits, and start a workout for the selected day.
- **Habit tracking** — set weekly targets, check habits off by day, and review streaks and completion history.
- **Private beta feedback** — signed-in users can send private bug reports or ideas; only accounts explicitly listed as project admins can view and triage the inbox.
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
2. Open **SQL Editor → New query**, paste the full contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it. It creates the profile, exercise, workout, habit, check-in, routine, and private feedback tables and enables Row Level Security policies. Re-run the full script after schema updates; it is written to be repeatable.
3. Create/sign in to your owner account, then run the admin assignment query at the bottom of `supabase/schema.sql` with your Supabase login email. Only accounts in `admin_users` can read or triage feedback; the UI check is backed by RLS.

### 2. Point the app at it

Copy `.env.example` to `.env.local` and fill in the values from **Project Settings → API**:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Restart `npm run dev`. A sign-in screen appears with email + password accounts (Supabase Auth). "Continue without an account" keeps the app local-only.

In **Authentication → URL Configuration**, set **Site URL** to `https://calebmartinc14.github.io/gymnotes/` and add these exact **Redirect URLs**:

```text
https://calebmartinc14.github.io/gymnotes/
http://localhost:5173/
```

Signup now sends the current app path as `emailRedirectTo`, so production registrations return to GitHub Pages while local registrations return to localhost. If you customized the confirmation email template, use `{{ .ConfirmationURL }}` for its link rather than hard-coding `{{ .SiteURL }}`.

> Email confirmation is on by default. Turn it off in **Authentication → Providers → Email** only if you want instant sign-in during development.

### How sync behaves

- **Supabase is the source of truth for signed-in accounts.** On sign-in the app loads that account's rows.
- **localStorage is the offline cache and write queue.** The current state is mirrored under `gymnotes:v1`; queued cloud writes are stored separately under `gymnotes:outbox:v1` and retried on reconnect and periodically. A failed write stays queued and the app explains whether the connection or database schema needs attention.
- **Bring local data up.** If your account is empty but this browser has data, GymNotes offers to upload it. You can also use **Profile → Upload this device** at any time.
- **Import / demo / reset** replace the whole dataset for the signed-in user in one database transaction, so a failed replacement cannot leave only part of the cloud data written. This requires the latest `supabase/schema.sql` function.
- **Account boundaries.** The browser cache is cleared when a signed-in account logs out or switches accounts. Export a backup before signing in on a shared browser if you need to preserve local-only data.
- **Feedback privacy.** Submissions require sign-in and are tied to that account. Regular users can submit but cannot read the inbox or other users' messages. This is a private inbox, not a public forum.

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

## Pre-release checks for multiple users

Use a staging Supabase project with two test accounts and no real workout or profile data:

1. Sign in as A, add a profile value, workout, custom exercise, habit, and check-in. Confirm they appear after refresh.
2. Sign out, choose local mode, then sign in as B. Confirm none of A's profile, workouts, exercises, habits, or check-ins appear.
3. Add a different set of records as B, then sign in as A again. Confirm A's original rows are intact and B's rows remain private.
4. With B signed in, try reading A's rows through the Supabase client/API and confirm the RLS policies return no rows or deny the request.
5. Disconnect the network, add and remove a workout and toggle a habit check, reconnect, then confirm the cloud converges to the final local state without duplicates.
6. Import a backup, load demo data, and reset the test account. Confirm each operation affects only the signed-in test account.

Run this only against a disposable staging project. The automated Vitest suite checks mapping, normalization, and queue behavior; it does not replace these live RLS and account-switch checks.

## Tech

React 19 + TypeScript + Vite. Charts are hand-built SVG, no chart library. Styling is plain CSS split by area under `src/styles/`. Calculations, storage and the Supabase row mappers are pure modules covered by Vitest unit tests.

```
src/
  components/   pages, chart, icons, auth screen, language switch, feedback inbox, shared UI
  data/         exercise library + demo generator
  lib/          calculations, strength standards, storage, i18n (+ locales), sessions, sync, supabase, auth, remote (+ tests)
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
