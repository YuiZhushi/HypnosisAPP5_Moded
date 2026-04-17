/**
 * 成就與任務領域服務（Phase B-5）
 */
export type AchievementQuestServiceDeps<TAchievement, TQuest> = {
  getAchievementsImpl: () => Promise<TAchievement[]>;
  claimAchievementByUsecase: (id: string, currentPoints: number) => Promise<{ success: boolean; newPoints: number }>;
  getQuestsImpl: () => Promise<TQuest[]>;
  acceptQuestImpl: (id: string) => Promise<{ success: boolean; message?: string }>;
  cancelQuestImpl: (id: string) => Promise<{ success: boolean; message?: string }>;
  claimQuestByUsecase: (id: string, currentPoints: number) => Promise<{ success: boolean; newPoints: number }>;
  publishCustomQuestImpl: (params: {
    name: string;
    condition: string;
    rewardMcPoints: number;
  }) => Promise<{ ok: boolean; message?: string }>;
  deleteCustomQuestImpl: (id: string) => Promise<{ ok: boolean; message?: string }>;
};

export function createAchievementQuestService<TAchievement, TQuest>(deps: AchievementQuestServiceDeps<TAchievement, TQuest>) {
  return {
    getAchievements(): Promise<TAchievement[]> {
      return deps.getAchievementsImpl();
    },
    claimAchievement(id: string, currentPoints: number): Promise<{ success: boolean; newPoints: number }> {
      return deps.claimAchievementByUsecase(id, currentPoints);
    },
    getQuests(): Promise<TQuest[]> {
      return deps.getQuestsImpl();
    },
    acceptQuest(id: string): Promise<{ success: boolean; message?: string }> {
      return deps.acceptQuestImpl(id);
    },
    cancelQuest(id: string): Promise<{ success: boolean; message?: string }> {
      return deps.cancelQuestImpl(id);
    },
    claimQuest(id: string, currentPoints: number): Promise<{ success: boolean; newPoints: number }> {
      return deps.claimQuestByUsecase(id, currentPoints);
    },
    publishCustomQuest(params: {
      name: string;
      condition: string;
      rewardMcPoints: number;
    }): Promise<{ ok: boolean; message?: string }> {
      return deps.publishCustomQuestImpl(params);
    },
    deleteCustomQuest(id: string): Promise<{ ok: boolean; message?: string }> {
      return deps.deleteCustomQuestImpl(id);
    },
  };
}
