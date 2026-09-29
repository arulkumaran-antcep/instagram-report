// Number and date formatting shared by the web UI, PDF and Excel so every
// surface shows the same figure the same way.

const LOCALE = 'en-US';

export const fmtInt = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? '—' : Math.round(n).toLocaleString(LOCALE);

export const fmtCompact = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (abs >= 10_000) return `${trim(n / 1_000, 1)}K`;
  if (abs >= 1_000) return `${trim(n / 1_000, 1)}K`;
  return String(Math.round(n));
};

const trim = (n: number, digits = 1) => Number(n.toFixed(digits)).toString();

export const fmtPct = (fraction: number | null | undefined, digits = 0) =>
  fraction == null || Number.isNaN(fraction) ? '—' : `${(fraction * 100).toFixed(digits)}%`;

export const fmtRate = (percent: number | null | undefined, digits = 2) =>
  percent == null || Number.isNaN(percent) ? '—' : `${percent.toFixed(digits)}%`;

export const fmtIndex = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? '—' : n.toFixed(2));

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString(LOCALE, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

export const fmtMonth = (yyyyMm: string) => {
  const [y, m] = yyyyMm.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(LOCALE, { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`;

export const fmtUsd = (n: number | null | undefined) => (n == null ? '—' : `$${n.toFixed(2)}`);

export const timeAgo = (iso: string) => {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return fmtDate(iso);
};
