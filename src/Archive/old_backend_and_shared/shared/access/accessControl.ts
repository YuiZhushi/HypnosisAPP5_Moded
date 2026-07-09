/**
 * AccessControl — 權限判定層
 *
 * 純函式，無副作用。
 * 基於 AccessContext 判斷用戶可否使用特定功能。
 */

import type { HypnosisFeature, AccessContext, SubscriptionState } from '../../constants/interfaces';
import { SUBSCRIPTION_TIERS, type SubscriptionTier } from '../../constants/types';
import { VIP_LEVELS } from '../../constants/common/vipLevels';

// ====== 輔助 ======

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

// ====== 公開 API ======

/** 取得訂閱等級的解鎖門檻 */
export function getSubscriptionUnlockThreshold(tier: SubscriptionTier): number {
  const cfg = VIP_LEVELS.find(v => v.tier === tier);
  return toFiniteNumber(cfg?.unlockThreshold) ?? 0;
}

/** 判斷用戶是否可訂閱指定 tier */
export function canSubscribeTier(ctx: {
  tier: SubscriptionTier;
  debugEnabled: boolean;
  totalConsumedMc: number;
}): boolean {
  if (ctx.debugEnabled) return true;
  return ctx.totalConsumedMc >= getSubscriptionUnlockThreshold(ctx.tier);
}

/** 判斷用戶的訂閱是否有效 */
export function isSubscriptionActive(ctx: AccessContext): boolean {
  if (ctx.debugEnabled) return true;
  if (!ctx.subscription) return false;
  if (ctx.nowVirtualMinutes === null) return false;
  return ctx.subscription.endVirtualMinutes > ctx.nowVirtualMinutes;
}

/** 判斷用戶是否可使用指定催眠功能 */
export function canUseFeature(feature: HypnosisFeature, ctx: AccessContext): boolean {
  if (ctx.debugEnabled) return true;

  const required = featureRequiredSubscriptionTier(feature);
  if (required === null) return true;

  if (!isSubscriptionActive(ctx) || !ctx.subscription) return false;
  return SUBSCRIPTION_TIERS.indexOf(ctx.subscription.tier) >= SUBSCRIPTION_TIERS.indexOf(required);
}

/** 判斷身體狀態 APP 是否已解鎖 */
export function getBodyStatsUnlocked(opts: { debugEnabled: boolean; vip1StatsUnlocked: boolean }): boolean {
  return opts.debugEnabled || opts.vip1StatsUnlocked;
}

// ====== 內部 ======

function featureRequiredSubscriptionTier(feature: HypnosisFeature): SubscriptionTier | null {
  if (feature.tier === 'TRIAL') return null;
  if (SUBSCRIPTION_TIERS.includes(feature.tier as SubscriptionTier)) return feature.tier as SubscriptionTier;
  return 'VIP5';
}
