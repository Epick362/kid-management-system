/**
 * Day-bucketing helpers in Europe/Bratislava timezone.
 * "Today" for Miško means the local Bratislava day, not UTC.
 */

const TZ = "Europe/Bratislava";

const ymdFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const weekdayFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "short",
});

/** Returns the local-day key for a moment, e.g. "2026-05-16". */
export function dayKey(d: Date): string {
  return ymdFmt.format(d);
}

/** Same calendar day in TZ? */
export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/** Sat/Sun in TZ. */
export function isWeekend(d: Date): boolean {
  const wd = weekdayFmt.format(d);
  return wd === "Sat" || wd === "Sun";
}

/** Strict future check at day granularity. */
export function isFutureDay(d: Date, now: Date = new Date()): boolean {
  return dayKey(d) > dayKey(now);
}

/**
 * Iterate every day key in `[start, end]` inclusive (in TZ).
 * Naive UTC-step iteration is safe because we re-key into TZ each step.
 */
export function eachDay(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cursor = new Date(Date.UTC(
    start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(),
  ));
  const endKey = dayKey(end);
  let safety = 400;
  while (safety-- > 0) {
    const k = dayKey(cursor);
    out.push(k);
    if (k >= endKey) break;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/**
 * Returns the first day of a month as a `YYYY-MM-DD` string in TZ.
 * Used to drive the calendar view.
 */
export function monthStartKey(year: number, month1based: number): string {
  return `${year}-${String(month1based).padStart(2, "0")}-01`;
}

/**
 * Returns the number of days in a month (1-based month).
 * Pure Gregorian — same answer in any timezone since months are calendar
 * not wall-clock.
 */
export function daysInMonth(year: number, month1based: number): number {
  return new Date(Date.UTC(year, month1based, 0)).getUTCDate();
}

/**
 * 0 = Monday, 6 = Sunday — what column the first day of the month
 * falls into, given a Monday-leading week (Slovak convention).
 */
export function firstWeekdayMondayLead(year: number, month1based: number): number {
  // 0=Sun..6=Sat in JS
  const dow = new Date(Date.UTC(year, month1based - 1, 1)).getUTCDay();
  return (dow + 6) % 7; // shift so Monday=0
}
