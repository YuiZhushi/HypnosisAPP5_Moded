import type { HypnosisFeature } from '../../types';

/**
 * 自訂催眠研發成本：各訂閱層級的基礎價格。
 */
export const CUSTOM_HYPNOSIS_TIER_BASE: Record<HypnosisFeature['tier'], number> = {
  TRIAL: 500,
  VIP1: 1000,
  VIP2: 3000,
  VIP3: 8000,
  VIP4: 20000,
  VIP5: 50000,
  VIP6: 50000,
};
