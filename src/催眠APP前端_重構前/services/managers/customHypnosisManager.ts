import type { PersistedStore } from '../types/persistedStore';
import type { CustomHypnosisDef, UserResources, HypnosisFeature } from '../../types';
import { calculateCustomHypnosisCostCore } from '../helpers/customHypnosisCost';

import { readStoreSnapshot, updateStoreWith, getUserDataCore, updateResourcesCore } from './systemCoreManager';

export function createCustomHypnosisManager() {

  function calculateCustomHypnosisCostImpl(
    tier: HypnosisFeature['tier'],
    costType: 'ONE_TIME' | 'PER_MINUTE',
    costValue: number,
  ): number {
    return calculateCustomHypnosisCostCore(tier, costType, costValue);
  }

  function getCustomHypnosisImpl(): CustomHypnosisDef[] {
    return Object.values(readStoreSnapshot().customHypnosis ?? {});
  }

  async function addCustomHypnosisImpl(
    def: Omit<CustomHypnosisDef, 'id' | 'createdAt' | 'researchCost'>,
  ): Promise<{ ok: boolean; message?: string; id?: string }> {
    const store = readStoreSnapshot();
    const customHypnosisRecord = store.customHypnosis ?? {};
    const existing = Object.keys(customHypnosisRecord);
    if (existing.length >= 10) return { ok: false, message: '自定义催眠已达上限（10个）' };

    const cost = calculateCustomHypnosisCostImpl(def.tier, def.costType, def.costValue);
    const user = await getUserDataCore();
    if (user.money < cost) return { ok: false, message: `金钱不足：需要 ¥${cost.toLocaleString()}` };

    const id = `custom_hyp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entry: CustomHypnosisDef = { ...def, id, createdAt: Date.now(), researchCost: cost };

    await updateStoreWith(s => ({
      ...s,
      customHypnosis: { ...s.customHypnosis, [id]: entry }
    }));
    await updateResourcesCore({ money: user.money - cost });
    return { ok: true, id };
  }

  async function deleteCustomHypnosisImpl(id: string): Promise<{ ok: boolean; message?: string; refund?: number }> {
    const store = readStoreSnapshot();
    const entry = store.customHypnosis?.[id];
    if (!entry) return { ok: false, message: '未找到该催眠' };

    const refund = Math.floor(entry.researchCost * 0.5);
    await updateStoreWith(s => {
      const nextHyp = { ...s.customHypnosis };
      delete nextHyp[id];
      const nextFeatures = { ...s.features };
      delete nextFeatures[id];
      return { ...s, customHypnosis: nextHyp, features: nextFeatures };
    });

    if (refund > 0) {
      const user = await getUserDataCore();
      await updateResourcesCore({ money: user.money + refund });
    }

    return { ok: true, refund };
  }

  return {
    calculateCustomHypnosisCostImpl,
    getCustomHypnosisImpl,
    addCustomHypnosisImpl,
    deleteCustomHypnosisImpl,
  };
}
