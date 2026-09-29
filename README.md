# InstaReport

Internal tool that turns any **public** Instagram account into a content audit: a written PDF report and an Excel workbook covering the last 12 months of posts. It automates the founder's manual workflow (Apify export → Claude analysis).

Team members use it through the web app. The in-app **How to use** page is the team guide. This README is for the admin who sets it up and runs it.

## How it works

1. **Collect**: Apify's `apify/instagram-scraper` fetches the profile and up to 1,200 posts from the last 12 months, without logging in to Instagram. Raw data is deleted from Apify immediately after, and commenter data is never kept.
2. **Categorise**: Claude (Sonnet 5.5) looks at a thumbnail of each post plus its caption, defines 4–8 content buckets, and assigns every post. Images are processed in memory and never stored.
3. **Analyse**: code (`lib/analysis/stats.ts`) calculates every metric: formats, buckets, performance index, monthly trend, timing in the chosen timezone, cadence, captions, hashtags, collabs and audio.
4. **Write**: Claude writes the audit from those figures only. Every number it writes is checked against the data (`lib/ai/verify.ts`); unsupported statements are corrected or removed.
5. **Deliver**: a PDF (`lib/export/pdf.tsx`) and an 8-sheet workbook (`lib/export/xlsx.ts`), stored in a private Supabase bucket and downloaded through 60-second signed links.

Typical run: **4–8 minutes, about $2–3** in API costs. Each report records its exact cost.

## First-time setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the keys.
3. In Supabase → **SQL Editor**, run `supabase/migrations/001_production_schema.sql`.
4. In Supabase → **Authentication → Sign In / Providers**, turn **off** "Allow new users to sign up".
5. `npm run create-admin`. Enter your name and email; it prints a temporary password.
6. `npm run dev`, open http://localhost:3000, sign in, and choose your own password.
7. Add teammates in **Settings → Team**. Each one gets a one-time password to share privately.

## Running it for the team

```bash
npm run build
npm run start
```

Report generation continues in the background after the page responds, so the app needs a **persistent Node.js server**: a small VPS, Railway, Render or an office machine. Serverless hosting such as Vercel functions stops background work after a time limit, so it is not suitable without adding a job queue.

## Accounts and costs

| Service | Used for | Notes |
|---|---|---|
| Apify | Collecting posts | About $1.70 per 12-month report. **The free plan ($5/month) covers only 2–3 reports**, so use a paid plan. |
| Anthropic | Categorising and writing | About $0.50–1.00 per report on Claude Sonnet 5.5. |
| Supabase | Login, database, file storage | Free tier is enough for an internal team. |

The dashboard shows this month's measured spend.

## Security & compliance summary

- Invite-only accounts. Membership is checked on every page and API call, and database row-level security blocks the public key.
- Public accounts only; private accounts are refused. No Instagram login is ever used.
- Only the audited account's own public data is stored. Commenter data and images are not.
- Files are private; downloads use short-lived signed links.
- Mutating API calls must come from the app's own origin; security headers are set.
- Reports are for internal use. See the **Acceptable use** section in the app.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Apify account has run out of monthly credit" | Top up or upgrade the Apify plan. |
| "Anthropic account has run out of credit" | Add credit at console.anthropic.com. |
| Report marked "interrupted" | The server restarted mid-report. Press **Try again**. |
| Someone can't sign in | Admin → Settings → Team → reset password. |
| Per-step timings and errors | Supabase table `job_logs` (one row per pipeline step). |

## Project layout

```
app/            pages (dashboard, generate, reports, settings, help) and API routes
components/     UI, charts, report view
lib/instagram/  Apify collection
lib/ai/         categorisation, report writing, figure verification
lib/analysis/   all metric calculations
lib/export/     PDF and Excel builders
lib/pipeline.ts runs one report end to end
proxy.ts        session refresh and route protection
supabase/       database migration
scripts/        create-admin
```
