// Accepts "name", "@name" or a pasted profile URL. Returns the bare lowercase
// username, or null if it can't be a valid Instagram username.
export const parseHandle = (input: string): string | null => {
  const name = input
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/^@+/, '')
    .toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(name)) return null;
  if (/^\.+$/.test(name) || name.startsWith('.') || name.endsWith('.')) return null;
  return name;
};

export const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (IST, UTC+5:30)' },
  { value: 'Asia/Dubai', label: 'UAE (GST, UTC+4)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT, UTC+8)' },
  { value: 'Europe/London', label: 'United Kingdom (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Central Europe (CET/CEST)' },
  { value: 'America/New_York', label: 'US Eastern (ET)' },
  { value: 'America/Los_Angeles', label: 'US Pacific (PT)' },
  { value: 'Australia/Sydney', label: 'Australia Eastern (AET)' },
  { value: 'UTC', label: 'UTC' },
] as const;

export const isSupportedTimezone = (tz: string) => TIMEZONES.some((t) => t.value === tz);

export type PeriodKey = '3m' | '6m' | '12m' | 'custom';

export const PERIODS: { value: PeriodKey; label: string; hint: string; months?: number }[] = [
  { value: '12m', label: 'Last 12 months', hint: 'Full audit with trajectory (recommended)', months: 12 },
  { value: '6m', label: 'Last 6 months', hint: 'Recent strategy, half the cost', months: 6 },
  { value: '3m', label: 'Last 3 months', hint: 'Quick check of current content', months: 3 },
  { value: 'custom', label: 'Custom date range', hint: 'Choose exact start and end dates' },
];

export const MAX_LOOKBACK_MONTHS = 24;
export const MIN_RANGE_DAYS = 7;

const DAY_MS = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export const customRangeBounds = (today = new Date()) => {
  const earliest = new Date(today);
  earliest.setUTCMonth(earliest.getUTCMonth() - MAX_LOOKBACK_MONTHS);
  return { min: isoDay(earliest), max: isoDay(today) };
};

// Returns an error message, or null if the range is usable.
export const customRangeProblem = (start: string, end: string, today = new Date()): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return 'Choose a start and an end date.';
  const { min, max } = customRangeBounds(today);
  if (start < min) return `The start date can be at most ${MAX_LOOKBACK_MONTHS} months ago.`;
  if (end > max) return 'The end date can’t be in the future.';
  if (end < start) return 'The end date must be after the start date.';
  if ((Date.parse(end) - Date.parse(start)) / DAY_MS + 1 < MIN_RANGE_DAYS) return `Choose a range of at least ${MIN_RANGE_DAYS} days.`;
  return null;
};

export const monthsBetween = (start: string, end: string) =>
  Math.max(1, Math.round(((Date.parse(end) - Date.parse(start)) / DAY_MS + 1) / 30.44));
