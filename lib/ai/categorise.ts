import 'server-only';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type Anthropic from '@anthropic-ai/sdk';
import type { Bucket, Post } from '@/lib/report-types';
import { MODEL, Usage, claude, explainClaudeError } from '@/lib/ai/client';

const SAMPLE_SIZE = 50;
const BATCH_SIZE = 40;
const CONCURRENCY = 4;

type Block = Anthropic.ContentBlockParam;

const describe = (p: Post, label: string): string => {
  const caption = p.caption.trim().replace(/\s+/g, ' ').slice(0, 220);
  const extras = [p.collaborators.length ? `collab with @${p.collaborators.join(', @')}` : '', p.isSponsored ? 'marked as paid partnership' : '']
    .filter(Boolean)
    .join('; ');
  return `${label} — ${p.format}${extras ? ` (${extras})` : ''}. Caption: ${caption ? `"${caption}"` : '(none)'}`;
};

const postBlocks = (posts: Post[], thumbs: Map<number, string>, label: (p: Post) => string): Block[] =>
  posts.flatMap((p): Block[] => {
    const text: Block = { type: 'text', text: describe(p, label(p)) + (thumbs.has(p.idx) ? '' : ' [image unavailable]') };
    const data = thumbs.get(p.idx);
    return data ? [text, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }] : [text];
  });

// A spread of posts: the top performers plus an even sample across the year,
// so the categories reflect both what the account posts and what works.
const pickSample = (posts: Post[]) => {
  const byEngagement = [...posts].sort((a, b) => b.engagement - a.engagement);
  const top = byEngagement.slice(0, 15);
  const rest = posts.filter((p) => !top.includes(p));
  const step = Math.max(1, rest.length / (SAMPLE_SIZE - top.length));
  const spread: Post[] = [];
  for (let i = 0; i < rest.length && spread.length < SAMPLE_SIZE - top.length; i += step) spread.push(rest[Math.floor(i)]);
  return [...top, ...spread];
};

const BucketsSchema = z.object({
  buckets: z.array(z.object({ name: z.string(), definition: z.string() })),
});

const discoverBuckets = async (username: string, posts: Post[], thumbs: Map<number, string>, usage: Usage): Promise<Bucket[]> => {
  const sample = pickSample(posts);
  const response = await claude().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { format: zodOutputFormat(BucketsSchema), effort: 'medium' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are a social media analyst preparing a content audit of the public Instagram account @${username}.
Below are ${sample.length} of its posts from the analysis window (the account posted ${posts.length} in that window). Each has its format, caption and the first image.

Define the content categories ("buckets") this account posts in, so that every post can later be assigned to exactly one.
- 4 to 8 buckets, based on what the content actually is (theme and style), e.g. "Motivational & Philosophical Quotes", "Bollywood Film Memes", "Product Tutorials".
- Judge from the images as well as the captions; many posts have no caption.
- Names: 2-5 words, Title Case, "&" instead of "and". Definitions: one sentence saying what belongs in the bucket, specific enough to classify by.
- Buckets must not overlap. Only add a small bucket (e.g. brand collaborations, press features) if it is clearly distinct.
- Do not include an "Other" bucket; it is added automatically.`,
          },
          ...postBlocks(sample, thumbs, (p) => `Post (engagement ${p.engagement.toLocaleString('en-US')})`),
        ],
      },
    ],
  });
  usage.add(response.usage);
  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    throw new Error('could not define content categories');
  }
  const buckets = response.parsed_output.buckets.slice(0, 8).map((b, id) => ({ id, name: b.name.trim(), definition: b.definition.trim() }));
  buckets.push({ id: buckets.length, name: 'Other', definition: 'Posts that fit no defined bucket.' });
  return buckets;
};

const AssignSchema = z.object({
  items: z.array(z.object({ post: z.number(), bucket: z.number(), note: z.string() })),
});

const classifyBatch = async (
  batch: Post[],
  buckets: Bucket[],
  thumbs: Map<number, string>,
  usage: Usage,
): Promise<Map<number, { bucket: number; note: string }>> => {
  const numberOf = new Map(batch.map((p, i) => [p.idx, i + 1]));
  const response = await claude().messages.parse({
    model: MODEL,
    max_tokens: 8000,
    output_config: { format: zodOutputFormat(AssignSchema), effort: 'low' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Assign each Instagram post below to exactly one content bucket.

Buckets:
${buckets.map((b) => `${b.id}. ${b.name}: ${b.definition}`).join('\n')}

For every post return: "post" (its number), "bucket" (the bucket number) and "note" (at most 12 words describing what the post shows, e.g. "Bollywood film still with modern dialogue overlay"). Use bucket ${buckets.length - 1} (Other) only when nothing fits. Return all ${batch.length} posts.`,
          },
          ...postBlocks(batch, thumbs, (p) => `Post ${numberOf.get(p.idx)}`),
        ],
      },
    ],
  });
  usage.add(response.usage);
  const out = new Map<number, { bucket: number; note: string }>();
  if (response.stop_reason === 'refusal' || !response.parsed_output) return out;
  for (const item of response.parsed_output.items) {
    const post = batch[item.post - 1];
    if (!post || !buckets.some((b) => b.id === item.bucket)) continue;
    out.set(post.idx, { bucket: item.bucket, note: item.note.trim().slice(0, 120) });
  }
  return out;
};

const runPool = async <T>(tasks: (() => Promise<T>)[], concurrency: number) => {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        results[i] = await tasks[i]();
      }
    }),
  );
  return results;
};

export const categorisePosts = async (
  username: string,
  posts: Post[],
  thumbs: Map<number, string>,
  usage: Usage,
  onProgress?: (fraction: number) => void,
): Promise<{ buckets: Bucket[]; unassigned: number }> => {
  try {
    const buckets = await discoverBuckets(username, posts, thumbs, usage);
    const other = buckets[buckets.length - 1].id;

    const batches: Post[][] = [];
    for (let i = 0; i < posts.length; i += BATCH_SIZE) batches.push(posts.slice(i, i + BATCH_SIZE));
    let finished = 0;
    const assigned = new Map<number, { bucket: number; note: string }>();
    await runPool(
      batches.map((batch) => async () => {
        let result = await classifyBatch(batch, buckets, thumbs, usage);
        const missing = batch.filter((p) => !result.has(p.idx));
        if (missing.length) {
          const retry = await classifyBatch(missing, buckets, thumbs, usage);
          result = new Map([...result, ...retry]);
        }
        result.forEach((v, k) => assigned.set(k, v));
        onProgress?.(++finished / batches.length);
      }),
      CONCURRENCY,
    );

    let unassigned = 0;
    for (const p of posts) {
      const a = assigned.get(p.idx);
      if (a) {
        p.bucketId = a.bucket;
        p.note = a.note;
      } else {
        p.bucketId = other;
        p.note = '';
        unassigned += 1;
      }
    }
    return { buckets, unassigned };
  } catch (error) {
    return explainClaudeError(error);
  }
};
