// Tests for reading an Apify export (xlsx / csv / json) back into report data.
// The spreadsheets are built the way Apify writes them: nested fields flattened
// into "a/b/0/c" columns and booleans stored as text.
// Run: npm test
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { parseExport } from '@/lib/instagram/import';
import { isInstagramImageUrl } from '@/lib/instagram/normalize';

let pass = 0;
let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else fail++;
  console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : `\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`);
};
const rejects = async (name: string, run: () => Promise<unknown>, pattern: RegExp) => {
  try {
    await run();
    eq(name, 'no error', 'error');
  } catch (e) {
    eq(name, pattern.test(e instanceof Error ? e.message : String(e)), true);
  }
};

const items = Array.from({ length: 12 }, (_, i) => ({
  id: `${1000 + i}`,
  type: i % 3 === 0 ? 'Video' : i % 3 === 1 ? 'Sidecar' : 'Image',
  productType: i % 3 === 0 ? 'clips' : 'feed',
  shortCode: `ABC${i}`,
  url: `https://www.instagram.com/p/ABC${i}/`,
  caption: `Post number ${i} #tag${i % 2}`,
  hashtags: [`tag${i % 2}`],
  commentsCount: i + 1,
  likesCount: i === 4 ? -1 : 100 * (i + 1),
  timestamp: new Date(Date.UTC(2026, 0, 1 + i * 9, 5, 30)).toISOString(),
  ownerUsername: 'sampleco',
  paidPartnership: i === 2,
  isPinned: i === 0,
  displayUrl: 'https://scontent.cdninstagram.com/v/t51/x.jpg',
  coauthorProducers: i === 1 ? [{ username: 'partner_one' }, { username: 'sampleco' }] : [],
  musicInfo: i % 3 === 0 ? { uses_original_audio: i === 0, artist_name: 'Some Artist', song_name: 'Some Song' } : undefined,
  latestComments: [{ ownerUsername: 'a_commenter', text: 'nice' }],
}));

const flatten = (o: any, prefix = '', out: Record<string, unknown> = {}) => {
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}/${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else if (v !== undefined) out[key] = typeof v === 'boolean' ? String(v) : v;
  }
  return out;
};

const toXlsx = async (rows: any[], sheetName = 'Data') => {
  const flat = rows.map((r) => flatten(r));
  const headers = [...new Set(flat.flatMap((r) => Object.keys(r)))];
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(headers);
  flat.forEach((r) => ws.addRow(headers.map((h) => r[h] ?? null)));
  return Buffer.from(await wb.xlsx.writeBuffer());
};
const toCsv = async (rows: any[]) => {
  const flat = rows.map((r) => flatten(r));
  const headers = [...new Set(flat.flatMap((r) => Object.keys(r)))];
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data');
  ws.addRow(headers);
  flat.forEach((r) => ws.addRow(headers.map((h) => r[h] ?? null)));
  return Buffer.from(await wb.csv.writeBuffer());
};

async function main() {
  // ---- All three formats give the same posts ----
  const fromXlsx = await parseExport(await toXlsx(items), 'export.xlsx');
  const fromCsv = await parseExport(await toCsv(items), 'export.csv');
  const fromJson = await parseExport(Buffer.from(JSON.stringify(items)), 'export.json');
  for (const [label, r] of [['xlsx', fromXlsx], ['csv', fromCsv], ['json', fromJson]] as const) {
    eq(`${label}: account found`, r.handle, 'sampleco');
    eq(`${label}: post count`, r.posts.length, 12);
    eq(`${label}: newest first`, r.posts[0].id, '1011');
    eq(`${label}: hidden likes become null`, r.posts.find((p) => p.id === '1004')!.likes, null);
    eq(`${label}: text booleans read as booleans (sponsored)`, r.posts.find((p) => p.id === '1002')!.isSponsored, true);
    eq(`${label}: text booleans read as booleans (not sponsored)`, r.posts.find((p) => p.id === '1003')!.isSponsored, false);
    eq(`${label}: pinned flag`, r.posts.find((p) => p.id === '1000')!.isPinned, true);
    eq(`${label}: formats`, r.posts.slice(-3).map((p) => p.format), ['Image', 'Carousel', 'Reel/Video']);
    eq(`${label}: collaborator kept, owner removed`, r.posts.find((p) => p.id === '1001')!.collaborators, ['partner_one']);
    eq(`${label}: original audio flag`, r.posts.find((p) => p.id === '1000')!.audio, { original: true, artist: null, song: null });
    eq(`${label}: licensed audio`, r.posts.find((p) => p.id === '1003')!.audio, { original: false, artist: 'Some Artist', song: 'Some Song' });
    eq(`${label}: numbers are numbers`, typeof r.posts[0].comments, 'number');
    eq(`${label}: commenter data is not carried over`, JSON.stringify(r.posts).includes('a_commenter'), false);
    eq(`${label}: image links counted`, r.imagesAvailable, 12);
  }
  eq('xlsx: date range', [fromXlsx.first.slice(0, 10), fromXlsx.last.slice(0, 10)], ['2026-01-01', '2026-04-10']);

  // ---- Messy real-world files ----
  const mixed = [...items, { ...items[0], id: '5000', ownerUsername: 'someone_else' }, { ...items[1] }];
  const m = await parseExport(await toXlsx(mixed), 'x.xlsx');
  eq('other accounts are left out', m.skipped.otherAccounts, 1);
  eq('duplicates are left out', m.skipped.duplicates, 1);
  eq('the report is about the dominant account', m.handle, 'sampleco');

  const noOwner = items.map(({ ownerUsername, ...rest }) => rest);
  await rejects('missing account column asks for a username', () => parseExport(Buffer.from(JSON.stringify(noOwner)), 'x.json'), /which account/i);
  const withFallback = await parseExport(Buffer.from(JSON.stringify(noOwner)), 'x.json', 'chosen');
  eq('typed username is used when the file has none', withFallback.handle, 'chosen');

  await rejects('too few posts', () => parseExport(Buffer.from(JSON.stringify(items.slice(0, 3))), 'x.json'), /at least 5/i);
  await rejects('wrong kind of file', () => parseExport(Buffer.from('hello'), 'notes.txt'), /Excel|CSV|JSON/);
  await rejects('broken json', () => parseExport(Buffer.from('{oops'), 'x.json'), /not valid/i);
  await rejects('json that is not a list', () => parseExport(Buffer.from('{"a":1}'), 'x.json'), /list of posts/i);
  await rejects('corrupt xlsx', () => parseExport(Buffer.from('not a zip'), 'x.xlsx'), /could not be/i);
  await rejects('profile-only export has no posts', () => parseExport(Buffer.from(JSON.stringify([{ username: 'a', followersCount: 5 }])), 'x.json'), /No posts/i);

  // A workbook whose sheet is not called "Data" still works; a prototype-pollution key is ignored.
  const other = await parseExport(await toXlsx(items, 'Sheet1'), 'x.xlsx');
  eq('any sheet name works', other.posts.length, 12);
  const evil = items.map((i) => ({ ...i, 'constructor/prototype/polluted': 'yes' }));
  await parseExport(await toXlsx(evil), 'x.xlsx');
  eq('prototype pollution is ignored', ({} as any).polluted, undefined);

  // A zip that unpacks to far more than its size is refused before it is opened.
  const bomb = new JSZip();
  bomb.file('xl/big.xml', Buffer.alloc(130 * 1024 * 1024, 0x41));
  const bombBuffer = await bomb.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  await rejects('zip bomb is refused', () => parseExport(bombBuffer, 'x.xlsx'), /too large/i);

  // ---- Only Instagram's own image hosts are ever fetched ----
  eq('cdninstagram host allowed', isInstagramImageUrl('https://scontent-bom1-1.cdninstagram.com/v/a.jpg'), true);
  eq('fbcdn host allowed', isInstagramImageUrl('https://scontent.xx.fbcdn.net/v/a.jpg'), true);
  eq('lookalike host refused', isInstagramImageUrl('https://evilcdninstagram.com/a.jpg'), false);
  eq('dot-lookalike refused', isInstagramImageUrl('https://cdninstagramXcom/a.jpg'), false);
  eq('internal address refused', isInstagramImageUrl('http://169.254.169.254/latest/meta-data'), false);
  eq('localhost refused', isInstagramImageUrl('https://localhost/a.jpg'), false);
  eq('plain http refused', isInstagramImageUrl('http://scontent.cdninstagram.com/a.jpg'), false);
  eq('custom port refused', isInstagramImageUrl('https://scontent.cdninstagram.com:8443/a.jpg'), false);
  eq('userinfo trick refused', isInstagramImageUrl('https://scontent.cdninstagram.com@evil.com/a.jpg'), false);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
