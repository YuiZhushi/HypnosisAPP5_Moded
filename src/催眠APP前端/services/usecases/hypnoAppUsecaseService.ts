import type { SessionStartPayload } from '../../types';

type SubscriptionTier = 'VIP1' | 'VIP2' | 'VIP3' | 'VIP4' | 'VIP5';
type SubscriptionState = { tier: SubscriptionTier; endVirtualMinutes: number; autoRenew: boolean };
type MinimalUserResources = { mcPoints: number; totalConsumedMc: number; money: number };

export type HypnoAppUsecaseDeps<TStore, THypnosisDef, TAchievement, TQuestDef, TUserResources extends MinimalUserResources> = {
  subscriptionPrices: Record<SubscriptionTier, number>;
  subscriptionWeekMinutes: number;
  getUserData: () => Promise<TUserResources>;
  updateResources: (patch: Partial<TUserResources>) => Promise<TUserResources>;
  readStoreSnapshot: () => TStore;
  updateStoreWith: (updater: (store: TStore) => TStore) => Promise<TStore>;
  setSubscriptionTierLabel: (tierLabel: string) => Promise<void>;
  getStoreSubscription: (store: TStore) => SubscriptionState | undefined;
  setStoreSubscriptionAndVipStatsPurchase: (store: TStore, sub: SubscriptionState) => TStore;
  getStorePurchases: (store: TStore) => Record<string, boolean>;
  setStorePurchased: (store: TStore, id: string) => TStore;
  getFeaturePurchasePricePoints: (id: string) => number | null;
  getAchievements: () => Promise<Array<TAchievement & { id: string; rewardMcPoints: number; checkCondition: (u: TUserResources) => boolean }>>;
  isAchievementClaimed: (store: TStore, id: string) => boolean;
  setAchievementClaimed: (store: TStore, id: string) => TStore;
  findQuestDef: (id: string, store: TStore) => TQuestDef | null;
  getQuestName: (quest: TQuestDef) => string;
  getQuestReward: (quest: TQuestDef) => number;
  getTasks: () => Promise<Record<string, unknown> | null>;
  deleteTask: (taskName: string) => Promise<void>;
  setQuestClaimed: (store: TStore, id: string) => TStore;
  getCustomHypnosisRecord: (store: TStore) => Record<string, THypnosisDef>;
  getCustomHypnosisLimit: () => number;
  calculateCustomHypnosisCost: (def: Omit<THypnosisDef, 'id' | 'createdAt' | 'researchCost'>) => number;
  createCustomHypnosisEntry: (
    id: string,
    def: Omit<THypnosisDef, 'id' | 'createdAt' | 'researchCost'>,
    cost: number,
  ) => THypnosisDef;
  appendCustomHypnosis: (store: TStore, id: string, entry: THypnosisDef) => TStore;
  removeCustomHypnosisAndFeature: (store: TStore, id: string) => TStore;
  getCustomHypnosisResearchCost: (entry: THypnosisDef) => number;
  getCustomHypnosisTitle: (entry: THypnosisDef) => string;
  markSessionStarted: (store: TStore, payload: SessionStartPayload) => TStore;
  makeId: (prefix: string) => string;
};

export function createHypnoAppUsecaseService<
  TStore,
  THypnosisDef,
  TAchievement,
  TQuestDef,
  TUserResources extends MinimalUserResources,
>(
  deps: HypnoAppUsecaseDeps<TStore, THypnosisDef, TAchievement, TQuestDef, TUserResources>,
) {
  return {
    async subscribeOrRenew(params: {
      tier: SubscriptionTier;
      nowVirtualMinutes: number | null;
      extendFromExistingIfActive?: boolean;
    }): Promise<{ ok: boolean; message?: string; subscription?: SubscriptionState | null }> {
      const { tier, nowVirtualMinutes, extendFromExistingIfActive = true } = params;
      if (nowVirtualMinutes === null) return { ok: false, message: '无法读取当前日期/时间，无法计算订阅到期时间' };

      const price = deps.subscriptionPrices[tier];
      const user = await deps.getUserData();
      if (user.money < price) return { ok: false, message: '零花钱不足' };

      const storeBefore = deps.readStoreSnapshot();
      const prev = deps.getStoreSubscription(storeBefore);
      const prevActive = Boolean(prev) && prev!.endVirtualMinutes > nowVirtualMinutes;
      const base =
        extendFromExistingIfActive && prevActive
          ? Math.max(nowVirtualMinutes, prev!.endVirtualMinutes)
          : nowVirtualMinutes;

      const nextSub: SubscriptionState = {
        tier,
        endVirtualMinutes: base + deps.subscriptionWeekMinutes,
        autoRenew: prev?.autoRenew ?? false,
      };

      await deps.updateResources({ money: user.money - price });
      const next = await deps.updateStoreWith(store => deps.setStoreSubscriptionAndVipStatsPurchase(store, nextSub));
      await deps.setSubscriptionTierLabel(tier);
      return { ok: true, subscription: deps.getStoreSubscription(next) ?? null };
    },

    async maybeAutoRenewSubscription(nowVirtualMinutes: number | null): Promise<{ renewed: boolean; message?: string }> {
      if (nowVirtualMinutes === null) return { renewed: false };
      const store = deps.readStoreSnapshot();
      const sub = deps.getStoreSubscription(store);
      if (!sub || !sub.autoRenew) return { renewed: false };
      if (sub.endVirtualMinutes > nowVirtualMinutes) return { renewed: false };
      const result = await this.subscribeOrRenew({ tier: sub.tier, nowVirtualMinutes, extendFromExistingIfActive: false });
      if (!result.ok) return { renewed: false, message: result.message };
      return { renewed: true };
    },

    async purchaseFeature(id: string): Promise<{ ok: boolean; message?: string; user?: TUserResources }> {
      const price = deps.getFeaturePurchasePricePoints(id);
      if (price === null) return { ok: false, message: '该功能无需购买' };

      const storeBefore = deps.readStoreSnapshot();
      if (deps.getStorePurchases(storeBefore)?.[id]) return { ok: false, message: '已购买' };

      const user = await deps.getUserData();
      if (user.mcPoints < price) return { ok: false, message: `MC点不足：需要 ${price} PT` };

      await deps.updateStoreWith(store => deps.setStorePurchased(store, id));
      const nextUser = await deps.updateResources({
        mcPoints: user.mcPoints - price,
        totalConsumedMc: user.totalConsumedMc + price,
      });
      return { ok: true, user: nextUser };
    },

    async claimAchievement(id: string, currentPoints: number): Promise<{ success: boolean; newPoints: number }> {
      const achievements = await deps.getAchievements();
      const ach = achievements.find(a => a.id === id);
      if (!ach) return { success: false, newPoints: currentPoints };

      const store = deps.readStoreSnapshot();
      if (deps.isAchievementClaimed(store, id)) return { success: false, newPoints: currentPoints };

      const user = await deps.getUserData();
      if (!ach.checkCondition(user)) return { success: false, newPoints: currentPoints };

      const newPoints = currentPoints + ach.rewardMcPoints;
      await deps.updateResources({ mcPoints: newPoints });
      await deps.updateStoreWith(s => deps.setAchievementClaimed(s, id));
      return { success: true, newPoints };
    },

    async claimQuest(id: string, currentPoints: number): Promise<{ success: boolean; newPoints: number }> {
      const store = deps.readStoreSnapshot();
      const def = deps.findQuestDef(id, store);
      if (!def) return { success: false, newPoints: currentPoints };

      const taskName = deps.getQuestName(def);
      if (taskName.includes('.')) return { success: false, newPoints: currentPoints };

      const tasks = await deps.getTasks();
      if (!tasks) return { success: false, newPoints: currentPoints };
      const taskState = tasks[taskName];
      const taskDone =
        taskState &&
        typeof taskState === 'object' &&
        (taskState as { 已完成?: boolean }).已完成 === true;
      if (!taskDone)
        return { success: false, newPoints: currentPoints };

      const newPoints = currentPoints + deps.getQuestReward(def);
      await deps.updateResources({ mcPoints: newPoints });
      await deps.updateStoreWith(s => deps.setQuestClaimed(s, id));
      await deps.deleteTask(taskName);
      return { success: true, newPoints };
    },

    async addCustomHypnosis(
      def: Omit<THypnosisDef, 'id' | 'createdAt' | 'researchCost'>,
    ): Promise<{ ok: boolean; message?: string; id?: string }> {
      const store = deps.readStoreSnapshot();
      const existing = Object.keys(deps.getCustomHypnosisRecord(store) ?? {});
      if (existing.length >= deps.getCustomHypnosisLimit()) return { ok: false, message: '自定义催眠已达上限（10个）' };

      const cost = deps.calculateCustomHypnosisCost(def);
      const user = await deps.getUserData();
      if (user.money < cost) return { ok: false, message: `金钱不足：需要 ¥${cost.toLocaleString()}` };

      const id = deps.makeId('custom_hyp');
      const entry = deps.createCustomHypnosisEntry(id, def, cost);

      await deps.updateStoreWith(s => deps.appendCustomHypnosis(s, id, entry));
      await deps.updateResources({ money: user.money - cost });
      return { ok: true, id };
    },

    async deleteCustomHypnosis(id: string): Promise<{ ok: boolean; message?: string; refund?: number }> {
      const store = deps.readStoreSnapshot();
      const entry = deps.getCustomHypnosisRecord(store)?.[id];
      if (!entry) return { ok: false, message: '未找到该催眠' };

      const refund = Math.floor(deps.getCustomHypnosisResearchCost(entry) * 0.5);
      await deps.updateStoreWith(s => deps.removeCustomHypnosisAndFeature(s, id));

      if (refund > 0) {
        const user = await deps.getUserData();
        await deps.updateResources({ money: user.money + refund });
      }

      return { ok: true, refund };
    },

    async startSession(payload: SessionStartPayload): Promise<boolean> {
      console.log('[Backend] Session Started:', payload);
      await deps.updateStoreWith(store => deps.markSessionStarted(store, payload));
      return true;
    },
  };
}
