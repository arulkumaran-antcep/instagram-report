import type { Bucket, Format, GroupStat, Post, Profile, ReportStats, ShareRow } from '@/lib/report-types';
import { FORMATS } from '@/lib/report-types';

// Deterministic metrics. Every number in the report comes from here; the AI
// only writes prose about these figures.

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const DAY_MS = 86_400_000;

const round = (n: number, digits = 1) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

export const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

// Posts whose like count is hidden can't be compared fairly, so they are
// counted as posts but left out of engagement averages.
const countable = (posts: Post[]) => posts.filter((p) => p.likes !== null);

const groupStat = (posts: Post[]): GroupStat => {
  const eng = countable(posts).map((p) => p.engagement);
  return { posts: posts.length, avg: round(mean(eng)), median: round(median(eng)) };
};

const sumEngagement = (posts: Post[]) => countable(posts).reduce((s, p) => s + p.engagement, 0);

type Local = { date: string; month: string; hour: number; weekday: number };

const makeLocalizer = (timeZone: string) => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  return (iso: string): Local => {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      month: `${parts.year}-${parts.month}`,
      hour: Number(parts.hour) % 24,
      weekday: WEEKDAY_INDEX[parts.weekday],
    };
  };
};

const groupBy = <K>(posts: Post[], key: (p: Post) => K) => {
  const map = new Map<K, Post[]>();
  for (const p of posts) {
    const k = key(p);
    const list = map.get(k);
    if (list) list.push(p);
    else map.set(k, [p]);
  }
  return map;
};

const shareRow = (group: Post[], total: number, totalEng: number, accountMedian: number): ShareRow => {
  const stat = groupStat(group);
  const pctPosts = group.length / total;
  const pctEngagement = totalEng ? sumEngagement(group) / totalEng : 0;
  return {
    ...stat,
    pctPosts: round(pctPosts, 4),
    pctEngagement: round(pctEngagement, 4),
    index: pctPosts ? round(pctEngagement / pctPosts, 2) : 0,
    medianMultiple: accountMedian ? round(stat.median / accountMedian, 1) : 0,
  };
};

const monthsBetween = (startMonth: string, endMonth: string) => {
  const out: string[] = [];
  let [y, m] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
};

const EMOJI = /\p{Extended_Pictographic}/u;
const CTA = /\b(link in (my )?bio|comment|save (this|it)|share (this|with)|tag (a|your)|follow (for|me)|dm me|click|shop now|swipe|subscribe|sign up|register)\b/i;

const hookProfile = (posts: Post[]) => {
  const lines = posts.map((p) => p.caption.split('\n')[0].trim());
  const pct = (test: (l: string) => boolean) => round(lines.filter(test).length / lines.length, 2);
  return {
    avgFirstLineChars: round(mean(lines.map((l) => l.length))),
    pctQuestion: pct((l) => l.includes('?')),
    pctEmojiStart: pct((l) => EMOJI.test(l.slice(0, 2))),
    pctNumberStart: pct((l) => /^\d/.test(l)),
  };
};

export interface StatsInput {
  profile: Profile;
  posts: Post[];
  buckets: Bucket[];
  timezone: string;
  windowStart: Date;
  windowEnd: Date;
  months: number;
  custom?: boolean;
  truncated?: boolean;
}

export const computeStats = ({ profile, posts, buckets, timezone, windowStart, windowEnd, months, custom = false, truncated = false }: StatsInput): ReportStats => {
  const local = makeLocalizer(timezone);
  const localOf = new Map(posts.map((p) => [p.id, local(p.timestamp)]));
  const L = (p: Post) => localOf.get(p.id)!;

  const N = posts.length;
  const counted = countable(posts);
  const totalEng = sumEngagement(posts);
  const account = groupStat(posts);
  const days = Math.max(1, (windowEnd.getTime() - windowStart.getTime()) / DAY_MS);

  const likeRatios = counted.filter((p) => (p.likes ?? 0) > 0).map((p) => (p.comments / (p.likes as number)) * 100);

  // Formats and content buckets
  const byFormat = groupBy(posts, (p) => p.format);
  const formats = FORMATS.filter((f) => byFormat.has(f)).map((format) => ({
    format,
    ...shareRow(byFormat.get(format)!, N, totalEng, account.median),
  }));

  const byBucket = groupBy(posts, (p) => p.bucketId ?? -1);
  const bucketRows = buckets
    .filter((b) => byBucket.has(b.id))
    .map((b) => ({ id: b.id, name: b.name, definition: b.definition, ...shareRow(byBucket.get(b.id)!, N, totalEng, account.median) }))
    .sort((a, b) => b.posts - a.posts);
  const bucketName = new Map(buckets.map((b) => [b.id, b.name]));

  const bucketFormats: ReportStats['bucketFormats'] = [];
  for (const row of bucketRows) {
    const group = byBucket.get(row.id)!;
    for (const [format, list] of [...groupBy(group, (p) => p.format)].sort((a, b) => b[1].length - a[1].length)) {
      bucketFormats.push({ bucket: row.name, format: format as Format, ...groupStat(list) });
    }
  }

  // Months, including empty ones so gaps are visible
  const byMonth = groupBy(posts, (p) => L(p).month);
  const monthRows = monthsBetween(local(windowStart.toISOString()).month, local(windowEnd.toISOString()).month).map((month) => {
    const list = byMonth.get(month) ?? [];
    const stat = groupStat(list);
    return {
      month,
      ...stat,
      carouselShare: list.length ? round(list.filter((p) => p.format === 'Carousel').length / list.length, 2) : 0,
      reelShare: list.length ? round(list.filter((p) => p.format === 'Reel/Video').length / list.length, 2) : 0,
    };
  });

  // First vs second half of the window
  const midpoint = windowStart.getTime() + (windowEnd.getTime() - windowStart.getTime()) / 2;
  const firstHalf = posts.filter((p) => new Date(p.timestamp).getTime() < midpoint);
  const secondHalf = posts.filter((p) => new Date(p.timestamp).getTime() >= midpoint);
  const first = groupStat(firstHalf);
  const second = groupStat(secondHalf);
  const midIso = new Date(midpoint).toISOString();

  // Days and hours in the report timezone
  const byDay = groupBy(posts, (p) => L(p).weekday);
  const dayRows = DAYS.map((day, i) => ({ day, ...groupStat(byDay.get(i) ?? []) }));
  const byHour = groupBy(posts, (p) => L(p).hour);
  const hourRows = Array.from({ length: 24 }, (_, hour) => ({ hour, ...groupStat(byHour.get(hour) ?? []) }));
  const minSample = Math.max(5, Math.round(N / 32));
  const eligibleHours = hourRows.filter((h) => h.posts >= minSample).sort((a, b) => b.median - a.median);
  const mostCommonHour = [...hourRows].sort((a, b) => b.posts - a.posts)[0] ?? null;

  // Cadence
  const chronological = [...posts].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const gaps: ReportStats['cadence']['gaps'] = [];
  for (let i = 1; i < chronological.length; i++) {
    const gapDays = Math.floor((Date.parse(chronological[i].timestamp) - Date.parse(chronological[i - 1].timestamp)) / DAY_MS);
    if (gapDays >= 5) gaps.push({ days: gapDays, from: L(chronological[i - 1]).date, to: L(chronological[i]).date });
  }
  gaps.sort((a, b) => b.days - a.days);
  const perDate = groupBy(posts, (p) => L(p).date);
  const busiest = [...perDate].sort((a, b) => b[1].length - a[1].length)[0];

  // Hashtags
  const tagBuckets: [string, (n: number) => boolean][] = [
    ['0', (n) => n === 0],
    ['1-5', (n) => n >= 1 && n <= 5],
    ['6-10', (n) => n >= 6 && n <= 10],
    ['11-20', (n) => n >= 11 && n <= 20],
    ['21+', (n) => n >= 21],
  ];
  const tagCounts = new Map<string, Post[]>();
  for (const p of posts) for (const t of new Set(p.hashtags)) tagCounts.set(t, [...(tagCounts.get(t) ?? []), p]);
  const minTagPosts = N >= 200 ? 3 : 2;

  // Captions
  const captioned = posts.filter((p) => p.caption.trim().length > 0);
  const lengthBuckets: [string, (n: number) => boolean][] = [
    ['0', (n) => n === 0],
    ['1-100', (n) => n >= 1 && n <= 100],
    ['101-300', (n) => n >= 101 && n <= 300],
    ['301-800', (n) => n >= 301 && n <= 800],
    ['800+', (n) => n > 800],
  ];
  const feature = (name: string, test: (p: Post) => boolean) => {
    const withF = posts.filter(test);
    const without = posts.filter((p) => !test(p));
    return {
      feature: name,
      postsWith: withF.length,
      avgWith: groupStat(withF).avg,
      postsWithout: without.length,
      avgWithout: groupStat(without).avg,
    };
  };
  const rankedCaptioned = countable(captioned).sort((a, b) => b.engagement - a.engagement);
  const quartile = Math.floor(rankedCaptioned.length / 4);

  // Collabs, audio, sponsorship, location
  const collabPosts = posts.filter((p) => p.collaborators.length > 0);
  const soloPosts = posts.filter((p) => p.collaborators.length === 0);
  const collabStat = groupStat(collabPosts);
  const soloStat = groupStat(soloPosts);
  const collaboratorMap = new Map<string, Post[]>();
  for (const p of collabPosts) for (const u of p.collaborators) collaboratorMap.set(u, [...(collaboratorMap.get(u) ?? []), p]);

  const reels = posts.filter((p) => p.format === 'Reel/Video');
  const licensed = reels.filter((p) => p.audio && !p.audio.original);
  const trackMap = groupBy(licensed, (p) => `${p.audio!.artist ?? 'Unknown'}|||${p.audio!.song ?? 'Unknown'}`);
  const located = posts.filter((p) => p.location);

  return {
    window: {
      start: windowStart.toISOString(),
      end: windowEnd.toISOString(),
      months,
      timezone,
      days: Math.round(days),
      custom,
      truncated,
    },
    overview: {
      posts: N,
      avgEngagement: account.avg,
      medianEngagement: account.median,
      engagementRate: profile.followers ? round((account.avg / profile.followers) * 100, 2) : 0,
      medianEngagementRate: profile.followers ? round((account.median / profile.followers) * 100, 2) : 0,
      postsPerWeek: round(N / (days / 7)),
      hiddenLikePosts: N - counted.length,
      commentsPer100LikesMedian: round(median(likeRatios), 2),
      captionlessShare: round((N - captioned.length) / N, 2),
      avgLikes: round(mean(counted.map((p) => p.likes as number))),
      avgComments: round(mean(posts.map((p) => p.comments))),
    },
    formats,
    buckets: bucketRows,
    bucketFormats,
    months: monthRows,
    halves: {
      first: { ...first, from: windowStart.toISOString(), to: midIso },
      second: { ...second, from: midIso, to: windowEnd.toISOString() },
      avgChangePct: first.avg ? round(((second.avg - first.avg) / first.avg) * 100) : 0,
    },
    days: dayRows,
    hours: hourRows,
    timing: {
      minSample,
      bestHours: eligibleHours.slice(0, 4),
      weakHours: eligibleHours.length > 4 ? eligibleHours.slice(-3).reverse() : [],
      mostCommonHour,
    },
    cadence: {
      gaps: gaps.slice(0, 8),
      busiestDay: busiest ? { date: busiest[0], posts: busiest[1].length } : null,
      daysWith5Plus: [...perDate.values()].filter((l) => l.length >= 5).length,
      activeDays: perDate.size,
    },
    hashtags: {
      postsWithout: posts.filter((p) => p.hashtags.length === 0).length,
      postsWith: posts.filter((p) => p.hashtags.length > 0).length,
      countBuckets: tagBuckets
        .map(([range, test]) => ({ range, ...groupStat(posts.filter((p) => test(p.hashtags.length))) }))
        .filter((b) => b.posts > 0),
      tags: [...tagCounts]
        .filter(([, list]) => list.length >= minTagPosts)
        .map(([tag, list]) => {
          const avg = groupStat(list).avg;
          return { tag: `#${tag}`, posts: list.length, avg, lift: account.avg ? round(avg / account.avg, 2) : 0 };
        })
        .sort((a, b) => b.posts - a.posts)
        .slice(0, 15),
    },
    captions: {
      captioned: groupStat(captioned),
      uncaptioned: groupStat(posts.filter((p) => !p.caption.trim())),
      lengthBuckets: lengthBuckets
        .map(([range, test]) => ({ range, ...groupStat(posts.filter((p) => test(p.caption.trim().length))) }))
        .filter((b) => b.posts > 0),
      features: [
        feature('Emoji', (p) => EMOJI.test(p.caption)),
        feature('Question', (p) => p.caption.includes('?')),
        feature('Call to action', (p) => CTA.test(p.caption)),
        feature('Mentions (@)', (p) => /@[\w.]+/.test(p.caption)),
      ],
      hooks:
        quartile >= 2
          ? { top: hookProfile(rankedCaptioned.slice(0, quartile)), bottom: hookProfile(rankedCaptioned.slice(-quartile)) }
          : null,
      topCaptions: rankedCaptioned.slice(0, 8).map((p) => ({ caption: p.caption.split('\n')[0].slice(0, 90), engagement: p.engagement })),
    },
    collabs: {
      collab: collabStat,
      solo: soloStat,
      medianMultiple: soloStat.median ? round(collabStat.median / soloStat.median, 1) : 0,
      collaborators: [...collaboratorMap]
        .map(([username, list]) => ({ username, posts: list.length, avg: groupStat(list).avg }))
        .sort((a, b) => b.posts - a.posts || b.avg - a.avg)
        .slice(0, 10),
    },
    audio: {
      reels: reels.length,
      original: groupStat(reels.filter((p) => p.audio?.original)),
      licensed: groupStat(licensed),
      unknown: reels.filter((p) => !p.audio).length,
      tracks: [...trackMap]
        .map(([key, list]) => {
          const [artist, song] = key.split('|||');
          return { artist, song, posts: list.length, avg: groupStat(list).avg };
        })
        .sort((a, b) => b.posts - a.posts || b.avg - a.avg)
        .slice(0, 10),
    },
    sponsored: {
      sponsored: groupStat(posts.filter((p) => p.isSponsored)),
      organic: groupStat(posts.filter((p) => !p.isSponsored)),
    },
    location: {
      tagged: groupStat(located),
      untagged: groupStat(posts.filter((p) => !p.location)),
      top: [...groupBy(located, (p) => p.location!)]
        .map(([name, list]) => ({ name, posts: list.length }))
        .sort((a, b) => b.posts - a.posts)
        .slice(0, 5),
    },
    topPosts: [...counted]
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 10)
      .map((p) => ({
        url: p.url,
        date: L(p).date,
        format: p.format,
        bucket: bucketName.get(p.bucketId ?? -1) ?? 'Other',
        likes: p.likes,
        comments: p.comments,
        engagement: p.engagement,
        caption: p.caption.split('\n')[0].slice(0, 120),
        note: p.note ?? '',
      })),
  };
};

export const localHourFor = (iso: string, timeZone: string) => makeLocalizer(timeZone)(iso);
