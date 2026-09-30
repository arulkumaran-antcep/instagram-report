import 'server-only';
import { adminDb, REPORTS_BUCKET } from '@/lib/supabase/admin';
import { fetchPosts, fetchProfile } from '@/lib/instagram/scrape';
import { loadThumbnails } from '@/lib/ai/images';
import { categorisePosts } from '@/lib/ai/categorise';
import { writeNarrative } from '@/lib/ai/narrative';
import { Usage } from '@/lib/ai/client';
import { computeStats } from '@/lib/analysis/stats';
import { buildPdf } from '@/lib/export/pdf';
import { buildWorkbook } from '@/lib/export/xlsx';
import { UserFacingError } from '@/lib/errors';
import { zonedRange } from '@/lib/dates';
import { loadSecrets } from '@/lib/secrets';
import { STAGES, type Post, type Profile, type ReportCost, type Stage } from '@/lib/report-types';

const HEARTBEAT_MS = 60_000;
export const STALE_AFTER_MINUTES = 10;

const progressOf = (stage: Stage) => STAGES.find((s) => s.key === stage)!.progress;

export const fileName = (handle: string, ext: 'pdf' | 'xlsx') => `${handle}-instagram-audit.${ext}`;

export const runReport = async (reportId: string) => {
  const db = adminDb();
  await loadSecrets(true);
  const { data: row, error } = await db.from('reports').select('handle, timezone, window_months, window_start, window_end, created_by_name, source, source_data').eq('id', reportId).single();
  if (error || !row) {
    console.error('[pipeline] report not found', reportId, error);
    return;
  }

  const handle: string = row.handle;
  const started = Date.now();
  const usage = new Usage();
  let apifyUsd = 0;
  let postsCollected = 0;
  let imagesAnalysed = 0;

  const update = async (fields: Record<string, unknown>) => {
    const { error: e } = await db.from('reports').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', reportId);
    if (e) console.error('[pipeline] update failed', e.message);
  };
  const stage = (s: Stage, progress = progressOf(s)) => update({ status: 'processing', stage: s, progress });
  const log = (step: string, ok: boolean, t0: number, detail: Record<string, unknown> = {}) =>
    db.from('job_logs').insert({ report_id: reportId, step, ok, duration_ms: Date.now() - t0, detail }).then(({ error: e }) => {
      if (e) console.error('[pipeline] log failed', e.message);
    });
  const cost = (): ReportCost => ({
    apifyUsd: Math.round(apifyUsd * 100) / 100,
    claudeUsd: Math.round(usage.usd * 100) / 100,
    totalUsd: Math.round((apifyUsd + usage.usd) * 100) / 100,
    postsCollected,
    imagesAnalysed,
    inputTokens: usage.input,
    outputTokens: usage.output,
  });

  const heartbeat = setInterval(() => void update({}), HEARTBEAT_MS);
  let step = 'profile';
  let t0 = Date.now();

  try {
    await stage('profile');
    const uploaded = row.source === 'upload' ? (row.source_data as { profile: Profile; posts: Post[] } | null) : null;
    if (row.source === 'upload' && !uploaded) throw new UserFacingError('The uploaded data for this report is missing. Please upload the file again.');
    const { profile, usd: profileUsd } = uploaded ? { profile: uploaded.profile, usd: 0 } : await fetchProfile(handle);
    apifyUsd += profileUsd;
    await log(step, true, t0, { followers: profile.followers, source: row.source });

    step = 'posts';
    t0 = Date.now();
    await stage('posts');
    const custom = Boolean(row.window_start && row.window_end);
    let windowStart: Date;
    let windowEnd: Date;
    if (custom) {
      ({ start: windowStart, end: windowEnd } = zonedRange(row.window_start, row.window_end, row.timezone));
    } else {
      windowEnd = new Date();
      windowStart = new Date(windowEnd);
      windowStart.setUTCMonth(windowStart.getUTCMonth() - row.window_months);
    }
    const { posts, usd: postsUsd, truncated } = uploaded
      ? { posts: uploaded.posts, usd: 0, truncated: false }
      : await fetchPosts(handle, windowStart, windowEnd, custom ? undefined : row.window_months);
    if (truncated) windowStart = new Date(posts[posts.length - 1].timestamp);
    apifyUsd += postsUsd;
    postsCollected = posts.length;
    await log(step, true, t0, { posts: posts.length, usd: postsUsd, truncated, oldest: posts[posts.length - 1].timestamp });

    step = 'images';
    t0 = Date.now();
    await stage('images');
    const thumbs = await loadThumbnails(posts, (done) =>
      void stage('images', progressOf('images') + Math.round((done / posts.length) * 9)),
    );
    imagesAnalysed = thumbs.size;
    await log(step, true, t0, { images: thumbs.size, of: posts.length });

    step = 'categorise';
    t0 = Date.now();
    await stage('categorise');
    const span = progressOf('analyse') - progressOf('categorise');
    const { buckets, unassigned } = await categorisePosts(handle, posts, thumbs, usage, (fraction) =>
      void stage('categorise', progressOf('categorise') + Math.round(fraction * span)),
    );
    thumbs.clear();
    await log(step, true, t0, { buckets: buckets.map((b) => b.name), unassigned });

    step = 'analyse';
    t0 = Date.now();
    await stage('analyse');
    const stats = computeStats({ profile, posts, buckets, timezone: row.timezone, windowStart, windowEnd, months: row.window_months, custom, truncated });
    await log(step, true, t0);

    step = 'write';
    t0 = Date.now();
    await stage('write');
    const narrative = await writeNarrative(profile, stats, usage);
    await log(step, true, t0, narrative.verification);

    step = 'render';
    t0 = Date.now();
    await stage('render');
    const generatedBy = row.created_by_name || 'the InstaReport team';
    const [pdf, xlsx] = await Promise.all([
      buildPdf({ profile, stats, narrative }),
      buildWorkbook({ profile, posts, buckets, stats, generatedBy }),
    ]);
    const pdfPath = `${reportId}/${fileName(handle, 'pdf')}`;
    const xlsxPath = `${reportId}/${fileName(handle, 'xlsx')}`;
    const storage = db.storage.from(REPORTS_BUCKET);
    const [pdfUp, xlsxUp] = await Promise.all([
      storage.upload(pdfPath, pdf, { contentType: 'application/pdf', upsert: true }),
      storage.upload(xlsxPath, xlsx, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      }),
    ]);
    if (pdfUp.error || xlsxUp.error) throw new Error(`file upload failed: ${(pdfUp.error ?? xlsxUp.error)!.message}`);
    await log(step, true, t0, { pdfBytes: pdf.length, xlsxBytes: xlsx.length });

    await update({
      status: 'completed',
      stage: 'done',
      progress: 100,
      profile,
      stats,
      narrative,
      pdf_path: pdfPath,
      xlsx_path: xlsxPath,
      cost: cost(),
      error_message: null,
      completed_at: new Date().toISOString(),
    });
    console.info(`[pipeline] ${handle} done in ${Math.round((Date.now() - started) / 1000)}s, $${cost().totalUsd}`);
  } catch (e) {
    const message =
      e instanceof UserFacingError
        ? e.message
        : 'Something unexpected went wrong while building this report. Please try again; if it keeps failing, send the report link to an admin.';
    console.error(`[pipeline] ${handle} failed at ${step}`, e);
    await log(step, false, t0, { error: e instanceof Error ? e.message : String(e) });
    await update({ status: 'failed', error_message: message, cost: cost() });
  } finally {
    clearInterval(heartbeat);
  }
};
