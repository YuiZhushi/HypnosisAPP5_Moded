/**
 * ID 生成相關輔助函式（Phase D-2）
 * 
 * 這些函式原本在 dataService.ts 中，現已下沉至此模組喵~
 */

/**
 * 將字串轉換為安全的 ID 格式喵~
 * 使用 encodeURIComponent 並將 % 替換為 _
 */
export function idSafe(part: string): string {
  return encodeURIComponent(part).replaceAll('%', '_');
}

/**
 * 生成成就 ID 喵~
 * 格式：prefix__part1__part2__...
 */
export function makeAchievementId(prefix: string, ...parts: string[]) {
  return [prefix, ...parts.map(idSafe)].join('__');
}
