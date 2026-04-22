/**
 * 角色預設模板
 *
 * ⚠ 注意：此檔案包含運行時邏輯（依賴 yamlToTree），
 * 在 Phase 3 重建 backend/character-editor 時需要重新連接 import。
 * 目前先放在 constants 層作為常數定義佔位。
 *
 * TODO: Phase 3 時將 buildDefaultBehaviorBranchNodes / buildDefaultGlobalRulesNodes
 *       移到 backend/character-editor/ 中，此檔僅保留純數據定義。
 */

// Phase 3 時重新連接以下 import：
// import { yamlToTree } from '../../backend/character-editor/yamlAstLogic';
// import YAML from 'yaml';

/** 全局規則預設物件 */
export function createDefaultGlobalRulesObject(): Record<string, unknown> {
  return {
    rules: [
      '行为指导优先于作为背景的`角色关键信息`和`角色详情`',
      '好感度和服从度行为可以混合',
      '角色的好感与服从度要优先于警戒度, 只要好感度或服从度大于警戒度, 就不会触发警戒',
    ],
  };
}

/** 各行為分區的閾值分段 */
export const BEHAVIOR_BANDS: Record<string, number[]> = {
  arousal: [20, 40, 60, 80, 95],
  alert: [20, 40, 60, 80, 100],
  affection: [20, 40, 60, 80],
  obedience: [20, 40, 60, 80],
};

/** 各行為分區的狀態標籤 */
export const BEHAVIOR_STATUS_LABELS: Record<string, string[]> = {
  alert: ['無警戒', '微弱的違和感', '低警戒', '普通警戒', '高警戒', '極高警戒'],
  affection: ['低好感度', '中低好感度', '普通好感度', '高好感度', '極高好感度'],
  obedience: ['低服從度', '較低服從度', '普通服從度', '高服從度', '極高服從度'],
};
