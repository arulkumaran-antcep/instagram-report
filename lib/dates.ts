// Calendar-day helpers for custom report ranges (whole days in a timezone).

export const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

// The UTC instant when the given calendar day (YYYY-MM-DD) starts in timeZone.
export const zonedDayStart = (day: string, timeZone: string) => {
  const guess = Date.parse(`${day}T00:00:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value]),
  );
  const asLocal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(guess - (asLocal - guess));
};

// [start of `from`, end of `to`] as UTC instants, inclusive of the whole last day.
export const zonedRange = (from: string, to: string, timeZone: string) => ({
  start: zonedDayStart(from, timeZone),
  end: new Date(zonedDayStart(addDays(to, 1), timeZone).getTime() - 1),
});

// The calendar day (YYYY-MM-DD) an instant falls on in the given timezone.
export const dayInZone = (iso: string, timezone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
