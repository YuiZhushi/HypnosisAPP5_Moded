import type { PersistedStore } from '../types/persistedStore';
import type { SubscriptionState } from '../access';
import { getBodyStatsUnlocked, isSubscriptionActive } from '../access';
import { SUBSCRIPTION_TIER_TRIAL_LABEL } from '../constants/subscriptionConstants';
import type { SessionStartPayload, UserResources } from '../../types';
import { SUBSCRIPTION_PRICES, SUBSCRIPTION_WEEK_MINUTES } from '../constants/subscriptionConstants';
import type { SubscriptionTier } from '../access';
import {
  readStoreSnapshot,
  updateStoreWith,
  setSubscriptionTierLabel,
  getSystemClockCore,
  normalizeChatVariables,
  CHAT_OPTION,
  getUserDataCore,
  updateResourcesCore,
  getVariables,
} from './systemCoreManager';

export function createResourceManager() {
  function getSessionEndImpl(): { endVirtualMinutes: number | null; endAtMs: number | null } {
    const store = readStoreSnapshot();
    return {
      endVirtualMinutes:
        typeof store.sessionEndVirtualMinutes === 'number' && Number.isFinite(store.sessionEndVirtualMinutes)
          ? store.sessionEndVirtualMinutes
          : null,
      endAtMs: typeof store.sessionEndAtMs === 'number' && Number.isFinite(store.sessionEndAtMs) ? store.sessionEndAtMs : null,
    };
  }

  async function setSessionEndImpl(payload: { endVirtualMinutes: number | null; endAtMs: number | null }): Promise<void> {
    await updateStoreWith(store => {
      const next: PersistedStore = { ...store };
      if (payload.endVirtualMinutes === null || !Number.isFinite(payload.endVirtualMinutes)) delete next.sessionEndVirtualMinutes;
      else next.sessionEndVirtualMinutes = payload.endVirtualMinutes;

      if (payload.endAtMs === null || !Number.isFinite(payload.endAtMs)) delete next.sessionEndAtMs;
      else next.sessionEndAtMs = payload.endAtMs;

      return next;
    });
  }

  async function getSubscriptionImpl(): Promise<SubscriptionState | null> {
    return (readStoreSnapshot().subscription as SubscriptionState | undefined) ?? null;
  }

  async function setSubscriptionAutoRenewImpl(autoRenew: boolean): Promise<void> {
    await updateStoreWith(store => ({
      ...store,
      subscription: store.subscription ? { ...store.subscription, autoRenew } : store.subscription,
    }));
  }

  async function clearSubscriptionImpl(): Promise<void> {
    await updateStoreWith(store => {
      const next: PersistedStore = { ...store };
      delete next.subscription;
      return next;
    });
    await setSubscriptionTierLabel(SUBSCRIPTION_TIER_TRIAL_LABEL);
  }

  async function getUnlocksImpl(): Promise<{ debugEnabled: boolean; bodyStatsUnlocked: boolean }> {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    const debugEnabled = Boolean(store.debugEnabled);
    const nowVirtualMinutes = (await getSystemClockCore()).virtualMinutes;
    const subscription = (store.subscription as SubscriptionState | undefined) ?? null;
    const accessContext = { debugEnabled, subscription, nowVirtualMinutes };

    const subscriptionActive = isSubscriptionActive(accessContext);
    let vip1StatsUnlocked = Boolean(store.purchases?.vip1_stats);
    if (!vip1StatsUnlocked && subscriptionActive) {
      await updateStoreWith((s: PersistedStore) => ({ ...s, purchases: { ...s.purchases, vip1_stats: true } }));
      vip1StatsUnlocked = true;
    }
    return { debugEnabled, bodyStatsUnlocked: getBodyStatsUnlocked({ debugEnabled, vip1StatsUnlocked }) };
  }

  function getDebugEnabledImpl(): boolean {
    return Boolean(readStoreSnapshot().debugEnabled);
  }

  async function setDebugEnabledImpl(enabled: boolean): Promise<void> {
    await updateStoreWith(store => ({ ...store, debugEnabled: enabled }));
  }

  async function subscribeOrRenewImpl(params: {
    tier: SubscriptionTier;
    nowVirtualMinutes: number | null;
    extendFromExistingIfActive?: boolean;
  }): Promise<{ ok: boolean; message?: string; subscription?: SubscriptionState | null }> {
    const { tier, nowVirtualMinutes, extendFromExistingIfActive = true } = params;
    if (nowVirtualMinutes === null) return { ok: false, message: '无法读取当前日期/时间，无法计算订阅到期时间' };

    const price = SUBSCRIPTION_PRICES[tier];
    const user = await getUserDataCore();
    if (user.money < price) return { ok: false, message: '零花钱不足' };

    const storeBefore = readStoreSnapshot();
    const prev = storeBefore.subscription as SubscriptionState | undefined;
    const prevActive = Boolean(prev) && prev!.endVirtualMinutes > nowVirtualMinutes;
    const base =
      extendFromExistingIfActive && prevActive
        ? Math.max(nowVirtualMinutes, prev!.endVirtualMinutes)
        : nowVirtualMinutes;

    const nextSub: SubscriptionState = {
      tier,
      endVirtualMinutes: base + SUBSCRIPTION_WEEK_MINUTES,
      autoRenew: prev?.autoRenew ?? false,
    };

    await updateResourcesCore({ money: user.money - price });
    const next = await updateStoreWith(store => ({
      ...store,
      subscription: nextSub,
      purchases: { ...store.purchases, vip1_stats: true },
    }));
    await setSubscriptionTierLabel(tier);
    return { ok: true, subscription: (next.subscription as SubscriptionState | undefined) ?? null };
  }

  async function maybeAutoRenewSubscriptionImpl(nowVirtualMinutes: number | null): Promise<{ renewed: boolean; message?: string }> {
    if (nowVirtualMinutes === null) return { renewed: false };
    const store = readStoreSnapshot();
    const sub = store.subscription as SubscriptionState | undefined;
    if (!sub || !sub.autoRenew) return { renewed: false };
    if (sub.endVirtualMinutes > nowVirtualMinutes) return { renewed: false };
    const result = await subscribeOrRenewImpl({ tier: sub.tier, nowVirtualMinutes, extendFromExistingIfActive: false });
    if (!result.ok) return { renewed: false, message: result.message };
    return { renewed: true };
  }

  async function startSessionImpl(payload: SessionStartPayload): Promise<boolean> {
    console.info('[Backend] Session Started:', payload);
    await updateStoreWith(store => ({ ...store, hasUsedHypnosis: true }));
    return true;
  }

  return {
    getSessionEndImpl,
    setSessionEndImpl,
    getSubscriptionImpl,
    setSubscriptionAutoRenewImpl,
    clearSubscriptionImpl,
    getUnlocksImpl,
    getDebugEnabledImpl,
    setDebugEnabledImpl,
    subscribeOrRenewImpl,
    maybeAutoRenewSubscriptionImpl,
    startSessionImpl,
  };
}
