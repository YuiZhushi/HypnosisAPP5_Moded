/**
 * HypnoOS 跨模組介面定義
 *
 * 所有被多個 APP 或多個層共用的資料結構介面集中於此。
 * APP 專屬的內部介面應放在對應 APP 的常數或邏輯檔案內。
 */

import type {
  VipTier,
  CostType,
  CostCurrency,
  QuestStatus,
  NodeType,
  AiAppId,
  PromptTemplateScope,
  PromptContextId,
  AstDiffChangeType,
  ReviewDecision,
  EditorPromptModuleType,
  EditorSectionCategory,
  StreamMode,
  SubscriptionTier,
} from './types';

// ====== 用戶資源 ======

/** 用戶資源數據結構（對應酒館變量 系統.*） */
export interface UserResources {
  mcEnergy: number;
  mcEnergyMax: number;
  mcPoints: number;
  totalConsumedMc: number;
  money: number;
  suspicion: number;
}

// ====== AI API 設定 ======

/** AI API 設定（跨 APP 共用） */
export interface ApiSettings {
  apiKey: string;
  apiEndpoint: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK?: number;
  presencePenalty: number;
  frequencyPenalty: number;
  streamMode?: StreamMode;
}

// ====== 催眠功能 ======

/** 催眠功能定義 */
export interface HypnosisFeature {
  id: string;
  title: string;
  description: string;
  tier: VipTier;
  costType: CostType;
  costValue: number;
  costCurrency?: CostCurrency;
  notePlaceholder?: string;
  userNote?: string;
  userNumber?: number;
  isEnabled: boolean;
  purchaseRequired?: boolean;
  purchasePricePoints?: number;
  isPurchased?: boolean;
}

/** 自定義催眠定義 */
export interface CustomHypnosisDef {
  id: string;
  title: string;
  description: string;
  tier: VipTier;
  costType: 'ONE_TIME' | 'PER_MINUTE';
  costValue: number;
  notePlaceholder?: string;
  createdAt: number;
  researchCost: number;
}

/** 催眠會話啟動 payload */
export interface SessionStartPayload {
  startTime: number;
  durationMinutes: number;
  selectedFeatures: { id: string; note?: string }[];
  globalNote: string;
}

// ====== VIP 等級 ======

/** VIP 等級配置 */
export interface VipTierConfig {
  tier: string;
  unlockThreshold: number;
  label: string;
}

// ====== 成就 & 任務 ======

/** 成就定義 */
export interface Achievement {
  id: string;
  title: string;
  description: string;
  rewardMcPoints: number;
  isClaimed: boolean;
  checkCondition: (user: UserResources) => boolean;
}

/** 任務定義 */
export interface Quest {
  id: string;
  title: string;
  description: string;
  rewardMcPoints: number;
  status: QuestStatus;
  isCustom?: boolean;
}

// ====== 角色編輯器 ======

/** 遞迴樹節點 */
export interface EditorNode {
  id: string;
  key: string;
  type: NodeType;
  value: string;
  children: EditorNode[];
  isLocked: boolean;
}

/** 編輯器分區定義 */
export interface EditorSection {
  id: string;
  name: string;
  category: EditorSectionCategory;
}

/** 提示詞模塊 */
export interface EditorPromptModule {
  id: string;
  title: string;
  content: string;
  type: EditorPromptModuleType;
  sectionId?: string;
  order: number;
}

/** 提示詞模板 V2 */
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

/** 佔位符定義 */
export interface PlaceholderDefinition {
  key: string;
  source: 'built_in' | 'user' | 'worldbook' | 'runtime';
  resolverType: 'static' | 'function';
  value?: string;
  enabled: boolean;
  scope: 'app';
}

// ====== AI 請求/回應 ======

/** AI 請求規格 */
export interface AiRequestSpec {
  appId: AiAppId;
  contextId: PromptContextId;
  mode: string;
  parserId?: string;
  outputSchema?: string;
  transport?: 'chat_transport' | 'api_transport';
}

/** AI 回應封裝 */
export interface AiResponseEnvelope<T = unknown> {
  rawText: string;
  parsed: T | null;
  result: 'ok' | 'error';
  error?: string;
  meta?: Record<string, unknown>;
}

/** AI patch 結果 */
export interface AiPatchResult {
  yamlRaw: string;
  ejsRaw: string;
  warnings: string[];
  rawText: string;
}

/** AST diff 提案 */
export interface AstDiffProposal {
  id: string;
  sectionId: string;
  branchId?: string;
  path: string[];
  changeType: AstDiffChangeType;
  oldValue: unknown;
  newValue: unknown;
  defaultDecision: 'accept' | 'reject';
  reason: string;
}

/** AST 套用結果 */
export interface AstApplyResult {
  appliedCount: number;
  rejectedCount: number;
  skippedCount: number;
  conflictCount: number;
  updatedSections: string[];
}

/** 角色補全 APP 模式 */
export interface CharacterCompletionAppMode {
  generationMode: 'completion' | 'rewrite' | 'rebuild';
  target: 'current_section' | 'all_sections';
  conservativeThreshold: 'strict' | 'relaxed';
}

// ====== 訂閱狀態 ======

/** 訂閱狀態 */
export interface SubscriptionState {
  tier: SubscriptionTier;
  endVirtualMinutes: number;
  autoRenew: boolean;
}

/** 權限判斷上下文 */
export interface AccessContext {
  debugEnabled: boolean;
  subscription: SubscriptionState | null;
  nowVirtualMinutes: number | null;
}

// ====== LLM 提示詞管道類型 ======

/** 提示詞模塊（id + content） */
export type PromptModule = { id: string; content: string };

/** 佔位符值（字串/數字/布林/null/undefined） */
export type PlaceholderValue = string | number | boolean | null | undefined;

/** 提示詞組裝參數（供 aiRequestPipeline 使用） */
export type ComposePromptParams = {
  modules: PromptModule[];
  moduleOrder?: string[];
  placeholders?: Record<string, PlaceholderValue>;
  escapeEjs?: boolean;
};
