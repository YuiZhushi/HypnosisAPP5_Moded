/**
 * 時間解析相關輔助函式（Phase D-2）
 * 
 * 這些函式原本在 dataService.ts 中，現已下沉至此模組喵~
 */

/**
 * 從日期和時間文字解析虛擬分鐘數喵~
 * 格式：日期 "X月X日"，時間 "HH:MM:SS"
 * 返回：一年中的第 N 分鐘
 */
export function parseVirtualMinutesFrom(dateText?: string, timeText?: string): number | null {
  if (!dateText || !timeText) return null;
  const dateMatch = dateText.match(/(\d+)\s*月\s*(\d+)\s*日/);
  const timeMatch = timeText.match(/(\d{1,2})\s*:\s*(\d{1,2})(?:\s*:\s*(\d{1,2}))?/);
  if (!dateMatch || !timeMatch) return null;

  const month = Number(dateMatch[1]);
  const day = Number(dateMatch[2]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const seconds = timeMatch[3] === undefined ? 0 : Number(timeMatch[3]);
  if (![month, day, hours, minutes].every(Number.isFinite)) return null;
  if (!Number.isFinite(seconds)) return null;

  const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const mIndex = Math.max(1, Math.min(12, month)) - 1;
  const dIndex = Math.max(1, Math.min(monthDays[mIndex], day)) - 1;
  const dayOfYear = monthDays.slice(0, mIndex).reduce((a, b) => a + b, 0) + dIndex;

  const h = Math.max(0, Math.min(23, hours));
  const min = Math.max(0, Math.min(59, minutes));
  const sec = Math.max(0, Math.min(59, seconds));
  return dayOfYear * 24 * 60 + h * 60 + min + sec / 60;
}

/**
 * 從系統變數取得時鐘資訊喵~
 * 返回日期文字、時間文字和虛擬分鐘數
 */
export function getSystemClockFrom(system: Record<string, any> | null | undefined) {
  const dateText = typeof system?.当前日期 === 'string' ? system.当前日期 : undefined;
  const timeText = typeof system?.当前时间 === 'string' ? system.当前时间 : undefined;
  return {
    dateText,
    timeText,
    virtualMinutes: parseVirtualMinutesFrom(dateText, timeText),
  };
}
