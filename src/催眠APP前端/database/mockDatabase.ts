import {
  MockUserData,
  MockSystemData,
  MockcharData,
  HypnosisDef,
  ComboDef,
  AchievementOrQuestDef,
  CalendarEvent,
  MockMapState,
} from '../models';

export const mockSystemData: MockSystemData = {
  time: '2026-05-01 11:28:00',
  apiSettings: {
    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: 'sk-mock-api-key-12345',
    modelName: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 8192,
    topP: 0.95,
    presencePenalty: 0.2,
    frequencyPenalty: 0.3,
    streamMode: 'non_streaming',
  },
};

export const TestCharDataInput: Record<string, MockcharData> = {
  西园寺爱丽莎: {
    identity: '青梅竹馬',
    alertness: 0,
    affection: 0,
    obedience: 22,
    lust: 0,
    arousal: 0,
    sensitivity: {
      clitSensitivity: 100,
      vaginaSensitivity: 100,
      anusSensitivity: 100,
      urethraSensitivity: 100,
      nippleSensitivity: 100,
    },
    orgasm: {
      clitOrgasms: 0,
      vaginaOrgasms: 0,
      anusOrgasms: 0,
      urethraOrgasms: 0,
      nippleOrgasms: 0,
    },
    ownedHypnosisEffects: {
      潛意識引導: { endTime: '2026-05-08 12:00', hypnosisType: 'temporary', description: '舉起左手' },
      永久虚假记忆: { endTime: 'permanent', hypnosisType: 'permanent', description: '永遠記得這件事' },
    },
    ownedEquipment: {},
    ownedBodyModifications: {},
  },
  月咏深雪: {
    identity: '風紀委員',
    alertness: 0,
    affection: 0,
    obedience: 0,
    lust: 0,
    arousal: 0,
    sensitivity: {
      clitSensitivity: 100,
      vaginaSensitivity: 100,
      anusSensitivity: 150,
      urethraSensitivity: 100,
      nippleSensitivity: 100,
    },
    orgasm: {
      clitOrgasms: 0,
      vaginaOrgasms: 0,
      anusOrgasms: 0,
      urethraOrgasms: 0,
      nippleOrgasms: 0,
    },
    ownedHypnosisEffects: {
      短期味嗅覺混淆: { endTime: '2026-05-08 15:30', hypnosisType: 'temporary', description: '把水看成酒' },
    },
    ownedEquipment: {},
    ownedBodyModifications: {},
  },
  犬冢夏美: {
    identity: '體育生',
    alertness: 0,
    affection: 0,
    obedience: 0,
    lust: 0,
    arousal: 0,
    sensitivity: {
      clitSensitivity: 100,
      vaginaSensitivity: 100,
      anusSensitivity: 100,
      urethraSensitivity: 100,
      nippleSensitivity: 150,
    },
    orgasm: {
      clitOrgasms: 0,
      vaginaOrgasms: 0,
      anusOrgasms: 0,
      urethraOrgasms: 0,
      nippleOrgasms: 0,
    },
    ownedHypnosisEffects: {
      強制睡眠: { endTime: '2026-05-08 18:00', hypnosisType: 'temporary', description: '在教室睡覺' },
      身体固定: { endTime: '2026-05-08 14:00', hypnosisType: 'temporary', description: '無法移動雙腿' },
    },
    ownedEquipment: {},
    ownedBodyModifications: {},
  },
};

export const TestCustomHypnosisInput: Record<string, HypnosisDef> = {
  ch_20260501_164434: {
    name: '測試用自訂催眠1',
    description: '這是用來測試自訂催眠的',
    tier: 1,
    cost: { money: 0 },
    isCustom: true,
    isPermanent: false,
    isOneTime: false,
    energyCost: 0,
    defaultNote: '請填入描述',
  },
  ch_20260501_164440: {
    name: '測試用自訂催眠2',
    description: '這是用來測試自訂催眠的',
    tier: 3,
    cost: { mc: 10, pts: 12 },
    isCustom: true,
    isPermanent: false,
    isOneTime: false,
    energyCost: 132,
    defaultNote: '請填入描述',
  },
};

export const TestComboDataInput: Record<string, ComboDef> = {
  chc_20260501_164557: {
    name: '預設組合：日常聽話',
    description: '簡單的日常服從組合。',
    includedHypnosis: {
      trial_basic: {
        applyMethod: '直接輸入-圖像',
        target: '看到催眠化面的人',
        duration: 30,
        note: '舉起左手',
      },
      vip4_conscious_action: {
        applyMethod: '直接輸入-聲音',
        target: '聽到聲音的人',
        duration: 1,
        note: '大喊`忠誠!`',
      },
    },
  },
  chc_20260501_164604: {
    name: '在公開場合強制裸體',
    description: '強迫目標在公共場合裸體。',
    includedHypnosis: {
      vip4_unconscious_action: {
        applyMethod: '間接輸入-聲音',
        target: '聽到這份催眠音檔的人',
        duration: 30,
        note: '走到操場中央並脫光衣服',
      },
      vip3_forced_orgasm: {
        applyMethod: '間接輸入-聲音',
        target: '聽到這份催眠音檔的人',
        duration: 'onetime',
        note: '走到操場並脫光衣服然後高潮',
      },
      vip1_estrus: {
        applyMethod: '間接輸入-聲音',
        target: '聽到這份催眠音檔的人',
        duration: 30,
        note: '',
      },
      vip4_no_refractory: {
        applyMethod: '間接輸入-聲音',
        target: '聽到這份催眠音檔的人',
        duration: 30,
        note: '',
      },
    },
  },
  chc_20260502_092418: {
    name: '自訂組合1',
    description: '自訂組合1',
    includedHypnosis: {
      vip3_forced_orgasm: {
        applyMethod: '直接輸入-聲音',
        target: '正在看 this 組合的人',
        duration: 'onetime',
        note: '高潮',
      },
      vip1_estrus: {
        applyMethod: '直接輸入-圖像',
        target: '正在看 this 組合的人',
        duration: 30,
        note: '發情',
      },
      vip4_no_refractory: {
        applyMethod: '直接輸入-聲音',
        target: '正在聽 this 組合的人',
        duration: 24,
        note: '',
      },
    },
  },
  chc_20260502_092426: {
    name: '自訂組合2',
    description: '自訂組合2',
    includedHypnosis: {
      vip5_forced_action: {
        applyMethod: '直接輸入-聲音',
        target: '正在聽 this 組合的人',
        duration: 'onetime',
        note: '',
      },
      vip5_perm_fake_memory: {
        applyMethod: '直接輸入-圖像',
        target: '正在看 this 組合的人',
        duration: 'permanent',
        note: '永遠記得這件事',
      },
    },
  },
};

export const TestQuestDataInput: Record<string, AchievementOrQuestDef> = {
  quest_for_test_1: {
    name: '测试任务1',
    dataType: 'quest',
    description: '测试任务1。',
    isCustom: true,
    completionCondition: {
      type: 'program',
      condition: [{ target: 'vipTier', operator: '>=', value: 4 }],
    },
    reward: { money: 1000 },
  },
  quest_for_test_2: {
    name: '测试任务2',
    dataType: 'quest',
    description: '测试任务2。',
    isCustom: true,
    completionCondition: {
      type: 'program',
      condition: [{ target: 'nippleSensitivity', operator: '>=', value: 105, charName: '西园寺爱丽莎' }],
    },
    reward: { mcEnergyMax: 50 },
  },
  quest_for_test_3: {
    name: '测试任务3',
    dataType: 'quest',
    description: '测试任务3。',
    isCustom: true,
    completionCondition: {
      type: 'program',
      condition: [{ target: 'nippleSensitivity', operator: '>=', value: 120 }],
    },
    reward: { mcEnergyMax: 50 },
  },
};

export const TestCustomCalendarEvents: Record<string, CalendarEvent> = {
  evt_custom_1: {
    title: '約會',
    startDate: '2026-05-15',
    endDate: '2026-05-15',
    type: 'custom',
    color: 'blue',
    description: '與愛麗莎的約會',
  },
  evt_custom_2: {
    title: '催眠實驗',
    startDate: '2026-05-20',
    endDate: '2026-05-22',
    type: 'custom',
    color: 'purple',
    description: '測試新的催眠組合',
  },
};

export const defaultMockUserData: MockUserData = {
  userName: '測試用玩家名',
  money: 500000,
  mcEnergy: 1900,
  mcEnergyMax: 2000,
  mcPoints: 100,
  totalConsumedMc: 500,
  vipTier: 3,
  vipEndVirtualMinutes: 10056,
  vipAutoRenew: true,
  suspicion: 10,

  ownedHypnosis: {
    trial_basic: { enabled: true },
    vip1_senses: { enabled: true },
    vip2_medium: { enabled: false },
    vip5_perm_fake_memory: { enabled: true },
    vip5_forced_action: { enabled: true },
    ch_20260501_164434: { enabled: true },
    ch_20260501_164440: { enabled: false },
  },
  ownedEquipments: {
    eq_screen: { enabled: true },
    eq_vip1_stats: { enabled: true },
    eq_text_compiler: { enabled: true },
    eq_gas_modulator: { enabled: true },
    eq_gas_maker: { enabled: false },
  },
  ownedCombos: {
    chc_20260501_164557: { enabled: true },
    chc_20260501_164604: { enabled: false },
    chc_20260502_092418: { enabled: true },
    chc_20260502_092426: { enabled: true },
  },
  ownedAchievements: {
    ach_newbie: { claimed: false }, // 測試已解鎖未領取
    ach_vip2: { claimed: true }, // 測試已領取
    ach_suspicion_25: { claimed: true },
    ach_suspicion_50: { claimed: false },
    ach_energyMax_100: { claimed: true },
    ach_orgasm_1_西园寺爱丽莎: { claimed: true },
    ach_orgasm_5_西园寺爱丽莎: { claimed: false },
    ach_obedience_25_犬冢夏美: { claimed: true },
    ach_obedience_50_犬冢夏美: { claimed: false },
  },
  ownedQuests: {
    quest_naked_public_no_hypno: { status: 'completed' }, // 測試已完成
    quest_placebo_hypno: { status: 'accepted' }, // 測試已接取
    quest_naked_school: { status: 'claimed' }, // 測試已領取
  },
  mapState: {
    currentLocationId: 'home_my_room',
    discoveredNodeIds: [
      'home_my_room',
      'home_living_room',
      'home_kitchen',
      'home_sister_room',
      'home_bathroom',
      'home_basement_corridor',
      'school_gate',
      'school_courtyard',
      'school_lobby',
      'school_playground',
      'school_classroom_2b',
      'school_corridor_2f',
      'school_student_council',
      'school_science_lab',
      'school_gym',
      'school_shower',
      'school_rooftop',
      'school_tennis_court',
      'school_kyudo_field',
    ],
  },
};

// 內部狀態 (模擬資料庫)，使用 let 宣告以允許重新賦值 (更新)
export let mockDatabase: MockUserData = JSON.parse(JSON.stringify(defaultMockUserData));

// 為了讓 API 能更新 Database 的指標，提供一個 Setter
export function setMockDatabase(newData: MockUserData) {
  mockDatabase = newData;
}
