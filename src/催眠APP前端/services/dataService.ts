/**
 * DataService 入口層（Phase D-2 重構後）
 * 
 * 這個檔案現在只負責：
 * 1. 組裝依賴
 * 2. 作為 facade 對外入口
 * 
 * 所有實作都已下沉到對應的 helper / constant / store 模組喵~
 */

import { z } from 'zod';
import { QUEST_DB, type QuestDefinition } from '../data/questDb';
import {
  Achievement,
  CustomHypnosisDef,
  EditorPromptModule,
  HypnosisFeature,
  PlaceholderDefinition,
  PromptTemplateV2,
  Quest,
  QuestStatus,
  SessionStartPayload,
  UserResources,
} from '../types';
import {
  canSubscribeTier,
  canUseFeature as canUseFeatureBySubscription,
  getBodyStatsUnlocked,
  getSubscriptionUnlockThreshold,
  isSubscriptionActive,
  SUBSCRIPTION_TIERS,
  type AccessContext,
  type SubscriptionState,
  type SubscriptionTier,
} from './access';
import { MvuBridge } from './mvuBridge';
import { createStoreGateway } from './store/storeGateway';
import { createHypnoAppUsecaseService } from './usecases/hypnoAppUsecaseService';
import { createSettingsService } from './domain/settingsService';
import { createCustomHypnosisService } from './domain/customHypnosisService';
import { createResourceService } from './domain/resourceService';
import { createSubscriptionService } from './domain/subscriptionService';
import { createFeatureService } from './domain/featureService';
import { createAchievementQuestService } from './domain/achievementQuestService';
import { createCalendarService } from './domain/calendarService';

// === 常數模組 ===
import { CUSTOM_HYPNOSIS_TIER_BASE } from './constants/customHypnosis';
import {
  DEFAULT_EDITOR_PROMPT_MODULES,
  DEFAULT_SECTION_CONTENTS_MAP,
  DEFAULT_SECTION_FORMATS_MAP,
  DEFAULT_SECTION_INSTRUCTIONS_MAP,
} from './constants/editorPromptDefaults';
import { FEATURES as FEATURES_BASE } from './constants/features';
import {
  DEFAULT_SETTINGS_PROMPT_CONFIG,
  cloneSettingsPromptConfig,
  type SettingsPromptTuningConfig,
  type SettingsPromptModule,
  type SettingsPromptPlaceholder,
} from './constants/settingsPromptDefaults';
import { DEFAULT_USER_DATA } from './constants/userDefaults';
import {
  PURCHASE_PRICE_BY_TIER,
  SUBSCRIPTION_PRICES,
  SUBSCRIPTION_WEEK_MINUTES,
  SUBSCRIPTION_TIER_TRIAL_LABEL,
  getSubscriptionTierLabel,
} from './constants/subscriptionConstants';
import { PERSISTENT_FEATURE_IDS } from './constants/featureConstants';

// === Helper 模組 ===
import { calculateCustomHypnosisCostCore } from './helpers/customHypnosisCost';
import { normalizeEditorPromptModules as normalizeEditorPromptModulesHelper } from './helpers/editorPromptModules';
import {
  buildRoleBasedAchievements,
  findQuestDef,
  mergeAchievementsWithClaimed,
  resolveQuestStatus,
  validateQuestDb,
} from './helpers/achievementQuestCore';
import {
  cleanupAfterRollback as cleanupAfterRollbackCalendarStore,
  ensureCalendarCrud,
  ensureNode,
  getCurrentFloorAndSwipe as getCurrentFloorAndSwipeFromStoreHelper,
  resolveCalendarStateAt as resolveCalendarStateAtStore,
} from './helpers/calendarCrudStore';
import { floorKey, swipeKey } from './helpers/calendarCrudResolver';
import { toFiniteNumber, normalizeSystemAliases } from './helpers/systemHelpers';
import { idSafe, makeAchievementId } from './helpers/idHelpers';
import { parseVirtualMinutesFrom, getSystemClockFrom } from './helpers/timeHelpers';
import { normalizeSettingsPromptConfig } from './helpers/settingsPromptHelpers';
import { createFirstFeatureIdByTier, isPurchaseRequired, getPurchasePricePoints } from './helpers/featureHelpers';
import { getRolesAndSystemSnapshot } from './helpers/mvuHelpers';
import { systemToUserResources } from './helpers/userResourceHelpers';
import { createAchievementQuestImplFunctions } from './helpers/achievementQuestImpl';
import { createCalendarEventImplFunctions } from './helpers/calendarEventImpl';

// === Store 模組 ===
import { STORE_SCHEMA } from './store/storeSchema';
import { createSystemSchema, type SystemWithStore } from './store/systemSchema';
import { migrateStore } from './store/migrateStore';
import {
  type CalendarCrudNode,
  type CalendarCrudOp,
  type CalendarEventPatch,
  type CalendarResolvedState,
  type PersistedStore,
  DEFAULT_CALENDAR_CRUD,
  normalizeCalendarCrudStore,
  type CustomCalendarEvent as PersistedCustomCalendarEvent,
} from './types/persistedStore';

declare function getVariables(option?: any): any;
declare function updateVariablesWith(callback: (vars: any) => void, option?: any): any;
declare function getCurrentMessageId(): number;
declare function getChatMessages(floor?: number, options?: { include_swipes?: boolean }): unknown[] | undefined;

const CHAT_OPTION = { type: 'chat' } as const;

// CalendarCRUD 渲染路徑調適開關（預設關閉；需要時手動改為 true）
const CALENDAR_CRUD_RESOLVE_DEBUG = false;

const FEATURES: HypnosisFeature[] = FEATURES_BASE;
const FIRST_FEATURE_ID_BY_TIER = createFirstFeatureIdByTier(FEATURES);

// 匯出類型供外部使用
export type CustomCalendarEvent = PersistedCustomCalendarEvent;
export type { SettingsPromptTuningConfig } from './constants/settingsPromptDefaults';

// === SYSTEM_SCHEMA 建立 ===
const SYSTEM_SCHEMA = createSystemSchema(DEFAULT_USER_DATA);

// === Store Gateway 建立 ===
const storeGateway = createStoreGateway<SystemWithStore, PersistedStore>({
  chatOption: CHAT_OPTION,
  getVariables,
  updateVariablesWith,
  normalizeSystemAliases,
  systemSchema: SYSTEM_SCHEMA,
  storeSchema: STORE_SCHEMA,
  migrateStore,
  syncPersistedStore: store => MvuBridge.syncPersistedStore(store),
});

const normalizeChatVariables = storeGateway.normalizeChatVariables;
const updateStoreWith = storeGateway.updateStoreWith;
const readStoreSnapshot = storeGateway.readStoreSnapshot;

// === Core 函式 ===
function getCurrentFloorAndSwipe(): { floor: number; swipeId: number } {
  return getCurrentFloorAndSwipeFromStoreHelper({ getCurrentMessageId, getChatMessages });
}

function resolveCalendarStateAt(store: PersistedStore, targetFloor: number): CalendarResolvedState {
  return resolveCalendarStateAtStore(store, targetFloor, {
    debug: CALENDAR_CRUD_RESOLVE_DEBUG,
    logger: payload => {
      console.info('[HypnoOS][CalendarCRUD] resolve path', payload);
    },
  });
}

async function setSubscriptionTierLabel(tierLabel: string): Promise<void> {
  updateVariablesWith(vars => {
    const { system } = normalizeChatVariables(vars);
    if (system._催眠APP订阅等级 === tierLabel) return vars;
    system._催眠APP订阅等级 = tierLabel;
    vars.系统 = system;
    return vars;
  }, CHAT_OPTION);
  await MvuBridge.syncSubscriptionTier(tierLabel);
}

// === Core 函式（getUserDataCore, updateResourcesCore, getSystemClockCore）===
async function getUserDataCore(): Promise<UserResources> {
  let user: UserResources | undefined;
  try {
    const mvuSystem = await MvuBridge.getSystem();
    if (mvuSystem) {
      user = systemToUserResources(SYSTEM_SCHEMA.parse(normalizeSystemAliases(mvuSystem)));
    }
  } catch (err) {
    console.warn('[HypnoOS] 读取 MVU 系统变量失败，回退到聊天变量', err);
  }

  updateVariablesWith(vars => {
    const { system } = normalizeChatVariables(vars);
    user ??= systemToUserResources(system);
    return vars;
  }, CHAT_OPTION);

  if (user) {
    updateVariablesWith(vars => {
      const { system, store } = normalizeChatVariables(vars);
      system._MC能量 = user!.mcEnergy;
      system._MC能量上限 = user!.mcEnergyMax;
      system.当前MC点 = user!.mcPoints;
      system._累计消耗MC点 = user!.totalConsumedMc;
      system.持有零花钱 = user!.money;
      system.主角可疑度 = user!.suspicion;
      system._hypnoos = store;
      vars.系统 = system;
      return vars;
    }, CHAT_OPTION);
  }

  return user ?? DEFAULT_USER_DATA;
}

async function updateResourcesCore(newData: Partial<UserResources>): Promise<UserResources> {
  const merged: UserResources = { ...(await getUserDataCore()), ...newData };
  updateVariablesWith(vars => {
    const { system, store } = normalizeChatVariables(vars);
    system._MC能量 = merged.mcEnergy;
    system._MC能量上限 = merged.mcEnergyMax;
    system.当前MC点 = merged.mcPoints;
    system._累计消耗MC点 = merged.totalConsumedMc;
    system.持有零花钱 = merged.money;
    system.主角可疑度 = merged.suspicion;
    system._hypnoos = store;
    vars.系统 = system;
    return vars;
  }, CHAT_OPTION);

  await MvuBridge.syncUserResources(merged);
  return merged;
}

async function getSystemClockCore(): Promise<{ dateText?: string; timeText?: string; virtualMinutes: number | null }> {
  const maybeSync = async (clock: { virtualMinutes: number | null }) => {
    try {
      await syncSubscriptionTierLabel(clock.virtualMinutes);
    } catch (err) {
      console.warn('[HypnoOS] 同步订阅等级变量失败', err);
    }
    return clock;
  };

  try {
    const mvuSystem = await MvuBridge.getSystem();
    if (mvuSystem) return await maybeSync(getSystemClockFrom(mvuSystem));
  } catch (err) {
    console.warn('[HypnoOS] 读取 MVU 系统时间失败，回退到聊天变量', err);
  }

  const { system } = normalizeChatVariables(getVariables(CHAT_OPTION));
  return await maybeSync(getSystemClockFrom(system));
}

async function syncSubscriptionTierLabel(nowVirtualMinutes: number | null): Promise<void> {
  const { system, store } = normalizeChatVariables(getVariables(CHAT_OPTION));
  const subscription = (store.subscription as SubscriptionState | undefined) ?? null;
  const desired = getSubscriptionTierLabel(subscription, nowVirtualMinutes);
  if (desired === null) return;
  if (system._催眠APP订阅等级 === desired) return;

  updateVariablesWith(vars => {
    const { system: nextSystem } = normalizeChatVariables(vars);
    nextSystem._催眠APP订阅等级 = desired;
    vars.系统 = nextSystem;
    return vars;
  }, CHAT_OPTION);

  await MvuBridge.syncSubscriptionTier(desired);
}

// === Usecase Service 建立 ===
const hypnoAppUsecaseService = createHypnoAppUsecaseService<
  PersistedStore,
  CustomHypnosisDef,
  Achievement,
  QuestDefinition,
  UserResources
>({
  subscriptionPrices: SUBSCRIPTION_PRICES,
  subscriptionWeekMinutes: SUBSCRIPTION_WEEK_MINUTES,
  getUserData: () => getUserDataCore(),
  updateResources: patch => updateResourcesCore(patch),
  readStoreSnapshot,
  updateStoreWith,
  setSubscriptionTierLabel,
  getStoreSubscription: store => store.subscription,
  setStoreSubscriptionAndVipStatsPurchase: (store, sub) => ({
    ...store,
    subscription: sub,
    purchases: { ...store.purchases, vip1_stats: true },
  }),
  getStorePurchases: store => store.purchases ?? {},
  setStorePurchased: (store, id) => ({ ...store, purchases: { ...store.purchases, [id]: true } }),
  getFeaturePurchasePricePoints: id => {
    const feature = FEATURES.find(f => f.id === id);
    if (!feature) return null;
    return getPurchasePricePoints(feature, FIRST_FEATURE_ID_BY_TIER, PURCHASE_PRICE_BY_TIER);
  },
  getAchievements: async () => {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    const dynamic = await buildRoleBasedAchievements(store, {
      getRolesAndSystemSnapshot: () => getRolesAndSystemSnapshot(normalizeChatVariables, getVariables, CHAT_OPTION),
      toFiniteNumber,
      makeAchievementId,
    });
    return mergeAchievementsWithClaimed(store, dynamic);
  },
  isAchievementClaimed: (store, id) => Boolean(store.achievements[id]),
  setAchievementClaimed: (store, id) => ({ ...store, achievements: { ...store.achievements, [id]: true } }),
  findQuestDef: (id, store) => findQuestDef(id, store, validateQuestDb(QUEST_DB)),
  getQuestName: quest => quest.name,
  getQuestReward: quest => quest.rewardMcPoints,
  getTasks: () => MvuBridge.getTasks(),
  deleteTask: taskName => MvuBridge.deleteTask(taskName),
  setQuestClaimed: (store, id) => ({ ...store, quests: { ...store.quests, [id]: 'CLAIMED' } }),
  getCustomHypnosisRecord: store => store.customHypnosis ?? {},
  getCustomHypnosisLimit: () => 10,
  calculateCustomHypnosisCost: def => calculateCustomHypnosisCostCore(def.tier, def.costType, def.costValue),
  createCustomHypnosisEntry: (id, def, cost) => ({ ...def, id, createdAt: Date.now(), researchCost: cost }),
  appendCustomHypnosis: (store, id, entry) => ({ ...store, customHypnosis: { ...store.customHypnosis, [id]: entry } }),
  removeCustomHypnosisAndFeature: (store, id) => {
    const nextHyp = { ...store.customHypnosis };
    delete nextHyp[id];
    const nextFeatures = { ...store.features };
    delete nextFeatures[id];
    return { ...store, customHypnosis: nextHyp, features: nextFeatures };
  },
  getCustomHypnosisResearchCost: entry => entry.researchCost,
  getCustomHypnosisTitle: entry => entry.title,
  markSessionStarted: (store, _payload: SessionStartPayload) => ({ ...store, hasUsedHypnosis: true }),
  makeId: prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
});

// === Domain Services 建立 ===
const resourceDomainService = createResourceService<UserResources, PersistedStore>({
  getUserData: () => getUserDataCore(),
  updateResources: patch => updateResourcesCore(patch),
  getSystemClock: () => getSystemClockCore(),
  startSession: payload => hypnoAppUsecaseService.startSession(payload),
  readStoreSnapshot,
  updateStoreWith,
  getSessionEndFromStore: store => ({
    endVirtualMinutes:
      typeof store.sessionEndVirtualMinutes === 'number' && Number.isFinite(store.sessionEndVirtualMinutes)
        ? store.sessionEndVirtualMinutes
        : null,
    endAtMs: typeof store.sessionEndAtMs === 'number' && Number.isFinite(store.sessionEndAtMs) ? store.sessionEndAtMs : null,
  }),
  setSessionEndToStore: (store, payload) => {
    const next: PersistedStore = { ...store };
    if (payload.endVirtualMinutes === null || !Number.isFinite(payload.endVirtualMinutes)) delete next.sessionEndVirtualMinutes;
    else next.sessionEndVirtualMinutes = payload.endVirtualMinutes;

    if (payload.endAtMs === null || !Number.isFinite(payload.endAtMs)) delete next.sessionEndAtMs;
    else next.sessionEndAtMs = payload.endAtMs;

    return next;
  },
});

const customHypnosisDomainService = createCustomHypnosisService<PersistedStore, CustomHypnosisDef, HypnosisFeature['tier']>({
  readStoreSnapshot,
  listFromStore: store => Object.values(store.customHypnosis ?? {}),
  calculateCost: (tier, costType, costValue) => calculateCustomHypnosisCostCore(tier, costType, costValue),
  addByUsecase: def => hypnoAppUsecaseService.addCustomHypnosis(def),
  deleteByUsecase: id => hypnoAppUsecaseService.deleteCustomHypnosis(id),
});

const subscriptionDomainService = createSubscriptionService<
  PersistedStore,
  SubscriptionState,
  SubscriptionTier,
  AccessContext
>({
  readStoreSnapshot,
  updateStoreWith,
  getStoreSubscription: store => (store.subscription as SubscriptionState | undefined) ?? null,
  setStoreSubscriptionAutoRenew: (store, autoRenew) => ({
    ...store,
    subscription: store.subscription ? { ...store.subscription, autoRenew } : store.subscription,
  }),
  clearStoreSubscription: store => {
    const next: PersistedStore = { ...store };
    delete next.subscription;
    return next;
  },
  syncSubscriptionTierLabel: tierLabel => setSubscriptionTierLabel(tierLabel),
  getTrialTierLabel: () => SUBSCRIPTION_TIER_TRIAL_LABEL,
  subscribeOrRenewByUsecase: params => hypnoAppUsecaseService.subscribeOrRenew(params),
  maybeAutoRenewByUsecase: nowVirtualMinutes => hypnoAppUsecaseService.maybeAutoRenewSubscription(nowVirtualMinutes),
  getSubscriptionUnlockThreshold: tier => getSubscriptionUnlockThreshold(tier),
  canSubscribeTier: (tier, ctx) =>
    canSubscribeTier({ tier, debugEnabled: ctx.debugEnabled, totalConsumedMc: ctx.totalConsumedMc }),
  isSubscriptionActive: ctx => isSubscriptionActive(ctx),
  getSubscriptionTiers: () => SUBSCRIPTION_TIERS,
});

const featureDomainService = createFeatureService<PersistedStore, HypnosisFeature, AccessContext, UserResources>({
  readStoreSnapshot,
  updateStoreWith,
  getFeatures: async () => {
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
  },
  purchaseFeatureByUsecase: async id => {
    const exists = FEATURES.some(f => f.id === id);
    if (!exists) return { ok: false, message: '未知功能' };
    return await hypnoAppUsecaseService.purchaseFeature(id);
  },
  updateFeatureInStore: (store, id, patch) => ({
    ...store,
    features: { ...store.features, [id]: { ...store.features[id], ...patch } },
  }),
  resetFeaturesInStore: store => {
    const preserved: PersistedStore['features'] = {};
    for (const [id, state] of Object.entries(store.features ?? {})) {
      if (!PERSISTENT_FEATURE_IDS.has(id)) continue;
      preserved[id] = state;
    }
    return { ...store, features: preserved };
  },
  canUseFeature: (feature, ctx) => {
    if (ctx.debugEnabled) return true;
    if (feature.id === 'vip1_stats') {
      const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
      if (store.purchases?.vip1_stats) return true;
    }
    return canUseFeatureBySubscription(feature, ctx);
  },
  getUnlocks: async () => {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    const debugEnabled = Boolean(store.debugEnabled);
    const nowVirtualMinutes = (await getSystemClockCore()).virtualMinutes;
    const subscription = (store.subscription as SubscriptionState | undefined) ?? null;
    const accessContext: AccessContext = { debugEnabled, subscription, nowVirtualMinutes };

    const subscriptionActive = isSubscriptionActive(accessContext);
    let vip1StatsUnlocked = Boolean(store.purchases?.vip1_stats);
    if (!vip1StatsUnlocked && subscriptionActive) {
      await updateStoreWith(s => ({ ...s, purchases: { ...s.purchases, vip1_stats: true } }));
      vip1StatsUnlocked = true;
    }
    return { debugEnabled, bodyStatsUnlocked: getBodyStatsUnlocked({ debugEnabled, vip1StatsUnlocked }) };
  },
  getDebugEnabledFromStore: store => Boolean(store.debugEnabled),
  setDebugEnabledToStore: (store, enabled) => ({ ...store, debugEnabled: enabled }),
});

const settingsDomainService = createSettingsService<
  PersistedStore,
  SettingsPromptTuningConfig,
  EditorPromptModule,
  PersistedStore['apiSettings']
>({
  readStoreSnapshot,
  updateStoreWith,
  getApiSettingsFromStore: store => store.apiSettings,
  mergeApiSettings: (store, patch) => {
    const current = store.apiSettings ?? {
      apiKey: '',
      apiEndpoint: '',
      modelName: '',
      temperature: 0.7,
      maxTokens: 8192,
      topP: 1,
      presencePenalty: 0,
      frequencyPenalty: 0,
      streamMode: 'non_streaming' as const,
    };
    return { ...store, apiSettings: { ...current, ...patch } };
  },
  normalizePromptConfigFromStore: store => normalizeSettingsPromptConfig(store.settingsPromptTuning),
  getDefaultPromptConfig: () => cloneSettingsPromptConfig(DEFAULT_SETTINGS_PROMPT_CONFIG),
  toPromptStorePatch: (next, store) => {
    const normalized: SettingsPromptTuningConfig = {
      modules: next.modules.map(m => ({
        id: String(m.id),
        title: String(m.title || m.id),
        content: String(m.content ?? ''),
        enabled: m.enabled !== false,
      })),
      moduleOrder: next.moduleOrder.map(String),
      placeholders: next.placeholders.map(p => ({
        key: String(p.key),
        value: String(p.value ?? ''),
        enabled: p.enabled !== false,
        source: p.source ?? 'user',
        resolverType: p.resolverType ?? 'static',
        scope: 'app',
      })),
    };

    const modulesRecord: NonNullable<PersistedStore['settingsPromptTuning']>['modules'] = {};
    for (const module of normalized.modules) {
      modulesRecord[module.id] = { ...module };
    }

    const placeholdersRecord: NonNullable<PersistedStore['settingsPromptTuning']>['placeholders'] = {};
    for (const placeholder of normalized.placeholders) {
      placeholdersRecord[placeholder.key] = { ...placeholder };
    }

    return {
      ...store,
      settingsPromptTuning: {
        modules: modulesRecord,
        moduleOrder: normalized.moduleOrder,
        placeholders: placeholdersRecord,
      },
    };
  },
  normalizeEditorModulesFromStore: store => normalizeEditorPromptModulesHelper(store.editorPromptModules, DEFAULT_EDITOR_PROMPT_MODULES),
  getDefaultEditorModules: () => DEFAULT_EDITOR_PROMPT_MODULES.map(m => ({ ...m })),
  toEditorModulesStorePatch: (modules, store) => {
    const record: NonNullable<PersistedStore['editorPromptModules']> = {};
    for (const m of modules) {
      record[m.id] = {
        id: m.id,
        title: m.title,
        content: m.content,
        type: m.type,
        sectionId: m.sectionId,
        order: m.order,
      };
    }
    return { ...store, editorPromptModules: record };
  },
});

// === Achievement/Quest Domain Service（使用下沉後的 Impl 函式）===
const achievementQuestImplFns = createAchievementQuestImplFunctions({
  normalizeChatVariables,
  getVariables,
  CHAT_OPTION,
  getUserDataCore,
  updateResourcesCore,
  updateStoreWith,
  toFiniteNumber,
  makeAchievementId,
  getRolesAndSystemSnapshot: () => getRolesAndSystemSnapshot(normalizeChatVariables, getVariables, CHAT_OPTION),
});

const achievementQuestDomainService = createAchievementQuestService<Achievement, Quest>({
  getAchievementsImpl: achievementQuestImplFns.getAchievementsImpl,
  claimAchievementByUsecase: (id, currentPoints) => hypnoAppUsecaseService.claimAchievement(id, currentPoints),
  getQuestsImpl: achievementQuestImplFns.getQuestsImpl,
  acceptQuestImpl: achievementQuestImplFns.acceptQuestImpl,
  cancelQuestImpl: achievementQuestImplFns.cancelQuestImpl,
  claimQuestByUsecase: (id, currentPoints) => hypnoAppUsecaseService.claimQuest(id, currentPoints),
  publishCustomQuestImpl: achievementQuestImplFns.publishCustomQuestImpl,
  deleteCustomQuestImpl: achievementQuestImplFns.deleteCustomQuestImpl,
});

// === Calendar Domain Service（使用下沉後的 Impl 函式）===
const calendarEventImplFns = createCalendarEventImplFunctions({
  normalizeChatVariables,
  getVariables,
  CHAT_OPTION,
  getCurrentFloorAndSwipe,
  resolveCalendarStateAt,
  updateStoreWith,
  getChatMessages: (floor, options) => getChatMessages(floor, options),
  getCalendarEvents: () => calendarDomainService.getCalendarEvents(),
  CALENDAR_CRUD_RESOLVE_DEBUG,
});

const calendarDomainService = createCalendarService<CustomCalendarEvent>({
  getCalendarEventsImpl: calendarEventImplFns.getCalendarEventsImpl,
  processCalendarBridgeEventsOnLoadImpl: calendarEventImplFns.processCalendarBridgeEventsOnLoadImpl,
  addCalendarEventImpl: calendarEventImplFns.addCalendarEventImpl,
  updateCalendarEventImpl: calendarEventImplFns.updateCalendarEventImpl,
  deleteCalendarEventImpl: calendarEventImplFns.deleteCalendarEventImpl,
  findCalendarEventByTitleAndDateImpl: calendarEventImplFns.findCalendarEventByTitleAndDateImpl,
});

// === DataService Facade ===
export const DataService = {
  getUnlocks: async (): Promise<{ debugEnabled: boolean; bodyStatsUnlocked: boolean }> => {
    return await featureDomainService.getUnlocks();
  },

  getSubscriptionUnlockThreshold: (tier: SubscriptionTier): number =>
    subscriptionDomainService.getSubscriptionUnlockThreshold(tier),

  canSubscribeTier: (tier: SubscriptionTier, ctx: { debugEnabled: boolean; totalConsumedMc: number }): boolean =>
    subscriptionDomainService.canSubscribeTier(tier, ctx),

  isSubscriptionActive: (ctx: AccessContext): boolean => subscriptionDomainService.isSubscriptionActive(ctx),

  canUseFeature: (feature: HypnosisFeature, ctx: AccessContext): boolean => featureDomainService.canUseFeature(feature, ctx),

  getSubscriptionTiers: (): readonly SubscriptionTier[] => subscriptionDomainService.getSubscriptionTiers(),

  getUserData: async (): Promise<UserResources> => {
    return await resourceDomainService.getUserData();
  },

  getSystemClock: async (): Promise<{ dateText?: string; timeText?: string; virtualMinutes: number | null }> => {
    return await resourceDomainService.getSystemClock();
  },

  getSessionEnd: async (): Promise<{ endVirtualMinutes: number | null; endAtMs: number | null }> => {
    return await resourceDomainService.getSessionEnd();
  },

  setSessionEnd: async ({
    endVirtualMinutes,
    endAtMs,
  }: {
    endVirtualMinutes: number | null;
    endAtMs: number | null;
  }) => {
    await resourceDomainService.setSessionEnd({ endVirtualMinutes, endAtMs });
  },

  clearSessionEnd: async () => {
    await resourceDomainService.clearSessionEnd();
  },

  getSubscription: async (): Promise<SubscriptionState | null> => {
    return await subscriptionDomainService.getSubscription();
  },

  setSubscriptionAutoRenew: async (autoRenew: boolean) => {
    await subscriptionDomainService.setSubscriptionAutoRenew(autoRenew);
  },

  clearSubscription: async () => {
    await subscriptionDomainService.clearSubscription();
  },

  subscribeOrRenew: async ({
    tier,
    nowVirtualMinutes,
    extendFromExistingIfActive = true,
  }: {
    tier: SubscriptionTier;
    nowVirtualMinutes: number | null;
    extendFromExistingIfActive?: boolean;
  }): Promise<{ ok: boolean; message?: string; subscription?: SubscriptionState | null }> => {
    return await subscriptionDomainService.subscribeOrRenew({ tier, nowVirtualMinutes, extendFromExistingIfActive });
  },

  maybeAutoRenewSubscription: async (
    nowVirtualMinutes: number | null,
  ): Promise<{ renewed: boolean; message?: string }> => {
    return await subscriptionDomainService.maybeAutoRenewSubscription(nowVirtualMinutes);
  },

  getFeatures: async (): Promise<HypnosisFeature[]> => {
    return await featureDomainService.getFeatures();
  },

  purchaseFeature: async (id: string): Promise<{ ok: boolean; message?: string; user?: UserResources }> => {
    return await featureDomainService.purchaseFeature(id);
  },

  getDebugEnabled: async (): Promise<boolean> => {
    return await featureDomainService.getDebugEnabled();
  },

  setDebugEnabled: async (enabled: boolean) => {
    await featureDomainService.setDebugEnabled(enabled);
  },

  updateResources: async (newData: Partial<UserResources>): Promise<UserResources> => {
    return await resourceDomainService.updateResources(newData);
  },

  startSession: async (payload: SessionStartPayload): Promise<boolean> => {
    return await resourceDomainService.startSession(payload);
  },

  updateFeature: async (id: string, patch: { isEnabled?: boolean; userNote?: string; userNumber?: number }) => {
    await featureDomainService.updateFeature(id, patch);
  },

  resetFeatures: async () => {
    await featureDomainService.resetFeatures();
  },

  getAchievements: async (): Promise<Achievement[]> => {
    return await achievementQuestDomainService.getAchievements();
  },

  getQuests: async (): Promise<Quest[]> => {
    return await achievementQuestDomainService.getQuests();
  },

  claimAchievement: async (id: string, currentPoints: number): Promise<{ success: boolean; newPoints: number }> => {
    return await achievementQuestDomainService.claimAchievement(id, currentPoints);
  },

  acceptQuest: async (id: string): Promise<{ success: boolean; message?: string }> => {
    return await achievementQuestDomainService.acceptQuest(id);
  },

  cancelQuest: async (id: string): Promise<{ success: boolean; message?: string }> => {
    return await achievementQuestDomainService.cancelQuest(id);
  },

  claimQuest: async (id: string, currentPoints: number): Promise<{ success: boolean; newPoints: number }> => {
    return await achievementQuestDomainService.claimQuest(id, currentPoints);
  },

  publishCustomQuest: async (params: {
    name: string;
    condition: string;
    rewardMcPoints: number;
  }): Promise<{ ok: boolean; message?: string }> => {
    return await achievementQuestDomainService.publishCustomQuest(params);
  },

  deleteCustomQuest: async (id: string): Promise<{ ok: boolean; message?: string }> => {
    return await achievementQuestDomainService.deleteCustomQuest(id);
  },

  // ─── Calendar Events ────────────────────────────────────────

  getCalendarEvents: (): CustomCalendarEvent[] => {
    return calendarDomainService.getCalendarEvents();
  },

  processCalendarBridgeEventsOnLoad: async (): Promise<void> => {
    await calendarDomainService.processCalendarBridgeEventsOnLoad();
  },

  addCalendarEvent: async (params: {
    month: number;
    day: number;
    title: string;
    description?: string;
  }): Promise<{ ok: boolean; id?: string; message?: string }> => {
    return await calendarDomainService.addCalendarEvent(params);
  },

  updateCalendarEvent: async (
    id: string,
    patch: { title?: string; description?: string; month?: number; day?: number },
  ): Promise<{ ok: boolean; message?: string }> => {
    return await calendarDomainService.updateCalendarEvent(id, patch);
  },

  deleteCalendarEvent: async (id: string): Promise<{ ok: boolean; message?: string }> => {
    return await calendarDomainService.deleteCalendarEvent(id);
  },

  findCalendarEventByTitleAndDate: (title: string, month: number, day: number): CustomCalendarEvent | undefined => {
    return calendarDomainService.findCalendarEventByTitleAndDate(title, month, day);
  },

  // --- Custom Hypnosis ---

  CUSTOM_HYPNOSIS_TIER_BASE: {
    ...CUSTOM_HYPNOSIS_TIER_BASE,
  } as Record<string, number>,

  calculateCustomHypnosisCost: (
    tier: HypnosisFeature['tier'],
    costType: 'ONE_TIME' | 'PER_MINUTE',
    costValue: number,
  ): number => {
    return customHypnosisDomainService.calculateCustomHypnosisCost(tier, costType, costValue);
  },

  getCustomHypnosis: (): CustomHypnosisDef[] => {
    return customHypnosisDomainService.getCustomHypnosis();
  },

  addCustomHypnosis: async (
    def: Omit<CustomHypnosisDef, 'id' | 'createdAt' | 'researchCost'>,
  ): Promise<{ ok: boolean; message?: string; id?: string }> => {
    return await customHypnosisDomainService.addCustomHypnosis(def);
  },

  deleteCustomHypnosis: async (id: string): Promise<{ ok: boolean; message?: string; refund?: number }> => {
    return await customHypnosisDomainService.deleteCustomHypnosis(id);
  },

  // --- API Settings (shared across all apps) ---

  getApiSettings: (): PersistedStore['apiSettings'] => {
    return settingsDomainService.getApiSettings();
  },

  getSettingsPromptConfig: (): SettingsPromptTuningConfig => {
    return settingsDomainService.getSettingsPromptConfig();
  },

  getDefaultSettingsPromptConfig: (): SettingsPromptTuningConfig => {
    return settingsDomainService.getDefaultSettingsPromptConfig();
  },

  updateSettingsPromptConfig: async (next: SettingsPromptTuningConfig): Promise<void> => {
    await settingsDomainService.updateSettingsPromptConfig(next);
  },

  updateApiSettings: async (patch: Partial<NonNullable<PersistedStore['apiSettings']>>): Promise<void> => {
    await settingsDomainService.updateApiSettings(patch);
  },

  fetchAvailableModels: async (endpoint: string, apiKey: string): Promise<string[]> => {
    return await settingsDomainService.fetchAvailableModels(endpoint, apiKey);
  },

  // --- Editor Prompt Modules (Character Editor) ---

  getEditorPromptModules: (): EditorPromptModule[] => {
    return settingsDomainService.getEditorPromptModules();
  },

  getDefaultEditorPromptModules: (): EditorPromptModule[] => {
    return settingsDomainService.getDefaultEditorPromptModules();
  },

  saveEditorPromptModules: async (modules: EditorPromptModule[]): Promise<void> => {
    await settingsDomainService.saveEditorPromptModules(modules);
  },
};
