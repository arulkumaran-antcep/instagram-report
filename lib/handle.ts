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
