import { after } from 'next/server';
import { apiError, HttpError, requireApiMember } from '@/lib/auth';
import { parseHandle, isSupportedTimezone } from '@/lib/handle';
import { activeJobCount, createReport, findReusable } from '@/lib/reports';
import { runReport } from '@/lib/pipeline';

export const maxDuration = 900;

const MAX_ACTIVE_PER_USER = 2;
const MAX_ACTIVE_TOTAL = 4;

export async function POST(request: Request) {
  try {
    const member = await requireApiMember(request);
    const body = await request.json().catch(() => ({}));

    const handle = parseHandle(String(body.handle ?? ''));
    if (!handle) throw new HttpError(400, 'Enter a valid Instagram username, e.g. natgeo or @natgeo.');
    const timezone = String(body.timezone ?? 'Asia/Kolkata');
    if (!isSupportedTimezone(timezone)) throw new HttpError(400, 'Choose a timezone from the list.');

    if (!body.force) {
      const existing = await findReusable(handle);
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

    const id = await createReport(handle, timezone, member);
    after(() => runReport(id));
    return Response.json({ id, reused: false, status: 'queued' }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
