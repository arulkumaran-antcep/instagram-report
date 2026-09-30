import 'server-only';
import ExcelJS from 'exceljs';
import type { Bucket, Post, Profile, ReportStats } from '@/lib/report-types';
import { fmtDate, fmtHour, fmtMonth } from '@/lib/format';

const BRAND = 'FF6D3BD7';
const HEADER_FILL = 'FFEFE9FB';
const ZEBRA = 'FFF8F7FC';

type Cell = string | number | null | { text: string; hyperlink: string };
type Col = { header: string; width?: number; fmt?: string };

const PCT = '0.0%';
const NUM = '#,##0';
const DEC = '#,##0.0';
const IDX = '0.00';

const styleHeader = (row: ExcelJS.Row) => {
  row.font = { bold: true, color: { argb: 'FF23005C' } };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.height = 22;
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFD0BCFF' } } };
  });
};

// Writes a titled table starting at `row`; returns the next free row.
const table = (ws: ExcelJS.Worksheet, row: number, title: string | null, cols: Col[], rows: Cell[][]) => {
  if (title) {
    const t = ws.getRow(row);
    t.getCell(1).value = title;
    t.font = { bold: true, size: 12, color: { argb: BRAND } };
    row += 1;
  }
  const header = ws.getRow(row);
  cols.forEach((c, i) => (header.getCell(i + 1).value = c.header));
  styleHeader(header);
  row += 1;
  rows.forEach((values, r) => {
    const line = ws.getRow(row);
    values.forEach((v, i) => {
      const cell = line.getCell(i + 1);
      cell.value = v as ExcelJS.CellValue;
      if (cols[i]?.fmt && typeof v === 'number') cell.numFmt = cols[i].fmt!;
      if (v && typeof v === 'object') cell.font = { color: { argb: 'FF4D5BD6' }, underline: true };
      if (r % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
    });
    row += 1;
  });
  if (rows.length === 0) {
    ws.getRow(row).getCell(1).value = 'No data in this window.';
    ws.getRow(row).font = { italic: true, color: { argb: 'FF888888' } };
    row += 1;
  }
  return row + 1;
};

const setWidths = (ws: ExcelJS.Worksheet, widths: number[]) => widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

const tzParts = (timeZone: string) => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return (iso: string) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
  };
};

export const buildWorkbook = async (args: {
  profile: Profile;
  posts: Post[];
  buckets: Bucket[];
  stats: ReportStats;
  generatedBy: string;
}): Promise<Buffer> => {
  const { profile, posts, buckets, stats, generatedBy } = args;
  const tz = stats.window.timezone;
  const local = tzParts(tz);
  const bucketName = new Map(buckets.map((b) => [b.id, b.name]));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'InstaReport';
  wb.created = new Date();
  const sheet = (name: string, freeze = false) =>
    wb.addWorksheet(name, { views: freeze ? [{ state: 'frozen', ySplit: 1 }] : [], properties: { defaultRowHeight: 18 } });

  // All Posts
  const all = sheet('All Posts', true);
  const allCols: Col[] = [
    { header: `Date (${tz})` },
    { header: 'Time' },
    { header: 'URL' },
    { header: 'Format' },
    { header: 'Bucket' },
    { header: 'Likes', fmt: NUM },
    { header: 'Comments', fmt: NUM },
    { header: 'Video Views', fmt: NUM },
    { header: 'Engagement', fmt: NUM },
    { header: 'Hashtags #' },
    { header: 'Collaborators' },
    { header: 'Sponsored' },
    { header: 'Location' },
    { header: 'Audio' },
    { header: 'Caption (start)' },
    { header: 'What the post shows (AI)' },
  ];
  table(
    all,
    1,
    null,
    allCols,
    posts.map((p) => {
      const t = local(p.timestamp);
      return [
        t.date,
        t.time,
        { text: p.url, hyperlink: p.url },
        p.format,
        bucketName.get(p.bucketId ?? -1) ?? 'Other',
        p.likes,
        p.comments,
        p.views,
        p.likes === null ? null : p.engagement,
        p.hashtags.length,
        p.collaborators.join(', '),
        p.isSponsored ? 'Yes' : '',
        p.location ?? '',
        p.audio ? (p.audio.original ? 'Original audio' : [p.audio.artist, p.audio.song].filter(Boolean).join(' — ')) : '',
        p.caption.replace(/\s+/g, ' ').slice(0, 150),
        p.note ?? '',
      ];
    }),
  );
  all.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: allCols.length } };
  setWidths(all, [12, 7, 44, 11, 32, 10, 10, 11, 12, 10, 22, 10, 18, 26, 60, 44]);

  // Bucket Summary
  const bs = sheet('Bucket Summary');
  let r = table(bs, 1, 'Account', [{ header: 'Metric' }, { header: 'Value' }], [
    ['Account', `@${profile.username}`],
    ['Followers', profile.followers],
    ['Window', `${fmtDate(stats.window.start)} – ${fmtDate(stats.window.end)}`],
    ['Posts analysed', stats.overview.posts],
    ['Avg engagement / post', stats.overview.avgEngagement],
    ['Median engagement / post', stats.overview.medianEngagement],
    ['Engagement rate %', stats.overview.engagementRate],
    ['Benchmark', 'Typical Instagram engagement rate is 1-3% of followers'],
  ]);
  table(
    bs,
    r,
    'Content buckets',
    [
      { header: 'Bucket' },
      { header: 'Definition' },
      { header: 'Posts', fmt: NUM },
      { header: '% of Posts', fmt: PCT },
      { header: '% of Engagement', fmt: PCT },
      { header: 'Performance Index', fmt: IDX },
      { header: 'Avg Engagement', fmt: DEC },
      { header: 'Median Engagement', fmt: DEC },
    ],
    stats.buckets.map((b) => [b.name, b.definition, b.posts, b.pctPosts, b.pctEngagement, b.index, b.avg, b.median]),
  );
  setWidths(bs, [38, 70, 10, 12, 16, 18, 16, 18]);

  // Format Analysis
  const fa = sheet('Format Analysis');
  r = table(
    fa,
    1,
    'Formats',
    [
      { header: 'Format' },
      { header: 'Posts', fmt: NUM },
      { header: '% of Posts', fmt: PCT },
      { header: '% of Engagement', fmt: PCT },
      { header: 'Performance Index', fmt: IDX },
      { header: 'Avg Engagement', fmt: DEC },
      { header: 'Median Engagement', fmt: DEC },
    ],
    stats.formats.map((f) => [f.format, f.posts, f.pctPosts, f.pctEngagement, f.index, f.avg, f.median]),
  );
  table(
    fa,
    r,
    'Bucket x Format',
    [{ header: 'Bucket' }, { header: 'Format' }, { header: 'Posts', fmt: NUM }, { header: 'Avg Engagement', fmt: DEC }, { header: 'Median Engagement', fmt: DEC }],
    stats.bucketFormats.map((b) => [b.bucket, b.format, b.posts, b.avg, b.median]),
  );
  setWidths(fa, [38, 14, 12, 16, 18, 16, 18]);

  // Posting Patterns
  const pp = sheet('Posting Patterns');
  r = table(pp, 1, 'Posts per month', [{ header: 'Month' }, { header: 'Posts', fmt: NUM }], stats.months.map((m) => [fmtMonth(m.month), m.posts]));
  r = table(
    pp,
    r,
    `Day of week (${tz})`,
    [{ header: 'Day' }, { header: 'Posts', fmt: NUM }, { header: 'Avg Engagement', fmt: DEC }, { header: 'Median Engagement', fmt: DEC }],
    stats.days.map((d) => [d.day, d.posts, d.avg, d.median]),
  );
  table(
    pp,
    r,
    'Longest gaps between posts',
    [{ header: 'Gap (days)', fmt: NUM }, { header: 'From' }, { header: 'To' }],
    stats.cadence.gaps.map((g) => [g.days, g.from, g.to]),
  );
  setWidths(pp, [22, 12, 16, 18]);

  // Hashtags
  const hs = sheet('Hashtags');
  r = table(
    hs,
    1,
    'Hashtags per post',
    [{ header: 'Hashtag Count' }, { header: 'Posts', fmt: NUM }, { header: 'Avg Engagement', fmt: DEC }, { header: 'Median Engagement', fmt: DEC }],
    stats.hashtags.countBuckets.map((b) => [b.range, b.posts, b.avg, b.median]),
  );
  table(
    hs,
    r,
    'Most used hashtags',
    [{ header: 'Tag' }, { header: 'Posts', fmt: NUM }, { header: 'Avg Engagement', fmt: DEC }, { header: 'Lift (vs account avg)', fmt: IDX }],
    stats.hashtags.tags.map((t) => [t.tag, t.posts, t.avg, t.lift]),
  );
  setWidths(hs, [28, 10, 16, 20]);

  // Timing & Trends
  const tt = sheet('Timing & Trends');
  r = table(
    tt,
    1,
    `Hour of day (${tz})`,
    [{ header: 'Hour' }, { header: 'Posts', fmt: NUM }, { header: 'Avg Engagement', fmt: DEC }, { header: 'Median Engagement', fmt: DEC }],
    stats.hours.map((h) => [fmtHour(h.hour), h.posts, h.avg, h.median]),
  );
  table(
    tt,
    r,
    'Monthly trend',
    [
      { header: 'Month' },
      { header: 'Posts', fmt: NUM },
      { header: 'Avg Engagement', fmt: DEC },
      { header: 'Median Engagement', fmt: DEC },
      { header: 'Carousel Share', fmt: PCT },
      { header: 'Reel/Video Share', fmt: PCT },
    ],
    stats.months.map((m) => [fmtMonth(m.month), m.posts, m.avg, m.median, m.carouselShare, m.reelShare]),
  );
  setWidths(tt, [14, 10, 16, 18, 16, 16]);

  // Caption Craft
  const cc = sheet('Caption Craft');
  r = table(
    cc,
    1,
    'Caption length',
    [{ header: 'Caption Length (chars)' }, { header: 'Posts', fmt: NUM }, { header: 'Avg Engagement', fmt: DEC }, { header: 'Median Engagement', fmt: DEC }],
    stats.captions.lengthBuckets.map((b) => [b.range, b.posts, b.avg, b.median]),
  );
  r = table(
    cc,
    r,
    'Caption features',
    [{ header: 'Feature' }, { header: 'Posts With', fmt: NUM }, { header: 'Avg With', fmt: DEC }, { header: 'Posts Without', fmt: NUM }, { header: 'Avg Without', fmt: DEC }],
    stats.captions.features.map((f) => [f.feature, f.postsWith, f.avgWith, f.postsWithout, f.avgWithout]),
  );
  const hooks = stats.captions.hooks;
  table(
    cc,
    r,
    'First-line hook (captioned posts, by engagement quartile)',
    [{ header: 'Measure' }, { header: 'Top Quartile' }, { header: 'Bottom Quartile' }],
    hooks
      ? [
          ['Avg first line chars', hooks.top.avgFirstLineChars, hooks.bottom.avgFirstLineChars],
          ['Share with a question', hooks.top.pctQuestion, hooks.bottom.pctQuestion],
          ['Share starting with emoji', hooks.top.pctEmojiStart, hooks.bottom.pctEmojiStart],
          ['Share starting with a number', hooks.top.pctNumberStart, hooks.bottom.pctNumberStart],
        ]
      : [],
  );
  setWidths(cc, [34, 14, 16, 16, 16]);

  // Collabs & Audio
  const ca = sheet('Collabs & Audio');
  r = table(
    ca,
    1,
    'Collab vs solo',
    [{ header: 'Type' }, { header: 'Posts', fmt: NUM }, { header: 'Avg Engagement', fmt: DEC }, { header: 'Median Engagement', fmt: DEC }],
    [
      ['Collab / tagged', stats.collabs.collab.posts, stats.collabs.collab.avg, stats.collabs.collab.median],
      ['Solo', stats.collabs.solo.posts, stats.collabs.solo.avg, stats.collabs.solo.median],
    ],
  );
  r = table(
    ca,
    r,
    'Collaborators',
    [{ header: 'Collaborator' }, { header: 'Posts', fmt: NUM }, { header: 'Avg Engagement', fmt: DEC }],
    stats.collabs.collaborators.map((c) => [`@${c.username}`, c.posts, c.avg]),
  );
  r = table(
    ca,
    r,
    'Reel audio',
    [{ header: 'Audio' }, { header: 'Posts', fmt: NUM }, { header: 'Avg Engagement', fmt: DEC }, { header: 'Median Engagement', fmt: DEC }],
    [
      ['Original audio', stats.audio.original.posts, stats.audio.original.avg, stats.audio.original.median],
      ['Licensed audio', stats.audio.licensed.posts, stats.audio.licensed.avg, stats.audio.licensed.median],
      ['(no music info)', stats.audio.unknown, null, null],
    ],
  );
  r = table(
    ca,
    r,
    'Licensed tracks',
    [{ header: 'Artist' }, { header: 'Song' }, { header: 'Posts', fmt: NUM }, { header: 'Avg Engagement', fmt: DEC }],
    stats.audio.tracks.map((t) => [t.artist, t.song, t.posts, t.avg]),
  );
  r = table(
    ca,
    r,
    'Sponsored vs organic',
    [{ header: 'Type' }, { header: 'Posts', fmt: NUM }, { header: 'Avg Engagement', fmt: DEC }],
    [
      ['Sponsored', stats.sponsored.sponsored.posts, stats.sponsored.sponsored.avg],
      ['Organic', stats.sponsored.organic.posts, stats.sponsored.organic.avg],
    ],
  );
  table(
    ca,
    r,
    'Location tagging',
    [{ header: 'Type' }, { header: 'Posts', fmt: NUM }, { header: 'Avg Engagement', fmt: DEC }],
    [
      ['Tagged', stats.location.tagged.posts, stats.location.tagged.avg],
      ['Untagged', stats.location.untagged.posts, stats.location.untagged.avg],
    ],
  );
  setWidths(ca, [36, 40, 10, 16, 18]);

  // About
  const ab = sheet('About');
  table(ab, 1, 'About this workbook', [{ header: 'Item' }, { header: 'Detail' }], [
    ['Account', `@${profile.username}${profile.fullName ? ` (${profile.fullName})` : ''}`],
    ['Window', `${fmtDate(stats.window.start)} – ${fmtDate(stats.window.end)} (${stats.window.days} days, ${stats.overview.posts} posts${stats.window.truncated ? ', capped at the collection limit' : ''})`],
    ['Timezone', tz],
    ['Generated', `${fmtDate(new Date().toISOString())} by ${generatedBy}`],
    ['Engagement', 'Likes + comments per post. Posts with hidden like counts are excluded from averages.'],
    ['Engagement rate', 'Average engagement per post / followers x 100.'],
    ['Performance index', 'Share of engagement / share of posts. 1.00 = average; above 1 over-performs.'],
    ['Buckets', 'Content categories assigned by AI from each post image and caption. Spot-check before quoting.'],
    ['Data source', 'Publicly visible Instagram data, collected without logging in. No private accounts, no commenter data.'],
    ['Not included', 'Reach, impressions, saves, shares and audience demographics are not public and are not estimated.'],
    ['Use', 'Internal use only. Do not share outside the company without approval.'],
  ]);
  setWidths(ab, [22, 100]);

  return Buffer.from(await wb.xlsx.writeBuffer());
};
