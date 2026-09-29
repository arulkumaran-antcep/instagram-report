// Shared between server and client. Plain data only.

export type Format = 'Image' | 'Carousel' | 'Reel/Video';
export const FORMATS: Format[] = ['Image', 'Carousel', 'Reel/Video'];

export type ReportStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type Stage = 'queued' | 'profile' | 'posts' | 'images' | 'categorise' | 'analyse' | 'write' | 'render' | 'done';

export const STAGES: { key: Stage; label: string; progress: number }[] = [
  { key: 'queued', label: 'Queued', progress: 2 },
  { key: 'profile', label: 'Checking the profile', progress: 5 },
  { key: 'posts', label: 'Collecting 12 months of posts', progress: 12 },
  { key: 'images', label: 'Preparing post images', progress: 40 },
  { key: 'categorise', label: 'Categorising content', progress: 50 },
  { key: 'analyse', label: 'Calculating metrics', progress: 72 },
  { key: 'write', label: 'Writing the analysis', progress: 78 },
  { key: 'render', label: 'Building PDF and Excel', progress: 92 },
  { key: 'done', label: 'Done', progress: 100 },
];

export interface Profile {
  username: string;
  fullName: string;
  biography: string;
  followers: number;
  following: number;
  totalPosts: number;
  isVerified: boolean;
  isBusiness: boolean;
  category: string | null;
  externalUrl: string | null;
}

export interface Post {
  idx: number;
  id: string;
  url: string;
  timestamp: string;
  format: Format;
  likes: number | null; // null when the creator hides like counts
  comments: number;
  views: number | null;
  engagement: number;
  caption: string;
  hashtags: string[];
  collaborators: string[];
  isSponsored: boolean;
  location: string | null;
  audio: { original: boolean; artist: string | null; song: string | null } | null;
  isPinned: boolean;
  imageUrl: string | null;
  bucketId?: number;
  note?: string;
}

export interface Bucket {
  id: number;
  name: string;
  definition: string;
}

export interface GroupStat {
  posts: number;
  avg: number;
  median: number;
}

export interface ShareRow extends GroupStat {
  pctPosts: number; // 0-1
  pctEngagement: number; // 0-1
  index: number; // pctEngagement / pctPosts
  medianMultiple: number; // median / account median
}

export interface ReportStats {
  window: { start: string; end: string; months: number; timezone: string; days: number };
  overview: {
    posts: number;
    avgEngagement: number;
    medianEngagement: number;
    engagementRate: number; // % of followers, from the average post
    medianEngagementRate: number; // % of followers, from the median post
    postsPerWeek: number;
    hiddenLikePosts: number;
    commentsPer100LikesMedian: number;
    captionlessShare: number; // 0-1
    avgLikes: number;
    avgComments: number;
  };
  formats: (ShareRow & { format: Format })[];
  buckets: (ShareRow & { id: number; name: string; definition: string })[];
  bucketFormats: { bucket: string; format: Format; posts: number; avg: number; median: number }[];
  months: { month: string; posts: number; avg: number; median: number; carouselShare: number; reelShare: number }[];
  halves: {
    first: GroupStat & { from: string; to: string };
    second: GroupStat & { from: string; to: string };
    avgChangePct: number;
  };
  days: ({ day: string } & GroupStat)[];
  hours: ({ hour: number } & GroupStat)[];
  timing: {
    minSample: number;
    bestHours: ({ hour: number } & GroupStat)[];
    weakHours: ({ hour: number } & GroupStat)[];
    mostCommonHour: ({ hour: number } & GroupStat) | null;
  };
  cadence: {
    gaps: { days: number; from: string; to: string }[];
    busiestDay: { date: string; posts: number } | null;
    daysWith5Plus: number;
    activeDays: number;
  };
  hashtags: {
    postsWithout: number;
    postsWith: number;
    countBuckets: ({ range: string } & GroupStat)[];
    tags: { tag: string; posts: number; avg: number; lift: number }[];
  };
  captions: {
    captioned: GroupStat;
    uncaptioned: GroupStat;
    lengthBuckets: ({ range: string } & GroupStat)[];
    features: { feature: string; postsWith: number; avgWith: number; postsWithout: number; avgWithout: number }[];
    hooks: {
      top: { avgFirstLineChars: number; pctQuestion: number; pctEmojiStart: number; pctNumberStart: number };
      bottom: { avgFirstLineChars: number; pctQuestion: number; pctEmojiStart: number; pctNumberStart: number };
    } | null;
    topCaptions: { caption: string; engagement: number }[];
  };
  collabs: {
    collab: GroupStat;
    solo: GroupStat;
    medianMultiple: number;
    collaborators: { username: string; posts: number; avg: number }[];
  };
  audio: {
    reels: number;
    original: GroupStat;
    licensed: GroupStat;
    unknown: number;
    tracks: { artist: string; song: string; posts: number; avg: number }[];
  };
  sponsored: { sponsored: GroupStat; organic: GroupStat };
  location: { tagged: GroupStat; untagged: GroupStat; top: { name: string; posts: number }[] };
  topPosts: {
    url: string;
    date: string;
    format: Format;
    bucket: string;
    likes: number | null;
    comments: number;
    engagement: number;
    caption: string;
    note: string;
  }[];
}

export interface NarrativeBullet {
  lead: string;
  text: string;
}

export interface Narrative {
  headline: string;
  sections: { key: string; title: string; bullets: NarrativeBullet[] }[];
  recommendations: { title: string; detail: string }[];
  verification: { checkedNumbers: number; removedBullets: number };
}

export interface ReportCost {
  apifyUsd: number;
  claudeUsd: number;
  totalUsd: number;
  postsCollected: number;
  imagesAnalysed: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ReportRow {
  id: string;
  handle: string;
  status: ReportStatus;
  stage: Stage;
  progress: number;
  timezone: string;
  window_months: number;
  profile: Profile | null;
  stats: ReportStats | null;
  narrative: Narrative | null;
  pdf_path: string | null;
  xlsx_path: string | null;
  error_message: string | null;
  cost: ReportCost | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
