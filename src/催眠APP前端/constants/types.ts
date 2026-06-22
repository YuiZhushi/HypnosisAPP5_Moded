/**
 * HypnoOS 核心類型定義
 *
 * 純類型/枚舉，無運行時數據。
 * 所有跨模組共用的類型別名和枚舉集中於此。
 */

// ====== APP 路由枚舉 ======

/** 當前打開的 APP 模式 */
export enum AppMode {
  HOME = 'HOME',
  HYPNOSIS = 'HYPNOSIS',
  BODY_STATS = 'BODY_STATS',
  CALENDAR = 'CALENDAR',
  HELP = 'HELP',
  ACHIEVEMENTS = 'ACHIEVEMENTS',
  SETTINGS = 'SETTINGS',
  WIP = 'WIP',
  CHARACTER_EDITOR = 'CHARACTER_EDITOR',
  MAP = 'MAP',
}

// ====== 催眠功能相關類型 ======

/** VIP 等級 tier 字面量 */
export type VipTier = 'TRIAL' | 'VIP1' | 'VIP2' | 'VIP3' | 'VIP4' | 'VIP5' | 'VIP6';

/** 功能計費方式 */
export type CostType = 'PER_MINUTE' | 'ONE_TIME';

/** 功能計費幣種 */
export type CostCurrency = 'MC_ENERGY' | 'MC_POINTS';

// ====== 任務相關類型 ======

/** 任務狀態 */
export type QuestStatus = 'AVAILABLE' | 'ACTIVE' | 'COMPLETED' | 'CLAIMED';

// ====== 角色編輯器相關類型 ======

/** 樹狀節點的三種型別 */
export type NodeType = 'string' | 'list' | 'object';

/** AI 應用 ID */
export type AiAppId = 'calendar' | 'custom_hypnosis' | 'hypnosis' | 'common' | 'settings';

/** 提示詞模板範圍 */
export type PromptTemplateScope = 'app' | 'context';

/** 提示詞情境 ID */
export type PromptContextId = string;

/** 提示詞情境 key */
export type PromptContextKey = 'global_output' | 'full_fill' | `sec_${string}`;

/** 提示詞模塊類型 */
export type EditorPromptModuleType = 'fixed' | 'section_content' | 'section_format' | 'section_instruction';

/** 編輯器分區類別 */
export type EditorSectionCategory = 'data' | 'behavior';

// ====== AI 補全相關類型 ======

/** AST diff 變更類型 */
export type AstDiffChangeType = 'add' | 'update' | 'empty_rejected' | 'type_conflict' | 'unchanged';

/** 審閱決策 */
export type ReviewDecision = 'accept' | 'reject';

// ====== API 串流模式 ======

export type StreamMode = 'streaming' | 'fake_streaming' | 'non_streaming';

// ====== 訂閱等級（access 層使用） ======

export const SUBSCRIPTION_TIERS = ['VIP1', 'VIP2', 'VIP3', 'VIP4', 'VIP5'] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];
