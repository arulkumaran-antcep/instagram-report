import type { Metadata } from 'next';
import { requireMember } from '@/lib/auth';
import { GenerateTabs } from '@/components/GenerateTabs';
import { RecentChips } from '@/components/RecentChips';
import { Card, CardHeader, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Generate report' };

const CONTENTS: [string, string][] = [
  ['Overview', 'Followers, posting rate, average and median engagement, engagement rate.'],
  ['Formats and content buckets', 'Which post types and themes earn more or less than their share of posts.'],
  ['Timing and cadence', 'Best hours and days by median engagement, gaps and bursts in posting.'],
  ['Trajectory', 'First half of the period compared with the second.'],
  ['Hashtags, captions, collabs, audio', 'What the account uses and how those posts perform.'],
  ['Recommendations', 'Numbered actions, each backed by figures from the account’s own posts.'],
  ['Excel workbook', 'Every post plus the analysis tables, ready to filter.'],
];

export default async function GeneratePage() {
  await requireMember();
  return (
    <div>
      <PageHeader
        title="New report"
        description="Enter a public Instagram username, or upload an export from Apify’s Instagram Scraper. The result is a PDF audit and an Excel workbook."
      />

      <div className="mx-auto max-w-720">
        <GenerateTabs />
        <RecentChips />
      </div>

      <Card className="mt-40">
        <CardHeader title="What the report covers" description="Only public data is used. Private accounts are refused." />
        <dl className="divide-y divide-line">
          {CONTENTS.map(([term, text]) => (
            <div key={term} className="grid grid-cols-1 gap-4 px-20 py-12 md:grid-cols-[240px_minmax(0,1fr)] md:gap-16 md:px-24">
              <dt className="text-body-md font-semibold text-ink">{term}</dt>
              <dd className="text-body-md text-ink-subtle">{text}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
