import { after } from 'next/server';
import { apiError, HttpError, requireApiMember } from '@/lib/auth';
import { PERIODS, customRangeProblem, isSupportedTimezone, monthsBetween, parseHandle } from '@/lib/handle';
import { activeJobCount, createReport, createUploadReport, findReusable, getReport, type WindowSpec } from '@/lib/reports';
import { runReport } from '@/lib/pipeline';
import { adminDb } from '@/lib/supabase/admin';
import type { Post, Profile } from '@/lib/report-types';

export const maxDuration = 300; // Hobby maximum. On Pro with Fluid Compute raise to 800 so 12-month reports can finish.

const MAX_ACTIVE_PER_USER = 2;
const MAX_ACTIVE_TOTAL = 4;

const sourceDataOf = async (id: string) => {
  const { data } = await adminDb().from('reports').select('source_data').eq('id', id).maybeSingle();
  return (data?.source_data as { profile: Profile; posts: Post[] } | null) ?? null;
};

export async function POST(request: Request) {
  try {
    const member = await requireApiMember(request);
    const body = await request.json().catch(() => ({}));

    // Re-run a report that was built from an uploaded file, using the data already parsed from it.
    if (body.fromReport) {
      const source = await getReport(String(body.fromReport));
      const data = source && source.source === 'upload' ? await sourceDataOf(source.id) : null;
      if (!source || !data) throw new HttpError(404, 'That report can’t be re-run. Upload the file again.');
      if ((await activeJobCount(member.userId)) >= MAX_ACTIVE_PER_USER) {
        throw new HttpError(429, `You already have ${MAX_ACTIVE_PER_USER} reports in progress. Wait for one to finish.`);
      }
      const id = await createUploadReport(
        source.handle,
        source.timezone,
        { months: source.window_months, start: source.window_start, end: source.window_end },
        member,
        data,
      );
      after(() => runReport(id));
      return Response.json({ id, reused: false, status: 'queued' }, { status: 201 });
    }

    const handle = parseHandle(String(body.handle ?? ''));
    if (!handle) throw new HttpError(400, 'Enter a valid Instagram username, e.g. natgeo or @natgeo.');
    const timezone = String(body.timezone ?? 'Asia/Kolkata');
    if (!isSupportedTimezone(timezone)) throw new HttpError(400, 'Choose a timezone from the list.');

    const period = PERIODS.find((p) => p.value === body.period) ?? PERIODS[0];
    let window: WindowSpec;
    if (period.value === 'custom') {
      const start = String(body.start ?? '');
      const end = String(body.end ?? '');
      const problem = customRangeProblem(start, end);
      if (problem) throw new HttpError(400, problem);
      window = { months: monthsBetween(start, end), start, end };
    } else {
      window = { months: period.months!, start: null, end: null };
    }

    if (!body.force) {
      const existing = await findReusable(handle, window);
      if (existing) {
        return Response.json({ id: existing.id, reused: true, status: existing.status });
      }
    }

    if ((await activeJobCount(member.userId)) >= MAX_ACTIVE_PER_USER) {
      throw new HttpError(429, `You already have ${MAX_ACTIVE_PER_USER} reports in progress. Wait for one to finish.`);
    }
    if ((await activeJobCount()) >= MAX_ACTIVE_TOTAL) {
      throw new HttpError(429, 'The team already has several reports in progress. Please try again in a few minutes.');
    }

    const id = await createReport(handle, timezone, window, member);
    after(() => runReport(id));
    return Response.json({ id, reused: false, status: 'queued' }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
