import type { NarrativeBullet } from '@/lib/report-types';

// Checks that every figure the AI wrote exists in the computed data.
// Small bare numbers (< 50) are not checked: they are usually counts,
// ordinals, hours or simple multiples ("3 of the top 10", "7 times").

// Only fields that hold shares, rates or percentages may back a "%" figure.
const FRACTION_KEY = /^(pct|share)|share$|^pctQuestion|^pctEmoji|^pctNumber/i; // 0-1 values
const PERCENT_KEY = /rate$|pct$/i; // already in percent units, e.g. engagementRate 1.33
const LIFT_KEY = /^(lift|index|medianMultiple)$/i; // 2.03 -> "+103%"

const walk = (value: unknown, key: string, onNumber: (n: number, key: string) => void) => {
  if (typeof value === 'number' && Number.isFinite(value)) onNumber(value, key);
  else if (Array.isArray(value)) value.forEach((v) => walk(v, key, onNumber));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => walk(v, k, onNumber));
  else if (typeof value === 'string') {
    for (const m of value.matchAll(/\d+(?:\.\d+)?/g)) onNumber(Number(m[0]), '');
  }
};

export const buildAllowed = (facts: unknown) => {
  const values = new Set<number>();
  const percents = new Set<number>([1, 2, 3]); // the 1-3% engagement benchmark
  walk(facts, '', (n, key) => {
    values.add(n);
    if (FRACTION_KEY.test(key) && Math.abs(n) <= 1) percents.add(n * 100);
    else if (PERCENT_KEY.test(key)) percents.add(n);
    else if (LIFT_KEY.test(key) && n > 0) percents.add((n - 1) * 100);
  });
  return { values: [...values], percents: [...percents] };
};

type Allowed = ReturnType<typeof buildAllowed>;

const close = (a: number, b: number, rel: number, abs = 0) => Math.abs(a - b) <= Math.max(abs, Math.abs(b) * rel);

export const unsupportedNumbers = (text: string, allowed: Allowed): string[] => {
  const cleaned = text
    .replace(/\b\d{4}-\d{2}(-\d{2})?\b/g, ' ') // ISO dates
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ') // clock times
    .replace(/\b(19|20)\d{2}\b/g, ' '); // years
  const bad: string[] = [];
  // A figure may be followed by a full stop (end of sentence) but not by
  // more digits or letters, so "25K." is checked and "5Kg" is not.
  for (const m of cleaned.matchAll(/(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(K|M|%)?(?!\w|\.\d)/g)) {
    const token = m[0].trim();
    const base = Number(m[1].replace(/,/g, ''));
    const unit = m[2];
    const decimals = m[1].includes('.') ? m[1].split('.')[1].length : 0;
    if (unit === '%') {
      // Half a unit of the last written digit (55% may stand for 54.5-55.5).
      const tolerance = 0.55 * 10 ** -decimals;
      if (!allowed.percents.some((p) => Math.abs(base - p) <= tolerance)) bad.push(token);
      continue;
    }
    const value = unit === 'K' ? base * 1_000 : unit === 'M' ? base * 1_000_000 : base;
    if (value < 50) continue;
    const tolerance = unit ? 0.55 * 10 ** -decimals * (unit === 'K' ? 1_000 : 1_000_000) : 0.012;
    if (!allowed.values.some((v) => (unit ? Math.abs(value - v) <= tolerance : close(value, v, tolerance, 1)))) bad.push(token);
  }
  return bad;
};

export const bulletText = (b: NarrativeBullet) => `${b.lead} ${b.text}`;
