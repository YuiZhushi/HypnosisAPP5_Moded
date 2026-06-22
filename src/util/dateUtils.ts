import { clampNumber } from './mathUtils';

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
const WEEKDAY_CHARS = ['一', '二', '三', '四', '五', '六', '日'] as const;

export function parseTimeToMinutes(time: unknown): number | null {
  if (typeof time !== 'string') return null;
  const m = /^(\d{1,2})\s*:\s*(\d{1,2})(?:\s*:\s*(\d{1,2}))?$/.exec(time.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

export type ParsedDate = {
  month: number;
  day: number;
  weekdayIndex: number | null;
};

export function parseDateText(text: unknown): ParsedDate | null {
  if (typeof text !== 'string') return null;
  const s = text.trim();
  const dateMatch = /(\d{1,2})\s*月\s*(\d{1,2})\s*日/.exec(s);
  if (!dateMatch) return null;
  const month = Number(dateMatch[1]);
  const day = Number(dateMatch[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;

  const weekdayMatch = /(星期|周)\s*([一二三四五六日天])/.exec(s);
  const weekdayChar = weekdayMatch ? weekdayMatch[2] : null;
  const normalized = weekdayChar === '天' ? '日' : weekdayChar;
  const weekdayIndex = normalized ? WEEKDAY_CHARS.indexOf(normalized as any) : -1;

  return {
    month: clampNumber(month, 1, 12),
    day: clampNumber(day, 1, MONTH_DAYS[clampNumber(month, 1, 12) - 1]),
    weekdayIndex: weekdayIndex >= 0 ? weekdayIndex : null,
  };
}

export function toDayOfYear(d: ParsedDate): number {
  const mIndex = clampNumber(d.month, 1, 12) - 1;
  const dIndex = clampNumber(d.day, 1, MONTH_DAYS[mIndex]) - 1;
  const prefix = MONTH_DAYS.slice(0, mIndex).reduce((a, b) => a + b, 0);
  return prefix + dIndex;
}

export function addDays(d: ParsedDate, deltaDays: number): ParsedDate {
  let month = clampNumber(d.month, 1, 12);
  let day = clampNumber(d.day, 1, MONTH_DAYS[month - 1]);
  let weekdayIndex = d.weekdayIndex;

  let remaining = Math.max(0, Math.floor(deltaDays));
  while (remaining > 0) {
    day += 1;
    if (day > MONTH_DAYS[month - 1]) {
      day = 1;
      month += 1;
      if (month > 12) month = 1;
    }
    if (weekdayIndex !== null) weekdayIndex = (weekdayIndex + 1) % WEEKDAY_CHARS.length;
    remaining -= 1;
  }

  return { month, day, weekdayIndex };
}

export function formatDateText(d: ParsedDate): string {
  if (d.weekdayIndex === null) return `${d.month}月${d.day}日`;
  const weekdayChar = WEEKDAY_CHARS[clampNumber(d.weekdayIndex, 0, WEEKDAY_CHARS.length - 1)];
  return `${d.month}月${d.day}日 星期${weekdayChar}`;
}

export function resolveDayDelta(
  beforeDate: unknown,
  afterDate: unknown,
  beforeTime: unknown,
  afterTime: unknown,
): { dayDelta: number; isDateMissingUpdate: boolean; nextDateText?: string } {
  const beforeParsed = parseDateText(beforeDate);
  const afterParsed = parseDateText(afterDate);
  const beforeMinutes = parseTimeToMinutes(beforeTime);
  const afterMinutes = parseTimeToMinutes(afterTime);
  const timeCrossed = beforeMinutes !== null && afterMinutes !== null && afterMinutes < beforeMinutes;

  if (!beforeParsed || !afterParsed) {
    const unchanged = typeof beforeDate === 'string' && typeof afterDate === 'string' && beforeDate === afterDate;
    const isDateMissingUpdate = unchanged && timeCrossed;
    return { dayDelta: isDateMissingUpdate ? 1 : 0, isDateMissingUpdate };
  }

  const beforeDay = toDayOfYear(beforeParsed);
  const afterDay = toDayOfYear(afterParsed);
  let delta = afterDay - beforeDay;
  if (delta < 0) delta += 365; // 允许跨年（简单按 365 天处理）

  const isSameDay = delta === 0;
  const isDateMissingUpdate = isSameDay && timeCrossed;
  if (!isDateMissingUpdate) return { dayDelta: Math.max(0, Math.floor(delta)), isDateMissingUpdate: false };

  const nextDate = addDays(afterParsed, 1);
  return { dayDelta: 1, isDateMissingUpdate: true, nextDateText: formatDateText(nextDate) };
}
