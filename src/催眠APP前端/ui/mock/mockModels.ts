/**
 * 模擬後端資料型別定義檔
 * 包含所有 APP (催眠、成就、任務等) 使用的介面與型別。
 */

// ==========================================
// 催眠 APP 相關定義 (Hypnosis App Models)
// ==========================================

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

// ==========================================
// 成就與任務 APP 相關定義 (Achievement & Quest App Models)
// ==========================================

export interface ConditionOnProgram {
  target: "money"
  | "pts"
  | "totalConsumedMc"
  | "mcEnergy"
  | "mcEnergyMax"
  | "vipTier"
  | "suspicion"
  | "sensitivity"
  | "clitSensitivity"
  | "vaginaSensitivity"
  | "anusSensitivity"
  | "urethraSensitivity"
  | "nippleSensitivity"
  | "orgasm"
  | "clitOrgasms"
  | "vaginaOrgasms"
  | "anusOrgasms"
  | "urethraOrgasms"
  | "nippleOrgasms"
  | "alertness"
  | "affection"
  | "obedience"
  | "lust"
  | "arousal";
  operator: "==" | "!=" | ">=" | "<=" | ">" | "<";
  value: number;
  charName?: string; // New field to support character-specific achievements
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
  reward: { // 至少有一種獎勵
    money?: number;
    pts?: number;
    mcEnergyMax?: number;
    mcEnergy?: number;
    suspicion?: number;
  }
}

// ==========================================
// 系統與通用定義 (System & Common Models)
// ==========================================

export interface MockSystemData {
  time: string;
}

// ==========================================
// 角色資料定義 (Character Data Models)
// ==========================================
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
  identity: string; // 身分或稱號?
  alertness: number; // 警戒值
  affection: number; // 好感度
  obedience: number; // 服從度
  lust: number; // 性慾值
  arousal: number; // 快感值
  sensitivity: sensitivityDefs; // 各部位敏感度設定
  orgasm: OrgasmDefs; // 各部位高潮次數

  ownedHypnosisEffects: Record<
    string,
    { endTime: string; hypnosisType: 'temporary' | 'permanent' | 'oneTime'; description: string }
  >; // 催眠名稱(不是id),催眠資料。
  ownedEquipment: Record<string, any>;
  ownedBodyModifications: Record<string, any>;
}


// ==========================================
// 狀態與使用者資料定義 (State & User Data Models)
// ==========================================

export interface MockAchievementState {
  claimed: boolean; // 是否已領取獎勵
}

export interface MockQuestState {
  status: 'accepted' | 'completed' | 'claimed'; // 是否完成與領取獎勵
}

export interface MockUserData {
  userName: string;
  // 基礎資源與訂閱資訊
  money: number;
  mcEnergy: number;
  mcEnergyMax: number;
  mcPoints: number; // 持有催眠點(PTS)
  totalConsumedMc: number;
  vipTier: number; // 0~5
  vipEndVirtualMinutes: number; // 虛擬分鐘
  vipAutoRenew: boolean;
  suspicion: number; // 主角可疑度

  // 玩家持有的催眠裝置
  ownedEquipments: Record<string, { enabled: boolean; settings?: any }>;

  // 玩家持有的催眠與組合
  ownedHypnosis: Record<string, { enabled: boolean; settings?: any }>;
  ownedCombos: Record<string, { enabled: boolean; settings?: any }>;

  // 玩家擁有的成就與任務
  ownedAchievements: Record<string, MockAchievementState>; // 只有達成條件的成就就會出現在這裡
  ownedQuests: Record<string, MockQuestState >; // 只有接取的任務才會出現在這裡
}

// ==========================================
// 遊戲執行資料定義 (Game Runtime Data Models)
// ==========================================

export interface RuntimeData {
  system: MockSystemData;
  user: MockUserData;

  // 所有有變數的角色
  chars: Record<string, MockcharData>;

  // 所有可用的催眠、裝置與組合
  hypnosis: Record<string, HypnosisDef>;
  equipment: Record<string, EquipmentDef>;
  combos: Record<string, ComboDef>;

  // 所有可用的成就與任務
  achievements: Record<string, AchievementOrQuestDef>;
  quests: Record<string, AchievementOrQuestDef>;
}
