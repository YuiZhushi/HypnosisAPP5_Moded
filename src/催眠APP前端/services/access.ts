import type { HypnosisFeature } from '../types';
import { VIP_LEVELS } from '../types';

export const SUBSCRIPTION_TIERS = ['VIP1', 'VIP2', 'VIP3', 'VIP4', 'VIP5'] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export type SubscriptionState = {
  tier: SubscriptionTier;
  endVirtualMinutes: number;
  autoRenew: boolean;
};

export type AccessContext = {
  debugEnabled: boolean;
  subscription: SubscriptionState | null;
  nowVirtualMinutes: number | null;
};

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function getSubscriptionUnlockThreshold(tier: SubscriptionTier): number {
  const cfg = VIP_LEVELS.find(v => v.tier === tier);
  return toFiniteNumber(cfg?.unlockThreshold) ?? 0;
}

export function canSubscribeTier(ctx: {
  tier: SubscriptionTier;
  debugEnabled: boolean;
  totalConsumedMc: number;
}): boolean {
  if (ctx.debugEnabled) return true;
  return ctx.totalConsumedMc >= getSubscriptionUnlockThreshold(ctx.tier);
}

export function isSubscriptionActive(ctx: AccessContext): boolean {
  if (ctx.debugEnabled) return true;
  if (!ctx.subscription) return false;
  if (ctx.nowVirtualMinutes === null) return false;
  return ctx.subscription.endVirtualMinutes > ctx.nowVirtualMinutes;
}

function featureRequiredSubscriptionTier(feature: HypnosisFeature): SubscriptionTier | null {
  if (feature.tier === 'TRIAL') return null;
  if (SUBSCRIPTION_TIERS.includes(feature.tier as SubscriptionTier)) return feature.tier as SubscriptionTier;

  // Feature tiers above VIP5 still require the highest subscription tier.
  return 'VIP5';
}

export function canUseFeature(feature: HypnosisFeature, ctx: AccessContext): boolean {
  if (ctx.debugEnabled) return true;

  const required = featureRequiredSubscriptionTier(feature);
  if (required === null) return true;

  if (!isSubscriptionActive(ctx) || !ctx.subscription) return false;
  return SUBSCRIPTION_TIERS.indexOf(ctx.subscription.tier) >= SUBSCRIPTION_TIERS.indexOf(required);
}

export function getBodyStatsUnlocked(opts: { debugEnabled: boolean; vip1StatsUnlocked: boolean }): boolean {
  return opts.debugEnabled || opts.vip1StatsUnlocked;
}
