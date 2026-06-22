/**
 * Models 統一模型與型別定義檔
 * 整合原 ui/mock/mockModels.ts、constants/types.ts、
 * character-mock-data.ts 以及 mvuBridge.ts 內的所有型別宣告。
 */

// ====== 基礎別名與枚舉型別 ======
export type yaml = any;
export type operator = '<' | '<=' | '>=' | '>' | '==' | 'else';

// ====== APP 路由枚舉 (遷移自 constants/types.ts) ======
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

// ====== 催眠功能相關型別 ======
export type VipTier = 'TRIAL' | 'VIP1' | 'VIP2' | 'VIP3' | 'VIP4' | 'VIP5' | 'VIP6';
export type CostType = 'PER_MINUTE' | 'ONE_TIME';
export type CostCurrency = 'MC_ENERGY' | 'MC_POINTS';

export interface CostDict {
  mc?: number;
  money?: number;
  pts?: number;
}

export interface HypnosisDef {
  name: string;
  description: string;
  tier: number; // 需求的 VIP 等級 (0~5)
  cost: CostDict;
  isCustom: boolean;
  isPermanent: boolean;
  isOneTime: boolean;
  duration?: number | 'onetime' | 'permanent'; // 單次持續時間 (分鐘)
  energyCost: number; // 消耗的 MC 能量
  defaultNote?: string; // 預設備註
}

export interface EquipmentDef {
  name: string;
  description: string;
  icon: string;
  tier: number; // 需求的 VIP 等級 (0~5)
  cost: CostDict;
  type: 'technology' | 'device';
  usageCostType: Array<'none' | 'mc' | 'money' | 'suspicion'>;
  usageCostRate: number; // 開啟時的消耗率
}

export interface ComboHypnosisConfig {
  applyMethod: string;
  target: string;
  duration: number | 'onetime' | 'permanent'; // 分鐘數或一次性或永久
  note: string;
}

export interface ComboDef {
  name: string;
  description: string;
  includedHypnosis: Record<string, ComboHypnosisConfig>; // 以催眠 ID 為 key
}

// ====== 任務相關型別 ======

export interface ConditionOnProgram {
  target:
    | 'money'
    | 'pts'
    | 'totalConsumedMc'
    | 'mcEnergy'
    | 'mcEnergyMax'
    | 'vipTier'
    | 'suspicion'
    | 'sensitivity'
    | 'clitSensitivity'
    | 'vaginaSensitivity'
    | 'anusSensitivity'
    | 'urethraSensitivity'
    | 'nippleSensitivity'
    | 'orgasm'
    | 'clitOrgasms'
    | 'vaginaOrgasms'
    | 'anusOrgasms'
    | 'urethraOrgasms'
    | 'nippleOrgasms'
    | 'alertness'
    | 'affection'
    | 'obedience'
    | 'lust'
    | 'arousal';
  operator: '==' | '!=' | '>=' | '<=' | '>' | '<';
  value: number;
  charName?: string; // 支持特定角色的成就
}

export interface AchievementOrQuestDef {
  name: string; // 名稱
  dataType: 'achievement' | 'quest'; // 資料類型
  description: string; // 描述
  isCustom: boolean;
  completionCondition: {
    type: 'program' | 'ai'; // 類型：由程式判定 或 由AI判定
    condition: string | ConditionOnProgram[]; // 完成條件說明或變數條件
  };
  reward: {
    money?: number;
    pts?: number;
    mcEnergyMax?: number;
    mcEnergy?: number;
    suspicion?: number;
  };
}

// ====== 日曆 APP 相關型別 ======
export type EventColor =
  | 'red'
  | 'blue'
  | 'purple'
  | 'gray'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'pink'
  | 'teal'
  | 'indigo';

export interface CalendarEvent {
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  type: 'system' | 'custom';
  color: EventColor;
  description?: string;
}

export interface MockCalendarData {
  events: Record<string, CalendarEvent>; // 以 id 為 key
}

// ====== 系統與通用型別 ======
export interface MockApiSettings {
  apiEndpoint: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  presencePenalty: number;
  frequencyPenalty: number;
  streamMode: 'non_streaming' | 'streaming' | 'fake_streaming';
}

export interface MockSystemData {
  time: string;
  apiSettings?: MockApiSettings;
}

// ====== 角色資料與屬性型別 ======
export interface sensitivityDefs {
  clitSensitivity: number;
  vaginaSensitivity: number;
  anusSensitivity: number;
  urethraSensitivity: number;
  nippleSensitivity: number;
}

export interface OrgasmDefs {
  clitOrgasms: number;
  vaginaOrgasms: number;
  anusOrgasms: number;
  urethraOrgasms: number;
  nippleOrgasms: number;
}

export interface MockcharData {
  identity: string;
  alertness: number;
  affection: number;
  obedience: number;
  lust: number;
  arousal: number;
  sensitivity: sensitivityDefs;
  orgasm: OrgasmDefs;
  ownedHypnosisEffects: Record<
    string,
    { endTime: string; hypnosisType: 'temporary' | 'permanent' | 'oneTime'; description: string }
  >;
  ownedEquipment: Record<string, any>;
  ownedBodyModifications: Record<string, any>;
}

// ====== 地圖 APP 相關型別 ======
export interface MockNpcTrace {
  name: string;
  status: string;
}

export interface MockLocationNode {
  id: string;
  name: string;
  zoneId: string;
  description: string;
  presentNpcs?: MockNpcTrace[];
  hasQuest?: boolean;
}

export interface PathInfo {
  status: 'open' | 'locked' | 'temp_open';
  cost: {
    timeCostMinutes: number;
    energyCost?: number;
    moneyCost?: number;
  };
  unlockCondition?: {
    type: 'obedience' | 'item' | 'always_locked';
    targetName?: string;
    value?: number;
    description: string;
  };
  tempConditon?: {
    type: 'item' | 'time' | 'character';
    targetName?: string;
    value?: number;
    description: string;
  };
}

export interface MockMapEdge {
  id: string;
  zoneId: string;
  StartNodeId: string;
  EndNodeId: string;
  forwardPath?: PathInfo;
  ReversePath?: PathInfo;
}

export interface MockZone {
  id: string;
  name: string;
  description: string;
}

export interface MockMapState {
  currentLocationId: string;
  discoveredNodeIds: string[];
}

// ====== 狀態與使用者資料定義 ======
export interface MockAchievementState {
  claimed: boolean;
}

export interface MockQuestState {
  status: 'accepted' | 'completed' | 'claimed';
}

export interface MockUserData {
  userName: string;
  money: number;
  mcEnergy: number;
  mcEnergyMax: number;
  mcPoints: number;
  totalConsumedMc: number;
  vipTier: number;
  vipEndVirtualMinutes: number;
  vipAutoRenew: boolean;
  suspicion: number;
  ownedEquipments: Record<string, { enabled: boolean; settings?: any }>;
  ownedHypnosis: Record<string, { enabled: boolean; settings?: any }>;
  ownedCombos: Record<string, { enabled: boolean; settings?: any }>;
  ownedAchievements: Record<string, MockAchievementState>;
  ownedQuests: Record<string, MockQuestState>;
  mapState?: MockMapState;
}

// ====== 遊戲執行期資料型別 ======
export interface RuntimeData {
  system: MockSystemData;
  user: MockUserData;
  chars: Record<string, MockcharData>;
  hypnosis: Record<string, HypnosisDef>;
  equipment: Record<string, EquipmentDef>;
  combos: Record<string, ComboDef>;
  achievements: Record<string, AchievementOrQuestDef>;
  quests: Record<string, AchievementOrQuestDef>;
}

// ====== 角色背景編輯 APP 相關定義 (遷移自 character-mock-data.ts) ======
export interface EJSnode {
  logic: {
    operator: operator;
    value?: number;
  };
  contant: yaml;
}

export interface CharacterBackgroundData {
  basic: yaml;
  behavior: Record<string, EJSnode[]>;
}

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  isSystem: boolean;
}

export interface AppSettings {
  prompts: PromptTemplate[];
}

// ====== 介面定義 (相容頂層 App.tsx 對 constants/ 的引用) ======
export interface UserResources {
  mcEnergy: number;
  mcEnergyMax: number;
  mcPoints: number;
  totalConsumedMc: number;
  money: number;
  suspicion: number;
}

// ====== 其他輔助定義 (如 mvuBridge.ts 中的 options) ======
export type WaitOptions = { timeoutMs?: number; pollMs?: number };


