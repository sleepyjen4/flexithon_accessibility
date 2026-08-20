/**
 * Local-calendar day key (`YYYY-MM-DD`).
 *
 * Deliberately NOT `toISOString().slice(0, 10)`: that yields the UTC day, so for
 * anyone at a negative UTC offset an evening check-in lands on tomorrow's key
 * while the on-screen label (which formats locally) still reads today. The
 * progress calendar then labels a dot with one date and fills it from another
 * day's data.
 *
 * Every producer and consumer of a day key shares this helper so the two can
 * never disagree.
 */
export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
