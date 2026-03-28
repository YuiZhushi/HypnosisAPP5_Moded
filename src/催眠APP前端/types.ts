// Enum for application state (which app is open)
export enum AppMode {
  HOME = 'HOME',
  HYPNOSIS = 'HYPNOSIS',
  BODY_STATS = 'BODY_STATS',
  CALENDAR = 'CALENDAR',
  HELP = 'HELP',
  ACHIEVEMENTS = 'ACHIEVEMENTS', // Replaces Ghost/WIP
  SETTINGS = 'SETTINGS', // System-wide settings
  WIP = 'WIP',
  CHARACTER_EDITOR = 'CHARACTER_EDITOR',
}

// User Resources Data Structure
export interface UserResources {
  mcEnergy: number;
  mcEnergyMax: number;
  mcPoints: number;
  totalConsumedMc: number; // Used for VIP progress
  money: number; // Yen
  suspicion: number; // 0-100
}

// AI API Settings (shared across all apps that use AI generation)
export interface ApiSettings {
  apiKey: string;
  apiEndpoint: string;
  modelName: string;
  temperature: number; // 0.0 - 2.0
  maxTokens: number;
  topP: number; // 0.0 - 1.0
  topK?: number;
  presencePenalty: number; // -2.0 - 2.0
  frequencyPenalty: number; // -2.0 - 2.0
  streamMode?: 'streaming' | 'fake_streaming' | 'non_streaming';
}

// Hypnosis Feature Definition
export interface HypnosisFeature {
  id: string;
  title: string;
  description: string; // Detail shown when expanded
  tier: 'TRIAL' | 'VIP1' | 'VIP2' | 'VIP3' | 'VIP4' | 'VIP5' | 'VIP6';
  costType: 'PER_MINUTE' | 'ONE_TIME';
  costValue: number;
  costCurrency?: 'MC_ENERGY' | 'MC_POINTS';
  notePlaceholder?: string;
  userNote?: string; // User input
  userNumber?: number; // Numeric input for some features
  isEnabled: boolean; // Toggle state
  purchaseRequired?: boolean; // Must be permanently purchased to use
  purchasePricePoints?: number; // Price in MC points for purchase
  isPurchased?: boolean; // Permanently purchased (or free to use)
}

// Achievement Data Structure
export interface Achievement {
  id: string;
  title: string;
  description: string;
  rewardMcPoints: number;
  isClaimed: boolean;
  // Function to check if unlocked based on current user stats
  // Returns true if the condition is met
  checkCondition: (user: UserResources) => boolean;
}

// Quest Data Structure
export type QuestStatus = 'AVAILABLE' | 'ACTIVE' | 'COMPLETED' | 'CLAIMED';

export interface Quest {
  id: string;
  title: string;
  description: string;
  rewardMcPoints: number;
  status: QuestStatus;
  isCustom?: boolean;
}

// Custom Hypnosis Definition (player-created)
export interface CustomHypnosisDef {
  id: string;
  title: string;
  description: string;
  tier: HypnosisFeature['tier'];
  costType: 'ONE_TIME' | 'PER_MINUTE';
  costValue: number; // energy cost per use (ONE_TIME) or per minute (PER_MINUTE)
  notePlaceholder?: string; // optional note prompt
  createdAt: number; // timestamp
  researchCost: number; // money spent to create (for refund calc)
}

// Data payload for backend submission
export interface SessionStartPayload {
  startTime: number;
  durationMinutes: number;
  selectedFeatures: {
    id: string;
    note?: string;
  }[];
  globalNote: string;
}

// VIP Tier Config
export interface VipTierConfig {
  tier: string;
  unlockThreshold: number; // Total consumed MC required
  label: string;
}

export const VIP_LEVELS: VipTierConfig[] = [
  { tier: 'TRIAL', unlockThreshold: 0, label: '试用区' },
  { tier: 'VIP1', unlockThreshold: 0, label: 'VIP 1 (基础)' },
  { tier: 'VIP2', unlockThreshold: 100, label: 'VIP 2 (进阶)' },
  { tier: 'VIP3', unlockThreshold: 250, label: 'VIP 3 (高阶)' },
  { tier: 'VIP4', unlockThreshold: 500, label: 'VIP 4 (深度)' },
  { tier: 'VIP5', unlockThreshold: 1000, label: 'VIP 5 (永久)' },
  { tier: 'VIP6', unlockThreshold: 2500, label: 'VIP 6 (完全控制)' },
];

// ====== Character Editor 相關 ======

/** 樹狀節點的三種型別 */
export type NodeType = 'string' | 'list' | 'object';

/** 遞迴樹節點 */
export interface EditorNode {
  id: string;
  key: string;
  type: NodeType;
  value: string; // type='string' 時的值
  children: EditorNode[]; // type='object'/'list' 時的子項
  isLocked: boolean; // 頂層預設欄位不可刪除/改 key
}

/** 提示詞模板卡片（現行版） */

export type AiAppId = 'calendar' | 'custom_hypnosis' | 'hypnosis' | 'common' | 'settings';

export type PromptTemplateScope = 'app' | 'context';

export type PromptContextId = string;

export interface PromptTemplateV2 {
  appId: AiAppId;
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  isSystem: boolean;
  tags?: string[];
  scope: PromptTemplateScope;
}

export interface PlaceholderDefinition {
  key: string;
  source: 'built_in' | 'user' | 'worldbook' | 'runtime';
  resolverType: 'static' | 'function';
  value?: string;
  enabled: boolean;
  scope: 'app';
}

export interface AiRequestSpec {
  appId: AiAppId;
  contextId: PromptContextId;
  mode: string;
  parserId?: string;
  outputSchema?: string;
  transport?: 'chat_transport' | 'api_transport';
}

export interface AiResponseEnvelope<T = unknown> {
  rawText: string;
  parsed: T | null;
  result: 'ok' | 'error';
  error?: string;
  meta?: Record<string, unknown>;
}

/** 提示詞情境 key */
export type PromptContextKey = 'global_output' | 'full_fill' | `sec_${string}`;

/** 角色編輯器的分區定義 */
export interface EditorSection {
  id: string;
  name: string;
  category: 'data' | 'behavior';
}

/** 編輯器 Tab 常量 */
export const EDITOR_SECTIONS: EditorSection[] = [
  { id: 'info', name: '基本資訊', category: 'data' },
  { id: 'social', name: '社交網絡', category: 'data' },
  { id: 'personality', name: '性格與興趣', category: 'data' },
  { id: 'appearance', name: '外觀特點', category: 'data' },
  { id: 'fetish', name: '性癖與弱點', category: 'data' },
  { id: 'arousal', name: '發情行為', category: 'behavior' },
  { id: 'alert', name: '警戒行為', category: 'behavior' },
  { id: 'affection', name: '好感行為', category: 'behavior' },
  { id: 'obedience', name: '服從行為', category: 'behavior' },
  { id: 'global', name: '全局行為', category: 'behavior' },
];

// ====== 角色編輯器提示詞模塊 ======

/** 提示詞模塊類型 */
export interface EditorPromptModule {
  /** 模塊唯一 ID */
  id: string;
  /** 顯示名稱 */
  title: string;
  /** 提示詞內容 */
  content: string;
  /** 固定模塊、分區內容模塊、還是分區格式模塊、分區生成要求 */
  type: 'fixed' | 'section_content' | 'section_format' | 'section_instruction';
  /** type='section' 時對應的分區 ID（含 'all'） */
  sectionId?: string;
  /** 排列順序（越小越靠前） */
  order: number;
}

/** 分區提示詞的所有分區 ID（10 個編輯分區 + 'all'） */
export const EDITOR_PROMPT_SECTION_IDS = [
  ...EDITOR_SECTIONS.map(s => s.id),
  'all',
] as const;

export type EditorPromptSectionId = typeof EDITOR_PROMPT_SECTION_IDS[number];

/** 預設佔位符鍵 */
export const EDITOR_PROMPT_PLACEHOLDERS = [
  { key: '角色名', description: '當前選中角色名' },
  { key: '角色世界書條目', description: '角色完整世界書內容' },
  { key: '當前的分區名稱', description: '用戶正在編輯的分區名稱' },
  { key: '當前分區的yaml內容', description: '該分區的 yaml/EJS 原始碼' },
  { key: '所有分區的yaml與ESJ內容', description: '所有分區合併的完整內容' },
  { key: '用戶的輸入', description: '用戶本次輸入要求文本' },
] as const;

// ====== 角色資訊補全與保守審核系統 ======

export interface CharacterCompletionAppAiPatchResult {
  yamlRaw: string;
  ejsRaw: string;
  warnings: string[];
  rawText: string;
}

export type CharacterCompletionAppDiffChangeType = 'add' | 'update' | 'empty_rejected' | 'type_conflict' | 'unchanged';

export interface CharacterCompletionAppDiffProposal {
  id: string; // unique literal id generated for UI mapping
  sectionId: string; // The section this diff applies to e.g. 'info' or 'arousal'
  branchId?: string; // If applicable (behavior tabs)
  path: string[]; // e.g. ['stats', 'body', 'height']
  changeType: CharacterCompletionAppDiffChangeType;
  oldValue: unknown;
  newValue: unknown;
  defaultDecision: 'accept' | 'reject';
  reason: string;
}

export type CharacterCompletionAppReviewDecision = 'accept' | 'reject';

export interface CharacterCompletionAppApplyResult {
  appliedCount: number;
  rejectedCount: number;
  skippedCount: number;
  conflictCount: number;
  updatedSections: string[];
}

export interface CharacterCompletionAppMode {
  generationMode: 'completion' | 'rewrite' | 'rebuild';
  target: 'current_section' | 'all_sections';
  conservativeThreshold: 'strict' | 'relaxed';
}
