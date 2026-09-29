import 'server-only';
import { adminDb, REPORTS_BUCKET } from '@/lib/supabase/admin';
import { STALE_AFTER_MINUTES, fileName } from '@/lib/pipeline';
import type { ReportRow, ReportStatus } from '@/lib/report-types';
import type { Member } from '@/lib/auth';

const LIST_COLUMNS =
  'id, handle, status, stage, progress, timezone, window_months, error_message, cost, created_by, created_by_name, created_at, updated_at, completed_at, profile';

export type ReportListItem = Omit<ReportRow, 'stats' | 'narrative' | 'pdf_path' | 'xlsx_path'> & {
  engagementRate: number | null;
  postsAnalysed: number | null;
};

// A job whose heartbeat stopped (server restarted mid-report) is marked
// failed instead of spinning forever.
export const expireStaleJobs = async () => {
  const cutoff = new Date(Date.now() - STALE_AFTER_MINUTES * 60_000).toISOString();
  await adminDb()
    .from('reports')
    .update({
      status: 'failed',
      error_message: 'This report was interrupted (the server restarted). Please generate it again.',
      updated_at: new Date().toISOString(),
    })
    .in('status', ['queued', 'processing'])
    .lt('updated_at', cutoff);
};

export const listReports = async ({
  q = '',
  status,
  page = 1,
  pageSize = 12,
}: {
  q?: string;
  status?: ReportStatus | 'active';
  page?: number;
  pageSize?: number;
}) => {
  await expireStaleJobs();
  let query = adminDb()
    .from('reports')
    .select(`${LIST_COLUMNS}, engagement:stats->overview->engagementRate, posts:stats->overview->posts`, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  const term = q.trim().replace(/^@/, '').replace(/[%_,()]/g, '');
  if (term) query = query.ilike('handle', `%${term}%`);
  if (status === 'active') query = query.in('status', ['queued', 'processing']);
  else if (status) query = query.eq('status', status);

  const { data, count, error } = await query;
  if (error) throw error;
  const rows = (data ?? []).map((r: any) => ({
    ...r,
    engagementRate: typeof r.engagement === 'number' ? r.engagement : null,
    postsAnalysed: typeof r.posts === 'number' ? r.posts : null,
  })) as ReportListItem[];
  return { rows, total: count ?? 0 };
};

export const getReport = async (id: string): Promise<ReportRow | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  await expireStaleJobs();
  const { data } = await adminDb().from('reports').select('*').eq('id', id).maybeSingle();
  return (data as ReportRow) ?? null;
};

export const findReusable = async (handle: string) => {
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { data } = await adminDb()
    .from('reports')
    .select('id, status, created_at')
    .eq('handle', handle)
    .or(`status.in.(queued,processing),and(status.eq.completed,created_at.gte."${since}")`)
    .order('created_at', { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
};

export const activeJobCount = async (userId?: string) => {
  let query = adminDb().from('reports').select('id', { count: 'exact', head: true }).in('status', ['queued', 'processing']);
  if (userId) query = query.eq('created_by', userId);
  const { count } = await query;
  return count ?? 0;
};

export const createReport = async (handle: string, timezone: string, member: Member) => {
  const { data, error } = await adminDb()
    .from('reports')
    .insert({ handle, timezone, window_months: 12, created_by: member.userId, created_by_name: member.fullName })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
};

export const deleteReport = async (report: ReportRow) => {
  const paths = [report.pdf_path, report.xlsx_path].filter((p): p is string => !!p);
  if (paths.length) await adminDb().storage.from(REPORTS_BUCKET).remove(paths);
  const { error } = await adminDb().from('reports').delete().eq('id', report.id);
  if (error) throw error;
};

export const signedDownloadUrl = async (report: ReportRow, format: 'pdf' | 'xlsx') => {
  const path = format === 'pdf' ? report.pdf_path : report.xlsx_path;
  if (!path) return null;
  const { data, error } = await adminDb()
    .storage.from(REPORTS_BUCKET)
    .createSignedUrl(path, 60, { download: fileName(report.handle, format) });
  if (error) throw error;
  return data.signedUrl;
};

export const dashboardStats = async () => {
  await expireStaleJobs();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { data } = await adminDb()
    .from('reports')
    .select('status, cost, created_at, completed_at')
    .gte('created_at', monthStart.toISOString());
  const rows = data ?? [];
  const completed = rows.filter((r) => r.status === 'completed');
  const durations = completed
    .filter((r) => r.completed_at)
    .map((r) => (Date.parse(r.completed_at!) - Date.parse(r.created_at)) / 1000);
  const { count: allTime } = await adminDb().from('reports').select('id', { count: 'exact', head: true }).eq('status', 'completed');
  return {
    thisMonth: rows.length,
    completedThisMonth: completed.length,
    failedThisMonth: rows.filter((r) => r.status === 'failed').length,
    active: rows.filter((r) => r.status === 'queued' || r.status === 'processing').length,
    spendThisMonth: rows.reduce((sum, r) => sum + (r.cost?.totalUsd ?? 0), 0),
    avgMinutes: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length / 60 : null,
    allTimeCompleted: allTime ?? 0,
  };
};
