import {
  MockUserData,
  MockSystemData,
  MockcharData,
  HypnosisDef,
  HypnoModuleDef,
  ItemDef,
  InventoryItemState,
  ComboDef,
  AchievementOrQuestDef,
  ConditionOnProgram,
  MockApiSettings,
  CalendarEvent,
  MockMapState,
  BodyPartsDef,
  MvuVariables,
  type AttrModifier,
} from '../../models';

import {
  mockChatVariables,
  mockMvuVariables,
} from '../../database/mockDatabase';

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

  for (const charName in mockMvuVariables.chars) {
    sensitivityThresholds.forEach((val, i) => {
      dynamic[`ach_sensitivity_${val}_${charName}`] = {
        name: `${sensitivityNames[i]} (${charName})`,
        dataType: 'achievement',
        isCustom: false,
        description: `總敏感度達到 ${val}`,
        completionCondition: {
          type: 'program',
          condition: [{ target: 'totalSensitivity', operator: '>=', value: val, charName }],
        },
        reward: { pts: sensitivityRewards[i] },
      };
    });

    orgasmThresholds.forEach((val, i) => {
      dynamic[`ach_orgasm_${val}_${charName}`] = {
        name: `${orgasmNames[i]} (${charName})`,
        dataType: 'achievement',
        isCustom: false,
        description: `總高潮次數達到 ${val} 次`,
        completionCondition: {
          type: 'program',
          condition: [{ target: 'totalOrgasms', operator: '>=', value: val, charName }],
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
// 身體改造：NPC 有效屬性計算與輔助函數
// ==========================================
function getEffectiveNpcData(npcName: string): MockcharData {
  const char = mockMvuVariables.chars[npcName];
  if (!char) {
    throw new Error(`[MockApi] getEffectiveNpcData: 未找到角色 ${npcName}`);
  }

  // 深度複製，避免污染 mvuVariables 的基礎狀態
  const effectiveChar = JSON.parse(JSON.stringify(char)) as MockcharData;

  effectiveChar.ownedBodyModifications = effectiveChar.ownedBodyModifications || {};
  effectiveChar.bodyParts = effectiveChar.bodyParts || {
    mouth: { sensitivity: 0, tightness: 0, proficiency: 0, orgasms: 0 },
    breastLeft: { sensitivity: 0, proficiency: 0, orgasms: 0 },
    breastRight: { sensitivity: 0, proficiency: 0, orgasms: 0 },
    vagina: { sensitivity: 0, tightness: 0, proficiency: 0, orgasms: 0 },
    anus: { sensitivity: 0, tightness: 0, proficiency: 0, orgasms: 0 },
    urethra: { sensitivity: 0, tightness: 0, proficiency: 0, orgasms: 0 },
    clitoris: { sensitivity: 0, proficiency: 0, orgasms: 0 },
  };

  // 1. 動態負荷上限計算：初始負荷上限 14，每多一個實體化的自訂部位則 +2
  const baseMaxLoad = 14;
  let customPartsCount = 0;
  const defaultParts = ['mouth', 'breastLeft', 'breastRight', 'vagina', 'anus', 'urethra', 'clitoris'];
  for (const partKey in effectiveChar.bodyParts) {
    if (!defaultParts.includes(partKey)) {
      customPartsCount++;
    }
  }
  const effectiveMaxLoad = baseMaxLoad + customPartsCount * 2;
  (effectiveChar as any).maxLoad = effectiveMaxLoad;
  (effectiveChar as any).currentLoad = 0;

  // 2. 套用啟用的改造 modifiers 與適應期排異反應
  const currentTime = mockMvuVariables.time;

  for (const modId in effectiveChar.ownedBodyModifications) {
    const modState = effectiveChar.ownedBodyModifications[modId];
    if (!modState || !modState.isActive) continue;

    const def = mockChatVariables.bodyModifications[modId];
    if (!def) continue;

    // 累計負荷
    (effectiveChar as any).currentLoad += def.loadCost || 0;

    // 檢查適應期
    let isAdapting = false;
    if (modState.adaptation && modState.adaptation.endVirtualTime) {
      const currentMs = new Date(currentTime.replace(/-/g, '/')).getTime();
      const endMs = new Date(modState.adaptation.endVirtualTime.replace(/-/g, '/')).getTime();
      if (!isNaN(currentMs) && !isNaN(endMs) && currentMs < endMs) {
        isAdapting = true;
      }
    }

    // 整合常駐 modifiers 與適應期排異 modifiers
    const modifiersToApply = [...(def.modifiers || [])];
    if (isAdapting && modState.adaptation && modState.adaptation.extraModifiers) {
      modifiersToApply.push(...modState.adaptation.extraModifiers);
    }

    // 套用增減益
    for (const mod of modifiersToApply) {
      if (mod.targetType === 'global_stat') {
        const val = Number((effectiveChar as any)[mod.statName]) || 0;
        let newVal = val;
        if (mod.operator === '+') newVal += mod.value;
        if (mod.operator === '-') newVal -= mod.value;
        if (mod.operator === '*') newVal *= mod.value;
        (effectiveChar as any)[mod.statName] = newVal;
      } else if (mod.targetType === 'body_part_stat') {
        const applyToPart = (partId: string) => {
          const bpStat = effectiveChar.bodyParts[partId];
          if (bpStat) {
            const val = Number((bpStat as any)[mod.statName]) || 0;
            let newVal = val;
            if (mod.operator === '+') newVal += mod.value;
            if (mod.operator === '-') newVal -= mod.value;
            if (mod.operator === '*') newVal *= mod.value;
            (bpStat as any)[mod.statName] = newVal;
          }
        };

        if (mod.bodyPartId === 'slots') {
          for (const slotId of def.slots) {
            applyToPart(slotId);
          }
        } else if (mod.bodyPartId) {
          applyToPart(mod.bodyPartId);
        }
      }
    }
  }

  // 3. 邊界數值限制
  const limit = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
  effectiveChar.obedience = limit(effectiveChar.obedience, 0, 100);
  effectiveChar.affection = limit(effectiveChar.affection, 0, 100);
  effectiveChar.alertness = limit(effectiveChar.alertness, 0, 100);
  effectiveChar.lust = limit(effectiveChar.lust, 0, 100);
  effectiveChar.arousal = limit(effectiveChar.arousal, 0, 100);

  for (const partKey in effectiveChar.bodyParts) {
    const bp = effectiveChar.bodyParts[partKey];
    if (bp) {
      if (bp.sensitivity !== undefined) bp.sensitivity = limit(bp.sensitivity, -150, 250);
      if (bp.tightness !== undefined) bp.tightness = limit(bp.tightness, -150, 250);
      if (bp.proficiency !== undefined) bp.proficiency = limit(bp.proficiency, 0, 100);
      if (bp.orgasms !== undefined) bp.orgasms = Math.max(0, bp.orgasms);
    }
  }

  return effectiveChar;
}

function getEffectiveNpcDataSafe(npcName: string): any {
  try {
    return getEffectiveNpcData(npcName);
  } catch (e) {
    return mockMvuVariables.chars[npcName] || {};
  }
}

function processVirtualTimeAdvance(oldTimeStr: string, newTimeStr: string) {
  const oldDt = new Date(oldTimeStr.replace(/-/g, '/'));
  const newDt = new Date(newTimeStr.replace(/-/g, '/'));
  if (isNaN(oldDt.getTime()) || isNaN(newDt.getTime())) return;

  // 1. 檢算每個 NPC 的適應期是否到期
  for (const charName in mockMvuVariables.chars) {
    const char = mockMvuVariables.chars[charName];
    if (char && char.ownedBodyModifications) {
      for (const modId in char.ownedBodyModifications) {
        const state = char.ownedBodyModifications[modId];
        if (state && state.adaptation && state.adaptation.endVirtualTime) {
          const endDt = new Date(state.adaptation.endVirtualTime.replace(/-/g, '/'));
          if (!isNaN(endDt.getTime()) && newDt.getTime() >= endDt.getTime()) {
            delete state.adaptation;
            console.info(`[HypnoOS][BodyMod] 角色【${charName}】的身體已完全適應改造【${mockChatVariables.bodyModifications[modId]?.name || modId}】，排異反應消失。`);
          }
        }
      }
    }
  }

  // 2. 檢算週期性產出：若跨越了「天」(日期改變)
  const oldDateKey = `${oldDt.getFullYear()}-${oldDt.getMonth() + 1}-${oldDt.getDate()}`;
  const newDateKey = `${newDt.getFullYear()}-${newDt.getMonth() + 1}-${newDt.getDate()}`;
  if (oldDateKey !== newDateKey) {
    const diffDays = Math.max(1, Math.floor((newDt.getTime() - oldDt.getTime()) / (1000 * 60 * 60 * 24)));

    for (const charName in mockMvuVariables.chars) {
      const char = mockMvuVariables.chars[charName];
      if (char && char.ownedBodyModifications) {
        for (const modId in char.ownedBodyModifications) {
          const state = char.ownedBodyModifications[modId];
          if (state && state.isActive) {
            const def = mockChatVariables.bodyModifications[modId];
            if (def && def.eventTags && def.eventTags.includes('lactation')) {
              char.inventory = char.inventory || {};
              char.inventory['item_milk'] = char.inventory['item_milk'] || { quantity: 0 };
              char.inventory['item_milk'].quantity += diffDays * 1;
              console.info(`[HypnoOS][BodyMod] 角色【${charName}】泌乳產出：新增了 ${diffDays} 瓶催眠母乳。`);
            }
          }
        }
      }
    }
  }
}

// ==========================================
// 內部輔助函數：評估程式條件
// ==========================================
function evaluateProgramConditions(conditions: ConditionOnProgram[] | string): boolean {
  if (typeof conditions === 'string') return false; // 模擬後端無法解析純字串條件

  for (const cond of conditions) {
    const targetValues: number[] = [];

    if (cond.target.includes('money')) targetValues.push(mockMvuVariables.user.money);
    if (cond.target.includes('pts')) targetValues.push(mockMvuVariables.user.mcPoints);
    if (cond.target.includes('totalConsumedMc')) targetValues.push(mockMvuVariables.user.totalConsumedMc);
    if (cond.target.includes('mcEnergy')) targetValues.push(mockMvuVariables.user.mcEnergy);
    if (cond.target.includes('mcEnergyMax')) targetValues.push(mockMvuVariables.user.mcEnergyMax);
    if (cond.target.includes('suspicion')) targetValues.push(mockMvuVariables.user.suspicion);
    if (cond.target === 'vipTier') {
      const user = mockMvuVariables.user;
      const hasVipCard = user.inventory && user.inventory['item_vip_card_passive'] && user.inventory['item_vip_card_passive'].quantity > 0;
      const effectiveVipTier = hasVipCard ? Math.min(6, user.vipTier + 1) : user.vipTier;
      targetValues.push(effectiveVipTier);
    }

    const charTargets = [
      'totalSensitivity',
      'totalOrgasms',
      'mouthSensitivity', 'mouthTightness', 'mouthProficiency', 'mouthOrgasms',
      'breastLeftSensitivity', 'breastLeftProficiency', 'breastLeftOrgasms',
      'breastRightSensitivity', 'breastRightProficiency', 'breastRightOrgasms',
      'vaginaSensitivity', 'vaginaTightness', 'vaginaProficiency', 'vaginaOrgasms',
      'anusSensitivity', 'anusTightness', 'anusProficiency', 'anusOrgasms',
      'urethraSensitivity', 'urethraTightness', 'urethraProficiency', 'urethraOrgasms',
      'clitorisSensitivity', 'clitorisProficiency', 'clitorisOrgasms',
      'alertness',
      'affection',
      'obedience',
      'lust',
      'arousal',
    ];
    const isBodyPartTarget = cond.target.endsWith('Sensitivity') ||
                             cond.target.endsWith('Tightness') ||
                             cond.target.endsWith('Proficiency') ||
                             cond.target.endsWith('Orgasms') ||
                             charTargets.includes(cond.target);
    if (isBodyPartTarget) {
      for (const charName in mockMvuVariables.chars) {
        if (cond.charName && cond.charName !== charName) continue;

        const char = getEffectiveNpcDataSafe(charName);
        const bp = char.bodyParts || {};
        const getVal = (part: string, key: string) => {
          return bp[part]?.[key] ?? 0;
        };

        if (cond.target === 'totalSensitivity') {
          let sum = 0;
          for (const key in bp) {
            sum += bp[key]?.sensitivity ?? 0;
          }
          targetValues.push(sum);
        } else if (cond.target === 'totalOrgasms') {
          let sum = 0;
          for (const key in bp) {
            sum += bp[key]?.orgasms ?? 0;
          }
          targetValues.push(sum);
        } else if (cond.target.endsWith('Sensitivity')) {
          const part = cond.target.slice(0, -11);
          targetValues.push(getVal(part, 'sensitivity'));
        } else if (cond.target.endsWith('Tightness')) {
          const part = cond.target.slice(0, -9);
          targetValues.push(getVal(part, 'tightness'));
        } else if (cond.target.endsWith('Proficiency')) {
          const part = cond.target.slice(0, -11);
          targetValues.push(getVal(part, 'proficiency'));
        } else if (cond.target.endsWith('Orgasms')) {
          const part = cond.target.slice(0, -7);
          targetValues.push(getVal(part, 'orgasms'));
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

function getFullAchievementDictionary(): Record<string, AchievementOrQuestDef> {
  return {
    ...mockChatVariables.achievements,
    ...getDynamicAchievements(),
  };
}

export const MockApi = {
  // ==========================================
  // 設定 APP 相關 API
  // ==========================================

  async getApiSettings(): Promise<MockApiSettings> {
    await delay(150);
    return JSON.parse(JSON.stringify(mockChatVariables.apiSettings || {}));
  },

  async updateApiSettings(newSettings: Partial<MockApiSettings>): Promise<void> {
    await delay(300);
    if (!mockChatVariables.apiSettings) {
      mockChatVariables.apiSettings = {
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
    mockChatVariables.apiSettings = { ...mockChatVariables.apiSettings, ...newSettings };
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
    const user = JSON.parse(JSON.stringify(mockMvuVariables.user)) as MockUserData;
    const hasVipCard = user.inventory && user.inventory['item_vip_card_passive'] && user.inventory['item_vip_card_passive'].quantity > 0;
    user.effectiveVipTier = hasVipCard ? Math.min(6, user.vipTier + 1) : user.vipTier;
    return user;
  },

  async getSystemData(): Promise<MockSystemData> {
    await delay(100);
    return JSON.parse(JSON.stringify({
      time: mockMvuVariables.time,
      apiSettings: mockChatVariables.apiSettings,
    }));
  },

  async getCharData(): Promise<Record<string, MockcharData>> {
    await delay(100);
    return mockMvuVariables.chars as any;
  },

  async getBodyPartsDef(): Promise<Record<string, BodyPartsDef>> {
    await delay(100);
    return JSON.parse(JSON.stringify(mockChatVariables.bodyParts || {}));
  },

  async getAllHypnoModules(): Promise<Record<string, HypnoModuleDef>> {
    await delay(150);
    return { ...mockChatVariables.hypnoModules };
  },

  async getAllHypnosis(): Promise<Record<string, HypnosisDef>> {
    await delay(150);
    return { ...mockChatVariables.hypnosis };
  },

  async getAllCombos(): Promise<Record<string, ComboDef>> {
    await delay(150);
    return { ...mockChatVariables.combos };
  },

  // ==========================================
  // 物品 (Item) 背包相關 API
  // ==========================================
  async getAllItems(): Promise<Record<string, ItemDef>> {
    await delay(100);
    return { ...mockChatVariables.items };
  },

  async getUserInventory(): Promise<Record<string, InventoryItemState>> {
    await delay(100);
    refreshInventoryItemsActivation(mockMvuVariables);
    return JSON.parse(JSON.stringify(mockMvuVariables.user.inventory || {}));
  },

  async getCharInventory(charName: string): Promise<Record<string, InventoryItemState>> {
    await delay(100);
    refreshInventoryItemsActivation(mockMvuVariables);
    const char = mockMvuVariables.chars[charName];
    return char ? JSON.parse(JSON.stringify(char.inventory || {})) : {};
  },

  async updateUserInventoryItem(itemId: string, quantityPatch: number, customDesc?: string): Promise<void> {
    await delay(200);
    const inv = mockMvuVariables.user.inventory;
    if (!inv[itemId]) {
      inv[itemId] = { quantity: 0 };
    }
    inv[itemId].quantity = Math.max(0, inv[itemId].quantity + quantityPatch);
    if (customDesc !== undefined) {
      inv[itemId].customDescription = customDesc;
    }
    if (inv[itemId].quantity === 0 && !inv[itemId].isEquipped) {
      delete inv[itemId];
    }
    refreshInventoryItemsActivation(mockMvuVariables);
  },

  async updateCharInventoryItem(charName: string, itemId: string, quantityPatch: number, isEquipped?: boolean, equipSlot?: string, customDesc?: string): Promise<void> {
    await delay(200);
    const char = mockMvuVariables.chars[charName];
    if (!char) return;
    if (!char.inventory) char.inventory = {};
    const inv = char.inventory;
    if (!inv[itemId]) {
      inv[itemId] = { quantity: 0 };
    }
    inv[itemId].quantity = Math.max(0, inv[itemId].quantity + quantityPatch);
    if (isEquipped !== undefined) inv[itemId].isEquipped = isEquipped;
    if (equipSlot !== undefined) inv[itemId].equipSlot = equipSlot;
    if (customDesc !== undefined) inv[itemId].customDescription = customDesc;
    if (inv[itemId].quantity === 0 && !inv[itemId].isEquipped) {
      delete inv[itemId];
    }
    refreshInventoryItemsActivation(mockMvuVariables);
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
    const user = mockMvuVariables.user;

    if (patch.mcEnergy !== undefined && patch.mcEnergy < user.mcEnergy) {
      const consumed = user.mcEnergy - patch.mcEnergy;
      patch.totalConsumedMc = (patch.totalConsumedMc ?? user.totalConsumedMc) + consumed;
    }

    Object.assign(user, patch);
    refreshInventoryItemsActivation(mockMvuVariables);
  },

  async updateUserOwnedHypnosis(id: string, enabled: boolean, settings?: any): Promise<void> {
    await delay(200);
    mockMvuVariables.user.ownedHypnosis[id] = { enabled, settings: settings || mockMvuVariables.user.ownedHypnosis[id]?.settings };
  },

  async updateUserOwnedHypnoModules(id: string, enabled: boolean, settings?: any): Promise<void> {
    await delay(200);
    mockMvuVariables.user.ownedHypnoModules[id] = { enabled, settings: settings || mockMvuVariables.user.ownedHypnoModules[id]?.settings };
  },

  async updateUserOwnedCombos(id: string, enabled: boolean, settings?: any): Promise<void> {
    await delay(200);
    mockMvuVariables.user.ownedCombos[id] = { enabled, settings: settings || mockMvuVariables.user.ownedCombos[id]?.settings };
  },

  async sendHypnosis(launchData: any[]): Promise<void> {
    await delay(500);
    console.log('[MockApi] 模擬發送催眠指令:', launchData);
  },

  async saveNewHypnosis(id: string, def: HypnosisDef): Promise<void> {
    await delay(300);
    mockChatVariables.hypnosis[id] = def;
  },

  async saveNewCombo(comboId: string, comboDef: ComboDef): Promise<void> {
    await delay(200);
    mockChatVariables.combos[comboId] = comboDef;
    mockMvuVariables.user.ownedCombos[comboId] = { enabled: true };
  },

  async updateCombo(comboId: string, comboDef: ComboDef): Promise<void> {
    await delay(200);
    if (mockChatVariables.combos[comboId]) {
      mockChatVariables.combos[comboId] = comboDef;
    }
  },

  async deleteCombo(comboId: string): Promise<void> {
    await delay(200);
    delete mockChatVariables.combos[comboId];
    if (mockMvuVariables.user.ownedCombos[comboId]) {
      delete mockMvuVariables.user.ownedCombos[comboId];
    }
  },

  async deleteHypnosis(id: string): Promise<void> {
    await delay(200);
    if (mockChatVariables.hypnosis[id]) {
      delete mockChatVariables.hypnosis[id];
    }
    if (mockMvuVariables.user.ownedHypnosis[id]) {
      delete mockMvuVariables.user.ownedHypnosis[id];
    }
    for (const comboId in mockChatVariables.combos) {
      if (mockChatVariables.combos[comboId].includedHypnosis[id]) {
        delete mockChatVariables.combos[comboId].includedHypnosis[id];
        if (Object.keys(mockChatVariables.combos[comboId].includedHypnosis).length === 0) {
          delete mockChatVariables.combos[comboId];
          if (mockMvuVariables.user.ownedCombos[comboId]) {
            delete mockMvuVariables.user.ownedCombos[comboId];
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
    return Object.keys(getFullAchievementDictionary()).length;
  },

  async getAllAchievements(): Promise<Record<string, AchievementOrQuestDef>> {
    await delay(100);
    const fullDict = getFullAchievementDictionary();
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
        const state = mockMvuVariables.user.ownedAchievements[item.id];
        if (!state || !state.claimed) {
          activeItem = item;
          break;
        }
      }

      // Character removal filter
      if (activeItem.charName && !mockMvuVariables.chars[activeItem.charName]) {
        // Character not in current floor
        const state = mockMvuVariables.user.ownedAchievements[activeItem.id];
        if (!state) {
          // Not unlocked, so we should hide it.
          // Show the last claimed/unlocked one instead if it exists
          let lastValid: typeof activeItem | null = null;
          for (let i = items.indexOf(activeItem) - 1; i >= 0; i--) {
            const prevState = mockMvuVariables.user.ownedAchievements[items[i].id];
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
    return { ...mockChatVariables.quests };
  },

  async claimAchievement(id: string): Promise<boolean> {
    await delay(300);
    const achState = mockMvuVariables.user.ownedAchievements[id];
    if (achState && !achState.claimed) {
      achState.claimed = true;

      const def = getFullAchievementDictionary()[id];
      if (def && def.reward) {
        if (def.reward.pts) mockMvuVariables.user.mcPoints += def.reward.pts;
        if (def.reward.money) mockMvuVariables.user.money += def.reward.money;
        if (def.reward.mcEnergyMax) mockMvuVariables.user.mcEnergyMax += def.reward.mcEnergyMax;
        if (def.reward.mcEnergy) mockMvuVariables.user.mcEnergy += def.reward.mcEnergy;
        if (def.reward.suspicion) mockMvuVariables.user.suspicion += def.reward.suspicion;
      }
      return true;
    }
    return false;
  },

  async acceptQuest(id: string): Promise<boolean> {
    await delay(200);
    const questState = mockMvuVariables.user.ownedQuests[id];
    if (!questState) {
      mockMvuVariables.user.ownedQuests[id] = { status: 'accepted' }; // 模擬新增
      return true;
    }
    return false;
  },

  async cancelQuest(id: string): Promise<boolean> {
    await delay(200);
    const questState = mockMvuVariables.user.ownedQuests[id];
    if (questState && questState.status === 'accepted') {
      delete mockMvuVariables.user.ownedQuests[id];
      return true;
    }
    return false;
  },

  async completeQuest(id: string): Promise<boolean> {
    await delay(200);
    const questState = mockMvuVariables.user.ownedQuests[id];
    if (questState && questState.status === 'accepted') {
      questState.status = 'completed';
      return true;
    }
    return false;
  },

  async checkCondition(id: string, type: 'achievement' | 'quest'): Promise<boolean> {
    await delay(150);
    const def =
      type === 'achievement' ? getFullAchievementDictionary()[id] : mockChatVariables.quests[id];
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
    if (!mockMvuVariables.user.ownedAchievements[id]) {
      mockMvuVariables.user.ownedAchievements[id] = { claimed: false };
      return true;
    }
    return false;
  },

  async claimQuest(id: string): Promise<boolean> {
    await delay(300);
    const questState = mockMvuVariables.user.ownedQuests[id];
    if (questState && questState.status === 'completed') {
      questState.status = 'claimed';

      const def = mockChatVariables.quests[id];
      if (def && def.reward) {
        if (def.reward.pts) mockMvuVariables.user.mcPoints += def.reward.pts;
        if (def.reward.money) mockMvuVariables.user.money += def.reward.money;
        if (def.reward.mcEnergyMax) mockMvuVariables.user.mcEnergyMax += def.reward.mcEnergyMax;
        if (def.reward.mcEnergy) mockMvuVariables.user.mcEnergy += def.reward.mcEnergy;
        if (def.reward.suspicion) mockMvuVariables.user.suspicion += def.reward.suspicion;
      }
      return true;
    }
    return false;
  },

  async saveNewQuest(id: string, def: AchievementOrQuestDef): Promise<void> {
    await delay(300);
    mockChatVariables.quests[id] = def;
  },

  async deleteQuest(id: string): Promise<void> {
    await delay(200);
    if (mockChatVariables.quests[id]) {
      delete mockChatVariables.quests[id];
    }
    if (mockMvuVariables.user.ownedQuests[id]) {
      delete mockMvuVariables.user.ownedQuests[id];
    }
  },

  // ==========================================
  // 日曆 APP 相關 API
  // ==========================================

  async getCalendarEvents(): Promise<Record<string, CalendarEvent>> {
    await delay(150);
    return { ...mockChatVariables.calendarEvents };
  },

  async createCalendarEvent(id: string, event: CalendarEvent): Promise<void> {
    await delay(300);
    mockChatVariables.calendarEvents[id] = event;
  },

  async updateCalendarEvent(id: string, event: CalendarEvent): Promise<void> {
    await delay(200);
    if (mockChatVariables.calendarEvents[id]) {
      mockChatVariables.calendarEvents[id] = event;
    }
  },

  async deleteCalendarEvent(id: string): Promise<void> {
    await delay(200);
    if (mockChatVariables.calendarEvents[id]) {
      delete mockChatVariables.calendarEvents[id];
    }
  },

  // ==========================================
  // 地圖 APP 相關 API (Map App APIs)
  // ==========================================

  async getMapLocations(): Promise<Record<string, any>> {
    await delay(100);
    return JSON.parse(JSON.stringify(mockChatVariables.locations));
  },

  async getMapEdges(): Promise<any[]> {
    await delay(100);
    return JSON.parse(JSON.stringify(mockChatVariables.mapEdges));
  },

  async getMapZones(): Promise<Record<string, any>> {
    await delay(100);
    return JSON.parse(JSON.stringify(mockChatVariables.zones));
  },

  async getMapState(): Promise<MockMapState> {
    await delay(100);
    if (!mockMvuVariables.user.mapState) {
      throw new Error(
        '[HypnoOS][MapMock] 偵測到 mockMvuVariables.user.mapState 缺少模擬運行時資料！請檢查 mockDatabase.ts 中是否正確配置。',
      );
    }
    return JSON.parse(JSON.stringify(mockMvuVariables.user.mapState));
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
    if (!mockMvuVariables.user.mapState) {
      throw new Error(
        '[HypnoOS][MapMock] 偵測到 mockMvuVariables.user.mapState 缺少模擬運行時資料！請檢查 mockDatabase.ts 中是否正確配置。',
      );
    }
    const state = mockMvuVariables.user.mapState;
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
    for (const edge of mockChatVariables.mapEdges) {
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
      const edge = mockChatVariables.mapEdges.find(
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

    // ==========================================
    // 地圖移動時間與能量模擬扣除邏輯
    // ==========================================
    if (totalTime > 0) {
      const dt = new Date(mockMvuVariables.time.replace(/-/g, '/'));
      if (!isNaN(dt.getTime())) {
        const oldTime = mockMvuVariables.time;
        dt.setMinutes(dt.getMinutes() + totalTime);
        const y = dt.getFullYear();
        const mo = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        const h = String(dt.getHours()).padStart(2, '0');
        const mi = String(dt.getMinutes()).padStart(2, '0');
        const s = String(dt.getSeconds()).padStart(2, '0');
        const newTime = `${y}-${mo}-${d} ${h}:${mi}:${s}`;
        mockMvuVariables.time = newTime;
        processVirtualTimeAdvance(oldTime, newTime);
      }
    }
    if (totalEnergy > 0) {
      mockMvuVariables.user.mcEnergy = Math.max(0, mockMvuVariables.user.mcEnergy - totalEnergy);
    }
    refreshInventoryItemsActivation(mockMvuVariables);

    const pathNames = path.map(id => mockChatVariables.locations[id]?.name ?? id).join(' -> ');
    const entry = `[模擬移動定位] 從「${mockChatVariables.locations[startNodeId]?.name ?? startNodeId}」移動至「${mockChatVariables.locations[targetNodeId]?.name ?? targetNodeId}」，途經路線：${pathNames}。耗時：${totalTime}分鐘，消耗MC能量：${totalEnergy}點。`;
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
    void npcObedience;
    await delay(200);
    if (!mockMvuVariables.user.mapState) {
      throw new Error(
        '[HypnoOS][MapMock] 偵測到 mockMvuVariables.user.mapState 缺少模擬運行時資料！請檢查 mockDatabase.ts 中是否正確配置。',
      );
    }
    const state = mockMvuVariables.user.mapState;
    const unlockedNodeIds: string[] = [];
    const messages: string[] = [];

    const currentZoneId = mockChatVariables.locations[state.currentLocationId]?.zoneId;
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

      for (const edge of mockChatVariables.mapEdges) {
        if (edge.zoneId !== currentZoneId) continue;

        // 正向解鎖與發現
        const isEndHidden = !state.discoveredNodeIds.includes(edge.EndNodeId);
        const canScanForward = isEndHidden
          ? state.currentLocationId === edge.StartNodeId
          : reachable.has(edge.StartNodeId);

        if (canScanForward && edge.forwardPath) {
          const pathInfo = edge.forwardPath;
          const nodeName = mockChatVariables.locations[edge.EndNodeId]?.name ?? edge.EndNodeId;

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
          const nodeName = mockChatVariables.locations[edge.StartNodeId]?.name ?? edge.StartNodeId;

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
      const entry = `[模擬地圖雷達掃描] 成功解鎖了新地點：${unlockedNodeIds.map(id => mockChatVariables.locations[id]?.name ?? id).join(', ')}。`;
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
    const edge = mockChatVariables.mapEdges.find(e => e.id === edgeId);
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
    const node = mockChatVariables.locations[nodeId];
    if (node) {
      node.description = newNote;
      return true;
    }
    return false;
  },

  findShortestPath(startId: string, endId: string, discovered: string[], items: string[] = []): string[] {
    return findShortestPath(startId, endId, discovered, items);
  },

  async updateSystemTime(newTime: string): Promise<void> {
    await delay(100);
    const oldTime = mockMvuVariables.time;
    mockMvuVariables.time = newTime;
    processVirtualTimeAdvance(oldTime, newTime);
  },

  async teleportToLocation(targetNodeId: string): Promise<MockMapState> {
    await delay(100);
    if (!mockMvuVariables.user.mapState) {
      throw new Error('[MapMock] mapState is missing');
    }
    const state = mockMvuVariables.user.mapState;
    state.currentLocationId = targetNodeId;
    if (!state.discoveredNodeIds.includes(targetNodeId)) {
      state.discoveredNodeIds.push(targetNodeId);
    }
    return JSON.parse(JSON.stringify(state));
  },

  getStatGrade(val: number, min: number = -100, max: number = 100): string {
    return getStatGrade(val, min, max);
  },

  getGradeColor(grade: string): string {
    return getGradeColor(grade);
  },

  async refreshInventoryItemsActivation(): Promise<void> {
    refreshInventoryItemsActivation(mockMvuVariables);
  },

  // ==========================================
  // 身體改造 APP 相關 API (Body Modification App APIs)
  // ==========================================
  async getAllBodyModifications(): Promise<Record<string, any>> {
    await delay(100);
    return JSON.parse(JSON.stringify(mockChatVariables.bodyModifications));
  },

  async getNpc(npcName: string): Promise<MockcharData> {
    await delay(100);
    return getEffectiveNpcData(npcName);
  },

  async performBodyModification(npcName: string, modId: string): Promise<{ success: boolean; errorMsg?: string }> {
    await delay(200);
    const char = mockMvuVariables.chars[npcName];
    if (!char) return { success: false, errorMsg: '找不到指定角色' };

    const def = mockChatVariables.bodyModifications[modId];
    if (!def) return { success: false, errorMsg: '找不到此身體改造方案' };

    // 1. 檢查是否已安裝
    char.ownedBodyModifications = char.ownedBodyModifications || {};
    if (char.ownedBodyModifications[modId]) {
      return { success: false, errorMsg: '角色已進行過此項身體改造' };
    }

    // 2. 檢查互斥 (材質或形狀)
    if (def.category === 'material' || def.category === 'shape') {
      const activeMods = Object.keys(char.ownedBodyModifications)
        .map(id => mockChatVariables.bodyModifications[id])
        .filter(m => m !== undefined && char.ownedBodyModifications[m.id]?.isActive);

      if (def.scope === 'global') {
        const hasConflict = activeMods.some(m => m.scope === 'global' && m.category === def.category);
        if (hasConflict) {
          return { success: false, errorMsg: `角色已安裝全身【${def.category === 'material' ? '材質' : '形狀'}】類型的改造，無法共存。` };
        }
      } else {
        for (const slotId of def.slots) {
          const hasConflict = activeMods.some(m => m.slots.includes(slotId) && m.category === def.category);
          if (hasConflict) {
            return { success: false, errorMsg: `部位【${slotId}】已安裝同屬【${def.category === 'material' ? '材質' : '形狀'}】類型的改造，無法共存。` };
          }
        }
      }
    }

    // 3. 負荷上限檢查
    const defaultParts = ['mouth', 'breastLeft', 'breastRight', 'vagina', 'anus', 'urethra', 'clitoris'];
    const currentParts = Object.keys(char.bodyParts || {});
    const customPartsCount = currentParts.filter(p => !defaultParts.includes(p)).length;
    const maxLoad = 14 + customPartsCount * 2;

    let currentLoad = 0;
    for (const mId in char.ownedBodyModifications) {
      const state = char.ownedBodyModifications[mId];
      if (state && state.isActive) {
        const mDef = mockChatVariables.bodyModifications[mId];
        if (mDef) currentLoad += mDef.loadCost || 0;
      }
    }

    if (currentLoad + def.loadCost > maxLoad) {
      return { success: false, errorMsg: `肉體負荷超載！當前負荷：${currentLoad}/${maxLoad}，此改造需要負荷：${def.loadCost}。請先拆除部分改造。` };
    }

    // 4. 檢查前置條件
    const evalConditions = (conds: ConditionOnProgram[]) => {
      const variables = {
        money: mockMvuVariables.user.money,
        pts: mockMvuVariables.user.mcPoints,
        mcEnergy: mockMvuVariables.user.mcEnergy,
        obedience: char.obedience,
        lust: char.lust,
        affection: char.affection,
        currentLocationId: mockMvuVariables.user.mapState?.currentLocationId || '',
      };
      const getVal = (target: string) => {
        if ((variables as any)[target] !== undefined) return (variables as any)[target];
        if (target.includes('bodyParts.')) {
          const parts = target.split('.');
          const partId = parts[1];
          const attr = parts[2];
          return (char.bodyParts?.[partId] as any)?.[attr] ?? 0;
        }
        return 0;
      };

      for (const cond of conds) {
        const actual = getVal(cond.target);
        let met = false;
        switch (cond.operator) {
          case '==': met = actual === cond.value; break;
          case '!=': met = actual !== cond.value; break;
          case '>=': met = actual >= cond.value; break;
          case '<=': met = actual <= cond.value; break;
          case '>': met = actual > cond.value; break;
          case '<': met = actual < cond.value; break;
        }
        if (!met) return false;
      }
      return true;
    };

    if (def.conditions && def.conditions.length > 0) {
      if (!evalConditions(def.conditions)) {
        return { success: false, errorMsg: '未滿足改造的前置調教與屬性條件！' };
      }
    }

    // 5. 資源扣減
    if (def.cost) {
      if (def.cost.money && mockMvuVariables.user.money < def.cost.money) {
        return { success: false, errorMsg: '資金不足，無法支付手術費用。' };
      }
      if (def.cost.pts && mockMvuVariables.user.mcPoints < def.cost.pts) {
        return { success: false, errorMsg: 'MC點數 (PTS) 不足。' };
      }
      if (def.cost.mcEnergy && mockMvuVariables.user.mcEnergy < def.cost.mcEnergy) {
        return { success: false, errorMsg: 'MC能量不足。' };
      }
      if (def.cost.requiredItems) {
        for (const itemCost of def.cost.requiredItems) {
          const qty = mockMvuVariables.user.inventory[itemCost.itemId]?.quantity || 0;
          if (qty < itemCost.quantity) {
            return { success: false, errorMsg: `手術材料不足！缺少【${mockChatVariables.items[itemCost.itemId]?.name || itemCost.itemId}】` };
          }
        }
      }

      if (def.cost.money) mockMvuVariables.user.money -= def.cost.money;
      if (def.cost.pts) mockMvuVariables.user.mcPoints -= def.cost.pts;
      if (def.cost.mcEnergy) mockMvuVariables.user.mcEnergy -= def.cost.mcEnergy;
      if (def.cost.requiredItems) {
        for (const itemCost of def.cost.requiredItems) {
          mockMvuVariables.user.inventory[itemCost.itemId].quantity -= itemCost.quantity;
          if (mockMvuVariables.user.inventory[itemCost.itemId].quantity <= 0) {
            delete mockMvuVariables.user.inventory[itemCost.itemId];
          }
        }
      }
    }

    // 6. 設定適應期與啟用狀態
    const dt = new Date(mockMvuVariables.time.replace(/-/g, '/'));
    dt.setHours(dt.getHours() + 48);
    const formatTime = (d: Date) => {
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      return `${y}-${mo}-${date} ${h}:${mi}:${s}`;
    };

    const extraMods: AttrModifier[] = [
      { targetType: 'global_stat', statName: 'affection', operator: '-', value: 10 }
    ];

    char.ownedBodyModifications[modId] = {
      id: modId,
      installedVirtualTime: mockMvuVariables.time,
      isActive: true,
      selectedTraits: [],
      adaptation: {
        endVirtualTime: formatTime(dt),
        extraModifiers: extraMods,
      }
    };

    // 7. 動態實體化部位
    if (def.addedBodyPart) {
      char.bodyParts = char.bodyParts || {};
      const partId = def.addedBodyPart.id;
      if (!char.bodyParts[partId]) {
        char.bodyParts[partId] = {
          sensitivity: def.addedBodyPart.initialStats?.sensitivity ?? 0,
          tightness: def.addedBodyPart.initialStats?.tightness ?? 0,
          proficiency: def.addedBodyPart.initialStats?.proficiency ?? 0,
          orgasms: def.addedBodyPart.initialStats?.orgasms ?? 0,
        };
      }
    }

    return { success: true };
  },

  async toggleBodyModification(npcName: string, modId: string, enabled: boolean): Promise<{ success: boolean; errorMsg?: string }> {
    await delay(150);
    const char = mockMvuVariables.chars[npcName];
    if (!char || !char.ownedBodyModifications || !char.ownedBodyModifications[modId]) {
      return { success: false, errorMsg: '角色未安裝該改造，無法切換狀態' };
    }

    const def = mockChatVariables.bodyModifications[modId];
    if (!def) return { success: false, errorMsg: '找不到此身體改造方案' };

    if (enabled) {
      const defaultParts = ['mouth', 'breastLeft', 'breastRight', 'vagina', 'anus', 'urethra', 'clitoris'];
      const currentParts = Object.keys(char.bodyParts || {});
      const customPartsCount = currentParts.filter(p => !defaultParts.includes(p)).length;
      const maxLoad = 14 + customPartsCount * 2;

      let currentLoad = 0;
      for (const mId in char.ownedBodyModifications) {
        if (mId === modId) continue;
        const state = char.ownedBodyModifications[mId];
        if (state && state.isActive) {
          const mDef = mockChatVariables.bodyModifications[mId];
          if (mDef) currentLoad += mDef.loadCost || 0;
        }
      }

      if (currentLoad + def.loadCost > maxLoad) {
        return { success: false, errorMsg: `無法啟用！負荷超載：啟用後負荷將達 ${currentLoad + def.loadCost}/${maxLoad}。` };
      }
    }

    char.ownedBodyModifications[modId].isActive = enabled;
    return { success: true };
  },

  async removeBodyModification(npcName: string, modId: string): Promise<{ success: boolean; errorMsg?: string }> {
    await delay(200);
    const char = mockMvuVariables.chars[npcName];
    if (!char || !char.ownedBodyModifications || !char.ownedBodyModifications[modId]) {
      return { success: false, errorMsg: '角色未安裝該改造，無法移除' };
    }

    const def = mockChatVariables.bodyModifications[modId];
    if (!def) return { success: false, errorMsg: '找不到此身體改造方案' };

    delete char.ownedBodyModifications[modId];

    if (def.addedBodyPart) {
      const partId = def.addedBodyPart.id;
      let isPartNeeded = false;
      for (const mId in char.ownedBodyModifications) {
        const mDef = mockChatVariables.bodyModifications[mId];
        if (mDef && mDef.slots.includes(partId)) {
          isPartNeeded = true;
          break;
        }
      }

      if (!isPartNeeded && char.bodyParts && char.bodyParts[partId]) {
        delete char.bodyParts[partId];
      }
    }

    return { success: true };
  },
};

// ====== 輔助函式 ======

// ==========================================
// 通用比較運算子輔助
// ==========================================
function compareValue(actual: number, operator: string, expected: number): boolean {
  switch (operator) {
    case '>=': return actual >= expected;
    case '<=': return actual <= expected;
    case '==': return actual === expected;
    case '!=': return actual !== expected;
    case '>': return actual > expected;
    case '<': return actual < expected;
    default: return actual >= expected;
  }
}

// ==========================================
// 多物品條件解析器
// 格式: "itemId1:op:qty1,itemId2:op:qty2"
// ==========================================
function parseItemConditions(targetName: string): Array<{ itemId: string; operator: string; quantity: number }> {
  if (!targetName) return [];
  return targetName.split(',').map(part => {
    const segments = part.trim().split(':').map(s => s.trim());
    if (segments.length === 3) {
      // 新格式: itemId:operator:quantity
      return { itemId: segments[0], operator: segments[1], quantity: Number(segments[2]) };
    } else if (segments.length === 2) {
      // 簡寫格式: itemId:quantity (預設 >=)
      return { itemId: segments[0], operator: '>=', quantity: Number(segments[1]) };
    }
    // 單一 itemId (需持有 >= 1)
    return { itemId: segments[0], operator: '>=', quantity: 1 };
  });
}

// ==========================================
// 多 NPC 條件解析器
// 格式: "NPC1:attr:op:val,NPC2:attr:op:val"
// ==========================================
function parseNpcConditions(targetName: string): Array<{ npcName: string; attribute: string; operator: string; value: number }> {
  if (!targetName) return [];
  return targetName.split(',').map(part => {
    const segments = part.trim().split(':').map(s => s.trim());
    if (segments.length === 4) {
      // 新格式: NPC:attribute:operator:value
      return { npcName: segments[0], attribute: segments[1], operator: segments[2], value: Number(segments[3]) };
    } else if (segments.length === 2) {
      // 簡寫格式: NPC:value (預設 obedience >=)
      return { npcName: segments[0], attribute: 'obedience', operator: '>=', value: Number(segments[1]) };
    }
    return { npcName: segments[0], attribute: 'obedience', operator: '>=', value: 0 };
  });
}

// ==========================================
// 從 NPC chars 資料中取得指定屬性的數值
// ==========================================
function getNpcAttributeValue(npcName: string, attribute: string): number {
  const char = getEffectiveNpcDataSafe(npcName);
  if (!char) return 0;
  // 直接屬性 (obedience, affection, alertness, arousal, lust)
  if (char[attribute] !== undefined) return Number(char[attribute]) || 0;

  // 身體部位屬性支援，如 'mouthSensitivity', 'vaginaTightness', 'clitorisSensitivity' 等
  const bp = (char.bodyParts || {}) as any;
  const getVal = (part: string, key: string) => {
    return bp[part]?.[key] ?? 0;
  };

  if (attribute === 'totalSensitivity') {
    let sum = 0;
    for (const key in bp) {
      sum += bp[key]?.sensitivity ?? 0;
    }
    return sum;
  }
  if (attribute === 'totalOrgasms') {
    let sum = 0;
    for (const key in bp) {
      sum += bp[key]?.orgasms ?? 0;
    }
    return sum;
  }

  if (attribute.endsWith('Sensitivity')) {
    const part = attribute.slice(0, -11);
    return getVal(part, 'sensitivity');
  }
  if (attribute.endsWith('Tightness')) {
    const part = attribute.slice(0, -9);
    return getVal(part, 'tightness');
  }
  if (attribute.endsWith('Proficiency')) {
    const part = attribute.slice(0, -11);
    return getVal(part, 'proficiency');
  }
  if (attribute.endsWith('Orgasms')) {
    const part = attribute.slice(0, -7);
    return getVal(part, 'orgasms');
  }

  return 0;
}

// ==========================================
// 從背包取得物品持有數量 (僅限 ID 索引)
// ==========================================
function getItemQuantity(itemId: string, items?: string[]): number {
  void items;
  const inv = mockMvuVariables.user?.inventory || {};
  if (inv[itemId]) {
    return inv[itemId].quantity || 0;
  }
  return 0;
}

// ==========================================
// 解鎖條件檢測 (支援新舊格式)
// ==========================================
function checkUnlockCondition(
  cond: { type: 'npc_stats' | 'item' | 'always_locked'; targetName?: string; value?: number },
  items: string[],
  npcObedience: Record<string, number>,
): boolean {
  void npcObedience;
  if (cond.type === 'always_locked') return false;

  if (cond.type === 'item') {
    if (!cond.targetName) return false;
    const conditions = parseItemConditions(cond.targetName);
    return conditions.every(ic => {
      const qty = getItemQuantity(ic.itemId, items);
      return compareValue(qty, ic.operator, ic.quantity);
    });
  }

  if (cond.type === 'npc_stats') {
    if (!cond.targetName) return false;
    const conditions = parseNpcConditions(cond.targetName);
    return conditions.every(nc => {
      const actual = getNpcAttributeValue(nc.npcName, nc.attribute);
      return compareValue(actual, nc.operator, nc.value);
    });
  }

  return false;
}

// ==========================================
// 時段判定輔助
// ==========================================
function isTimeInPeriod(currentDateTimeStr: string, periodString: string): boolean {
  try {
    const rules = JSON.parse(periodString);
    if (!Array.isArray(rules)) return false;

    let currentMinutes = 12 * 60; // 預設 12:00
    let currentDayOfWeek = 5; // 預設週五
    let currentDayOfMonth = 1; // 預設 1 日
    let currentDateObj = new Date();

    // 1. 強健的日期解析器 (防禦空格與簡繁體格式)
    const dateMatch = currentDateTimeStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (dateMatch) {
      const year = Number(dateMatch[1]);
      const month = Number(dateMatch[2]) - 1;
      const date = Number(dateMatch[3]);
      const dateObj = new Date(year, month, date);
      if (!isNaN(dateObj.getTime())) {
        currentDateObj = dateObj;
        const rawDay = dateObj.getDay();
        currentDayOfWeek = rawDay === 0 ? 7 : rawDay;
        currentDayOfMonth = dateObj.getDate();
      }
    }

    // 2. 強健的時間解析器 (支援 12/24 小時制自動換算)
    const timeMatch = currentDateTimeStr.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (timeMatch) {
      let h = Number(timeMatch[1]);
      const m = Number(timeMatch[2]);

      const isPm = currentDateTimeStr.includes('下午') || currentDateTimeStr.toUpperCase().includes('PM');
      const isAm = currentDateTimeStr.includes('上午') || currentDateTimeStr.toUpperCase().includes('AM');

      if (isPm || isAm) {
        if (isPm) {
          if (h !== 12) h += 12;
        } else if (h === 12) {
          h = 0;
        }
      }
      currentMinutes = h * 60 + m;
    }

    const matchedResults: boolean[] = [];

    for (const rule of rules) {
      let matched = false;

      if (rule.type === 'daily') {
        matched = checkTimeRange(currentMinutes, rule.range);
      } else if (rule.type === 'weekly') {
        const parts = rule.range.split(/\s+/);
        const weekPart = parts[0];
        const timePart = parts[1];
        if (checkWeekMatch(currentDayOfWeek, weekPart)) {
          matched = checkTimeRange(currentMinutes, timePart);
        }
      } else if (rule.type === 'monthly') {
        const parts = rule.range.split(/\s+/);
        const monthPart = parts[0];
        const timePart = parts[1];
        if (checkMonthMatch(currentDayOfMonth, monthPart)) {
          matched = checkTimeRange(currentMinutes, timePart);
        }
      } else if (rule.type === 'date') {
        matched = checkDateRange(currentDateObj, rule.range);
      }

      if (matched) {
        matchedResults.push(rule.passable);
      }
    }

    if (matchedResults.length > 0) {
      // 當範圍有衝突時，以 true (可通行) 優先
      return matchedResults.includes(true);
    } else {
      // 智能預設狀態推導：當前時間未落在任何一項規則區間內
      // 若規則中包含任何「允許通行 (passable: true)」，說明是限時開放，其他時間預設禁止通行
      const hasAnyOpen = rules.some(r => r.passable === true);
      return !hasAnyOpen;
    }
  } catch (e) {
    return false;
  }
}

// ==========================================
// 時間規則細部比對輔助函數
// ==========================================
function checkTimeRange(currentMinutes: number, rangeStr: string): boolean {
  const [startStr, endStr] = rangeStr.split('-');
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
}

function checkWeekMatch(currentDayOfWeek: number, weekPart: string): boolean {
  if (weekPart.includes('-')) {
    const [startW, endW] = weekPart.split('-').map(Number);
    return currentDayOfWeek >= startW && currentDayOfWeek <= endW;
  } else if (weekPart.includes(',')) {
    const weeks = weekPart.split(',').map(Number);
    return weeks.includes(currentDayOfWeek);
  } else {
    return Number(weekPart) === currentDayOfWeek;
  }
}

function checkMonthMatch(currentDayOfMonth: number, monthPart: string): boolean {
  if (monthPart.includes('-')) {
    const [startM, endM] = monthPart.split('-').map(Number);
    return currentDayOfMonth >= startM && currentDayOfMonth <= endM;
  } else if (monthPart.includes(',')) {
    const days = monthPart.split(',').map(Number);
    return days.includes(currentDayOfMonth);
  } else {
    return Number(monthPart) === currentDayOfMonth;
  }
}

function checkDateRange(currentDateObj: Date, dateRangeStr: string): boolean {
  const parts = dateRangeStr.split(' - ');
  if (parts.length !== 2) return false;

  const startStr = parts[0].replace('T', ' ');
  const endStr = parts[1].replace('T', ' ');

  const currentMs = currentDateObj.getTime();
  const startMs = new Date(startStr.replace(/-/g, '/')).getTime();
  const endMs = new Date(endStr.replace(/-/g, '/')).getTime();

  if (isNaN(currentMs) || isNaN(startMs) || isNaN(endMs)) return false;
  return currentMs >= startMs && currentMs <= endMs;
}

// ==========================================
// 臨時條件檢測 (支援新舊格式)
// ==========================================
function checkTempCondition(pathInfo: any, toId: string, items: string[]): boolean {
  void toId;
  const cond = pathInfo.tempConditon;
  if (!cond) return true;

  if (cond.type === 'item') {
    if (!cond.targetName) return false;
    const conditions = parseItemConditions(cond.targetName);
    return conditions.every(ic => {
      const qty = getItemQuantity(ic.itemId, items);
      return compareValue(qty, ic.operator, ic.quantity);
    });
  }

  if (cond.type === 'npc_stats') {
    if (!cond.targetName) return false;
    const conditions = parseNpcConditions(cond.targetName);
    return conditions.every(nc => {
      const actual = getNpcAttributeValue(nc.npcName, nc.attribute);
      return compareValue(actual, nc.operator, nc.value);
    });
  }

  if (cond.type === 'time') {
    return cond.targetName ? isTimeInPeriod(mockMvuVariables.time, cond.targetName) : false;
  }
  return false;
}

function findReachableNodes(startId: string, discovered: string[], items: string[]): Set<string> {
  const reachable = new Set<string>([startId]);
  const queue = [startId];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const edge of mockChatVariables.mapEdges) {
      // 跳過被屏蔽的節點相關連線
      if ((mockChatVariables.locations[edge.StartNodeId] as any)?._hidden) continue;
      if ((mockChatVariables.locations[edge.EndNodeId] as any)?._hidden) continue;

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
        const edge = mockChatVariables.mapEdges.find(
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

    for (const edge of mockChatVariables.mapEdges) {
      // 跳過被屏蔽的節點相關連線
      if ((mockChatVariables.locations[edge.StartNodeId] as any)?._hidden) continue;
      if ((mockChatVariables.locations[edge.EndNodeId] as any)?._hidden) continue;

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

// ==========================================
// 身體屬性評級工具函數
// ==========================================
function getStatGrade(val: number, min: number = -100, max: number = 100): string {
  if (val > max) return 'S';
  if (val < min) return 'F';

  const range = max - min;
  if (range <= 0) return 'C';

  const w = range / 5;
  let level = Math.floor((val - min) / w);
  if (level > 4) level = 4;
  if (level < 0) level = 0;

  const grades = ['E', 'D', 'C', 'B', 'A'];
  const baseGrade = grades[level];

  const base = min + level * w;
  const sub_w = w / 3;
  let subLevel = Math.floor((val - base) / sub_w);
  if (subLevel > 2) subLevel = 2;
  if (subLevel < 0) subLevel = 0;

  const suffixes = ['-', '', '+'];
  return baseGrade + suffixes[subLevel];
}

function getGradeColor(grade: string): string {
  if (grade.startsWith('S')) return 'text-amber-400 font-bold';
  if (grade.startsWith('A')) return 'text-fuchsia-400 font-bold';
  if (grade.startsWith('B')) return 'text-purple-400 font-semibold';
  if (grade.startsWith('C')) return 'text-blue-400';
  if (grade.startsWith('D')) return 'text-slate-400';
  if (grade.startsWith('E')) return 'text-orange-400';
  return 'text-red-500 font-bold';
}

// ==========================================
// 物品激活狀態重新整理邏輯
// ==========================================
export function refreshInventoryItemsActivation(mvu: MvuVariables) {
  if (!mvu || !mvu.user || !mvu.user.inventory) return;

  const itemsDict = mockChatVariables.items || {};

  // 1. 刷新玩家背包
  const playerInv = mvu.user.inventory as Record<string, InventoryItemState>;
  Object.entries(playerInv).forEach(([itemId, state]) => {
    const def = itemsDict[itemId];
    if (!def) return;
    state.isActive = evaluateItemActivation(mvu, def, null);
  });

  // 2. 刷新所有 NPC 背包
  const chars = mvu.chars || {};
  Object.entries(chars).forEach(([charName, char]: [string, any]) => {
    const charInv = (char.inventory || {}) as Record<string, InventoryItemState>;
    Object.entries(charInv).forEach(([itemId, state]) => {
      const def = itemsDict[itemId];
      if (!def) return;
      state.isActive = evaluateItemActivation(mvu, def, charName);
    });
  });
}

function evaluateItemActivation(mvu: MvuVariables, def: ItemDef, ownerCharName: string | null): boolean {
  if (def.activationType === 'none') {
    return false;
  }
  if (def.activationType === 'permanent') {
    return true;
  }
  if (def.activationType === 'periodic') {
    if (!def.activationTimeRule) return false;
    return isTimeInPeriod(mvu.time, def.activationTimeRule);
  }
  if (def.activationType === 'conditional') {
    if (!def.activationCondition || def.activationCondition.length === 0) return false;

    // 如果在 NPC 背包中，且條件沒指定 charName，我們自動綁定 ownerCharName
    const finalConditions = def.activationCondition.map(cond => {
      if (ownerCharName && !cond.charName) {
        return { ...cond, charName: ownerCharName };
      }
      return cond;
    });

    return evaluateProgramConditions(finalConditions);
  }
  return false;
}

// ==========================================
// 初始化時自動刷新一次物品激活狀態
// ==========================================
refreshInventoryItemsActivation(mockMvuVariables);


