/**
 * WorldBookRepository — 世界書的統一存取層
 *
 * 負責封裝對 iframe 全域 Worldbook API 的呼叫，
 * 避免在多個 Service 中重複宣告和直接依賴全域函數。
 */

// ========== iframe 全域函數呼叫 ==========
// 這些函數已在 @types/function/worldbook.d.ts 等型別定義檔中全域宣告

export const WorldBookRepository = {
  /**
   * 取得當前角色卡的主世界書名稱
   */
  getCurrentCharacterWorldbook(): string | null {
    try {
      const charWb = getCharWorldbookNames('current');
      return charWb.primary;
    } catch (err) {
      console.warn('[HypnoOS] WorldBookRepository: 取得世界書名稱失敗', err);
      return null;
    }
  },

  /**
   * 讀取指定世界書的所有條目
   */
  async getEntries(wbName: string): Promise<WorldbookEntry[]> {
    return await getWorldbook(wbName);
  },

  /**
   * 在指定世界書中建立新條目
   */
  async createEntries(wbName: string, entries: PartialDeep<WorldbookEntry>[]): Promise<void> {
    await createWorldbookEntries(wbName, entries);
  },

  /**
   * 更新指定世界書
   */
  async updateEntries(
    wbName: string,
    updater: (worldbook: WorldbookEntry[]) => PartialDeep<WorldbookEntry>[] | Promise<PartialDeep<WorldbookEntry>[]>,
    options?: { render?: 'debounced' | 'immediate' }
  ): Promise<WorldbookEntry[]> {
    return await updateWorldbookWith(wbName, updater, options);
  },
};
