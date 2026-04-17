/**
 * 訂閱領域服務（Phase B-4）
 */
export type SubscriptionServiceDeps<TStore, TSub, TTier, TCtx> = {
  readStoreSnapshot: () => TStore;
  updateStoreWith: (updater: (store: TStore) => TStore) => Promise<TStore>;
  getStoreSubscription: (store: TStore) => TSub | null;
  setStoreSubscriptionAutoRenew: (store: TStore, autoRenew: boolean) => TStore;
  clearStoreSubscription: (store: TStore) => TStore;
  syncSubscriptionTierLabel: (tierLabel: string) => Promise<void>;
  getTrialTierLabel: () => string;
  subscribeOrRenewByUsecase: (params: {
    tier: TTier;
    nowVirtualMinutes: number | null;
    extendFromExistingIfActive?: boolean;
  }) => Promise<{ ok: boolean; message?: string; subscription?: TSub | null }>;
  maybeAutoRenewByUsecase: (nowVirtualMinutes: number | null) => Promise<{ renewed: boolean; message?: string }>;
  getSubscriptionUnlockThreshold: (tier: TTier) => number;
  canSubscribeTier: (tier: TTier, ctx: { debugEnabled: boolean; totalConsumedMc: number }) => boolean;
  isSubscriptionActive: (ctx: TCtx) => boolean;
  getSubscriptionTiers: () => readonly TTier[];
};

export function createSubscriptionService<TStore, TSub, TTier, TCtx>(
  deps: SubscriptionServiceDeps<TStore, TSub, TTier, TCtx>,
) {
  return {
    async getSubscription(): Promise<TSub | null> {
      return deps.getStoreSubscription(deps.readStoreSnapshot());
    },

    async setSubscriptionAutoRenew(autoRenew: boolean): Promise<void> {
      await deps.updateStoreWith(store => deps.setStoreSubscriptionAutoRenew(store, autoRenew));
    },

    async clearSubscription(): Promise<void> {
      await deps.updateStoreWith(store => deps.clearStoreSubscription(store));
      await deps.syncSubscriptionTierLabel(deps.getTrialTierLabel());
    },

    subscribeOrRenew(params: {
      tier: TTier;
      nowVirtualMinutes: number | null;
      extendFromExistingIfActive?: boolean;
    }): Promise<{ ok: boolean; message?: string; subscription?: TSub | null }> {
      return deps.subscribeOrRenewByUsecase(params);
    },

    maybeAutoRenewSubscription(nowVirtualMinutes: number | null): Promise<{ renewed: boolean; message?: string }> {
      return deps.maybeAutoRenewByUsecase(nowVirtualMinutes);
    },

    getSubscriptionUnlockThreshold(tier: TTier): number {
      return deps.getSubscriptionUnlockThreshold(tier);
    },

    canSubscribeTier(tier: TTier, ctx: { debugEnabled: boolean; totalConsumedMc: number }): boolean {
      return deps.canSubscribeTier(tier, ctx);
    },

    isSubscriptionActive(ctx: TCtx): boolean {
      return deps.isSubscriptionActive(ctx);
    },

    getSubscriptionTiers(): readonly TTier[] {
      return deps.getSubscriptionTiers();
    },
  };
}
