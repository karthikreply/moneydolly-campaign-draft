/** The demo season is March 1 through April 15. A finished window rolls to next year. */
export function defaultSeasonWindow(now = new Date()): { windowStart: string; windowEnd: string } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  const seasonOver = month > 3 || (month === 3 && day > 15);
  const seasonYear = seasonOver ? year + 1 : year;
  return {
    windowStart: `${seasonYear}-03-01`,
    windowEnd: `${seasonYear}-04-15`,
  };
}
