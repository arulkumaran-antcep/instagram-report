import 'server-only';
import { ApifyClient } from 'apify-client';
import { env } from '@/lib/env';
import type { Post, Profile } from '@/lib/report-types';
import { normalizePosts } from '@/lib/instagram/normalize';
export { normalizePosts };

import { UserFacingError } from '@/lib/errors';
export { UserFacingError };

const MAX_POSTS = 1200;
const RUN_TIMEOUT_SECONDS = 900;

let client: ApifyClient | null = null;
let clientToken = '';
// Rebuilt whenever the token is changed in Settings.
const apify = () => {
  const token = env.apifyToken;
  if (!client || token !== clientToken) {
    client = new ApifyClient({ token });
    clientToken = token;
  }
  return client;
};

const explainApifyError = (error: unknown): never => {
  const message = error instanceof Error ? error.message : String(error);
  if (/usage|limit|credit|insufficient|payment/i.test(message)) {
    throw new UserFacingError(
      'The Apify account has run out of monthly credit. An admin needs to raise the plan or limit in the Apify console (Settings → API keys & credit shows usage), then try again.',
    );
  }
  if (/token|unauthori[sz]ed|401/i.test(message)) {
    throw new UserFacingError('The Apify API token is invalid. An admin needs to update it in Settings → API keys & credit.');
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

// Instagram lists newest first, so the scraper walks back from today until
// windowStart. Posts after windowEnd (custom past ranges) are dropped here.
export const fetchPosts = async (
  username: string,
  windowStart: Date,
  windowEnd: Date,
  relativeMonths?: number,
): Promise<{ posts: Post[]; usd: number; truncated: boolean }> => {
  const { items, usd } = await runActor({
    directUrls: [`https://www.instagram.com/${username}/`],
    resultsType: 'posts',
    resultsLimit: MAX_POSTS,
    onlyPostsNewerThan: relativeMonths ? `${relativeMonths} months` : windowStart.toISOString().slice(0, 10),
    searchType: 'user',
  });

  if (items.length === 1 && items[0].error) assertUsable(items[0], username);

  const posts = normalizePosts(items, username, windowStart, windowEnd);
  const truncated = items.filter((i) => !i.error).length >= MAX_POSTS;
  if (posts.length === 0) {
    throw new UserFacingError(
      truncated
        ? `@${username} posts so often that the ${MAX_POSTS.toLocaleString('en-US')}-post limit was reached before the chosen dates. Choose a more recent range.`
        : `@${username} has no public posts in the chosen time span, so there is nothing to analyse.`,
    );
  }
  return { posts, usd, truncated };
};
