import 'server-only';
import { ApifyClient } from 'apify-client';
import { env } from '@/lib/env';
import type { Format, Post, Profile } from '@/lib/report-types';

import { UserFacingError } from '@/lib/errors';
export { UserFacingError };

const MAX_POSTS = 1200;
const RUN_TIMEOUT_SECONDS = 900;

let client: ApifyClient | null = null;
const apify = () => (client ??= new ApifyClient({ token: env.apifyToken }));

const explainApifyError = (error: unknown): never => {
  const message = error instanceof Error ? error.message : String(error);
  if (/usage|limit|credit|insufficient|payment/i.test(message)) {
    throw new UserFacingError(
      'The Apify account has run out of monthly credit. An admin needs to top it up in the Apify console, then try again.',
    );
  }
  if (/token|unauthori[sz]ed|401/i.test(message)) {
    throw new UserFacingError('The Apify API token is invalid. An admin needs to update APIFY_API_TOKEN.');
  }
  throw new UserFacingError(`Instagram data collection failed: ${message}`);
};

// Runs the actor, reads its dataset, then deletes the dataset so no scraped
// data (including commenters' usernames) is retained on Apify.
const runActor = async (input: Record<string, unknown>) => {
  try {
    const run = await apify().actor(env.apifyActorId).call(input, { timeout: RUN_TIMEOUT_SECONDS, log: null });
    if (run.status !== 'SUCCEEDED') {
      throw new Error(`scraper run ${run.status?.toLowerCase() ?? 'failed'}`);
    }
    const { items } = await apify().dataset(run.defaultDatasetId).listItems();
    await apify()
      .dataset(run.defaultDatasetId)
      .delete()
      .catch(() => undefined);
    return { items: items as Record<string, any>[], usd: Number(run.usageTotalUsd ?? 0) };
  } catch (error) {
    if (error instanceof UserFacingError) throw error;
    return explainApifyError(error);
  }
};

const assertUsable = (item: Record<string, any> | undefined, username: string) => {
  if (!item) throw new UserFacingError(`@${username} could not be found on Instagram.`);
  if (item.error) {
    const text = `${item.error} ${item.errorDescription ?? ''}`.toLowerCase();
    if (text.includes('private')) throw privateError(username);
    throw new UserFacingError(`@${username} could not be found on Instagram. Check the spelling and try again.`);
  }
  if (item.private) throw privateError(username);
};

const privateError = (username: string) =>
  new UserFacingError(
    `@${username} is a private account. InstaReport only analyses public accounts, so no data was collected.`,
  );

export const fetchProfile = async (username: string): Promise<{ profile: Profile; usd: number }> => {
  const { items, usd } = await runActor({
    directUrls: [`https://www.instagram.com/${username}/`],
    resultsType: 'details',
    resultsLimit: 1,
    searchType: 'user',
  });
  const d = items[0];
  assertUsable(d, username);

  const externalUrl =
    d.externalUrl || (Array.isArray(d.externalUrls) && d.externalUrls[0]?.url) || null;

  return {
    usd,
    profile: {
      username: d.username || username,
      fullName: d.fullName || '',
      biography: d.biography || '',
      followers: Number(d.followersCount ?? 0),
      following: Number(d.followsCount ?? 0),
      totalPosts: Number(d.postsCount ?? 0),
      isVerified: Boolean(d.verified),
      isBusiness: Boolean(d.isBusinessAccount),
      category: d.businessCategoryName || null,
      externalUrl,
    },
  };
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

export const fetchPosts = async (
  username: string,
  windowStart: Date,
  months: number,
): Promise<{ posts: Post[]; usd: number }> => {
  const { items, usd } = await runActor({
    directUrls: [`https://www.instagram.com/${username}/`],
    resultsType: 'posts',
    resultsLimit: MAX_POSTS,
    onlyPostsNewerThan: `${months} months`,
    searchType: 'user',
  });

  if (items.length === 1 && items[0].error) assertUsable(items[0], username);

  const posts = normalizePosts(items, username, windowStart);
  if (posts.length === 0) {
    throw new UserFacingError(`@${username} has no public posts in the last ${months} months, so there is nothing to analyse.`);
  }
  return { posts, usd };
};

// Scraped values end up as clickable links, so only accept Instagram URLs.
const safePostUrl = (item: Record<string, any>) => {
  if (typeof item.url === 'string' && /^https:\/\/www\.instagram\.com\/(p|reel|tv)\/[\w-]+\/?$/.test(item.url)) return item.url;
  const code = typeof item.shortCode === 'string' && /^[\w-]+$/.test(item.shortCode) ? item.shortCode : null;
  return code ? `https://www.instagram.com/p/${code}/` : 'https://www.instagram.com/';
};

// Maps raw scraper items to our Post shape, keeping only the audited
// account's own public data.
export const normalizePosts = (items: Record<string, any>[], username: string, windowStart: Date): Post[] => {
  const seen = new Set<string>();
  const posts: Post[] = [];

  for (const item of items) {
    if (item.error || !item.id || !item.timestamp) continue;
    if (seen.has(item.id)) continue;
    const time = new Date(item.timestamp);
    if (Number.isNaN(time.getTime()) || time < windowStart) continue; // e.g. old pinned posts
    seen.add(item.id);

    const format = toFormat(item);
    const rawLikes = item.likesCount;
    const likes = typeof rawLikes === 'number' && rawLikes >= 0 ? rawLikes : null;
    const comments = Math.max(0, Number(item.commentsCount ?? 0));
    const music = item.musicInfo;

    // Deliberately not copied: latestComments / firstComment (other people's
    // data) and media download URLs.
    posts.push({
      idx: 0,
      id: String(item.id),
      url: safePostUrl(item),
      timestamp: time.toISOString(),
      format,
      likes,
      comments,
      views: format === 'Reel/Video' ? Number(item.videoPlayCount ?? item.videoViewCount ?? 0) || null : null,
      engagement: (likes ?? 0) + comments,
      caption: typeof item.caption === 'string' ? item.caption : '',
      hashtags: Array.isArray(item.hashtags) ? item.hashtags.map((h: string) => h.toLowerCase()) : [],
      collaborators: [...new Set([...usernames(item.coauthorProducers, username), ...usernames(item.taggedUsers, username)])],
      isSponsored: Boolean(item.paidPartnership || item.isSponsored),
      location: item.locationName || null,
      audio:
        format === 'Reel/Video' && music
          ? {
              original: Boolean(music.uses_original_audio),
              artist: music.uses_original_audio ? null : music.artist_name || null,
              song: music.uses_original_audio ? null : music.song_name || null,
            }
          : null,
      isPinned: Boolean(item.isPinned),
      imageUrl: item.displayUrl || null,
    });
  }

  posts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  posts.forEach((p, i) => (p.idx = i));
  return posts;
};
