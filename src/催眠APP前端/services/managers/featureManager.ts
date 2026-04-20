import type { PersistedStore } from '../types/persistedStore';
import type { HypnosisFeature, UserResources } from '../../types';
import { isPurchaseRequired, getPurchasePricePoints } from '../helpers/featureHelpers';
import type { UserResources } from '../../types';
import { canUseFeature as canUseFeatureBySubscription, type AccessContext } from '../access';
import { FEATURES, PERSISTENT_FEATURE_IDS } from '../constants/features';
import { PURCHASE_PRICE_BY_TIER } from '../constants/subscriptionConstants';

import {
  readStoreSnapshot,
  updateStoreWith,
  normalizeChatVariables,
  CHAT_OPTION,
  getUserDataCore,
  updateResourcesCore,
  getVariables,
} from './systemCoreManager';

export function createFeatureManager(deps: {
  FIRST_FEATURE_ID_BY_TIER: Record<string, string>;
}) {
  const { FIRST_FEATURE_ID_BY_TIER } = deps;

  async function getFeaturesImpl(): Promise<HypnosisFeature[]> {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    const predefined = FEATURES.map(f => ({
      ...f,
      isEnabled: store.features?.[f.id]?.isEnabled ?? f.isEnabled,
      userNote: store.features?.[f.id]?.userNote ?? f.userNote,
      userNumber: store.features?.[f.id]?.userNumber ?? f.userNumber,
      purchaseRequired: isPurchaseRequired(f, FIRST_FEATURE_ID_BY_TIER),
      purchasePricePoints: getPurchasePricePoints(f, FIRST_FEATURE_ID_BY_TIER, PURCHASE_PRICE_BY_TIER) ?? undefined,
      isPurchased: !isPurchaseRequired(f, FIRST_FEATURE_ID_BY_TIER) || Boolean(store.purchases?.[f.id]),
    }));

    const custom: HypnosisFeature[] = Object.values(store.customHypnosis ?? {}).map(ch => ({
      id: ch.id,
      title: ch.title,
      description: ch.description,
      tier: ch.tier,
      costType: ch.costType,
      costValue: ch.costValue,
      costCurrency: 'MC_ENERGY' as const,
      notePlaceholder: ch.notePlaceholder,
      isEnabled: store.features?.[ch.id]?.isEnabled ?? false,
      userNote: store.features?.[ch.id]?.userNote,
      userNumber: store.features?.[ch.id]?.userNumber,
      purchaseRequired: false,
      isPurchased: true,
    }));

    return [...predefined, ...custom];
  }

  async function purchaseFeatureImpl(id: string): Promise<{ ok: boolean; message?: string; user?: UserResources }> {
    const exists = FEATURES.some(f => f.id === id);
    if (!exists) return { ok: false, message: '未知功能' };
    
    const feature = FEATURES.find(f => f.id === id);
    if (!feature) return { ok: false, message: '未知功能' };
    
    const price = getPurchasePricePoints(feature, FIRST_FEATURE_ID_BY_TIER, PURCHASE_PRICE_BY_TIER);
    if (price === null) return { ok: false, message: '该功能无需购买' };

    const storeBefore = readStoreSnapshot();
    if (storeBefore.purchases?.[id]) return { ok: false, message: '已购买' };

    const user = await getUserDataCore();
    if (user.mcPoints < price) return { ok: false, message: `MC点不足：需要 ${price} PT` };

    await updateStoreWith(store => ({ ...store, purchases: { ...store.purchases, [id]: true } }));
    const nextUser = await updateResourcesCore({
      mcPoints: user.mcPoints - price,
      totalConsumedMc: user.totalConsumedMc + price,
    });
    return { ok: true, user: nextUser };
  }

  async function updateFeatureImpl(
    id: string,
    patch: { isEnabled?: boolean; userNote?: string; userNumber?: number },
  ): Promise<void> {
    await updateStoreWith(store => ({
      ...store,
      features: { ...store.features, [id]: { ...store.features[id], ...patch } },
    }));
  }

  async function resetFeaturesImpl(): Promise<void> {
    await updateStoreWith(store => {
      const preserved: PersistedStore['features'] = {};
      for (const [id, state] of Object.entries(store.features ?? {})) {
        if (!PERSISTENT_FEATURE_IDS.has(id)) continue;
        preserved[id] = state;
      }
      return { ...store, features: preserved };
    });
  }

  function canUseFeatureImpl(feature: HypnosisFeature, ctx: AccessContext): boolean {
    if (ctx.debugEnabled) return true;
    if (feature.id === 'vip1_stats') {
      const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
      if (store.purchases?.vip1_stats) return true;
    }
    return canUseFeatureBySubscription(feature, ctx);
  }

  return {
    getFeaturesImpl,
    purchaseFeatureImpl,
    updateFeatureImpl,
    resetFeaturesImpl,
    canUseFeatureImpl,
  };
}
