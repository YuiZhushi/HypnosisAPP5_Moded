import type { HypnosisFeature } from '../../types';
import { CUSTOM_HYPNOSIS_TIER_BASE } from '../constants/customHypnosis';

/**
 * 計算自訂催眠研發成本。
 */
export function calculateCustomHypnosisCostCore(
  tier: HypnosisFeature['tier'],
  costType: 'ONE_TIME' | 'PER_MINUTE',
  costValue: number,
): number {
  const base = CUSTOM_HYPNOSIS_TIER_BASE[tier] ?? 500;
  let easeMultiplier: number;
  if (costType === 'ONE_TIME') {
    easeMultiplier = 2.0;
  } else if (costValue <= 5) {
    easeMultiplier = 1.8;
  } else if (costValue <= 20) {
    easeMultiplier = 1.2;
  } else if (costValue <= 50) {
    easeMultiplier = 1.0;
  } else {
    easeMultiplier = 0.8;
  }
  return Math.floor(base * easeMultiplier);
}
