/**
 * 功能領域服務（Phase B-4）
 */
export type FeatureServiceDeps<TStore, TFeature, TCtx, TUserResources = unknown> = {
  readStoreSnapshot: () => TStore;
  updateStoreWith: (updater: (store: TStore) => TStore) => Promise<TStore>;
  getFeatures: () => Promise<TFeature[]>;
  purchaseFeatureByUsecase: (id: string) => Promise<{ ok: boolean; message?: string; user?: TUserResources }>;
  updateFeatureInStore: (
    store: TStore,
    id: string,
    patch: { isEnabled?: boolean; userNote?: string; userNumber?: number },
  ) => TStore;
  resetFeaturesInStore: (store: TStore) => TStore;
  canUseFeature: (feature: TFeature, ctx: TCtx) => boolean;
  getUnlocks: () => Promise<{ debugEnabled: boolean; bodyStatsUnlocked: boolean }>;
  getDebugEnabledFromStore: (store: TStore) => boolean;
  setDebugEnabledToStore: (store: TStore, enabled: boolean) => TStore;
};

export function createFeatureService<TStore, TFeature, TCtx, TUserResources = unknown>(
  deps: FeatureServiceDeps<TStore, TFeature, TCtx, TUserResources>,
) {
  return {
    getFeatures: () => deps.getFeatures(),

    async purchaseFeature(id: string): Promise<{ ok: boolean; message?: string; user?: TUserResources }> {
      return deps.purchaseFeatureByUsecase(id);
    },

    async updateFeature(id: string, patch: { isEnabled?: boolean; userNote?: string; userNumber?: number }): Promise<void> {
      await deps.updateStoreWith(store => deps.updateFeatureInStore(store, id, patch));
    },

    async resetFeatures(): Promise<void> {
      await deps.updateStoreWith(store => deps.resetFeaturesInStore(store));
    },

    canUseFeature(feature: TFeature, ctx: TCtx): boolean {
      return deps.canUseFeature(feature, ctx);
    },

    getUnlocks(): Promise<{ debugEnabled: boolean; bodyStatsUnlocked: boolean }> {
      return deps.getUnlocks();
    },

    async getDebugEnabled(): Promise<boolean> {
      return deps.getDebugEnabledFromStore(deps.readStoreSnapshot());
    },

    async setDebugEnabled(enabled: boolean): Promise<void> {
      await deps.updateStoreWith(store => deps.setDebugEnabledToStore(store, enabled));
    },
  };
}
