import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Eye, FileSearch, FileSpreadsheet, FileText, Plus, Search } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { listReports } from '@/lib/reports';
import { fmtCompact, fmtDateTime, fmtInt, fmtRate } from '@/lib/format';
import type { ReportStatus } from '@/lib/report-types';
import { Avatar, ButtonLink, EmptyState, PageHeader, cx } from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';
import { DeleteReportButton } from '@/components/DeleteReportButton';

export const metadata: Metadata = { title: 'Report history' };

const FILTERS: { key: string; label: string; status?: ReportStatus | 'active' }[] = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Ready', status: 'completed' },
  { key: 'active', label: 'Generating', status: 'active' },
  { key: 'failed', label: 'Failed', status: 'failed' },
];
const PAGE_SIZE = 12;

const iconAction = 'flex h-36 w-36 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-highest hover:text-ink';

export default async function ReportsPage({ searchParams }: PageProps<'/reports'>) {
  const member = await requireMember();
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 60) : '';
  const filter = FILTERS.find((f) => f.key === sp.status) ?? FILTERS[0];
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listReports({ q, status: filter.status, page, pageSize: PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (over: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, status: filter.key === 'all' ? undefined : filter.key, page: page > 1 ? page : undefined, ...over };
    Object.entries(merged).forEach(([k, v]) => v !== undefined && v !== '' && params.set(k, String(v)));
    const s = params.toString();
    return s ? `/reports?${s}` : '/reports';
  };

  return (
    <div>
      <PageHeader
        title="Report history"
        description="Every audit your team has generated. Open a report to read it, or download the PDF and Excel files."
        action={
          <ButtonLink href="/generate">
            <Plus className="h-16 w-16" aria-hidden /> New report
          </ButtonLink>
        }
      />

      <section className="card">
        <div className="flex flex-col gap-12 border-b border-line p-16 md:flex-row md:items-center md:justify-between md:px-24">
          <form action="/reports" method="get" className="relative w-full md:max-w-360" role="search">
            <Search className="pointer-events-none absolute left-12 top-1/2 h-16 w-16 -translate-y-1/2 text-ink-subtle" aria-hidden />
            {filter.key !== 'all' && <input type="hidden" name="status" value={filter.key} />}
            <input
              name="q"
              defaultValue={q}
              type="search"
              placeholder="Search by handle"
              aria-label="Search by handle"
              className="h-40 w-full rounded-lg border border-line-strong bg-canvas-deep pl-36 pr-12 text-body-md text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
            />
          </form>
          <nav aria-label="Filter by status" className="flex gap-4 overflow-x-auto rounded-lg bg-canvas-deep p-4">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={href({ status: f.key === 'all' ? undefined : f.key, page: undefined })}
                aria-current={f.key === filter.key ? 'page' : undefined}
                className={cx(
                  'flex h-32 items-center whitespace-nowrap rounded-md px-12 text-body-sm font-medium transition-colors',
                  f.key === filter.key ? 'bg-surface-highest text-ink' : 'text-ink-subtle hover:text-ink',
                )}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={<FileSearch className="h-24 w-24" />} title={q || filter.key !== 'all' ? 'No matching reports' : 'No reports yet'}>
            {q || filter.key !== 'all' ? (
              <>
                Try a different search or{' '}
                <Link href="/reports" className="text-primary hover:underline">
                  clear the filters
                </Link>
                .
              </>
            ) : (
              'Generate your first audit to see it here.'
            )}
          </EmptyState>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line">
                    {['Account', 'Followers', 'Posts', 'Eng. rate', 'Generated', 'Status', ''].map((h, i) => (
                      <th key={i} scope="col" className={cx('label px-24 py-14 font-medium', i >= 1 && i <= 3 && 'text-right', i === 6 && 'text-right')}>
                        {h || <span className="sr-only">Actions</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => {
                    const canDelete = member.role === 'admin' || r.created_by === member.userId;
                    return (
                      <tr key={r.id} className="transition-colors hover:bg-surface-high/60">
                        <td className="px-24 py-14">
                          <Link href={`/reports/${r.id}`} className="flex items-center gap-12">
                            <Avatar name={r.handle} size={40} />
                            <span className="min-w-0">
                              <span className="block truncate text-body-md font-semibold text-ink">@{r.handle}</span>
                              <span className="block truncate text-body-sm text-ink-subtle">{r.profile?.fullName || r.profile?.category || '—'}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="tabular px-24 py-14 text-right text-body-md text-ink">{r.profile ? fmtCompact(r.profile.followers) : '—'}</td>
                        <td className="tabular px-24 py-14 text-right text-body-md text-ink">{fmtInt(r.postsAnalysed)}</td>
                        <td className="tabular px-24 py-14 text-right text-body-md text-ink">{r.engagementRate != null ? fmtRate(r.engagementRate) : '—'}</td>
                        <td className="px-24 py-14 text-body-sm text-ink-muted">
                          {fmtDateTime(r.created_at)}
                          <span className="block text-ink-faint">by {r.created_by_name ?? 'former member'}</span>
                        </td>
                        <td className="px-24 py-14">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-24 py-14">
                          <div className="flex justify-end gap-4">
                            <Link href={`/reports/${r.id}`} className={iconAction} aria-label={`Open report for @${r.handle}`} title="Open">
                              <Eye className="h-18 w-18" />
                            </Link>
                            {r.status === 'completed' && (
                              <>
                                <a href={`/api/reports/${r.id}/download?format=pdf`} className={iconAction} aria-label="Download PDF" title="Download PDF">
                                  <FileText className="h-18 w-18" />
                                </a>
                                <a href={`/api/reports/${r.id}/download?format=xlsx`} className={iconAction} aria-label="Download Excel" title="Download Excel">
                                  <FileSpreadsheet className="h-18 w-18" />
                                </a>
                              </>
                            )}
                            {canDelete && r.status !== 'processing' && r.status !== 'queued' && <DeleteReportButton id={r.id} handle={r.handle} />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <ul className="divide-y divide-line md:hidden">
              {rows.map((r) => (
                <li key={r.id} className="p-16">
                  <Link href={`/reports/${r.id}`} className="flex items-center gap-12">
                    <Avatar name={r.handle} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-md font-semibold text-ink">@{r.handle}</span>
                      <span className="block text-body-sm text-ink-subtle">
                        {r.profile ? `${fmtCompact(r.profile.followers)} followers · ` : ''}
                        {fmtDateTime(r.created_at)}
                      </span>
                    </span>
                    <StatusBadge status={r.status} />
                  </Link>
                  {r.status === 'completed' && (
                    <div className="mt-12 flex gap-8 pl-52">
                      <a href={`/api/reports/${r.id}/download?format=pdf`} className="flex h-32 items-center gap-6 rounded-md bg-surface-high px-10 text-body-sm text-ink-muted">
                        <FileText className="h-14 w-14" aria-hidden /> PDF
                      </a>
                      <a href={`/api/reports/${r.id}/download?format=xlsx`} className="flex h-32 items-center gap-6 rounded-md bg-surface-high px-10 text-body-sm text-ink-muted">
                        <FileSpreadsheet className="h-14 w-14" aria-hidden /> Excel
                      </a>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-12 border-t border-line px-16 py-14 md:px-24">
              <p className="text-body-sm text-ink-subtle">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-8">
                <PageLink disabled={page <= 1} href={href({ page: page - 1 > 1 ? page - 1 : undefined })} label="Previous">
                  <ChevronLeft className="h-16 w-16" aria-hidden /> Previous
                </PageLink>
                <PageLink disabled={page >= pages} href={href({ page: page + 1 })} label="Next">
                  Next <ChevronRight className="h-16 w-16" aria-hidden />
                </PageLink>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function PageLink({ disabled, href, label, children }: { disabled: boolean; href: string; label: string; children: React.ReactNode }) {
  const cls = 'flex h-36 items-center gap-6 rounded-lg border border-line-strong px-12 text-body-sm font-medium';
  if (disabled)
    return (
      <span aria-disabled className={cx(cls, 'cursor-not-allowed text-ink-faint opacity-50')} aria-label={label}>
        {children}
      </span>
    );
  return (
    <Link href={href} className={cx(cls, 'text-ink hover:bg-surface-high')} aria-label={label}>
      {children}
    </Link>
  );
}
