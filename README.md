# InstaReport

Internal tool that turns any **public** Instagram account into a content audit: a written PDF report and an Excel workbook. The team chooses the time span per report: last 12, 6 or 3 months, or exact dates (up to 24 months back). It automates the founder's manual workflow (Apify export → Claude analysis).

Team members use it through the web app. The in-app **How to use** page is the team guide. This README is for the admin who sets it up and runs it.

## How it works

1. **Collect**: Apify's `apify/instagram-scraper` fetches the profile and up to 1,200 posts in the chosen time span, without logging in to Instagram. If an account posts more than that, the report says so and covers its most recent 1,200 posts. Raw data is deleted from Apify immediately after, and commenter data is never kept.
2. **Categorise**: Claude (Sonnet 5.5) looks at a thumbnail of each post plus its caption, defines 4–8 content buckets, and assigns every post. Images are processed in memory and never stored.
3. **Analyse**: code (`lib/analysis/stats.ts`) calculates every metric: formats, buckets, performance index, monthly trend, timing in the chosen timezone, cadence, captions, hashtags, collabs and audio.
4. **Write**: Claude writes the audit from those figures only. Every number it writes is checked against the data (`lib/ai/verify.ts`); unsupported statements are corrected or removed.
5. **Deliver**: a PDF (`lib/export/pdf.tsx`) and an 8-sheet workbook (`lib/export/xlsx.ts`), stored in a private Supabase bucket and downloaded through 60-second signed links.

Typical 12-month run: **4–8 minutes, about $2–3** in API costs. Shorter spans are faster and cheaper (roughly $0.35 per 100 posts). Each report records its exact cost.

## Building a report from an uploaded export

If the team already has an Apify Instagram Scraper export, **Generate report → Upload an export** builds the same PDF and workbook from it, with no Apify spend (Claude cost only, about $0.35 per 100 posts).

- Accepts `.xlsx`, `.csv` or `.json` up to 15 MB, one account per file. Spreadsheet exports use Apify’s flattened "a/b/0/c" columns; `lib/instagram/import.ts` rebuilds them.
- The report covers the first to last post date in the file. Followers are read from the file if present, otherwise typed in.
- The file is read in memory and never stored. Parsed public post data is kept on the report so Try again works. Commenter data is ignored.
- Uploaded files are untrusted: zip-bomb and prototype-pollution guards, and post images are only fetched from Instagram’s own CDN hosts.
- The uploader must confirm the data is from a public account and was collected lawfully. It is then sent to Anthropic for analysis; Anthropic does not train on API inputs by default.

## First-time setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the keys.
3. In Supabase → **SQL Editor**, run these in order: `supabase/migrations/001_production_schema.sql`, `002_custom_time_span.sql`, `003_upload_source.sql`, then `004_api_keys.sql`.
4. In Supabase → **Authentication → Sign In / Providers**, turn **off** "Allow new users to sign up".
5. `npm run create-admin`. Enter your name and email; it prints a temporary password.
6. `npm run dev`, open http://localhost:3000, sign in, and choose your own password.
7. Add teammates in **Settings → Team**. Each one gets a one-time password to share privately.

## Running it for the team

```bash
npm run build
npm run start
```

Report generation continues in the background after the page responds, so the safest host is a **persistent Node.js server**: a small VPS, Railway, Render or an office machine.

**Vercel** works only on a paid plan with Fluid Compute, because a report runs 4–8 minutes inside `after()` (the routes ask for 800 s, the Pro maximum; the free Hobby plan stops at about 5 minutes and will fail long reports). Vercel also rejects request bodies over 4.5 MB, so Excel uploads larger than that fail there; typical exports of a few hundred posts are well under 1 MB. Set every variable from `.env.example` in the Vercel project settings, and add your production domain to Supabase → Authentication → URL Configuration.

## Accounts and costs

| Service | Used for | Notes |
|---|---|---|
| Apify | Collecting posts | About $1.70 per 12-month report. **The free plan ($5/month) covers only 2 such reports**, so use a paid plan. |
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

## API keys and credit

Admins can change the Apify token and Anthropic key in **Settings → API keys & credit** without editing the server. Each key is checked with its provider before it is saved, stored encrypted (AES-256-GCM; set `APP_ENCRYPTION_KEY` to use your own secret, otherwise it is derived from the Supabase service-role key) and never shown again, only its last 4 characters. New reports use it straight away. A key saved there overrides the environment variable; "Remove" falls back to it.

- **Apify credit** is read live from Apify (usage and limit for the billing cycle).
- **Anthropic credit** can't be read by apps, so enter the balance from the Anthropic console after each top-up; InstaReport subtracts the recorded cost of every report created since.

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
lib/instagram/  Apify collection, export import, shared post normaliser
lib/ai/         categorisation, report writing, figure verification
lib/analysis/   all metric calculations
lib/export/     PDF and Excel builders
lib/pipeline.ts runs one report end to end
proxy.ts        session refresh and route protection
supabase/       database migration
scripts/        create-admin
```
