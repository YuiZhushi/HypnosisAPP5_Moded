/**
 * 訂閱相關常數（Phase D-2）
 * 
 * 這些常數原本在 dataService.ts 中，現已下沉至此模組喵~
 */

import type { SubscriptionTier } from '../access';

/**
 * 各層級的功能購買價格（MC 點數）喵~
 */
export const PURCHASE_PRICE_BY_TIER: Record<string, number> = {
  TRIAL: 0,
  VIP1: 10,
  VIP2: 50,
  VIP3: 150,
  VIP4: 300,
  VIP5: 1000,
  VIP6: 1000,
};

/**
 * 各訂閱層級的價格（零花錢）喵~
 */
export const SUBSCRIPTION_PRICES: Record<SubscriptionTier, number> = {
  VIP1: 3000,
  VIP2: 6000,
  VIP3: 10000,
  VIP4: 20000,
  VIP5: 40000,
};

/**
 * 訂閱週期的虛擬分鐘數（一週 = 7 * 24 * 60 分鐘）喵~
 */
export const SUBSCRIPTION_WEEK_MINUTES = 7 * 24 * 60;

/**
 * 試用期的層級標籤喵~
 */
export const SUBSCRIPTION_TIER_TRIAL_LABEL = '试用期';

/**
 * 根據訂閱狀態取得層級標籤喵~
 */
export function getSubscriptionTierLabel(
  subscription: { tier: string; endVirtualMinutes: number } | null,
  nowVirtualMinutes: number | null,
): string | null {
  if (!subscription) return SUBSCRIPTION_TIER_TRIAL_LABEL;
  if (nowVirtualMinutes === null) return null;
  return subscription.endVirtualMinutes > nowVirtualMinutes ? subscription.tier : SUBSCRIPTION_TIER_TRIAL_LABEL;
}
