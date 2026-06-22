/**
 * Hypnosis APP 後端 — 統一入口
 *
 * 職責：
 * - 催眠功能 CRUD（getFeatures / updateFeature / purchaseFeature / resetFeatures）
 * - 訂閱管理（subscribe / renew / autoRenew / clear）
 * - 催眠工作階段（session start/end）
 * - 自定義催眠 CRUD
 * - 資源扣除/退還
 * - 調試開關
 *
 * 所有函式透過 shared 層讀寫數據，不直接呼叫全域 API。
 */

import type { HypnosisFeature, UserResources, SubscriptionState, CustomHypnosisDef, AccessContext, SessionStartPayload } from '../../constants/interfaces';
import type { SubscriptionTier } from '../../constants/types';
import type { PersistedStore } from '../../constants/schemas/storeSchema';
import { FEATURES, PERSISTENT_FEATURE_IDS } from '../../constants/hypnosis/features';
import { SUBSCRIPTION_PRICES, SUBSCRIPTION_WEEK_MINUTES, SUBSCRIPTION_TIER_TRIAL_LABEL } from '../../constants/hypnosis/subscription';
import { PURCHASE_PRICE_BY_TIER } from '../../constants/hypnosis/subscription';
import { CUSTOM_HYPNOSIS_TIER_BASE } from '../../constants/hypnosis/customHypnosis';
import { isSubscriptionActive, getBodyStatsUnlocked, canUseFeature as canUseFeatureBySubscription } from '../../shared/access/accessControl';
import { normalizeChatVariables, readStoreSnapshot, updateStoreWith, CHAT_OPTION } from '../../shared/store/storeGateway';
import { getUserData, updateResources, getSystemClock, setSubscriptionTierLabel } from '../../shared/store/resourceSync';
import { logger } from '../../../催眠APP共用/debug/loggerService';

// ====== 內部工具 ======

/** 各層級的第一個功能 ID（該功能不需要購買） */
function buildFirstFeatureIdByTier(): Map<HypnosisFeature['tier'], string> {
  const map = new Map<HypnosisFeature['tier'], string>();
  for (const feature of FEATURES) {
    if (feature.tier === 'TRIAL') continue;
    if (!map.has(feature.tier)) map.set(feature.tier, feature.id);
  }
  return map;
}

const FIRST_FEATURE_ID_BY_TIER = buildFirstFeatureIdByTier();

function isPurchaseRequired(feature: HypnosisFeature): boolean {
  if (feature.tier === 'TRIAL') return false;
  const firstId = FIRST_FEATURE_ID_BY_TIER.get(feature.tier);
  return Boolean(firstId) && feature.id !== firstId;
}

function getPurchasePricePoints(feature: HypnosisFeature): number | null {
  if (!isPurchaseRequired(feature)) return null;
  return PURCHASE_PRICE_BY_TIER[feature.tier] ?? PURCHASE_PRICE_BY_TIER.VIP5;
}

function calculateCustomHypnosisCost(
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

// ====== 功能管理 ======

/** 取得所有催眠功能（預定義 + 自定義），已合併持久化狀態 */
export function getFeatures(): HypnosisFeature[] {
  const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));

  const predefined = FEATURES.map(f => ({
    ...f,
    isEnabled: store.features?.[f.id]?.isEnabled ?? f.isEnabled,
    userNote: store.features?.[f.id]?.userNote ?? f.userNote,
    userNumber: store.features?.[f.id]?.userNumber ?? f.userNumber,
    purchaseRequired: isPurchaseRequired(f),
    purchasePricePoints: getPurchasePricePoints(f) ?? undefined,
    isPurchased: !isPurchaseRequired(f) || Boolean(store.purchases?.[f.id]),
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

/** 更新功能的啟用狀態 / 備註 / 數值 */
export async function updateFeature(
  id: string,
  patch: { isEnabled?: boolean; userNote?: string; userNumber?: number },
): Promise<void> {
  await updateStoreWith(store => ({
    ...store,
    features: { ...store.features, [id]: { ...store.features[id], ...patch } },
  }));
}

/** 購買功能（扣除 MC 點數） */
export async function purchaseFeature(id: string): Promise<{ ok: boolean; message?: string; user?: UserResources }> {
  const feature = FEATURES.find(f => f.id === id);
  if (!feature) return { ok: false, message: '未知功能' };

  const price = getPurchasePricePoints(feature);
  if (price === null) return { ok: false, message: '该功能无需购买' };

  const storeBefore = readStoreSnapshot();
  if (storeBefore.purchases?.[id]) return { ok: false, message: '已购买' };

  const user = await getUserData();
  if (user.mcPoints < price) return { ok: false, message: `MC点不足：需要 ${price} PT` };

  await updateStoreWith(
    store => ({ ...store, purchases: { ...store.purchases, [id]: true } }),
  );
  const nextUser = await updateResources({
    mcPoints: user.mcPoints - price,
    totalConsumedMc: user.totalConsumedMc + price,
  });
  return { ok: true, user: nextUser };
}

/** 重置所有功能（保留 PERSISTENT_FEATURE_IDS 中的功能） */
export async function resetFeatures(): Promise<void> {
  await updateStoreWith(store => {
    const preserved: PersistedStore['features'] = {};
    for (const [id, state] of Object.entries(store.features ?? {})) {
      if (!PERSISTENT_FEATURE_IDS.has(id)) continue;
      preserved[id] = state;
    }
    return { ...store, features: preserved };
  });
}

/** 權限檢查：用戶是否可使用某功能 */
export function canUseFeature(feature: HypnosisFeature, ctx: AccessContext): boolean {
  if (ctx.debugEnabled) return true;
  if (feature.id === 'vip1_stats') {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    if (store.purchases?.vip1_stats) return true;
  }
  return canUseFeatureBySubscription(feature, ctx);
}

// ====== 訂閱管理 ======

/** 取得當前訂閱狀態 */
export function getSubscription(): SubscriptionState | null {
  return (readStoreSnapshot().subscription as SubscriptionState | undefined) ?? null;
}

/** 設定自動續訂 */
export async function setSubscriptionAutoRenew(autoRenew: boolean): Promise<void> {
  await updateStoreWith(
    store => ({ ...store, subscription: store.subscription ? { ...store.subscription, autoRenew } : store.subscription }),
  );
}

/** 清除訂閱 */
export async function clearSubscription(): Promise<void> {
  await updateStoreWith(store => {
    const next: PersistedStore = { ...store };
    delete next.subscription;
    return next;
  });
  await setSubscriptionTierLabel(SUBSCRIPTION_TIER_TRIAL_LABEL);
}

/** 訂閱或續期 */
export async function subscribeOrRenew(params: {
  tier: SubscriptionTier;
  nowVirtualMinutes: number | null;
  extendFromExistingIfActive?: boolean;
}): Promise<{ ok: boolean; message?: string; subscription?: SubscriptionState | null }> {
  const { tier, nowVirtualMinutes, extendFromExistingIfActive = true } = params;
  if (nowVirtualMinutes === null) return { ok: false, message: '无法读取当前日期/时间，无法计算订阅到期时间' };

  const price = SUBSCRIPTION_PRICES[tier];
  const user = await getUserData();
  if (user.money < price) return { ok: false, message: '零花钱不足' };

  const storeBefore = readStoreSnapshot();
  const prev = storeBefore.subscription as SubscriptionState | undefined;
  const prevActive = Boolean(prev) && prev!.endVirtualMinutes > nowVirtualMinutes;
  const base = extendFromExistingIfActive && prevActive
    ? Math.max(nowVirtualMinutes, prev!.endVirtualMinutes)
    : nowVirtualMinutes;

  const nextSub: SubscriptionState = {
    tier,
    endVirtualMinutes: base + SUBSCRIPTION_WEEK_MINUTES,
    autoRenew: prev?.autoRenew ?? false,
  };

  await updateResources({ money: user.money - price });
  const next = await updateStoreWith(store => ({
    ...store,
    subscription: nextSub,
    purchases: { ...store.purchases, vip1_stats: true },
  }));
  await setSubscriptionTierLabel(tier);
  return { ok: true, subscription: (next.subscription as SubscriptionState | undefined) ?? null };
}

/** 自動續訂檢查（每次讀取時鐘時調用） */
export async function maybeAutoRenewSubscription(nowVirtualMinutes: number | null): Promise<{ renewed: boolean; message?: string }> {
  if (nowVirtualMinutes === null) return { renewed: false };
  const store = readStoreSnapshot();
  const sub = store.subscription as SubscriptionState | undefined;
  if (!sub || !sub.autoRenew) return { renewed: false };
  if (sub.endVirtualMinutes > nowVirtualMinutes) return { renewed: false };
  const result = await subscribeOrRenew({ tier: sub.tier, nowVirtualMinutes, extendFromExistingIfActive: false });
  if (!result.ok) return { renewed: false, message: result.message };
  return { renewed: true };
}

// ====== 催眠工作階段 ======

/** 取得工作階段結束資訊 */
export function getSessionEnd(): { endVirtualMinutes: number | null; endAtMs: number | null } {
  const store = readStoreSnapshot();
  return {
    endVirtualMinutes: typeof store.sessionEndVirtualMinutes === 'number' && Number.isFinite(store.sessionEndVirtualMinutes) ? store.sessionEndVirtualMinutes : null,
    endAtMs: typeof store.sessionEndAtMs === 'number' && Number.isFinite(store.sessionEndAtMs) ? store.sessionEndAtMs : null,
  };
}

/** 設定工作階段結束時間 */
export async function setSessionEnd(payload: { endVirtualMinutes: number | null; endAtMs: number | null }): Promise<void> {
  await updateStoreWith(store => {
    const next: PersistedStore = { ...store };
    if (payload.endVirtualMinutes === null || !Number.isFinite(payload.endVirtualMinutes)) delete next.sessionEndVirtualMinutes;
    else next.sessionEndVirtualMinutes = payload.endVirtualMinutes;
    if (payload.endAtMs === null || !Number.isFinite(payload.endAtMs)) delete next.sessionEndAtMs;
    else next.sessionEndAtMs = payload.endAtMs;
    return next;
  });
}

/** 清除工作階段結束時間 */
export async function clearSessionEnd(): Promise<void> {
  await setSessionEnd({ endVirtualMinutes: null, endAtMs: null });
}

/** 開始催眠工作階段 */
export async function startSession(payload: SessionStartPayload): Promise<boolean> {
  logger.info('催眠工作阶段已开始', payload);
  await updateStoreWith(
    store => ({ ...store, hasUsedHypnosis: true }),
  );
  return true;
}

// ====== 自定義催眠 ======

export { calculateCustomHypnosisCost };

/** 取得所有自定義催眠 */
export function getCustomHypnosisList(): CustomHypnosisDef[] {
  return Object.values(readStoreSnapshot().customHypnosis ?? {});
}

/** 新增自定義催眠（扣除研發費用） */
export async function addCustomHypnosis(
  def: Omit<CustomHypnosisDef, 'id' | 'createdAt' | 'researchCost'>,
): Promise<{ ok: boolean; message?: string; id?: string }> {
  const store = readStoreSnapshot();
  const existing = Object.keys(store.customHypnosis ?? {});
  if (existing.length >= 10) return { ok: false, message: '自定义催眠已达上限（10个）' };

  const cost = calculateCustomHypnosisCost(def.tier, def.costType, def.costValue);
  const user = await getUserData();
  if (user.money < cost) return { ok: false, message: `金钱不足：需要 ¥${cost.toLocaleString()}` };

  const id = `custom_hyp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry: CustomHypnosisDef = { ...def, id, createdAt: Date.now(), researchCost: cost };

  await updateStoreWith(
    s => ({ ...s, customHypnosis: { ...s.customHypnosis, [id]: entry } }),
  );
  await updateResources({ money: user.money - cost });
  return { ok: true, id };
}

/** 刪除自定義催眠（退還 50% 研發費用） */
export async function deleteCustomHypnosis(id: string): Promise<{ ok: boolean; message?: string; refund?: number }> {
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
    const user = await getUserData();
    await updateResources({ money: user.money + refund });
  }

  return { ok: true, refund };
}

// ====== 系統工具 ======

/** 取得解鎖狀態 */
export async function getUnlocks(): Promise<{ debugEnabled: boolean; bodyStatsUnlocked: boolean }> {
  const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
  const debugEnabled = Boolean(store.debugEnabled);
  const nowVirtualMinutes = (await getSystemClock()).virtualMinutes;
  const subscription = (store.subscription as SubscriptionState | undefined) ?? null;
  const accessContext: AccessContext = { debugEnabled, subscription, nowVirtualMinutes };

  const subscriptionActive = isSubscriptionActive(accessContext);
  let vip1StatsUnlocked = Boolean(store.purchases?.vip1_stats);
  if (!vip1StatsUnlocked && subscriptionActive) {
    await updateStoreWith(
      (s: PersistedStore) => ({ ...s, purchases: { ...s.purchases, vip1_stats: true } }),
    );
    vip1StatsUnlocked = true;
  }
  return { debugEnabled, bodyStatsUnlocked: getBodyStatsUnlocked({ debugEnabled, vip1StatsUnlocked }) };
}

/** 取得調試開關 */
export function getDebugEnabled(): boolean {
  return Boolean(readStoreSnapshot().debugEnabled);
}

/** 設定調試開關 */
export async function setDebugEnabled(enabled: boolean): Promise<void> {
  await updateStoreWith(
    store => ({ ...store, debugEnabled: enabled }),
  );
}

// 提示詞構造（催眠 APP 獨立管理）
export { buildHypnosisSendMessage } from './promptBuilder';
