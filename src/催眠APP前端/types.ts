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
  temperature: number;        // 0.0 - 2.0
  maxTokens: number;
  topP: number;               // 0.0 - 1.0
  presencePenalty: number;    // -2.0 - 2.0
  frequencyPenalty: number;   // -2.0 - 2.0
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
  costValue: number;          // energy cost per use (ONE_TIME) or per minute (PER_MINUTE)
  notePlaceholder?: string;   // optional note prompt
  createdAt: number;          // timestamp
  researchCost: number;       // money spent to create (for refund calc)
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
  value: string;           // type='string' 時的值
  children: EditorNode[];  // type='object'/'list' 時的子項
  isLocked: boolean;       // 頂層預設欄位不可刪除/改 key
}

/** 提示詞模板卡片 */
export interface PromptTemplate {
  id: string;
  title: string;
  content: string;
  isSystem: boolean;
}

/** 提示詞情境 key */
export type PromptContextKey =
  | 'global_output'
  | 'full_fill'
  | `sec_${string}`;

/** 角色編輯器的分區定義 */
export interface EditorSection {
  id: string;
  name: string;
  category: 'data' | 'behavior';
}

/** 編輯器 Tab 常量 */
export const EDITOR_SECTIONS: EditorSection[] = [
  { id: 'info',        name: '基本資訊',   category: 'data'     },
  { id: 'social',      name: '社交網絡',   category: 'data'     },
  { id: 'personality', name: '性格與興趣', category: 'data'     },
  { id: 'appearance',  name: '外觀特點',   category: 'data'     },
  { id: 'fetish',      name: '性癖與弱點', category: 'data'     },
  { id: 'arousal',     name: '發情行為',   category: 'behavior' },
  { id: 'alert',       name: '警戒行為',   category: 'behavior' },
  { id: 'affection',   name: '好感行為',   category: 'behavior' },
  { id: 'obedience',   name: '服從行為',   category: 'behavior' },
  { id: 'global',      name: '全局行為',   category: 'behavior' },
];
