/**
 * Models 統一模型與型別定義檔
 * 整合原 ui/mock/mockModels.ts、constants/types.ts、
 * character-mock-data.ts 以及 mvuBridge.ts 內的所有型別宣告。
 */

// ============================================================================
// 第一區：遊戲系統運行相關 (Runtime / Database 狀態)
// ============================================================================

// ==========================================
// 基礎別名與全域定義
// ==========================================
export type yaml = any;
export type operator = '<' | '<=' | '>=' | '>' | '==' | 'else';
export type WaitOptions = { timeoutMs?: number; pollMs?: number };

// ==========================================
// 系統路由與 API 設定
// ==========================================
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

// ==========================================
// 運行時當前狀態
// ==========================================
export interface MockAchievementState {
  claimed: boolean;
}

export interface MockQuestState {
  status: 'accepted' | 'completed' | 'claimed';
}

export interface MockMapState {
  currentLocationId: string;
  discoveredNodeIds: string[];
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
  ownedHypnoModules: Record<string, { enabled: boolean; settings?: any }>;
  ownedHypnosis: Record<string, { enabled: boolean; settings?: any }>;
  ownedCombos: Record<string, { enabled: boolean; settings?: any }>;
  ownedAchievements: Record<string, MockAchievementState>;
  ownedQuests: Record<string, MockQuestState>;
  mapState?: MockMapState;
  // 玩家背包：以 itemId 為 key
  inventory: Record<string, InventoryItemState>;
  effectiveVipTier: number;
}

export interface MockcharData {
  identity: string;
  alertness: number;
  affection: number;
  obedience: number;
  lust: number;
  arousal: number;
  bodyParts: CharBodyPartsDefs;
  ownedHypnosisEffects: Record<
    string,
    { endTime: string; hypnosisType: 'temporary' | 'permanent' | 'oneTime'; description: string }
  >;
  // NPC 的背包與裝備，與玩家背包結構對稱
  inventory: Record<string, InventoryItemState>;
  ownedBodyModifications: Record<string, any>;
  locationState?: {
    locationId: string;
    locationStatus: string;
  };
}

// ==========================================
// 執行期全局總狀態與變數介面
// ==========================================
export interface RuntimeData {
  system: MockSystemData;
  user: MockUserData;
  chars: Record<string, MockcharData>;
  hypnosis: Record<string, HypnosisDef>;
  hypnoModules: Record<string, HypnoModuleDef>;
  combos: Record<string, ComboDef>;
  achievements: Record<string, AchievementOrQuestDef>;
  quests: Record<string, AchievementOrQuestDef>;
}

export interface ChatVariables {
  apiSettings?: MockApiSettings;
  hypnosis: Record<string, HypnosisDef>;
  combos: Record<string, ComboDef>;
  hypnoModules: Record<string, HypnoModuleDef>;
  quests: Record<string, AchievementOrQuestDef>;
  achievements: Record<string, AchievementOrQuestDef>;
  calendarEvents: Record<string, CalendarEvent>;
  zones: Record<string, MockZone>;
  locations: Record<string, MockLocationNode>;
  mapEdges: MockMapEdge[];
  // 物品靜態資料庫
  items: Record<string, ItemDef>;
  // 身體部位定義相關邏輯
  bodyParts: Record<string, BodyPartsDef>;
}

export interface MvuVariables {
  time: string;
  user: {
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
    ownedHypnosis: Record<string, { enabled: boolean; settings?: any }>;
    ownedHypnoModules: Record<string, { enabled: boolean; settings?: any }>;
    ownedCombos: Record<string, { enabled: boolean; settings?: any }>;
    mapState: MockMapState;
    ownedAchievements: Record<string, MockAchievementState>;
    ownedQuests: Record<string, MockQuestState>;

    // 玩家背包
    inventory: Record<string, InventoryItemState>;
  };
  chars: Record<string, {
    identity?: string;
    alertness: number;
    affection: number;
    obedience: number;
    lust: number;
    arousal: number;
    bodyParts: CharBodyPartsDefs;
    ownedHypnosisEffects: Record<
      string,
      { endTime: string; hypnosisType: 'temporary' | 'permanent' | 'oneTime'; description: string }
    >;

    // 主要 NPC 背包
    inventory: Record<string, InventoryItemState>;
    ownedBodyModifications: Record<string, any>;
    locationState?: {
      locationId: string;
      locationStatus: string;
    };
  }>;
}

export interface DevRuntimeVariables {
  prompts: PromptTemplate[];
  charBackgrounds: Record<string, CharacterBackgroundData>;
}


// ============================================================================
// 第二區：資料類定義 (StaticData / 世界書解析變數)
// ============================================================================

// ==========================================
// 催眠與裝備相關定義
// ==========================================
export type VipTier = 'TRIAL' | 'VIP1' | 'VIP2' | 'VIP3' | 'VIP4' | 'VIP5' | 'VIP6';
export type CostType = 'PER_MINUTE' | 'ONE_TIME';
export type CostCurrency = 'MC_ENERGY' | 'MC_POINTS';

export interface CostDict {
  mc?: number;
  money?: number;
  pts?: number;
}

// 實體物品相關型別定義
export type ItemType = 'consumable' | 'passive' | 'equipment' | 'material';
export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

// ==========================================
// 物品激活屬性相關型別與定義
// ==========================================
export type ItemActivationType = 'periodic' | 'conditional' | 'permanent' | 'none';

export interface ItemDef {
  id: string;               // 唯一識別碼 (例如: item_old_key, item_mc_potion_s)
  name: string;             // 物品名稱 (例如: "老舊鑰匙", "低階能量藥水")
  description: string;      // 物品詳細描述
  type: ItemType;           // 物品類型
  rarity: ItemRarity;       // 稀有度

  // 經濟與商店屬性
  cost?: {
    money?: number;         // 購買所需的零花錢
    pts?: number;           // 購買所需的 MC 點
  };
  isSellable: boolean;      // 是否可以出售
  vipTierLimit?: number;    // 購買或使用所需的 VIP 等級限制 (0 ~ 5)
  isPurchasable: boolean;   // 是否可直接在商店中購買

  // 堆疊限制
  isStackable: boolean;     // 是否可堆疊 (若是，quantity 可大於 1)
  maxStack?: number;        // 堆疊上限 (例如 99，預設為 99)

  // 使用效果 (純文字描述，保留 AI 靈活性與被動效果描述)
  effectDescription?: string; // 物品使用效果、被動效果或裝備影響的純文字說明

  // 激活屬性與規則 (擴充欄位)
  activationType: ItemActivationType;          // 激活類型 (none / periodic / conditional / permanent)
  activationTimeRule?: string;                // (僅週期性) 時間激活條件規則 (JSON 格式)
  activationCondition?: ConditionOnProgram[];  // (僅條件性) 屬性變數激活條件
  activationDescription?: string;             // 激活效果純文字描述
}

// 背包項目狀態定義 (包含數量、裝備狀態、部位與自訂臨時描述)
export interface InventoryItemState {
  quantity: number;             // 持有數量
  isEquipped?: boolean;         // (僅裝備) 是否正被玩家或 NPC 裝備/穿戴中
  equipSlot?: string;           // (僅裝備) 裝備部位描述 (如: "head", "eyes", "body", "crotch" 等)
  customDescription?: string;    // 物品可選的附加臨時描述 (例如: "沾著泥土的鑰匙")
  
  // 運行時激活狀態 (擴充欄位)
  isActive?: boolean;           // 該物品當前是否處於激活狀態
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
  energyCost: number; // 消耗 the MC 能量
  defaultNote?: string; // 預設備註
}

// 手機催眠模組定義 (原 EquipmentDef)
export interface HypnoModuleDef {
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

// ==========================================
// 任務與成就相關定義
// ==========================================
export interface ConditionOnProgram {
  target:
    | 'money'
    | 'pts'
    | 'totalConsumedMc'
    | 'mcEnergy'
    | 'mcEnergyMax'
    | 'vipTier'
    | 'suspicion'
    | 'totalSensitivity'
    | 'totalOrgasms'
    | 'alertness'
    | 'affection'
    | 'obedience'
    | 'lust'
    | 'arousal'
    | string;
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

// ==========================================
// 日曆相關定義
// ==========================================
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

// ==========================================
// 角色屬性微定義 (身體部位管理)
// ==========================================
export interface BodyPartsDef {
  id: string;          // 唯一識別碼 (如: 'mouth', 'breastLeft', 'tail')
  name: string;        // 顯示名稱 (如: '口腔', '左乳房', '尾巴')
  isCustom: boolean;   // 是否為自訂部位
  hasSensitivity?: boolean;   // 是否有敏感度屬性 (預設為 false)
  hasTightness?: boolean;     // 是否有鬆緊度屬性 (預設為 false)
  hasProficiency?: boolean;   // 是否有熟練度屬性 (預設為 false)
  canOrgasm?: boolean;        // 是否能高潮屬性 (預設為 false)
  description: string; // 基礎描述
}

export interface BodyPartStat {
  sensitivity?: number;  // 敏感度: 可正可負 (-100 ~ 100，超過 100 或低於 -100 為特殊情況)
  tightness?: number;   // 鬆緊度: 可選，可正可負 (-100 ~ 100，0為正常，正數為緊緻，負數為鬆弛)
  proficiency?: number;  // 熟練度: (0 ~ 100)
  orgasms?: number;      // 高潮次數: (>= 0)
}

export interface CharBodyPartsDefs {
  mouth: BodyPartStat;
  breastLeft: BodyPartStat;
  breastRight: BodyPartStat;
  vagina: BodyPartStat;
  anus: BodyPartStat;
  urethra: BodyPartStat;
  clitoris: BodyPartStat;
  [key: string]: BodyPartStat | undefined;
}

// ==========================================
// 地圖與區域定義
// ==========================================
export interface MockNpcTrace {
  name: string;
  status: string;
}

export interface MockLocationNode {
  id: string;
  name: string;
  zoneId: string;
  description: string;
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
    type: 'item' | 'npc_stats' | 'always_locked';
    targetName?: string;
    // value?: number;
    description: string;
  };
  tempConditon?: {
    type: 'item' | 'time' | 'npc_stats';
    targetName?: string;
    // value?: number;
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

// ==========================================
// 使用者與資源定義
// ==========================================
export interface UserResources {
  mcEnergy: number;
  mcEnergyMax: number;
  mcPoints: number;
  totalConsumedMc: number;
  money: number;
  suspicion: number;
}

// ==========================================
// 角色背景編輯定義
// ==========================================
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


