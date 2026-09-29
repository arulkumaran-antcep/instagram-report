import Link from 'next/link';
import { listReports } from '@/lib/reports';
import { Avatar } from '@/components/ui';

export async function RecentChips() {
  const { rows } = await listReports({ status: 'completed', pageSize: 4 });
  if (!rows.length) return null;
  return (
    <div className="mt-24 flex flex-wrap items-center justify-center gap-8">
      <span className="label mr-4">Recent</span>
      {rows.map((r) => (
        <Link
          key={r.id}
          href={`/reports/${r.id}`}
          className="flex h-36 items-center gap-8 rounded-full border border-line bg-surface pl-4 pr-14 text-body-sm text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          <Avatar name={r.handle} size={32} />@{r.handle}
        </Link>
      ))}
    </div>
  );
}
