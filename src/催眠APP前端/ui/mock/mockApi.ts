import {
  MockUserData,
  MockSystemData,
  MockcharData,
  HypnosisDef,
  EquipmentDef,
  ComboDef,
  AchievementOrQuestDef,
  ConditionOnProgram,
  MockApiSettings,
  CalendarEvent
} from './mockModels';

import {
  mockDatabase,
  setMockDatabase,
  mockSystemData,
  TestCharDataInput,
  TestCustomHypnosisInput,
  TestComboDataInput,
  TestQuestDataInput,
  TestCustomCalendarEvents
} from './mockDatabase';

import {
  HYPNOSIS_DICTIONARY,
  EQUIPMENT_DICTIONARY,
  ACHIEVEMENT_DICTIONARY,
  QUEST_DICTIONARY,
  CALENDAR_STATIC_EVENTS
} from './mockStaticData';

// 模擬網路延遲
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 內部輔助函數：動態成就生成
// ==========================================
let cachedDynamicAchievements: Record<string, AchievementOrQuestDef> | null = null;

function getDynamicAchievements(): Record<string, AchievementOrQuestDef> {
  if (cachedDynamicAchievements) return cachedDynamicAchievements;

  const dynamic: Record<string, AchievementOrQuestDef> = {};

  // 全域資源閾值
  const suspicionThresholds = [25, 50, 75, 100];
  const suspicionNames = ['初露端倪', '引人注目', '危機四伏', '暴露邊緣'];
  const suspicionRewards = [10, 20, 30, 50];
  suspicionThresholds.forEach((val, i) => {
    dynamic[`ach_suspicion_${val}`] = {
      name: suspicionNames[i],
      dataType: 'achievement',
      isCustom: false,
      description: `可疑度達到 ${val}%`,
      completionCondition: {
        type: 'program',
        condition: [{ target: 'suspicion', operator: '>=', value: val }]
      },
      reward: { pts: suspicionRewards[i] }
    };
  });

  const energyMaxThresholds = [100, 300, 1000];
  const energyMaxNames = ['能量充沛 I', '能量充沛 II', '能量充沛 III'];
  const energyMaxRewards = [10, 30, 50];
  energyMaxThresholds.forEach((val, i) => {
    dynamic[`ach_energyMax_${val}`] = {
      name: energyMaxNames[i],
      dataType: 'achievement',
      isCustom: false,
      description: `MC能量上限達到 ${val}`,
      completionCondition: {
        type: 'program',
        condition: [{ target: 'mcEnergyMax', operator: '>=', value: val }]
      },
      reward: { pts: energyMaxRewards[i] }
    };
  });

  // 角色專屬閾值
  const sensitivityThresholds = [200, 300, 400, 500];
  const sensitivityNames = ['敏感體質 I', '敏感體質 II', '敏感體質 III', '敏感體質 IV'];
  const sensitivityRewards = [10, 20, 30, 50];

  const orgasmThresholds = [1, 5, 25, 100];
  const orgasmNames = ['初嚐禁果', '漸入佳境', '欲罷不能', '高潮迭起'];
  const orgasmRewards = [5, 10, 20, 50];

  const obedienceThresholds = [25, 50, 75, 100];
  const obedienceNames = ['初步馴服', '漸露順從', '高度服從', '絕對服從'];
  const obedienceRewards = [10, 20, 30, 50];

  for (const charName in TestCharDataInput) {
    sensitivityThresholds.forEach((val, i) => {
      dynamic[`ach_sensitivity_${val}_${charName}`] = {
        name: `${sensitivityNames[i]} (${charName})`,
        dataType: 'achievement',
        isCustom: false,
        description: `敏感度達到 ${val}`,
        completionCondition: {
          type: 'program',
          condition: [{ target: 'sensitivity', operator: '>=', value: val, charName }]
        },
        reward: { pts: sensitivityRewards[i] }
      };
    });

    orgasmThresholds.forEach((val, i) => {
      dynamic[`ach_orgasm_${val}_${charName}`] = {
        name: `${orgasmNames[i]} (${charName})`,
        dataType: 'achievement',
        isCustom: false,
        description: `高潮次數達到 ${val} 次`,
        completionCondition: {
          type: 'program',
          condition: [{ target: 'orgasm', operator: '>=', value: val, charName }]
        },
        reward: { pts: orgasmRewards[i] }
      };
    });

    obedienceThresholds.forEach((val, i) => {
      dynamic[`ach_obedience_${val}_${charName}`] = {
        name: `${obedienceNames[i]} (${charName})`,
        dataType: 'achievement',
        isCustom: false,
        description: `服從度達到 ${val}%`,
        completionCondition: {
          type: 'program',
          condition: [{ target: 'obedience', operator: '>=', value: val, charName }]
        },
        reward: { pts: obedienceRewards[i] }
      };
    });
  }

  cachedDynamicAchievements = dynamic;
  return dynamic;
}

// ==========================================
// 內部輔助函數：評估程式條件
// ==========================================
function evaluateProgramConditions(conditions: ConditionOnProgram[] | string): boolean {
  if (typeof conditions === 'string') return false; // 模擬後端無法解析純字串條件

  for (const cond of conditions) {
    // 取得所有 target 的值，並檢查是否至少有一個符合條件
    const targetValues: number[] = [];

    // 1. 檢查全域資源 (user data)
    if (cond.target.includes('money')) targetValues.push(mockDatabase.money);
    if (cond.target.includes('pts')) targetValues.push(mockDatabase.mcPoints);
    if (cond.target.includes('totalConsumedMc')) targetValues.push(mockDatabase.totalConsumedMc);
    if (cond.target.includes('mcEnergy')) targetValues.push(mockDatabase.mcEnergy);
    if (cond.target.includes('mcEnergyMax')) targetValues.push(mockDatabase.mcEnergyMax);
    if (cond.target.includes('suspicion')) targetValues.push(mockDatabase.suspicion);
    if (cond.target === 'vipTier') targetValues.push(mockDatabase.vipTier);

    // 2. 檢查角色屬性 (char data)，將所有角色的該屬性值加入陣列
    const charTargets = [
      'sensitivity', 'clitSensitivity', 'vaginaSensitivity', 'anusSensitivity', 'urethraSensitivity', 'nippleSensitivity',
      'orgasm', 'clitOrgasms', 'vaginaOrgasms', 'anusOrgasms', 'urethraOrgasms', 'nippleOrgasms',
      'alertness', 'affection', 'obedience', 'lust', 'arousal'
    ];
    if (charTargets.includes(cond.target)) {
      for (const charName in TestCharDataInput) {
        if (cond.charName && cond.charName !== charName) continue; // 如果指定了角色，只檢查該角色

        const char = TestCharDataInput[charName];
        const s = char.sensitivity || {};
        const o = char.orgasm || {};

        if (cond.target === 'sensitivity') {
          targetValues.push((s.clitSensitivity || 0) + (s.vaginaSensitivity || 0) + (s.anusSensitivity || 0) + (s.urethraSensitivity || 0) + (s.nippleSensitivity || 0));
        } else if (cond.target === 'clitSensitivity') {
          targetValues.push(s.clitSensitivity || 0);
        } else if (cond.target === 'vaginaSensitivity') {
          targetValues.push(s.vaginaSensitivity || 0);
        } else if (cond.target === 'anusSensitivity') {
          targetValues.push(s.anusSensitivity || 0);
        } else if (cond.target === 'urethraSensitivity') {
          targetValues.push(s.urethraSensitivity || 0);
        } else if (cond.target === 'nippleSensitivity') {
          targetValues.push(s.nippleSensitivity || 0);
        } else if (cond.target === 'orgasm') {
          targetValues.push((o.clitOrgasms || 0) + (o.vaginaOrgasms || 0) + (o.anusOrgasms || 0) + (o.urethraOrgasms || 0) + (o.nippleOrgasms || 0));
        } else if (cond.target === 'clitOrgasms') {
          targetValues.push(o.clitOrgasms || 0);
        } else if (cond.target === 'vaginaOrgasms') {
          targetValues.push(o.vaginaOrgasms || 0);
        } else if (cond.target === 'anusOrgasms') {
          targetValues.push(o.anusOrgasms || 0);
        } else if (cond.target === 'urethraOrgasms') {
          targetValues.push(o.urethraOrgasms || 0);
        } else if (cond.target === 'nippleOrgasms') {
          targetValues.push(o.nippleOrgasms || 0);
        } else if (cond.target === 'alertness') {
          targetValues.push(char.alertness || 0);
        } else if (cond.target === 'affection') {
          targetValues.push(char.affection || 0);
        } else if (cond.target === 'obedience') {
          targetValues.push(char.obedience || 0);
        } else if (cond.target === 'lust') {
          targetValues.push(char.lust || 0);
        } else if (cond.target === 'arousal') {
          targetValues.push(char.arousal || 0);
        }
      }
    }

    // 進行比對邏輯
    let isConditionMet = false;
    for (const val of targetValues) {
      switch (cond.operator) {
        case '==': if (val === cond.value) isConditionMet = true; break;
        case '!=': if (val !== cond.value) isConditionMet = true; break;
        case '>=': if (val >= cond.value) isConditionMet = true; break;
        case '<=': if (val <= cond.value) isConditionMet = true; break;
        case '>':  if (val > cond.value) isConditionMet = true; break;
        case '<':  if (val < cond.value) isConditionMet = true; break;
      }
      if (isConditionMet) break; // 只要有一個 target 達成即算通過此條件
    }

    // 如果這個 condition 沒有任何 target 達成，則整個判斷失敗
    if (!isConditionMet) return false;
  }

  return true; // 所有 conditions 都達成
}

const FULL_ACHIEVEMENT_DICTIONARY: Record<string, AchievementOrQuestDef> = {
  ...ACHIEVEMENT_DICTIONARY,
  ...getDynamicAchievements()
};

export const MockApi = {
  // ==========================================
  // 設定 APP 相關 API
  // ==========================================

  async getApiSettings(): Promise<MockApiSettings> {
    await delay(150);
    return JSON.parse(JSON.stringify(mockSystemData.apiSettings || {}));
  },

  async updateApiSettings(newSettings: Partial<MockApiSettings>): Promise<void> {
    await delay(300);
    if (!mockSystemData.apiSettings) {
      mockSystemData.apiSettings = {
        apiEndpoint: '',
        apiKey: '',
        modelName: '',
        temperature: 0.7,
        maxTokens: 8192,
        topP: 1,
        presencePenalty: 0,
        frequencyPenalty: 0,
        streamMode: 'non_streaming'
      };
    }
    mockSystemData.apiSettings = { ...mockSystemData.apiSettings, ...newSettings };
  },

  async fetchAvailableModels(): Promise<string[]> {
    await delay(500);
    return ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'gemini-1.5-pro'];
  },

  // ==========================================
  // 通用 & 催眠相關 API
  // ==========================================

  async getUserInfo(): Promise<MockUserData> {
    await delay(200);
    return JSON.parse(JSON.stringify(mockDatabase));
  },

  async getSystemData(): Promise<MockSystemData> {
    await delay(100);
    return JSON.parse(JSON.stringify(mockSystemData));
  },

  async getCharData(): Promise<Record<string, MockcharData>> {
    await delay(100);
    return TestCharDataInput;
  },

  async getAllEquipment(): Promise<Record<string, EquipmentDef>> {
    await delay(150);
    return { ...EQUIPMENT_DICTIONARY };
  },

  async getAllHypnosis(): Promise<Record<string, HypnosisDef>> {
    await delay(150);
    return { ...HYPNOSIS_DICTIONARY, ...TestCustomHypnosisInput };
  },

  async getAllCombos(): Promise<Record<string, ComboDef>> {
    await delay(150);
    return { ...TestComboDataInput };
  },

  async updateUserResource(patch: Partial<Pick<MockUserData, 'money' | 'mcEnergy' | 'mcEnergyMax' | 'mcPoints' | 'totalConsumedMc' | 'suspicion' | 'vipTier' | 'vipEndVirtualMinutes' | 'vipAutoRenew'>>): Promise<void> {
    await delay(300);
    const newData = { ...mockDatabase };

    if (patch.mcEnergy !== undefined && patch.mcEnergy < newData.mcEnergy) {
      const consumed = newData.mcEnergy - patch.mcEnergy;
      patch.totalConsumedMc = (patch.totalConsumedMc ?? newData.totalConsumedMc) + consumed;
    }

    setMockDatabase({ ...newData, ...patch });
  },

  async updateUserOwnedHypnosis(id: string, enabled: boolean, settings?: any): Promise<void> {
    await delay(200);
    mockDatabase.ownedHypnosis[id] = { enabled, settings: settings || mockDatabase.ownedHypnosis[id]?.settings };
  },

  async updateUserOwnedEquipments(id: string, enabled: boolean, settings?: any): Promise<void> {
    await delay(200);
    mockDatabase.ownedEquipments[id] = { enabled, settings: settings || mockDatabase.ownedEquipments[id]?.settings };
  },

  async updateUserOwnedCombos(id: string, enabled: boolean, settings?: any): Promise<void> {
    await delay(200);
    mockDatabase.ownedCombos[id] = { enabled, settings: settings || mockDatabase.ownedCombos[id]?.settings };
  },

  async sendHypnosis(launchData: any[]): Promise<void> {
    await delay(500);
    console.log('[MockApi] 模擬發送催眠指令:', launchData);
  },

  async saveNewHypnosis(id: string, def: HypnosisDef): Promise<void> {
    await delay(300);
    TestCustomHypnosisInput[id] = def;
  },

  async saveNewCombo(comboId: string, comboDef: ComboDef): Promise<void> {
    await delay(200);
    TestComboDataInput[comboId] = comboDef;
    mockDatabase.ownedCombos[comboId] = { enabled: true };
  },

  async updateCombo(comboId: string, comboDef: ComboDef): Promise<void> {
    await delay(200);
    if (TestComboDataInput[comboId]) {
      TestComboDataInput[comboId] = comboDef;
    }
  },

  async deleteCombo(comboId: string): Promise<void> {
    await delay(200);
    delete TestComboDataInput[comboId];
    if (mockDatabase.ownedCombos[comboId]) {
      delete mockDatabase.ownedCombos[comboId];
    }
  },

  async deleteHypnosis(id: string): Promise<void> {
    await delay(200);
    if (TestCustomHypnosisInput[id]) {
      delete TestCustomHypnosisInput[id];
    }
    if (mockDatabase.ownedHypnosis[id]) {
      delete mockDatabase.ownedHypnosis[id];
    }
    for (const comboId in TestComboDataInput) {
      if (TestComboDataInput[comboId].includedHypnosis[id]) {
        delete TestComboDataInput[comboId].includedHypnosis[id];
        if (Object.keys(TestComboDataInput[comboId].includedHypnosis).length === 0) {
          delete TestComboDataInput[comboId];
          if (mockDatabase.ownedCombos[comboId]) {
            delete mockDatabase.ownedCombos[comboId];
          }
        }
      }
    }
  },

  // ==========================================
  // 成就與任務相關 API
  // ==========================================

  async getTotalAchievementsCount(): Promise<number> {
    await delay(50);
    return Object.keys(FULL_ACHIEVEMENT_DICTIONARY).length;
  },

  async getAllAchievements(): Promise<Record<string, AchievementOrQuestDef>> {
    await delay(100);
    const fullDict = FULL_ACHIEVEMENT_DICTIONARY;
    const filtered: Record<string, AchievementOrQuestDef> = {};

    // Group dynamic achievements by series
    const seriesMap: Record<string, { id: string, threshold: number, charName?: string }[]> = {};
    const staticAchievements: string[] = [];

    for (const id in fullDict) {
      const match = id.match(/^ach_([a-zA-Z]+)_(\d+)(?:_(.+))?$/);
      if (match) {
        const type = match[1];
        const threshold = parseInt(match[2]);
        const charName = match[3];
        const seriesId = charName ? `ach_${type}_${charName}` : `ach_${type}`;
        if (!seriesMap[seriesId]) seriesMap[seriesId] = [];
        seriesMap[seriesId].push({ id, threshold, charName });
      } else {
        staticAchievements.push(id);
      }
    }

    // Add static achievements directly
    for (const id of staticAchievements) {
      filtered[id] = fullDict[id];
    }

    // Process dynamic series
    for (const seriesId in seriesMap) {
      const items = seriesMap[seriesId];
      items.sort((a, b) => a.threshold - b.threshold);

      let activeItem = items[items.length - 1]; // default to last
      for (const item of items) {
        const state = mockDatabase.ownedAchievements[item.id];
        if (!state || !state.claimed) {
          activeItem = item;
          break;
        }
      }

      // Character removal filter
      if (activeItem.charName && !TestCharDataInput[activeItem.charName]) {
        // Character not in current floor
        const state = mockDatabase.ownedAchievements[activeItem.id];
        if (!state) {
          // Not unlocked, so we should hide it.
          // Show the last claimed/unlocked one instead if it exists
          let lastValid: typeof activeItem | null = null;
          for (let i = items.indexOf(activeItem) - 1; i >= 0; i--) {
            const prevState = mockDatabase.ownedAchievements[items[i].id];
            if (prevState) {
              lastValid = items[i];
              break;
            }
          }
          if (lastValid) {
            filtered[lastValid.id] = fullDict[lastValid.id];
          }
          continue; // Skip the un-unlocked active item
        }
      }

      filtered[activeItem.id] = fullDict[activeItem.id];
    }

    return filtered;
  },

  async getAllQuests(): Promise<Record<string, AchievementOrQuestDef>> {
    await delay(100);
    return { ...QUEST_DICTIONARY, ...TestQuestDataInput };
  },

  async claimAchievement(id: string): Promise<boolean> {
    await delay(300);
    const achState = mockDatabase.ownedAchievements[id];
    if (achState && !achState.claimed) {
      achState.claimed = true;

      const def = FULL_ACHIEVEMENT_DICTIONARY[id];
      if (def && def.reward) {
        if (def.reward.pts) mockDatabase.mcPoints += def.reward.pts;
        if (def.reward.money) mockDatabase.money += def.reward.money;
        if (def.reward.mcEnergyMax) mockDatabase.mcEnergyMax += def.reward.mcEnergyMax;
        if (def.reward.mcEnergy) mockDatabase.mcEnergy += def.reward.mcEnergy;
        if (def.reward.suspicion) mockDatabase.suspicion += def.reward.suspicion;
      }
      return true;
    }
    return false;
  },

  async acceptQuest(id: string): Promise<boolean> {
    await delay(200);
    const questState = mockDatabase.ownedQuests[id];
    if (!questState) {
      mockDatabase.ownedQuests[id] = { status: 'accepted' }; // 模擬新增
      return true;
    }
    return false;
  },

  async cancelQuest(id: string): Promise<boolean> {
    await delay(200);
    const questState = mockDatabase.ownedQuests[id];
    if (questState && questState.status === 'accepted') {
      delete mockDatabase.ownedQuests[id];
      return true;
    }
    return false;
  },

  async completeQuest(id: string): Promise<boolean> {
    await delay(200);
    const questState = mockDatabase.ownedQuests[id];
    if (questState && questState.status === 'accepted') {
      questState.status = 'completed';
      return true;
    }
    return false;
  },

  async checkCondition(id: string, type: 'achievement' | 'quest'): Promise<boolean> {
    await delay(150);
    const def = type === 'achievement' ? FULL_ACHIEVEMENT_DICTIONARY[id] : ({...QUEST_DICTIONARY, ...TestQuestDataInput}[id]);
    if (!def) return false;
    if (def.completionCondition.type === 'ai') {
      return false; // AI 判斷暫不處理
    }
    if (def.completionCondition.type === 'program' && Array.isArray(def.completionCondition.condition)) {
      return evaluateProgramConditions(def.completionCondition.condition);
    }
    return false;
  },

  async unlockAchievement(id: string): Promise<boolean> {
    await delay(100);
    if (!mockDatabase.ownedAchievements[id]) {
      mockDatabase.ownedAchievements[id] = { claimed: false };
      return true;
    }
    return false;
  },

  async claimQuest(id: string): Promise<boolean> {
    await delay(300);
    const questState = mockDatabase.ownedQuests[id];
    if (questState && questState.status === 'completed') {
      questState.status = 'claimed';

      const def = {...QUEST_DICTIONARY, ...TestQuestDataInput}[id];
      if (def && def.reward) {
        if (def.reward.pts) mockDatabase.mcPoints += def.reward.pts;
        if (def.reward.money) mockDatabase.money += def.reward.money;
        if (def.reward.mcEnergyMax) mockDatabase.mcEnergyMax += def.reward.mcEnergyMax;
        if (def.reward.mcEnergy) mockDatabase.mcEnergy += def.reward.mcEnergy;
        if (def.reward.suspicion) mockDatabase.suspicion += def.reward.suspicion;
      }
      return true;
    }
    return false;
  },

  async saveNewQuest(id: string, def: AchievementOrQuestDef): Promise<void> {
    await delay(300);
    TestQuestDataInput[id] = def;
  },

  async deleteQuest(id: string): Promise<void> {
    await delay(200);
    if (TestQuestDataInput[id]) {
      delete TestQuestDataInput[id];
    }
    if (mockDatabase.ownedQuests[id]) {
      delete mockDatabase.ownedQuests[id];
    }
  },

  // ==========================================
  // 日曆 APP 相關 API
  // ==========================================

  async getCalendarEvents(): Promise<Record<string, CalendarEvent>> {
    await delay(150);
    return { ...CALENDAR_STATIC_EVENTS, ...TestCustomCalendarEvents };
  },

  async createCalendarEvent(id: string, event: CalendarEvent): Promise<void> {
    await delay(300);
    TestCustomCalendarEvents[id] = event;
  },

  async updateCalendarEvent(id: string, event: CalendarEvent): Promise<void> {
    await delay(200);
    if (TestCustomCalendarEvents[id]) {
      TestCustomCalendarEvents[id] = event;
    }
  },

  async deleteCalendarEvent(id: string): Promise<void> {
    await delay(200);
    if (TestCustomCalendarEvents[id]) {
      delete TestCustomCalendarEvents[id];
    }
  }
};
