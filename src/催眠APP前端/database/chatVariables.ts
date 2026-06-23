import { ChatVariables } from '../models';

// ============================================================================
// 模擬在 iframe 載入後用戶進行操作所新增或修改的聊天變數 (Chat Variables)
// ============================================================================

export const chatDatabasePatch: Partial<ChatVariables> = {
  // 系統 API 設定
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

  // 模擬用戶自訂的催眠術
  hypnosis: {
    ch_20260501_164434: {
      name: '測試用自訂催眠1',
      description: '這是用來測試自訂催眠的',
      tier: 1,
      cost: { money: 0 },
      isCustom: true,
      isPermanent: false,
      isOneTime: false,
      duration: 'onetime',
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
      duration: 'onetime',
      energyCost: 132,
      defaultNote: '請填入描述',
    },
  },

  // 模擬用戶自訂的連攜組合
  combos: {
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
  },

  // 模擬用戶自訂的任務
  quests: {
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
  },

  // 模擬用戶自訂的日曆事件
  calendarEvents: {
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
  },
};
