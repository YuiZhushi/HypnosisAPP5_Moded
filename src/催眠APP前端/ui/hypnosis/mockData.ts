/**
 * 催眠 APP 模擬資料檔 (Mock Data File)
 * 用於 UI 重構期間的測試與開發。
 * 包含基礎資源、訂閱資訊、以及玩家持有的多重物件。
 */

export interface MockCombo {
  id: string;
  name: string;
  hypnosisConfigs: any[]; // 具體的配置結構待後續 UI 設計時完善
  totalCost: number;
}

export interface MockCustomHypnosis {
  id: string;
  name: string;
  description: string;
  tier: number;
  costType: 'mc' | 'money';
  costValue: number;
}

export interface MockUserData {
  // A. 基礎資源與訂閱資訊
  money: number;
  mcEnergy: number;
  mcEnergyMax: number;
  mcPoints: number; // 持有催眠點(PTS)
  totalConsumedMc: number;
  vipTier: number; // 0~5
  vipEndVirtualMinutes: number; // 虛擬分鐘
  vipAutoRenew: boolean;

  // B. 玩家持有的多重物件
  ownedHypnosis: string[]; // 已購買的預設催眠 ID 列表
  customHypnosis: Record<string, MockCustomHypnosis>; // 玩家自製的催眠
  ownedEquipments: string[]; // 已解鎖/購買的裝置 ID 列表
  savedCombos: MockCombo[]; // 玩家儲存的快捷催眠組合
}

// 預設的測試資料
export const defaultMockUserData: MockUserData = {
  money: 10000,
  mcEnergy: 500,
  mcEnergyMax: 1000,
  mcPoints: 200,
  totalConsumedMc: 50,
  vipTier: 3,
  vipEndVirtualMinutes: 10080, // 一週
  vipAutoRenew: true,

  ownedHypnosis: [
    'vip1_basic_obedience',
    'vip2_memory_alteration'
  ],
  customHypnosis: {
    'custom_1': {
      id: 'custom_1',
      name: '自製催眠測試 A',
      description: '這是一個測試用的自製催眠。',
      tier: 2,
      costType: 'mc',
      costValue: 10
    }
  },
  ownedEquipments: [
    'eq_screen', // 屏幕 (預設擁有)
    'eq_text_compiler' // 催眠文字編譯技術
  ],
  savedCombos: [
    {
      id: 'combo_1',
      name: '日常服從組合',
      hypnosisConfigs: [],
      totalCost: 15
    }
  ]
};

// 簡單的資料存取與操作模擬 (後續可擴充為 React Context 或 Zustand 等)
let currentMockData: MockUserData = { ...defaultMockUserData };

export const MockDataService = {
  getData: () => ({ ...currentMockData }),

  updateData: (updates: Partial<MockUserData>) => {
    currentMockData = { ...currentMockData, ...updates };
    return currentMockData;
  },

  resetData: () => {
    currentMockData = { ...defaultMockUserData };
    return currentMockData;
  }
};
