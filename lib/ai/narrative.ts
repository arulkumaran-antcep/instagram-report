import 'server-only';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { Narrative, Profile, ReportStats } from '@/lib/report-types';
import { MODEL, Usage, claude, explainClaudeError } from '@/lib/ai/client';
import { buildAllowed, bulletText, unsupportedNumbers } from '@/lib/ai/verify';
import { fmtDate } from '@/lib/format';

const Bullet = z.object({ lead: z.string(), text: z.string() });
const NarrativeSchema = z.object({
  headline: z.string(),
  snapshot: z.array(Bullet),
  buckets: z.array(Bullet),
  opportunities: z.array(Bullet),
  trajectory: z.array(Bullet),
  hashtags: z.array(Bullet),
  timing: z.array(Bullet),
  captions: z.array(Bullet),
  collabs: z.array(Bullet),
  recommendations: z.array(z.object({ title: z.string(), detail: z.string() })),
});
type Draft = z.infer<typeof NarrativeSchema>;

const SECTION_KEYS = ['snapshot', 'buckets', 'opportunities', 'trajectory', 'hashtags', 'timing', 'captions', 'collabs'] as const;

const sectionTitle = (key: (typeof SECTION_KEYS)[number], timezone: string) =>
  ({
    snapshot: 'Account snapshot',
    buckets: 'Content buckets',
    opportunities: 'Gaps & opportunities',
    trajectory: 'Trajectory',
    hashtags: 'Hashtag strategy',
    timing: `Timing (${timezone})`,
    captions: 'Hook & caption patterns',
    collabs: 'Collabs & audio',
  })[key];

// Trim the stats to what a writer needs, keeping every figure it may cite.
const factsFor = (profile: Profile, stats: ReportStats) => ({
  profile: {
    username: profile.username,
    fullName: profile.fullName,
    biography: profile.biography,
    followers: profile.followers,
    following: profile.following,
    totalPostsAllTime: profile.totalPosts,
    category: profile.category,
  },
  window: { ...stats.window, start: fmtDate(stats.window.start), end: fmtDate(stats.window.end) },
  overview: stats.overview,
  formats: stats.formats,
  buckets: stats.buckets,
  bucketFormats: stats.bucketFormats,
  months: stats.months,
  halves: stats.halves,
  days: stats.days,
  hoursWithPosts: stats.hours.filter((h) => h.posts > 0),
  timing: stats.timing,
  cadence: stats.cadence,
  hashtags: stats.hashtags,
  captions: stats.captions,
  collabs: stats.collabs,
  audio: stats.audio,
  sponsored: stats.sponsored,
  location: stats.location,
  topPosts: stats.topPosts.map(({ url: _url, ...rest }) => rest),
});

const INSTRUCTIONS = (timezone: string) => `You are a senior social media analyst writing an internal content audit for a marketing team.
Write the report from the DATA below. It must read like a sharp analyst wrote it, not like marketing copy.

Hard rules:
- Every number you state must come from DATA (you may round, e.g. 16085.6 -> 16.1K, 0.2569 -> 26%). Never invent or estimate figures.
- Do not state facts DATA cannot support: no reach, impressions, saves, shares, follower growth, audience demographics or fake-follower claims. If you infer something (e.g. the audience "likely" shares more than it comments), say it is an inference.
- Use medians when averages are distorted by a few viral posts, and say so.
- "Engagement" means likes + comments. Engagement rate = average engagement per post / followers; the usual benchmark is 1-3%.
- "Index" = share of engagement / share of posts (1.0 = average; above 1 over-performs).
- When a group is too small to judge (fewer than ~5 posts), say so instead of drawing a conclusion.
- Times and days are in ${timezone}.
- Plain, direct English in the third person. Never write "I", "my", "we" or "our". No emojis, no hype words ("amazing", "skyrocket"), no exclamation marks.
- Do not do your own arithmetic to create new figures; use the figures already in DATA (e.g. overview.medianEngagementRate).
- Write dates like "28 Jul 2026" or "July 2026", never as 2026-07-28. Refer to hours as "21:00".

Format:
- headline: one sentence (max 30 words) with the single most important finding.
- Each section is a list of bullets. "lead" is a short bold label or claim (2-6 words, e.g. "Posting rate:" or "Carousels win in every bucket."); "text" is 1-3 sentences with the evidence.
- snapshot (5-7 bullets): profile, posting rate and cadence, format mix, engagement baseline (average vs median), engagement rate vs benchmark, comments per 100 likes.
- buckets: one bullet per content bucket, largest first (share of posts, share of engagement, index, median, what it is, standouts). Group tiny buckets into one "Minor:" bullet.
- opportunities (4-6): the biggest gaps between effort and results.
- trajectory (2-4): first half vs second half, monthly shifts, what changed.
- hashtags (1-3), timing (3-5, only hours with at least timing.minSample posts count as best/weak), captions (3-5), collabs (2-4, include audio, sponsored and location tags).
- recommendations (6-8): numbered in priority order; "title" is an imperative action, "detail" cites the numbers that justify it.`;

const toNarrative = (draft: Draft, timezone: string, checked: number, removed: number): Narrative => ({
  headline: draft.headline.trim(),
  sections: SECTION_KEYS.map((key) => ({ key, title: sectionTitle(key, timezone), bullets: draft[key] })).filter(
    (s) => s.bullets.length > 0,
  ),
  recommendations: draft.recommendations,
  verification: { checkedNumbers: checked, removedBullets: removed },
});

const findProblems = (draft: Draft, allowed: ReturnType<typeof buildAllowed>) => {
  const problems: string[] = [];
  for (const key of SECTION_KEYS) {
    draft[key].forEach((b, i) => {
      const bad = unsupportedNumbers(bulletText(b), allowed);
      if (bad.length) problems.push(`${key}[${i}] "${b.lead}": ${bad.join(', ')}`);
    });
  }
  draft.recommendations.forEach((r, i) => {
    const bad = unsupportedNumbers(`${r.title} ${r.detail}`, allowed);
    if (bad.length) problems.push(`recommendations[${i}] "${r.title}": ${bad.join(', ')}`);
  });
  const headBad = unsupportedNumbers(draft.headline, allowed);
  if (headBad.length) problems.push(`headline: ${headBad.join(', ')}`);
  return problems;
};

const countNumbers = (draft: Draft) =>
  JSON.stringify(draft).match(/\d+(?:\.\d+)?/g)?.length ?? 0;

export const writeNarrative = async (profile: Profile, stats: ReportStats, usage: Usage): Promise<Narrative> => {
  const facts = factsFor(profile, stats);
  const allowed = buildAllowed(facts);
  const timezone = stats.window.timezone;
  const dataBlock = `DATA (JSON):\n${JSON.stringify(facts)}`;

  const ask = async (extra: { role: 'assistant' | 'user'; content: string }[] = []) => {
    const response = await claude().messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { format: zodOutputFormat(NarrativeSchema), effort: 'high' },
      messages: [{ role: 'user', content: `${INSTRUCTIONS(timezone)}\n\n${dataBlock}` }, ...extra],
    });
    usage.add(response.usage);
    if (response.stop_reason === 'refusal') throw new Error('the model declined to write this report');
    if (!response.parsed_output) throw new Error('the analysis came back incomplete');
    return response.parsed_output;
  };

  try {
    let draft = await ask();
    let problems = findProblems(draft, allowed);

    if (problems.length) {
      draft = await ask([
        { role: 'assistant', content: JSON.stringify(draft) },
        {
          role: 'user',
          content: `These figures are not in DATA:\n${problems.join('\n')}\n\nReturn the full report again with those statements corrected to use only figures from DATA (or removed). Keep everything else the same.`,
        },
      ]);
      problems = findProblems(draft, allowed);
    }

    // Anything still unsupported is dropped rather than published.
    let removed = 0;
    if (problems.length) {
      for (const key of SECTION_KEYS) {
        const before = draft[key].length;
        draft[key] = draft[key].filter((b) => unsupportedNumbers(bulletText(b), allowed).length === 0);
        removed += before - draft[key].length;
      }
      const before = draft.recommendations.length;
      draft.recommendations = draft.recommendations.filter((r) => unsupportedNumbers(`${r.title} ${r.detail}`, allowed).length === 0);
      removed += before - draft.recommendations.length;
      if (unsupportedNumbers(draft.headline, allowed).length) draft.headline = '';
    }

    return toNarrative(draft, timezone, countNumbers(draft), removed);
  } catch (error) {
    return explainClaudeError(error);
  }
};
