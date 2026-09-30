import 'server-only';
import sharp from 'sharp';
import type { Post } from '@/lib/report-types';
import { isInstagramImageUrl } from '@/lib/instagram/normalize';

// Post images are fetched into memory, shrunk to a small thumbnail (cheap for
// the model, still legible for text-on-image posts) and never written to disk
// or storage.
const WIDTH = 384;
const CONCURRENCY = 16;
const TIMEOUT_MS = 15_000;

const thumbnail = async (url: string): Promise<string | null> => {
  if (!isInstagramImageUrl(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'error' });
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const out = await sharp(input)
      .resize({ width: WIDTH, height: 480, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
    return out.toString('base64');
  } catch {
    return null;
  }
};

export const loadThumbnails = async (posts: Post[], onProgress?: (done: number) => void) => {
  const result = new Map<number, string>();
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < posts.length) {
      const post = posts[next++];
      if (post.imageUrl) {
        const data = await thumbnail(post.imageUrl);
        if (data) result.set(post.idx, data);
      }
      done += 1;
      if (done % 50 === 0) onProgress?.(done);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return result;
};
