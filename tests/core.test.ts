// Regression tests for the parts that decide what a report says.
// Run: npm test
import { computeStats } from '@/lib/analysis/stats';
import { zonedDayStart, zonedRange, addDays } from '@/lib/dates';
import { customRangeProblem, monthsBetween, parseHandle } from '@/lib/handle';
import { buildAllowed, unsupportedNumbers } from '@/lib/ai/verify';
import type { Post, Profile } from '@/lib/report-types';

let pass = 0;
let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else fail++;
  console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : `\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`);
};
const near = (name: string, got: number, want: number, tol = 0.01) => {
  const ok = Math.abs(got - want) <= tol;
  if (ok) pass++;
  else fail++;
  console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : `\n     got ${got} want ${want}`);
};
const iso = (d: Date) => d.toISOString();

// ---- Dates ----
eq('IST 1 Jan starts 18:30Z previous day', iso(zonedDayStart('2026-01-01', 'Asia/Kolkata')), '2025-12-31T18:30:00.000Z');
eq('New York winter', iso(zonedDayStart('2026-01-15', 'America/New_York')), '2026-01-15T05:00:00.000Z');
eq('New York summer', iso(zonedDayStart('2026-07-15', 'America/New_York')), '2026-07-15T04:00:00.000Z');
eq('New York DST start day', iso(zonedDayStart('2026-03-08', 'America/New_York')), '2026-03-08T05:00:00.000Z');
eq('Sydney summer', iso(zonedDayStart('2026-01-01', 'Australia/Sydney')), '2025-12-31T13:00:00.000Z');
const r = zonedRange('2026-01-01', '2026-03-31', 'Asia/Kolkata');
eq('range end is the last ms of the last day', iso(r.end), '2026-03-31T18:29:59.999Z');
eq('addDays over year end', addDays('2025-12-31', 1), '2026-01-01');

// ---- Range validation (today = 29 Sep 2026) ----
const today = new Date('2026-09-29T12:00:00Z');
eq('valid range', customRangeProblem('2026-06-01', '2026-08-31', today), null);
eq('exactly 7 days ok', customRangeProblem('2026-09-01', '2026-09-07', today), null);
eq('6 days rejected', customRangeProblem('2026-09-01', '2026-09-06', today), 'Choose a range of at least 7 days.');
eq('end before start rejected', customRangeProblem('2026-09-10', '2026-09-01', today), 'The end date must be after the start date.');
eq('future end rejected', customRangeProblem('2026-09-01', '2026-10-05', today), 'The end date can’t be in the future.');
eq('older than 24 months rejected', customRangeProblem('2024-08-01', '2024-12-01', today), 'The start date can be at most 24 months ago.');
eq('garbage rejected', customRangeProblem('yesterday', 'today', today), 'Choose a start and an end date.');
eq('months between', monthsBetween('2026-01-01', '2026-03-31'), 3);

// ---- Handles ----
eq('handle plain', parseHandle('NatGeo'), 'natgeo');
eq('handle @', parseHandle('@natgeo'), 'natgeo');
eq('handle url', parseHandle('https://www.instagram.com/natgeo/?hl=en'), 'natgeo');
eq('handle with dot/underscore', parseHandle('a.b_c'), 'a.b_c');
eq('handle too long', parseHandle('a'.repeat(31)), null);
eq('handle with space', parseHandle('a b'), null);
eq('handle injection', parseHandle("x'; drop table"), null);

// ---- Metrics engine on a hand-checkable account ----
const profile: Profile = {
  username: 'test',
  fullName: 'Test',
  biography: '',
  followers: 1000,
  following: 1,
  totalPosts: 5,
  isVerified: false,
  isBusiness: false,
  category: null,
  externalUrl: null,
};
const mk = (idx: number, format: Post['format'], likes: number | null, comments: number, ts: string, bucketId: number, extra: Partial<Post> = {}): Post => ({
  idx,
  id: String(idx),
  url: `https://www.instagram.com/p/x${idx}/`,
  timestamp: ts,
  format,
  likes,
  comments,
  views: null,
  engagement: (likes ?? 0) + comments,
  caption: '',
  hashtags: [],
  collaborators: [],
  isSponsored: false,
  location: null,
  audio: null,
  isPinned: false,
  imageUrl: null,
  bucketId,
  ...extra,
});
const posts: Post[] = [
  mk(0, 'Image', 100, 0, '2026-01-05T04:00:00Z', 0),
  mk(1, 'Image', 200, 0, '2026-01-06T04:00:00Z', 0),
  mk(2, 'Image', 300, 0, '2026-01-07T04:00:00Z', 0),
  mk(3, 'Carousel', 1000, 100, '2026-01-08T18:30:00Z', 1, { collaborators: ['friend'] }), // 00:00 IST on 9 Jan (a Friday)
  mk(4, 'Carousel', 2000, 0, '2026-02-20T10:00:00Z', 1),
];
const buckets = [
  { id: 0, name: 'Singles', definition: 'x' },
  { id: 1, name: 'Series', definition: 'y' },
];
const base = {
  profile,
  posts,
  buckets,
  timezone: 'Asia/Kolkata',
  windowStart: new Date('2026-01-01T00:00:00Z'),
  windowEnd: new Date('2026-03-02T00:00:00Z'),
  months: 2,
};
const st = computeStats(base);
const o = st.overview;

eq('post count', o.posts, 5);
eq('average engagement', o.avgEngagement, 740);
eq('median engagement', o.medianEngagement, 300);
eq('engagement rate = avg / followers', o.engagementRate, 74);
eq('median engagement rate', o.medianEngagementRate, 30);
const img = st.formats.find((f) => f.format === 'Image')!;
const car = st.formats.find((f) => f.format === 'Carousel')!;
eq('image share of posts', img.pctPosts, 0.6);
near('image share of engagement (600/3700)', img.pctEngagement, 0.1622, 0.0005);
near('image performance index', img.index, 0.27, 0.005);
near('carousel performance index', car.index, 2.09, 0.005);
eq('carousel median', car.median, 1550);
eq('bucket count', st.buckets.length, 2);
eq('hour 00 in IST holds the 18:30Z post', st.hours[0].posts, 1);
eq('UTC hour 18 is empty when reporting in IST', st.hours[18].posts, 0);
eq('Friday holds both Fridays, including the one that is Thursday in UTC', st.days.find((d) => d.day === 'Friday')!.posts, 2);
eq('Thursday holds none', st.days.find((d) => d.day === 'Thursday')!.posts, 0);
eq('one long gap found', st.cadence.gaps.length, 1);
eq('gap length in days', st.cadence.gaps[0].days, 42);
eq('gap starts on the IST date', st.cadence.gaps[0].from, '2026-01-09');
eq('collab post count', st.collabs.collab.posts, 1);
eq('no hashtags anywhere', st.hashtags.postsWithout, 5);
eq('first half average', st.halves.first.avg, 425);
eq('second half average', st.halves.second.avg, 2000);
near('half-over-half change %', st.halves.avgChangePct, 370.6, 0.2);
eq('months listed (Jan, Feb, Mar)', st.months.map((m) => m.month), ['2026-01', '2026-02', '2026-03']);
eq('empty month has zero posts', st.months[2].posts, 0);

// Hidden like counts must not skew averages
const hidden = computeStats({ ...base, posts: [...posts, mk(5, 'Image', null, 5, '2026-01-10T04:00:00Z', 0)] });
eq('hidden-like post is counted', hidden.overview.posts, 6);
eq('hidden-like post flagged', hidden.overview.hiddenLikePosts, 1);
eq('hidden-like post excluded from average', hidden.overview.avgEngagement, 740);

// Same instants, different timezone -> different hour/day (proves the timezone is applied)
const utc = computeStats({ ...base, timezone: 'UTC' });
eq('UTC puts that post at hour 18', utc.hours[18].posts, 1);
eq('UTC puts that post on Thursday', utc.days.find((d) => d.day === 'Thursday')!.posts, 1);

// ---- Figure checker: what the AI writes must exist in the facts ----
const facts = {
  overview: { avgEngagement: 4767.7, engagementRate: 1.34, posts: 625, medianEngagementRate: 0.28 },
  share: { pctPosts: 0.1584, pctEngagement: 0.5476 },
};
const allowed = buildAllowed(facts);
eq('accepts a real count', unsupportedNumbers('The account posted 625 times.', allowed), []);
eq('accepts a rounded figure', unsupportedNumbers('Average engagement is 4.8K per post.', allowed), []);
eq('accepts a real rate', unsupportedNumbers('The rate is 1.34%.', allowed), []);
eq('accepts a share as a percentage', unsupportedNumbers('Carousels earn 55% of engagement from 16% of posts.', allowed), []);
eq('rejects an invented count', unsupportedNumbers('It posted 900 times.', allowed), ['900']);
eq('rejects an invented rate', unsupportedNumbers('The rate is 2.7%.', allowed), ['2.7%']);
eq('rejects an invented thousand figure', unsupportedNumbers('Engagement reached 25K.', allowed), ['25K']);
eq('ignores dates and times', unsupportedNumbers('On 2026-07-05 at 21:00 in 2026.', allowed), []);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
