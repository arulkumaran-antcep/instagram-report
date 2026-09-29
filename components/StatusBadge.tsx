import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { ReportStatus } from '@/lib/report-types';

export function StatusBadge({ status }: { status: ReportStatus }) {
  if (status === 'completed')
    return (
      <Badge tone="success">
        <CheckCircle2 className="h-14 w-14" aria-hidden /> Ready
      </Badge>
    );
  if (status === 'failed')
    return (
      <Badge tone="danger">
        <AlertCircle className="h-14 w-14" aria-hidden /> Failed
      </Badge>
    );
  if (status === 'processing')
    return (
      <Badge tone="warning">
        <Loader2 className="h-14 w-14 animate-spin" aria-hidden /> Generating
      </Badge>
    );
  return (
    <Badge tone="neutral">
      <Clock className="h-14 w-14" aria-hidden /> Queued
    </Badge>
  );
}
