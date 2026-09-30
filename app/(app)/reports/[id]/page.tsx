import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/auth';
import { getReport } from '@/lib/reports';
import { ReportProgress } from '@/components/report/ReportProgress';
import { ReportView } from '@/components/report/ReportView';

export async function generateMetadata({ params }: PageProps<'/reports/[id]'>): Promise<Metadata> {
  const report = await getReport((await params).id);
  return { title: report ? `@${report.handle}` : 'Report' };
}

export default async function ReportPage({ params }: PageProps<'/reports/[id]'>) {
  const member = await requireMember();
  const report = await getReport((await params).id);
  if (!report) notFound();

  if (report.status !== 'completed') {
    return (
      <ReportProgress
        key={report.id}
        id={report.id}
        handle={report.handle}
        timezone={report.timezone}
        span={report}
        initial={{ status: report.status, stage: report.stage, progress: report.progress, error: report.error_message }}
      />
    );
  }

  return <ReportView report={report} canDelete={member.role === 'admin' || report.created_by === member.userId} />;
}
