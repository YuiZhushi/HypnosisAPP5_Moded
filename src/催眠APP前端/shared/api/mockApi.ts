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
  CalendarEvent,
  MockMapState,
} from '../../models';

import {
  mockDatabase,
  setMockDatabase,
  mockSystemData,
  TestCharDataInput,
  TestCustomHypnosisInput,
  TestComboDataInput,
  TestQuestDataInput,
  TestCustomCalendarEvents,
} from '../../database/mockDatabase';

import {
  HYPNOSIS_DICTIONARY,
  EQUIPMENT_DICTIONARY,
  ACHIEVEMENT_DICTIONARY,
  QUEST_DICTIONARY,
  CALENDAR_STATIC_EVENTS,
  MAP_LOCATION_NODES,
  MAP_MAP_EDGES,
} from '../../staticData';

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
        condition: [{ target: 'suspicion', operator: '>=', value: val }],
      },
      reward: { pts: suspicionRewards[i] },
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
        condition: [{ target: 'mcEnergyMax', operator: '>=', value: val }],
      },
      reward: { pts: energyMaxRewards[i] },
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
          condition: [{ target: 'sensitivity', operator: '>=', value: val, charName }],
        },
        reward: { pts: sensitivityRewards[i] },
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
          condition: [{ target: 'orgasm', operator: '>=', value: val, charName }],
        },
        reward: { pts: orgasmRewards[i] },
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
          condition: [{ target: 'obedience', operator: '>=', value: val, charName }],
        },
        reward: { pts: obedienceRewards[i] },
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
      'sensitivity',
      'clitSensitivity',
      'vaginaSensitivity',
      'anusSensitivity',
      'urethraSensitivity',
      'nippleSensitivity',
      'orgasm',
      'clitOrgasms',
      'vaginaOrgasms',
      'anusOrgasms',
      'urethraOrgasms',
      'nippleOrgasms',
      'alertness',
      'affection',
      'obedience',
      'lust',
      'arousal',
    ];
    if (charTargets.includes(cond.target)) {
      for (const charName in TestCharDataInput) {
        if (cond.charName && cond.charName !== charName) continue; // 如果指定了角色，只檢查該角色

        const char = TestCharDataInput[charName];
        const s = char.sensitivity || {};
        const o = char.orgasm || {};

        if (cond.target === 'sensitivity') {
          targetValues.push(
            (s.clitSensitivity || 0) +
              (s.vaginaSensitivity || 0) +
              (s.anusSensitivity || 0) +
              (s.urethraSensitivity || 0) +
              (s.nippleSensitivity || 0),
          );
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
          targetValues.push(
            (o.clitOrgasms || 0) +
              (o.vaginaOrgasms || 0) +
              (o.anusOrgasms || 0) +
              (o.urethraOrgasms || 0) +
              (o.nippleOrgasms || 0),
          );
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
        case '==':
          if (val === cond.value) isConditionMet = true;
          break;
        case '!=':
          if (val !== cond.value) isConditionMet = true;
          break;
        case '>=':
          if (val >= cond.value) isConditionMet = true;
          break;
        case '<=':
          if (val <= cond.value) isConditionMet = true;
          break;
        case '>':
          if (val > cond.value) isConditionMet = true;
          break;
        case '<':
          if (val < cond.value) isConditionMet = true;
          break;
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
  ...getDynamicAchievements(),
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
        streamMode: 'non_streaming',
      };
    }
    mockSystemData.apiSettings = { ...mockSystemData.apiSettings, ...newSettings };
  },

  async fetchAvailableModels(): Promise<string[]> {
    await delay(500);
    return [
      'gpt-4o',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
      'claude-3-opus',
      'claude-3-sonnet',
      'claude-3-haiku',
      'gemini-1.5-pro',
    ];
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

  async updateUserResource(
    patch: Partial<
      Pick<
        MockUserData,
        | 'money'
        | 'mcEnergy'
        | 'mcEnergyMax'
        | 'mcPoints'
        | 'totalConsumedMc'
        | 'suspicion'
        | 'vipTier'
        | 'vipEndVirtualMinutes'
        | 'vipAutoRenew'
      >
    >,
  ): Promise<void> {
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
    const seriesMap: Record<string, { id: string; threshold: number; charName?: string }[]> = {};
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
    const def =
      type === 'achievement' ? FULL_ACHIEVEMENT_DICTIONARY[id] : { ...QUEST_DICTIONARY, ...TestQuestDataInput }[id];
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

      const def = { ...QUEST_DICTIONARY, ...TestQuestDataInput }[id];
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
  },

  // ==========================================
  // 地圖 APP 相關 API (Map App APIs)
  // ==========================================

  async getMapState(): Promise<MockMapState> {
    await delay(100);
    if (!mockDatabase.mapState) {
      throw new Error(
        '[HypnoOS][MapMock] 偵測到 mockDatabase.mapState 缺少模擬運行時資料！請檢查 mockDatabase.ts 中是否正確配置。',
      );
    }
    return JSON.parse(JSON.stringify(mockDatabase.mapState));
  },

  async moveToLocation(
    targetNodeId: string,
    items: string[] = [],
    npcObedience: Record<string, number> = {},
  ): Promise<{
    success: boolean;
    path: string[];
    timeCost: number;
    energyCost: number;
    errorMsg?: string;
    nextState: MockMapState;
  }> {
    await delay(150);
    if (!mockDatabase.mapState) {
      throw new Error(
        '[HypnoOS][MapMock] 偵測到 mockDatabase.mapState 缺少模擬運行時資料！請檢查 mockDatabase.ts 中是否正確配置。',
      );
    }
    const state = mockDatabase.mapState;
    const startNodeId = state.currentLocationId;
    if (startNodeId === targetNodeId) {
      return { success: true, path: [targetNodeId], timeCost: 0, energyCost: 0, nextState: { ...state } };
    }

    if (!state.discoveredNodeIds.includes(targetNodeId)) {
      return {
        success: false,
        path: [],
        timeCost: 0,
        energyCost: 0,
        errorMsg: '該地點尚未被發現。',
        nextState: { ...state },
      };
    }

    // 移動前動態解鎖檢測：若滿足條件，將已發現的 locked 通道升格為 open (Runtime)
    for (const edge of MAP_MAP_EDGES) {
      if (edge.forwardPath && edge.forwardPath.status === 'locked' && edge.forwardPath.unlockCondition) {
        if (checkUnlockCondition(edge.forwardPath.unlockCondition, items, npcObedience)) {
          edge.forwardPath.status = 'open';
          console.info(`[HypnoOS][MapMock] 通路正向【${edge.id}】已滿足條件，動態自動解鎖為 open。`);
        }
      }
      if (edge.ReversePath && edge.ReversePath.status === 'locked' && edge.ReversePath.unlockCondition) {
        if (checkUnlockCondition(edge.ReversePath.unlockCondition, items, npcObedience)) {
          edge.ReversePath.status = 'open';
          console.info(`[HypnoOS][MapMock] 通路反向【${edge.id}】已滿足條件，動態自動解鎖為 open。`);
        }
      }
    }

    const path = findShortestPath(startNodeId, targetNodeId, state.discoveredNodeIds, items);
    if (path.length === 0) {
      return {
        success: false,
        path: [],
        timeCost: 0,
        energyCost: 0,
        errorMsg: '兩地點之間沒有通路，無法前往。',
        nextState: { ...state },
      };
    }

    let totalTime = 0;
    let totalEnergy = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];
      const edge = MAP_MAP_EDGES.find(
        e => (e.StartNodeId === from && e.EndNodeId === to) || (e.StartNodeId === to && e.EndNodeId === from),
      );
      if (edge) {
        const pathInfo = edge.StartNodeId === from ? edge.forwardPath : edge.ReversePath;
        if (pathInfo) {
          totalTime += pathInfo.cost.timeCostMinutes;
          totalEnergy += pathInfo.cost.energyCost ?? 0;
        }
      }
    }

    state.currentLocationId = targetNodeId;

    const pathNames = path.map(id => MAP_LOCATION_NODES.find(n => n.id === id)?.name ?? id).join(' -> ');
    const entry = `[模擬移動定位] 從「${MAP_LOCATION_NODES.find(n => n.id === startNodeId)?.name}」移動至「${MAP_LOCATION_NODES.find(n => n.id === targetNodeId)?.name}」，途經路線：${pathNames}。耗時：${totalTime}分鐘，消耗MC能量：${totalEnergy}點。`;
    console.info(`[HypnoOS][MapMock] ${entry}`);

    return {
      success: true,
      path,
      timeCost: totalTime,
      energyCost: totalEnergy,
      nextState: { ...state },
    };
  },

  async scanForLocations(
    items: string[],
    npcObedience: Record<string, number>,
  ): Promise<{
    success: boolean;
    unlockedNodeIds: string[];
    messages: string[];
    nextState: MockMapState;
  }> {
    await delay(200);
    if (!mockDatabase.mapState) {
      throw new Error(
        '[HypnoOS][MapMock] 偵測到 mockDatabase.mapState 缺少模擬運行時資料！請檢查 mockDatabase.ts 中是否正確配置。',
      );
    }
    const state = mockDatabase.mapState;
    const unlockedNodeIds: string[] = [];
    const messages: string[] = [];

    const currentZoneId = MAP_LOCATION_NODES.find(n => n.id === state.currentLocationId)?.zoneId;
    if (!currentZoneId) {
      return {
        success: false,
        unlockedNodeIds: [],
        messages: ['定位失敗，無法判定當前區域。'],
        nextState: { ...state },
      };
    }

    let changed = true;
    let iterations = 0;
    const maxIterations = 20;
    const processedEdges = new Set<string>();

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      const reachable = findReachableNodes(state.currentLocationId, state.discoveredNodeIds, items);

      for (const edge of MAP_MAP_EDGES) {
        if (edge.zoneId !== currentZoneId) continue;

        // 正向解鎖與發現
        const isEndHidden = !state.discoveredNodeIds.includes(edge.EndNodeId);
        const canScanForward = isEndHidden
          ? state.currentLocationId === edge.StartNodeId
          : reachable.has(edge.StartNodeId);

        if (canScanForward && edge.forwardPath) {
          const pathInfo = edge.forwardPath;
          const nodeName = MAP_LOCATION_NODES.find(n => n.id === edge.EndNodeId)?.name ?? edge.EndNodeId;

          // 1. 不論通路狀態，在此次掃描中必定會發現該節點
          let newlyDiscovered = false;
          if (!state.discoveredNodeIds.includes(edge.EndNodeId)) {
            state.discoveredNodeIds.push(edge.EndNodeId);
            unlockedNodeIds.push(edge.EndNodeId);
            newlyDiscovered = true;
            changed = true;
          }

          // 2. 僅在新發現節點時才發送通知訊息 (不再自動解鎖 locked 通道)
          if (pathInfo.status === 'locked') {
            const cond = pathInfo.unlockCondition;
            if (cond) {
              const edgeKeyForward = `${edge.id}_forward`;
              if (newlyDiscovered && !processedEdges.has(edgeKeyForward)) {
                messages.push(`偵測到鄰近地點：「${nodeName}」，但通道鎖定：${cond.description}`);
                processedEdges.add(edgeKeyForward);
              }
            }
          } else {
            // 通路原本就是 open 或 temp_open
            const edgeKeyForward = `${edge.id}_forward`;
            if (newlyDiscovered && !processedEdges.has(edgeKeyForward)) {
              messages.push(`成功掃描發現新地點：「${nodeName}」！`);
              processedEdges.add(edgeKeyForward);
            }
          }
        }

        // 反向解鎖與發現
        const isStartHidden = !state.discoveredNodeIds.includes(edge.StartNodeId);
        const canScanReverse = isStartHidden
          ? state.currentLocationId === edge.EndNodeId
          : reachable.has(edge.EndNodeId);

        if (canScanReverse && edge.ReversePath) {
          const pathInfo = edge.ReversePath;
          const nodeName = MAP_LOCATION_NODES.find(n => n.id === edge.StartNodeId)?.name ?? edge.StartNodeId;

          // 1. 不論通路狀態，在此次掃描中必定會發現該節點
          let newlyDiscovered = false;
          if (!state.discoveredNodeIds.includes(edge.StartNodeId)) {
            state.discoveredNodeIds.push(edge.StartNodeId);
            unlockedNodeIds.push(edge.StartNodeId);
            newlyDiscovered = true;
            changed = true;
          }

          // 2. 僅在新發現節點時才發送通知訊息 (不再自動解鎖 locked 通道)
          if (pathInfo.status === 'locked') {
            const cond = pathInfo.unlockCondition;
            if (cond) {
              const edgeKeyReverse = `${edge.id}_reverse`;
              if (newlyDiscovered && !processedEdges.has(edgeKeyReverse)) {
                messages.push(`偵測到鄰近地點：「${nodeName}」，但通道鎖定：${cond.description}`);
                processedEdges.add(edgeKeyReverse);
              }
            }
          } else {
            // 通路原本就是 open 或 temp_open
            const edgeKeyReverse = `${edge.id}_reverse`;
            if (newlyDiscovered && !processedEdges.has(edgeKeyReverse)) {
              messages.push(`成功掃描發現新地點：「${nodeName}」！`);
              processedEdges.add(edgeKeyReverse);
            }
          }
        }
      }
    }

    if (unlockedNodeIds.length > 0) {
      const entry = `[模擬地圖雷達掃描] 成功解鎖了新地點：${unlockedNodeIds.map(id => MAP_LOCATION_NODES.find(n => n.id === id)?.name ?? id).join(', ')}。`;
      console.info(`[HypnoOS][MapMock] ${entry}`);
    }

    return {
      success: true,
      unlockedNodeIds,
      messages,
      nextState: { ...state },
    };
  },

  // 新增手動開鎖 API
  async unlockEdge(
    edgeId: string,
    isForward: boolean,
    items: string[] = [],
    npcObedience: Record<string, number> = {},
  ): Promise<{ success: boolean; errorMsg?: string }> {
    await delay(150);
    const edge = MAP_MAP_EDGES.find(e => e.id === edgeId);
    if (!edge) return { success: false, errorMsg: '未找到該通路。' };

    const pathInfo = isForward ? edge.forwardPath : edge.ReversePath;
    if (!pathInfo) return { success: false, errorMsg: '未找到該通路的特定方向。' };
    if (pathInfo.status !== 'locked') return { success: true }; // 早已解鎖

    const cond = pathInfo.unlockCondition;
    if (!cond) return { success: false, errorMsg: '此通路無解鎖條件。' };

    const isEligible = checkUnlockCondition(cond, items, npcObedience);
    if (!isEligible) return { success: false, errorMsg: `未滿足解鎖條件：${cond.description}` };

    pathInfo.status = 'open';
    console.info(`[HypnoOS][MapMock] 手動解鎖通路【${edgeId}】(${isForward ? '正向' : '反向'}) 成功。`);
    return { success: true };
  },

  async updateLocationNote(nodeId: string, newNote: string): Promise<boolean> {
    await delay(100);
    const node = MAP_LOCATION_NODES.find(n => n.id === nodeId);
    if (node) {
      node.description = newNote;
      return true;
    }
    return false;
  },

  findShortestPath(startId: string, endId: string, discovered: string[], items: string[] = []): string[] {
    return findShortestPath(startId, endId, discovered, items);
  },
};

// ====== 輔助函式 ======

function checkUnlockCondition(
  cond: { type: 'obedience' | 'item' | 'always_locked'; targetName?: string; value?: number },
  items: string[],
  npcObedience: Record<string, number>,
): boolean {
  if (cond.type === 'item') {
    return cond.targetName ? items.includes(cond.targetName) : false;
  }
  if (cond.type === 'obedience') {
    if (cond.targetName) {
      const currentVal = npcObedience[cond.targetName] ?? 0;
      return currentVal >= (cond.value ?? 999);
    }
  }
  return false;
}

function isTimeInPeriod(currentDateTimeStr: string, periodString: string): boolean {
  let currentMinutes = 12 * 60; // 預設 12:00
  let currentDayOfWeek = 5; // 預設週五 (2026-05-01 是週五)

  if (currentDateTimeStr.includes(' ')) {
    const parts = currentDateTimeStr.split(' ');
    const datePart = parts[0];
    const timePart = parts[1];

    // 解析星期幾 (用 / 替換 - 防止部分環境解析錯誤)
    const dateObj = new Date(datePart.replace(/-/g, '/'));
    if (!isNaN(dateObj.getTime())) {
      const rawDay = dateObj.getDay(); // 0-6 (0 是週日)
      currentDayOfWeek = rawDay === 0 ? 7 : rawDay;
    }

    const [h, m] = timePart.split(':').map(Number);
    currentMinutes = h * 60 + m;
  } else if (currentDateTimeStr.includes(':')) {
    const [h, m] = currentDateTimeStr.split(':').map(Number);
    currentMinutes = h * 60 + m;
  }

  // 以分號分隔多個時段
  const periods = periodString.split(';');

  return periods.some(period => {
    const trimmed = period.trim();
    if (!trimmed) return false;

    let weekPart = '';
    let timePart = trimmed;

    // 檢查是否有空格分隔星期與時間，例如 "1-5 15:00-18:00"
    if (trimmed.includes(' ')) {
      const parts = trimmed.split(/\s+/);
      weekPart = parts[0];
      timePart = parts[1];
    }

    // 1. 星期判定
    if (weekPart) {
      let isWeekMatched = false;
      if (weekPart.includes('-')) {
        const [startW, endW] = weekPart.split('-').map(Number);
        isWeekMatched = currentDayOfWeek >= startW && currentDayOfWeek <= endW;
      } else if (weekPart.includes(',')) {
        const weeks = weekPart.split(',').map(Number);
        isWeekMatched = weeks.includes(currentDayOfWeek);
      } else {
        isWeekMatched = Number(weekPart) === currentDayOfWeek;
      }
      if (!isWeekMatched) return false;
    }

    // 2. 時間判定 (支援跨日，例如 20:00-07:30)
    const [startStr, endStr] = timePart.split('-');
    if (!startStr || !endStr) return false;

    const toMinutes = (tStr: string) => {
      const [h, m] = tStr.trim().split(':').map(Number);
      return h * 60 + m;
    };

    const start = toMinutes(startStr);
    const end = toMinutes(endStr);

    if (start <= end) {
      return currentMinutes >= start && currentMinutes <= end;
    } else {
      return currentMinutes >= start || currentMinutes <= end;
    }
  });
}

function checkTempCondition(pathInfo: any, toId: string, items: string[]): boolean {
  const cond = pathInfo.tempConditon;
  if (!cond) return true;

  if (cond.type === 'item') {
    return cond.targetName ? items.includes(cond.targetName) : false;
  }
  if (cond.type === 'character') {
    const node = MAP_LOCATION_NODES.find(n => n.id === toId);
    return node?.presentNpcs?.some(npc => npc.name === cond.targetName) ?? false;
  }
  if (cond.type === 'time') {
    return cond.targetName ? isTimeInPeriod(mockSystemData.time, cond.targetName) : false;
  }
  return false;
}

function findReachableNodes(startId: string, discovered: string[], items: string[]): Set<string> {
  const reachable = new Set<string>([startId]);
  const queue = [startId];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const edge of MAP_MAP_EDGES) {
      // 情況 A：正向 (Start -> End)
      if (edge.StartNodeId === curr && discovered.includes(edge.EndNodeId) && edge.forwardPath) {
        const path = edge.forwardPath;
        if (
          path.status === 'open' ||
          (path.status === 'temp_open' && checkTempCondition(path, edge.EndNodeId, items))
        ) {
          if (!reachable.has(edge.EndNodeId)) {
            reachable.add(edge.EndNodeId);
            queue.push(edge.EndNodeId);
          }
        }
      }
      // 情況 B：反向 (End -> Start)
      if (edge.EndNodeId === curr && discovered.includes(edge.StartNodeId) && edge.ReversePath) {
        const path = edge.ReversePath;
        if (
          path.status === 'open' ||
          (path.status === 'temp_open' && checkTempCondition(path, edge.StartNodeId, items))
        ) {
          if (!reachable.has(edge.StartNodeId)) {
            reachable.add(edge.StartNodeId);
            queue.push(edge.StartNodeId);
          }
        }
      }
    }
  }
  return reachable;
}

function findShortestPath(startId: string, endId: string, discovered: string[], items: string[] = []): string[] {
  if (startId === endId) return [startId];

  const queue: Array<{ path: string[]; cost: number }> = [{ path: [startId], cost: 0 }];

  const visited: Record<string, number> = {};
  visited[startId] = 0;

  while (queue.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].cost < queue[minIdx].cost) {
        minIdx = i;
      }
    }
    const { path, cost } = queue.splice(minIdx, 1)[0];
    const curr = path[path.length - 1];

    if (curr === endId) {
      const truncatedPath: string[] = [path[0]];
      for (let i = 0; i < path.length - 1; i++) {
        const u = path[i];
        const v = path[i + 1];
        const edge = MAP_MAP_EDGES.find(
          e => (e.StartNodeId === u && e.EndNodeId === v) || (e.EndNodeId === u && e.StartNodeId === v),
        );
        if (edge) {
          let isOpen = false;
          if (edge.StartNodeId === u && edge.EndNodeId === v) {
            const p = edge.forwardPath;
            isOpen = p ? p.status === 'open' || (p.status === 'temp_open' && checkTempCondition(p, v, items)) : false;
          } else {
            const p = edge.ReversePath;
            isOpen = p ? p.status === 'open' || (p.status === 'temp_open' && checkTempCondition(p, u, items)) : false;
          }
          truncatedPath.push(v);
          if (!isOpen) {
            return truncatedPath;
          }
        } else {
          truncatedPath.push(v);
        }
      }
      return truncatedPath;
    }

    for (const edge of MAP_MAP_EDGES) {
      // 情況 A：正向 (Start -> End)
      if (edge.StartNodeId === curr && discovered.includes(edge.EndNodeId) && edge.forwardPath) {
        const p = edge.forwardPath;
        const isOpen =
          p.status === 'open' || (p.status === 'temp_open' && checkTempCondition(p, edge.EndNodeId, items));
        const edgeWeight = isOpen ? 1 : 1000;
        const newCost = cost + edgeWeight;

        if (visited[edge.EndNodeId] === undefined || newCost < visited[edge.EndNodeId]) {
          visited[edge.EndNodeId] = newCost;
          queue.push({ path: [...path, edge.EndNodeId], cost: newCost });
        }
      }

      // 情況 B：反向 (End -> Start)
      if (edge.EndNodeId === curr && discovered.includes(edge.StartNodeId) && edge.ReversePath) {
        const p = edge.ReversePath;
        const isOpen =
          p.status === 'open' || (p.status === 'temp_open' && checkTempCondition(p, edge.StartNodeId, items));
        const edgeWeight = isOpen ? 1 : 1000;
        const newCost = cost + edgeWeight;

        if (visited[edge.StartNodeId] === undefined || newCost < visited[edge.StartNodeId]) {
          visited[edge.StartNodeId] = newCost;
          queue.push({ path: [...path, edge.StartNodeId], cost: newCost });
        }
      }
    }
  }

  return [];
}
