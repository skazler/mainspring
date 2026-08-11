/**
 * Calendar dates in the user's LOCAL timezone.
 *
 * `new Date().toISOString()` is UTC: west of Greenwich it rolls over to tomorrow
 * during the evening, so a purchase logged at 7pm on the 31st would be stamped
 * with the 1st and land in next month's budget — and the month would appear to
 * reset hours early. Everything that keys a calendar day or month goes through
 * here. (Timestamps that are moments rather than dates — exports, refresh times
 * — stay ISO/UTC.)
 */

/** Today as YYYY-MM-DD, local. */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The current calendar month as YYYY-MM, local. */
export function localMonth(): string {
  return localToday().slice(0, 7);
}

/** The local calendar date `n` days before today, as YYYY-MM-DD. */
export function localDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Last calendar day of the current month as YYYY-MM-DD, local. */
export function endOfThisMonth(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

/**
 * Days from `isoDate` (YYYY-MM-DD) to the end of its month, counting that day.
 * Takes the date rather than reading the clock so callers can pass reactive
 * state and stay pure.
 */
export function daysLeftInMonth(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y ?? 1970, m ?? 1, 0).getDate() - (d ?? 1) + 1;
}
