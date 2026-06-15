// =============================================================================
// scheduler/timezone
// epoch ms ⇄ IANA タイムゾーンのローカル壁時計時刻の変換ヘルパー（純粋関数）。
// Intl.DateTimeFormat のみを使い、外部ライブラリに依存しない。
// =============================================================================

/** その瞬間における tz の UTC オフセット(ms)。local = utc + offset。 */
function tzOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const parts = dtf.formatToParts(date);
  const m: Record<string, string> = {};
  for (const p of parts) {
    m[p.type] = p.value;
  }
  const asUTC = Date.UTC(
    +m.year,
    +m.month - 1,
    +m.day,
    +m.hour === 24 ? 0 : +m.hour,
    +m.minute,
    +m.second
  );
  return asUTC - date.getTime();
}

/** tz のローカル壁時計時刻 (y, m, d, h, min) を UTC epoch ms に変換。 */
export function zonedWallToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = tzOffsetMs(timeZone, new Date(guess));
  return guess - offset;
}

/** epoch ms の tz ローカルな年月日・時分・曜日を返す。 */
export function localParts(ms: number, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  const m: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(ms))) {
    m[p.type] = p.value;
  }
  const wd: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  return {
    year: +m.year,
    month: +m.month,
    day: +m.day,
    hour: +m.hour === 24 ? 0 : +m.hour,
    minute: +m.minute,
    weekday: wd[m.weekday]
  };
}

/** tz における ms の「その日の 0 時」の UTC epoch ms。 */
export function startOfLocalDay(ms: number, timeZone: string): number {
  const p = localParts(ms, timeZone);
  return zonedWallToUtc(p.year, p.month, p.day, 0, 0, timeZone);
}

/** ローカル時刻に直したときの「時（小数）」。スコアリング用。 */
export function localHour(ms: number, timeZone: string): number {
  const p = localParts(ms, timeZone);
  return p.hour + p.minute / 60;
}
