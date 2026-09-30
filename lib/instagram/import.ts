import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { Readable } from 'node:stream';
import { UserFacingError } from '@/lib/errors';
import { normalizePosts } from '@/lib/instagram/normalize';
import type { Post, Profile } from '@/lib/report-types';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_UNZIPPED_BYTES = 120 * 1024 * 1024; // guards against zip bombs
const MAX_ROWS = 5000;
export const MIN_POSTS = 5;

export interface ParsedExport {
  handle: string;
  posts: Post[];
  first: string; // ISO of the oldest post
  last: string; // ISO of the newest post
  skipped: { otherAccounts: number; unusable: number; duplicates: number };
  profileFromFile: Partial<Profile> | null;
  imagesAvailable: number;
}

const cellValue = (v: ExcelJS.CellValue): unknown => {
  if (v == null) return undefined;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    const o = v as any;
    if (Array.isArray(o.richText)) return o.richText.map((r: any) => r.text).join('');
    if ('result' in o) return o.result instanceof Date ? o.result.toISOString() : o.result;
    if ('text' in o) return o.text;
    if ('error' in o) return undefined;
  }
  return v;
};

// Apify's spreadsheet export flattens nested fields into "a/b/0/c" columns.
// This rebuilds the nested shape the scraper returns from the API.
const unflatten = (row: Record<string, unknown>) => {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined || value === '') continue;
    const path = key.split('/');
    let node: any = out;
    path.forEach((part, i) => {
      if (part === '__proto__' || part === 'constructor' || part === 'prototype') return;
      const last = i === path.length - 1;
      const nextIsIndex = /^\d+$/.test(path[i + 1] ?? '');
      if (last) node[part] = value;
      else node = node[part] ??= nextIsIndex ? [] : {};
    });
  }
  return out;
};

const guardZip = async (buffer: Buffer) => {
  const zip = await JSZip.loadAsync(buffer).catch(() => {
    throw new UserFacingError('That file could not be opened. Upload the .xlsx exactly as exported from Apify, or export it as CSV or JSON.');
  });
  let total = 0;
  zip.forEach((_, entry) => {
    total += (entry as any)._data?.uncompressedSize ?? 0;
  });
  if (total > MAX_UNZIPPED_BYTES) throw new UserFacingError('That spreadsheet is too large to process. Export fewer posts and try again.');
};

const readRows = async (buffer: Buffer, name: string): Promise<Record<string, unknown>[]> => {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'json') {
    let data: unknown;
    try {
      data = JSON.parse(buffer.toString('utf8'));
    } catch {
      throw new UserFacingError('That JSON file is not valid. Download the dataset from Apify again as JSON.');
    }
    if (!Array.isArray(data)) throw new UserFacingError('The JSON file should be a list of posts, as downloaded from the Apify dataset.');
    return data.filter((x) => x && typeof x === 'object') as Record<string, unknown>[];
  }

  const wb = new ExcelJS.Workbook();
  try {
    if (ext === 'csv') await wb.csv.read(Readable.from(buffer));
    else if (ext === 'xlsx') {
      await guardZip(buffer);
      await wb.xlsx.load(buffer as any);
    } else throw new UserFacingError('Upload an Excel (.xlsx), CSV or JSON file exported from the Apify Instagram Scraper.');
  } catch (e) {
    if (e instanceof UserFacingError) throw e;
    throw new UserFacingError('That file could not be read. Upload the export exactly as downloaded from Apify.');
  }

  const sheet = wb.getWorksheet('Data') ?? wb.worksheets[0];
  if (!sheet || sheet.rowCount < 2) throw new UserFacingError('The file has no rows. Check that the Apify run finished and exported posts.');
  if (sheet.rowCount > MAX_ROWS + 1) throw new UserFacingError(`The file has more than ${MAX_ROWS.toLocaleString('en-US')} rows. Export one account at a time.`);

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = String(cellValue(cell.value) ?? '').trim();
  });
  const rows: Record<string, unknown>[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row: Record<string, unknown> = {};
    sheet.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => {
      if (headers[col]) row[headers[col]] = cellValue(cell.value);
    });
    if (Object.keys(row).length) rows.push(row);
  }
  return rows;
};

const asNumber = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);

export const parseExport = async (buffer: Buffer, filename: string, fallbackHandle?: string): Promise<ParsedExport> => {
  const raw = await readRows(buffer, filename);
  const items = raw.map((r) => (Object.keys(r).some((k) => k.includes('/')) ? unflatten(r) : (r as Record<string, any>)));

  const postItems = items.filter((i) => i.id && i.timestamp && !i.error);
  if (postItems.length === 0) {
    const columns = new Set(raw.flatMap((r) => Object.keys(r)));
    if (columns.has('Bucket') || columns.has('Engagement') || columns.has('Performance Index')) {
      throw new UserFacingError(
        'This looks like a finished analysis workbook, not the scraper’s raw export. Upload the file downloaded from the Apify run’s dataset (Export → Excel, CSV or JSON), which has columns such as id, timestamp, likesCount and commentsCount.',
      );
    }
    if (columns.has('followersCount') && columns.has('username') && !columns.has('timestamp')) {
      throw new UserFacingError(
        'This is a profile-only export (followers, bio and so on) with no posts in it, so there is nothing to analyse. Run Apify’s Instagram Scraper (apify/instagram-scraper) with the result type “Posts”, then upload that dataset.',
      );
    }
    throw new UserFacingError(
      'No posts were found in that file. Export the Instagram Scraper run that collected posts (it needs the id, timestamp, likesCount and commentsCount columns).',
    );
  }

  // One account per report: use the account that owns most rows.
  const owners = new Map<string, number>();
  for (const i of postItems) {
    const owner = typeof i.ownerUsername === 'string' ? i.ownerUsername.toLowerCase() : null;
    if (owner) owners.set(owner, (owners.get(owner) ?? 0) + 1);
  }
  const handle = [...owners.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallbackHandle;
  if (!handle) throw new UserFacingError('This file does not say which account the posts belong to. Enter the username and try again.');
  const mine = owners.size ? postItems.filter((i) => String(i.ownerUsername ?? '').toLowerCase() === handle) : postItems;
  const otherAccounts = postItems.length - mine.length;

  const posts = normalizePosts(mine, handle, new Date(0), new Date(Date.now() + 86_400_000));
  const duplicates = mine.length - posts.length;
  if (posts.length < MIN_POSTS) {
    throw new UserFacingError(`Only ${posts.length} usable post${posts.length === 1 ? '' : 's'} found. At least ${MIN_POSTS} are needed for a meaningful report.`);
  }

  const withFollowers = items.find((i) => asNumber(i.followersCount) !== undefined && String(i.username ?? '').toLowerCase() === handle);
  return {
    handle,
    posts,
    first: posts[posts.length - 1].timestamp,
    last: posts[0].timestamp,
    skipped: { otherAccounts, unusable: raw.length - postItems.length, duplicates },
    imagesAvailable: posts.filter((p) => p.imageUrl).length,
    profileFromFile: withFollowers
      ? {
          fullName: String(withFollowers.fullName ?? ''),
          biography: String(withFollowers.biography ?? ''),
          followers: asNumber(withFollowers.followersCount),
          following: asNumber(withFollowers.followsCount),
          totalPosts: asNumber(withFollowers.postsCount),
          category: withFollowers.businessCategoryName ?? null,
        }
      : null,
  };
};
