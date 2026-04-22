/**
 * 功能相關輔助函式（Phase D-2）
 * 
 * 這些函式原本在 dataService.ts 中，現已下沉至此模組喵~
 */

import type { HypnosisFeature } from '../../types';

/**
 * 各層級的第一個功能 ID 喵~
 * 用於判斷是否需要購買功能
 */
export function createFirstFeatureIdByTier(features: HypnosisFeature[]): Map<HypnosisFeature['tier'], string> {
  const map = new Map<HypnosisFeature['tier'], string>();
  for (const feature of features) {
    if (feature.tier === 'TRIAL') continue;
    if (!map.has(feature.tier)) map.set(feature.tier, feature.id);
  }
  return map;
}

/**
 * 判斷功能是否需要購買喵~
 * 如果是該層級的第一個功能，則不需要購買
 */
export function isPurchaseRequired(
  feature: HypnosisFeature,
  firstFeatureIdByTier: Map<HypnosisFeature['tier'], string>,
): boolean {
  if (feature.tier === 'TRIAL') return false;
  const firstId = firstFeatureIdByTier.get(feature.tier);
  return Boolean(firstId) && feature.id !== firstId;
}

/**
 * 取得功能的購買價格（MC 點數）喵~
 * 如果不需要購買則返回 null
 */
export function getPurchasePricePoints(
  feature: HypnosisFeature,
  firstFeatureIdByTier: Map<HypnosisFeature['tier'], string>,
  purchasePriceByTier: Record<string, number>,
): number | null {
  if (!isPurchaseRequired(feature, firstFeatureIdByTier)) return null;
  return purchasePriceByTier[feature.tier] ?? purchasePriceByTier.VIP5;
}
