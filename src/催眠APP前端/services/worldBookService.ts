/**
 * WorldBookService — 世界書條目檢查與建立
 *
 * 用於在身體檢測APP中檢查角色的 MVU 變量更新世界書條目是否存在，
 * 如果缺失則自動補入。
 */

const DEFAULT_ORDER = 23;
const ENTRY_PREFIX = '[mvu_update]';
const ENTRY_SUFFIX_VARIANTS = ['变量', '變量'];

function buildEntryName(roleName: string): string {
  return `${ENTRY_PREFIX}${roleName}变量`;
}

function isUpdateEntry(name: string): boolean {
  if (!name.startsWith(ENTRY_PREFIX)) return false;
  return ENTRY_SUFFIX_VARIANTS.some(s => name.endsWith(s));
}

function buildEntryContent(roleName: string): string {
  return `  ${roleName}:\n    {{format_message_variable::stat_data.角色.${roleName}}}`;
}

export type WbCheckResult =
  | { status: 'pass' }
  | { status: 'created' }
  | { status: 'error'; message: string };

export const WorldBookService = {
  /**
   * 檢查指定角色的世界書條目，缺失則自動補入
   */
  checkAndEnsureEntry: async (roleName: string): Promise<WbCheckResult> => {
    try {
      // 1. 取得角色卡的 primary 世界書
      const charWb = getCharWorldbookNames('current');
      const wbName = charWb.primary;
      if (!wbName) {
        return { status: 'error', message: '角色卡未绑定世界书' };
      }

      // 2. 讀取世界書
      const entries = await getWorldbook(wbName);

      // 3. 搜尋是否已存在對應條目（繁簡體相容）
      const targetName = buildEntryName(roleName);
      const existing = entries.find(
        e => e.name === targetName || e.name === `${ENTRY_PREFIX}${roleName}變量`,
      );

      if (existing) {
        return { status: 'pass' };
      }

      // 4. 計算插入順序：取現有 [mvu_update]xxx变量/變量 中最大 order + 1
      //    排除 [mvu_update]任务变量 / 任務變量
      const EXCLUDED_NAMES = ['[mvu_update]任务变量', '[mvu_update]任務變量'];
      let maxOrder = -1;
      for (const e of entries) {
        if (isUpdateEntry(e.name) && !EXCLUDED_NAMES.includes(e.name) && e.position && typeof e.position.order === 'number') {
          if (e.position.order > maxOrder) maxOrder = e.position.order;
        }
      }
      const order = maxOrder >= 0 ? maxOrder + 1 : DEFAULT_ORDER;

      // 5. 建立條目
      await createWorldbookEntries(wbName, [
        {
          name: targetName,
          enabled: true,
          strategy: {
            type: 'selective',
            keys: [roleName],
          },
          position: {
            type: 'before_character_definition',
            order,
          },
          content: buildEntryContent(roleName),
          probability: 100,
          recursion: {
            prevent_incoming: true,
            prevent_outgoing: true,
          },
        },
      ]);

      console.info(`[HypnoOS] 已补入世界书条目「${targetName}」(order=${order})`);
      return { status: 'created' };
    } catch (err) {
      console.error('[HypnoOS] 世界书检查失败', err);
      return {
        status: 'error',
        message: err instanceof Error ? err.message : '未知错误',
      };
    }
  },
};
