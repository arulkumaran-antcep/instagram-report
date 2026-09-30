import type { Format, Post } from '@/lib/report-types';

// Live scraper items are typed JSON; items read back from an Excel/CSV export
// carry the same fields as text ("true", "1234"), so every read goes through
// these helpers.
const flag = (v: unknown) => v === true || (typeof v === 'string' && v.trim().toLowerCase() === 'true');
const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};

// Uploaded files are untrusted, so only Instagram's own image CDN is fetched.
export const isInstagramImageUrl = (value: string) => {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.port && /(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(u.hostname);
  } catch {
    return false;
  }
};

const toFormat = (item: Record<string, any>): Format => {
  if (item.type === 'Sidecar') return 'Carousel';
  if (item.type === 'Video' || item.productType === 'clips') return 'Reel/Video';
  return 'Image';
};

const usernames = (list: unknown, owner: string): string[] =>
  Array.isArray(list)
    ? list
        .map((u) => (typeof u?.username === 'string' ? u.username.toLowerCase() : null))
        .filter((u): u is string => !!u && u !== owner)
    : [];

// Scraped values end up as clickable links, so only accept Instagram URLs.
const safePostUrl = (item: Record<string, any>) => {
  if (typeof item.url === 'string' && /^https:\/\/www\.instagram\.com\/(p|reel|tv)\/[\w-]+\/?$/.test(item.url)) return item.url;
  const code = typeof item.shortCode === 'string' && /^[\w-]+$/.test(item.shortCode) ? item.shortCode : null;
  return code ? `https://www.instagram.com/p/${code}/` : 'https://www.instagram.com/';
};

// Maps raw scraper items to our Post shape, keeping only the audited
// account's own public data.
export const normalizePosts = (items: Record<string, any>[], username: string, windowStart: Date, windowEnd = new Date()): Post[] => {
  const seen = new Set<string>();
  const posts: Post[] = [];

  for (const item of items) {
    if (item.error || !item.id || !item.timestamp) continue;
    const id = String(item.id);
    if (seen.has(id)) continue;
    const time = new Date(item.timestamp);
    if (Number.isNaN(time.getTime()) || time < windowStart || time > windowEnd) continue; // e.g. old pinned posts
    seen.add(id);

    const format = toFormat(item);
    const rawLikes = num(item.likesCount);
    const likes = rawLikes !== null && rawLikes >= 0 ? rawLikes : null;
    const comments = Math.max(0, num(item.commentsCount) ?? 0);
    const music = item.musicInfo;
    const original = flag(music?.uses_original_audio);

    // Deliberately not copied: latestComments / firstComment (other people's
    // data) and media download URLs.
    posts.push({
      idx: 0,
      id,
      url: safePostUrl(item),
      timestamp: time.toISOString(),
      format,
      likes,
      comments,
      views: format === 'Reel/Video' ? num(item.videoPlayCount) || num(item.videoViewCount) || null : null,
      engagement: (likes ?? 0) + comments,
      caption: typeof item.caption === 'string' ? item.caption : '',
      hashtags: Array.isArray(item.hashtags) ? item.hashtags.filter((h: unknown) => typeof h === 'string').map((h: string) => h.toLowerCase()) : [],
      collaborators: [...new Set([...usernames(item.coauthorProducers, username), ...usernames(item.taggedUsers, username)])],
      isSponsored: flag(item.paidPartnership) || flag(item.isSponsored),
      location: item.locationName || null,
      audio:
        format === 'Reel/Video' && music
          ? {
              original,
              artist: original ? null : music.artist_name || null,
              song: original ? null : music.song_name || null,
            }
          : null,
      isPinned: flag(item.isPinned),
      imageUrl: item.displayUrl || null,
    });
  }

  posts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  posts.forEach((p, i) => (p.idx = i));
  return posts;
};
