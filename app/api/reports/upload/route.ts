import { after } from 'next/server';
import { apiError, HttpError, requireApiMember } from '@/lib/auth';
import { isSupportedTimezone } from '@/lib/handle';
import { dayInZone, zonedRange } from '@/lib/dates';
import { MAX_UPLOAD_BYTES, MIN_POSTS, parseExport } from '@/lib/instagram/import';
import { activeJobCount, createUploadReport } from '@/lib/reports';
import { runReport } from '@/lib/pipeline';
import { UserFacingError } from '@/lib/errors';
import type { Profile } from '@/lib/report-types';

export const maxDuration = 800;

const MAX_ACTIVE_PER_USER = 2;
const MAX_ACTIVE_TOTAL = 4;

const monthsSpan = (firstDay: string, lastDay: string) => {
  const [y1, m1] = firstDay.split('-').map(Number);
  const [y2, m2] = lastDay.split('-').map(Number);
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1);
};

// intent=preview reads the file and reports what it found (nothing is saved);
// intent=create builds a report from it. The file itself is never stored.
export async function POST(request: Request) {
  try {
    const member = await requireApiMember(request);
    const form = await request.formData().catch(() => null);
    if (!form) throw new HttpError(400, 'The upload could not be read. Try again.');

    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) throw new HttpError(400, 'Choose the exported file to upload.');
    if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, 'That file is larger than 15 MB. Export one account at a time.');

    const intent = String(form.get('intent') ?? 'preview');
    const timezone = String(form.get('timezone') ?? 'Asia/Kolkata');
    if (!isSupportedTimezone(timezone)) throw new HttpError(400, 'Choose a timezone from the list.');
    const fallbackHandle = String(form.get('handle') ?? '').trim().replace(/^@/, '').toLowerCase() || undefined;

    let parsed;
    try {
      parsed = await parseExport(Buffer.from(await file.arrayBuffer()), file.name, fallbackHandle);
    } catch (e) {
      if (e instanceof UserFacingError) throw new HttpError(400, e.message);
      throw e;
    }

    const fileFrom = dayInZone(parsed.first, timezone);
    const fileTo = dayInZone(parsed.last, timezone);

    // Optional: analyse only part of the file (whole days in the chosen timezone).
    let posts = parsed.posts;
    let firstDay = fileFrom;
    let lastDay = fileTo;
    const start = String(form.get('start') ?? '');
    const end = String(form.get('end') ?? '');
    if (start || end) {
      const day = /^\d{4}-\d{2}-\d{2}$/;
      if (!day.test(start) || !day.test(end)) throw new HttpError(400, 'Choose a start and an end date.');
      if (end < start) throw new HttpError(400, 'The end date must be after the start date.');
      const range = zonedRange(start, end, timezone);
      posts = parsed.posts.filter((p) => {
        const t = new Date(p.timestamp);
        return t >= range.start && t <= range.end;
      });
      if (posts.length < MIN_POSTS) {
        throw new HttpError(400, `Only ${posts.length} post${posts.length === 1 ? '' : 's'} fall in those dates. Choose a wider range (the file covers ${fileFrom} to ${fileTo}).`);
      }
      posts = posts.map((p, i) => ({ ...p, idx: i }));
      firstDay = dayInZone(posts[posts.length - 1].timestamp, timezone);
      lastDay = dayInZone(posts[0].timestamp, timezone);
    }
    const summary = {
      handle: parsed.handle,
      fileFrom,
      fileTo,
      posts: posts.length,
      from: firstDay,
      to: lastDay,
      followersInFile: parsed.profileFromFile?.followers ?? null,
      imagesAvailable: posts.filter((p) => p.imageUrl).length,
      skipped: parsed.skipped,
    };
    if (intent === 'preview') return Response.json(summary);

    if (form.get('confirm') !== 'yes') {
      throw new HttpError(400, 'Please confirm the data comes from a public account and was collected lawfully.');
    }
    const typed = Number(form.get('followers'));
    const followers = Number.isFinite(typed) && typed > 0 ? Math.round(typed) : (parsed.profileFromFile?.followers ?? 0);
    if (!followers || followers < 1) {
      throw new HttpError(400, 'Enter the account’s follower count. It is not in the export, and engagement rates need it.');
    }

    if ((await activeJobCount(member.userId)) >= MAX_ACTIVE_PER_USER) {
      throw new HttpError(429, `You already have ${MAX_ACTIVE_PER_USER} reports in progress. Wait for one to finish.`);
    }
    if ((await activeJobCount()) >= MAX_ACTIVE_TOTAL) {
      throw new HttpError(429, 'The team already has several reports in progress. Please try again in a few minutes.');
    }

    const p = parsed.profileFromFile;
    const profile: Profile = {
      username: parsed.handle,
      fullName: p?.fullName ?? '',
      biography: p?.biography ?? '',
      followers,
      following: p?.following ?? 0,
      totalPosts: p?.totalPosts ?? parsed.posts.length,
      isVerified: false,
      isBusiness: false,
      category: p?.category ?? null,
      externalUrl: null,
    };
    const id = await createUploadReport(
      parsed.handle,
      timezone,
      { months: monthsSpan(firstDay, lastDay), start: firstDay, end: lastDay },
      member,
      { profile, posts },
    );
    after(() => runReport(id));
    return Response.json({ id, status: 'queued' }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
