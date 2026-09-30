import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { Card, CardHeader, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'How to use' };

const STEPS = [
  {
    title: 'Enter the Instagram username',
    text: 'On Generate Report, type the handle (e.g. natgeo), @natgeo, or paste the profile link. Pick a time span (12 months is the full audit) and keep the timezone on IST unless the audience is elsewhere.',
  },
  {
    title: 'Wait a few minutes',
    text: 'The app collects every post in the time span, looks at each image, calculates the metrics and writes the analysis. 12 months takes 4–8 minutes; shorter spans are faster. You can leave the page; the report keeps generating.',
  },
  {
    title: 'Read the report on screen',
    text: 'Start with the Key finding, then Content buckets and Recommendations. Hover over any chart bar to see the exact numbers.',
  },
  {
    title: 'Download what you need',
    text: 'Download PDF gives the written audit to share internally. Excel gives every post plus the eight analysis tables for your own filtering.',
  },
];

const TERMS = [
  ['Engagement', 'Likes + comments on a post.'],
  ['Engagement rate', 'Average engagement per post divided by followers. Typical Instagram accounts sit at 1–3%.'],
  ['Median', 'The middle post. More honest than the average when a few viral posts pull the average up.'],
  ['Content bucket', 'A theme the account posts about, assigned by AI from the image and caption.'],
  ['Index', 'Share of engagement ÷ share of posts. 2.00 means the bucket earns twice its share; 0.50 means half.'],
  ['Best hours', 'Hours ranked by median engagement, counting only hours with enough posts to be reliable.'],
];

export default async function HelpPage() {
  await requireMember();
  return (
    <div>
      <PageHeader eyebrow="Team guide" title="How to use InstaReport" description="Everything you need to generate, read and share an Instagram audit." />
      <div className="grid grid-cols-1 gap-24 md:gap-32 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="xl:col-span-2">
          <CardHeader title="Generate a report in four steps" />
          <ol className="grid grid-cols-1 gap-12 p-16 md:grid-cols-2 md:gap-16 md:p-24 xl:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-line bg-surface-low p-16">
                <span className="tabular flex h-32 w-32 items-center justify-center rounded-lg bg-brand-gradient text-body-sm font-bold text-white">{i + 1}</span>
                <h3 className="mt-12 text-body-lg font-semibold text-ink">{s.title}</h3>
                <p className="mt-4 text-body-md text-ink-subtle">{s.text}</p>
              </li>
            ))}
          </ol>
          <p className="px-16 pb-16 text-body-sm text-ink-subtle md:px-24 md:pb-20">
            Ready?{' '}
            <Link href="/generate" className="font-semibold text-primary hover:underline">
              Generate a report
            </Link>
            .
          </p>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Already have an Apify export? Upload it" description="Skips the collection step, so no Apify credit is used." />
          <ol className="list-decimal space-y-8 p-20 pl-40 text-body-md text-ink-muted md:p-24 md:pl-44">
            <li>Run Apify’s Instagram Scraper for one public account and download the dataset as Excel, CSV or JSON, exactly as exported.</li>
            <li>
              Open <Link href="/generate" className="font-semibold text-primary hover:underline">Generate report</Link>, choose <strong className="text-ink">Upload an export</strong> and drop the file in. The page shows the account, post count and dates it found.
            </li>
            <li>Enter the follower count if the file doesn’t include it, confirm the data is from a public account, then press <strong className="text-ink">Analyse and build report</strong>.</li>
          </ol>
          <p className="px-20 pb-20 text-body-sm text-ink-subtle md:px-24">
            The report covers the dates found in the file. One account per file, up to 15 MB. The file is read in memory and not kept; commenter details are ignored. Post images are fetched from Instagram’s image links in the export, which expire after a few days, so upload soon after exporting.
          </p>
        </Card>

        <Card>
          <CardHeader title="Reading the numbers" />
          <dl className="divide-y divide-line">
            {TERMS.map(([term, def]) => (
              <div key={term} className="grid grid-cols-1 gap-4 px-20 py-12 md:grid-cols-[140px_minmax(0,1fr)] md:gap-16 md:px-24">
                <dt className="text-body-md font-semibold text-ink">{term}</dt>
                <dd className="text-body-md text-ink-subtle">{def}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Acceptable use" description="The rules we follow so the tool stays legal and trustworthy." />
          <ul className="space-y-12 p-20 md:p-24">
            {[
              [true, 'Analyse public accounts for client work, competitor research and our own accounts.'],
              [true, 'Share reports inside the company. Get approval before sending one to a client or outside partner.'],
              [false, 'Don’t try to analyse private accounts, or ask anyone for Instagram logins to get around it.'],
              [false, 'Don’t use reports to profile, track or contact private individuals. Audit brands, creators and businesses.'],
              [false, 'Don’t quote AI-assigned buckets for a single post as fact; they describe patterns across many posts.'],
            ].map(([ok, text]) => (
              <li key={String(text)} className="flex gap-10 text-body-md text-ink-muted">
                {ok ? <CheckCircle2 className="mt-2 h-18 w-18 shrink-0 text-success" aria-label="Do" /> : <XCircle className="mt-2 h-18 w-18 shrink-0 text-danger" aria-label="Don't" />}
                {text}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="If something goes wrong" />
          <dl className="grid grid-cols-1 gap-16 p-20 md:grid-cols-2 md:p-24">
            {[
              ['“This is a private account”', 'Nothing was collected and nothing was charged beyond the profile check. Only public accounts can be analysed.'],
              ['“No posts were found in that file”', 'The export must come from a run that collected posts (columns like id, timestamp, likesCount, commentsCount). A profile-only export can’t be analysed.'],
              ['“Could not be found”', 'Check the spelling. Usernames can change; open the profile on Instagram and copy the link.'],
              ['“Apify / Anthropic account has run out of credit”', 'An admin needs to top up that account. The report can then be generated again.'],
              ['“Already analysed in the last 24 hours”', 'Open the existing report to save time and cost, or generate a fresh one if you need the very latest posts.'],
              ['Report stuck or “interrupted”', 'If the server restarted mid-report it is marked as interrupted after 10 minutes. Press Try again.'],
              ['Forgot password', 'Ask an admin to reset it in Settings → Team. You’ll get a temporary password and choose a new one when you sign in.'],
            ].map(([q, a]) => (
              <div key={q} className="flex gap-12">
                <AlertTriangle className="mt-2 h-16 w-16 shrink-0 text-warning" aria-hidden />
                <div>
                  <dt className="text-body-md font-semibold text-ink">{q}</dt>
                  <dd className="mt-2 text-body-sm text-ink-subtle">{a}</dd>
                </div>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}
