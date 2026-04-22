/**
 * 系統相關輔助函式（Phase D-2）
 * 
 * 這些函式原本在 dataService.ts 中，現已下沉至此模組喵~
 */

/**
 * 將任意值轉換為有限數字喵~
 * 如果無法轉換則返回 null
 */
export function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * 正規化系統變數別名喵~
 * 處理舊版欄位名稱到新版的轉換
 */
export function normalizeSystemAliases(systemRaw: Record<string, any>) {
  const existingEnergy = toFiniteNumber(systemRaw._MC能量);
  if (existingEnergy === null) {
    const mcEnergy = toFiniteNumber(systemRaw.MC能量);
    if (mcEnergy !== null) systemRaw._MC能量 = mcEnergy;
  }

  const existingEnergyMax = toFiniteNumber(systemRaw._MC能量上限);
  if (existingEnergyMax === null) {
    const mcEnergyMax = toFiniteNumber(systemRaw.MC能量上限);
    if (mcEnergyMax !== null) systemRaw._MC能量上限 = mcEnergyMax;
  }
  return systemRaw;
}
