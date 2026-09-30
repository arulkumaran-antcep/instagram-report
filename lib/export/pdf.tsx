import 'server-only';
import path from 'node:path';
import { Document, Font, Link, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { Narrative, Profile, ReportStats } from '@/lib/report-types';
import { fmtCompact, fmtDate, fmtHour, fmtIndex, fmtInt, fmtMonth, fmtPct, fmtRate } from '@/lib/format';

const fontDir = path.join(process.cwd(), 'node_modules', '@fontsource', 'inter', 'files');
let fontsReady = false;
const registerFonts = () => {
  if (fontsReady) return;
  Font.register({
    family: 'Inter',
    fonts: [400, 500, 600, 700].map((w) => ({ src: path.join(fontDir, `inter-latin-${w}-normal.woff`), fontWeight: w })),
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
};

const C = {
  ink: '#1c1a29',
  body: '#34313f',
  muted: '#6b6780',
  faint: '#9a96ab',
  line: '#e7e4ef',
  soft: '#f6f3fd',
  accent: '#6d3bd7',
  accent2: '#c0267a',
  good: '#15803d',
};

const s = StyleSheet.create({
  page: { fontFamily: 'Inter', fontSize: 9.5, color: C.body, paddingTop: 44, paddingBottom: 56, paddingHorizontal: 48, lineHeight: 1.5 },
  footerLeft: { position: 'absolute', top: 806, left: 48, right: 48, fontSize: 7.5, color: C.faint },
  footerRight: { position: 'absolute', top: 806, left: 48, right: 48, fontSize: 7.5, color: C.faint, textAlign: 'right' },
  eyebrow: { fontSize: 7.5, fontWeight: 600, color: C.accent, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: 700, color: C.ink, marginTop: 6, lineHeight: 1.2 },
  subtitle: { fontSize: 10, color: C.muted, marginTop: 4 },
  meta: { marginTop: 14, padding: 12, backgroundColor: C.soft, borderRadius: 6, fontSize: 8.5, color: C.body },
  kpis: { flexDirection: 'row', marginTop: 14, borderWidth: 0.75, borderColor: C.line, borderRadius: 6 },
  kpi: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, borderRightWidth: 0.75, borderRightColor: C.line },
  kpiLabel: { fontSize: 6.8, fontWeight: 600, color: C.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  kpiValue: { fontSize: 14, fontWeight: 700, color: C.ink, marginTop: 4 },
  kpiNote: { fontSize: 7, color: C.faint, marginTop: 2 },
  headline: { marginTop: 14, borderLeftWidth: 3, borderLeftColor: C.accent, paddingLeft: 10, paddingVertical: 4, fontSize: 11, fontWeight: 500, color: C.ink, lineHeight: 1.45 },
  h2: { fontSize: 13, fontWeight: 700, color: C.ink, marginTop: 20, marginBottom: 8 },
  bulletRow: { flexDirection: 'row', marginBottom: 5 },
  dot: { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: C.accent, marginTop: 5.2, marginRight: 8 },
  bulletText: { flex: 1 },
  lead: { fontWeight: 600, color: C.ink },
  th: { flexDirection: 'row', borderBottomWidth: 0.75, borderBottomColor: C.ink, paddingBottom: 4, marginTop: 6 },
  thCell: { fontSize: 7, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 4.5 },
  td: { fontSize: 8.3, color: C.body },
  num: { textAlign: 'right' },
  recRow: { flexDirection: 'row', marginBottom: 8 },
  recNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.accent,
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 700,
    textAlign: 'center',
    paddingTop: 3.5,
    marginRight: 9,
  },
  small: { fontSize: 8, color: C.muted },
});

const Bullet = ({ lead, text }: { lead: string; text: string }) => (
  <View style={s.bulletRow} wrap={false}>
    <View style={s.dot} />
    <Text style={s.bulletText}>
      <Text style={s.lead}>{lead}</Text> {text}
    </Text>
  </View>
);

type ColSpec = { label: string; width: string; align?: 'right' };

type TableCell = string | { text: string; href: string } | { node: React.ReactElement };

const Table = ({ cols, rows }: { cols: ColSpec[]; rows: TableCell[][] }) => (
  <View wrap={rows.length > 12}>
    <View style={s.th} fixed={false}>
      {cols.map((c) => (
        <Text key={c.label} style={[s.thCell, { width: c.width }, c.align === 'right' ? s.num : {}]}>
          {c.label}
        </Text>
      ))}
    </View>
    {rows.map((row, i) => (
      <View key={i} style={s.tr} wrap={false}>
        {row.map((cell, j) =>
          typeof cell === 'string' ? (
            <Text key={j} style={[s.td, { width: cols[j].width }, cols[j].align === 'right' ? s.num : {}]}>
              {cell}
            </Text>
          ) : 'node' in cell ? (
            <View key={j} style={{ width: cols[j].width, justifyContent: 'center' }}>
              {cell.node}
            </View>
          ) : (
            <View key={j} style={{ width: cols[j].width, alignItems: cols[j].align === 'right' ? 'flex-end' : 'flex-start' }}>
              <Link src={cell.href} style={[s.td, { color: C.accent, textDecoration: 'none' }]}>
                {cell.text}
              </Link>
            </View>
          ),
        )}
      </View>
    ))}
  </View>
);

const IndexBar = ({ value, max }: { value: number; max: number }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <View style={{ width: 44, height: 5, backgroundColor: C.line, borderRadius: 3 }}>
      <View
        style={{
          width: Math.max(2, Math.min(44, (value / max) * 44)),
          height: 5,
          borderRadius: 3,
          backgroundColor: value >= 1 ? C.accent : C.faint,
        }}
      />
    </View>
    <Text style={[s.td, { marginLeft: 5, fontWeight: 600, color: value >= 1 ? C.accent : C.muted }]}>{fmtIndex(value)}</Text>
  </View>
);

const MonthChart = ({ months }: { months: ReportStats['months'] }) => {
  const maxMedian = Math.max(1, ...months.map((m) => m.median));
  const maxPosts = Math.max(1, ...months.map((m) => m.posts));
  const H = 70;
  return (
    <View wrap={false} style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H, borderBottomWidth: 0.75, borderBottomColor: C.ink }}>
        {months.map((m) => (
          <View key={m.month} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: H }}>
            <Text style={{ fontSize: 6.3, color: C.muted, marginBottom: 2 }}>{m.posts ? fmtCompact(m.median) : ''}</Text>
            <View style={{ width: '58%', height: Math.max(m.posts ? 2 : 0, (m.median / maxMedian) * (H - 14)), backgroundColor: C.accent, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 3 }}>
        {months.map((m) => (
          <View key={m.month} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 6, color: C.muted }}>{fmtMonth(m.month).replace(' 20', " '")}</Text>
            <View style={{ marginTop: 3, width: '58%', height: 3, backgroundColor: C.line }}>
              <View style={{ width: `${(m.posts / maxPosts) * 100}%`, height: 3, backgroundColor: C.accent2 }} />
            </View>
            <Text style={{ fontSize: 6, color: C.faint, marginTop: 1 }}>{m.posts}</Text>
          </View>
        ))}
      </View>
      <Text style={[s.small, { marginTop: 6 }]}>
        Bars: median engagement per post by month. Pink line and number: posts published that month.
      </Text>
    </View>
  );
};

const ReportPdf = ({ profile, stats, narrative }: { profile: Profile; stats: ReportStats; narrative: Narrative }) => {
  const o = stats.overview;
  const tz = stats.window.timezone;
  const maxIndex = Math.max(1.5, ...stats.buckets.map((b) => b.index));
  const section = (key: string) => narrative.sections.find((x) => x.key === key);
  // A heading is always kept on the same page as the first item under it.
  const Titled = ({ title, first, children }: { title: string; first: React.ReactNode; children?: React.ReactNode }) => (
    <View>
      <View wrap={false}>
        <Text style={s.h2}>{title}</Text>
        {first}
      </View>
      {children}
    </View>
  );
  const Section = ({ k }: { k: string }) => {
    const sec = section(k);
    if (!sec || sec.bullets.length === 0) return null;
    const [head, ...rest] = sec.bullets;
    return (
      <Titled title={sec.title} first={<Bullet lead={head.lead} text={head.text} />}>
        {rest.map((b, i) => (
          <Bullet key={i} lead={b.lead} text={b.text} />
        ))}
      </Titled>
    );
  };

  return (
    <Document title={`@${profile.username} — Instagram Content Analysis`} subject="Instagram content audit">
      <Page size="A4" style={s.page}>

        <Text style={s.eyebrow}>Instagram content analysis</Text>
        <Text style={s.title}>@{profile.username}</Text>
        <Text style={s.subtitle}>
          {[profile.fullName, profile.category, `${fmtInt(profile.followers)} followers`, profile.totalPosts != null ? `${fmtInt(profile.totalPosts)} posts in total` : null]
            .filter(Boolean)
            .join('  ·  ')}
        </Text>

        <View style={s.meta}>
          <Text>
            <Text style={s.lead}>Window: </Text>
            {fmtDate(stats.window.start)} – {fmtDate(stats.window.end)} ({fmtInt(o.posts)} posts{stats.window.truncated ? ', the most recent posts up to the collection limit' : ''}).{'  '}
            <Text style={s.lead}>Timezone for timing analysis: </Text>
            {tz}.{'  '}
            <Text style={s.lead}>Content categories: </Text>
            assigned by AI from post images and captions{o.captionlessShare >= 0.3 ? `, because ${fmtPct(o.captionlessShare)} of posts have no caption` : ''}.
          </Text>
        </View>

        <View style={s.kpis}>
          {[
            { label: 'Followers', value: fmtCompact(profile.followers), note: profile.following != null ? `Follows ${fmtInt(profile.following)}` : 'As provided' },
            { label: 'Posts / week', value: o.postsPerWeek.toFixed(1), note: `${fmtInt(o.posts)} posts in ${fmtInt(stats.window.days)} days` },
            { label: 'Engagement rate', value: fmtRate(o.engagementRate), note: 'Benchmark 1–3%' },
            { label: 'Avg / median', value: `${fmtCompact(o.avgEngagement)} / ${fmtCompact(o.medianEngagement)}`, note: 'engagement per post' },
            { label: 'Comments', value: o.commentsPer100LikesMedian.toFixed(1), note: 'per 100 likes (median)' },
          ].map((k, i, arr) => (
            <View key={k.label} style={[s.kpi, i === arr.length - 1 ? { borderRightWidth: 0 } : {}]}>
              <Text style={s.kpiLabel}>{k.label}</Text>
              <Text style={s.kpiValue}>{k.value}</Text>
              <Text style={s.kpiNote}>{k.note}</Text>
            </View>
          ))}
        </View>

        {narrative.headline ? <Text style={s.headline}>{narrative.headline}</Text> : null}

        <Section k="snapshot" />

        <View wrap={false}>
        <Text style={s.h2}>Formats</Text>
        <Table
          cols={[
            { label: 'Format', width: '22%' },
            { label: 'Posts', width: '12%', align: 'right' },
            { label: '% posts', width: '13%', align: 'right' },
            { label: '% engagement', width: '17%', align: 'right' },
            { label: 'Index', width: '10%', align: 'right' },
            { label: 'Average', width: '13%', align: 'right' },
            { label: 'Median', width: '13%', align: 'right' },
          ]}
          rows={stats.formats.map((f) => [f.format, fmtInt(f.posts), fmtPct(f.pctPosts), fmtPct(f.pctEngagement), fmtIndex(f.index), fmtInt(f.avg), fmtInt(f.median)])}
        />
        </View>

        <View wrap={false}>
        <Text style={s.h2}>Content buckets</Text>
        <Table
          cols={[
            { label: 'Bucket', width: '36%' },
            { label: 'Posts', width: '9%', align: 'right' },
            { label: '% posts', width: '11%', align: 'right' },
            { label: '% engagement', width: '14%', align: 'right' },
            { label: '', width: '3%' },
            { label: 'Index', width: '15%' },
            { label: 'Median', width: '12%', align: 'right' },
          ]}
          rows={stats.buckets.map((b) => [
            b.name,
            fmtInt(b.posts),
            fmtPct(b.pctPosts),
            fmtPct(b.pctEngagement),
            '',
            { node: <IndexBar value={b.index} max={maxIndex} /> },
            fmtInt(b.median),
          ])}
        />
        </View>
        <View style={{ marginTop: 8 }}>
          {section('buckets')?.bullets.map((b, i) => <Bullet key={i} lead={b.lead} text={b.text} />)}
        </View>

        <Section k="opportunities" />

        <Titled title={section('trajectory')?.title ?? 'Trajectory'} first={<MonthChart months={stats.months} />}>
          <View style={{ marginTop: 8 }}>
            {section('trajectory')?.bullets.map((b, i) => <Bullet key={i} lead={b.lead} text={b.text} />)}
          </View>
        </Titled>

        <Section k="hashtags" />

        <Section k="timing" />
        {stats.timing.bestHours.length > 0 && (
          <View wrap={false} style={{ marginTop: 4 }}>
            <Table
              cols={[
                { label: `Best hours (${tz}, ${stats.timing.minSample}+ posts)`, width: '46%' },
                { label: 'Posts', width: '18%', align: 'right' },
                { label: 'Median', width: '18%', align: 'right' },
                { label: 'Average', width: '18%', align: 'right' },
              ]}
              rows={stats.timing.bestHours.map((h) => [fmtHour(h.hour), fmtInt(h.posts), fmtInt(h.median), fmtInt(h.avg)])}
            />
          </View>
        )}

        <Section k="captions" />
        <Section k="collabs" />

        <View wrap={false}>
        <Text style={s.h2}>Top 10 posts</Text>
        <Table
          cols={[
            { label: 'Date', width: '14%' },
            { label: 'Format', width: '12%' },
            { label: 'Bucket', width: '30%' },
            { label: 'Likes', width: '12%', align: 'right' },
            { label: 'Comments', width: '13%', align: 'right' },
            { label: 'Post', width: '19%', align: 'right' },
          ]}
          rows={stats.topPosts.map((p) => [
            fmtDate(p.date),
            p.format,
            p.bucket,
            fmtInt(p.likes),
            fmtInt(p.comments),
            { text: 'View post', href: p.url },
          ])}
        />
        </View>

        {(() => {
          const row = (r: { title: string; detail: string }, i: number) => (
            <View key={i} style={s.recRow} wrap={false}>
              <Text style={s.recNum}>{i + 1}</Text>
              <Text style={s.bulletText}>
                <Text style={s.lead}>{r.title.replace(/\.$/, '')}.</Text> {r.detail}
              </Text>
            </View>
          );
          const [head, ...rest] = narrative.recommendations;
          if (!head) return null;
          return (
            <Titled title="Recommendations" first={row(head, 0)}>
              {rest.map((r, i) => row(r, i + 1))}
            </Titled>
          );
        })()}

        <View wrap={false} style={{ marginTop: 16, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 0.75, borderColor: C.line, borderRadius: 6 }}>
          <Text style={[s.lead, { fontSize: 9, marginBottom: 4 }]}>Methodology & limitations</Text>
          {[
            'Data: publicly visible posts and profile details, collected without logging in to Instagram. Commenter data is not collected.',
            'Engagement = likes + comments. Engagement rate = average engagement per post ÷ followers. Index = share of engagement ÷ share of posts.',
            `Timing uses ${tz}. Hours are ranked by median engagement and only count with ${stats.timing.minSample}+ posts.`,
            'Content buckets are assigned by AI from each post’s image and caption; individual posts may be misclassified.',
            'Reach, impressions, saves, shares and audience demographics are not public and are not included or estimated.',
            `Every figure in this report was checked against the underlying data (${narrative.verification.checkedNumbers} figures checked).`,
          ].map((t) => (
            <View key={t} style={[s.bulletRow, { marginBottom: 2 }]}>
              <View style={[s.dot, { backgroundColor: C.faint, marginTop: 4 }]} />
              <Text style={[s.bulletText, { fontSize: 7.6, color: C.muted }]}>{t}</Text>
            </View>
          ))}
        </View>
        <Text style={s.footerLeft} fixed>
          @{profile.username} · Instagram Content Analysis
        </Text>
        <Text style={s.footerRight} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
};

export const buildPdf = async (args: { profile: Profile; stats: ReportStats; narrative: Narrative }) => {
  registerFonts();
  return renderToBuffer(<ReportPdf {...args} />);
};
