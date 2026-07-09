import { MvuVariables } from '../models';

// ============================================================================
// 模擬在 iframe 載入後用戶進行操作所新增或修改的 MVU 變數 (Mvu Variables)
// ============================================================================

export const mvuDatabasePatch: Partial<MvuVariables> = {
  // 系統當前虛擬時間
  time: '2026-05-01 11:28:00',

  // 玩家當前資源狀態與啟用設定
  user: {
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

    // 裝備與催眠啟用狀態 (僅關聯 ID)
    ownedHypnosis: {
      trial_basic: { enabled: true },
      vip1_senses: { enabled: true },
      vip2_medium: { enabled: false },
      vip5_perm_fake_memory: { enabled: true },
      vip5_forced_action: { enabled: true },
      ch_20260501_164434: { enabled: true },
      ch_20260501_164440: { enabled: false },
    },
    ownedHypnoModules: {
      eq_screen: { enabled: true },
      eq_vip1_stats: { enabled: true },
      eq_text_compiler: { enabled: true },
      eq_gas_modulator: { enabled: true },
      eq_gas_maker: { enabled: false },
    },
    ownedCombos: {
      chc_20260501_164557: { enabled: true },
      chc_20260504: { enabled: false },
      chc_20260502_092418: { enabled: true },
      chc_20260502_092426: { enabled: true },
    },

    // 玩家背包初始資料 (Rich Object)
    inventory: {
      item_mc_potion_s: { quantity: 3 },
      item_suspicion_remover: { quantity: 1 },
      item_fridge_food: { quantity: 2 },
      item_time_battery: { quantity: 1 },
      item_sus_amulet: { quantity: 1 },
    },

    // 地圖當前狀態
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

    // 任務與成就進度狀態
    ownedAchievements: {
      ach_newbie: { claimed: false },
      ach_vip2: { claimed: true },
      ach_suspicion_25: { claimed: true },
      ach_suspicion_50: { claimed: false },
      ach_energyMax_100: { claimed: true },
      ach_orgasm_1_西园寺爱丽莎: { claimed: true },
      ach_orgasm_5_西园寺爱丽莎: { claimed: false },
      ach_obedience_25_犬冢夏美: { claimed: true },
      ach_obedience_50_犬冢夏美: { claimed: false },
    },
    ownedQuests: {
      quest_naked_public_no_hypno: { status: 'completed' },
      quest_placebo_hypno: { status: 'accepted' },
      quest_naked_school: { status: 'claimed' },
    },
  },

  // 各角色的當前屬性與狀態 (不含 identity 欄位)
  chars: {
    西园寺爱丽莎: {
      identity: '青梅竹馬',
      alertness: 0,
      affection: 0,
      obedience: 22,
      lust: 0,
      arousal: 0,
      bodyParts: {
        mouth: { sensitivity: 0, tightness: 0, proficiency: 0, orgasms: 0 },
        breastLeft: { sensitivity: 0, proficiency: 0, orgasms: 0 },
        breastRight: { sensitivity: 0, proficiency: 0, orgasms: 0 },
        vagina: { sensitivity: 0, tightness: 0, proficiency: 0, orgasms: 0 },
        anus: { sensitivity: 0, tightness: 0, proficiency: 0, orgasms: 0 },
        urethra: { sensitivity: 0, tightness: 0, proficiency: 0, orgasms: 0 },
        clitoris: { sensitivity: 0, proficiency: 0, orgasms: 0 },
      },
      ownedHypnosisEffects: {
        潛意識引導: { endTime: '2026-05-08 12:00', hypnosisType: 'temporary', description: '舉起左手' },
        永久虚假记忆: { endTime: 'permanent', hypnosisType: 'permanent', description: '永遠記得這件事' },
      },
      inventory: {
        item_eye_mask: {
          quantity: 1,
          isEquipped: false,
          equipSlot: 'eyes',
          customDescription: '西園寺愛麗莎的專屬粉色眼罩',
        },
        item_obedience_collar: { quantity: 1, isEquipped: true, equipSlot: 'neck' },
        item_crystal_heart: { quantity: 1 },
      },
      ownedBodyModifications: {},
      locationState: {
        locationId: 'home_sister_room',
        locationStatus: '正坐在書桌前用電腦',
      },
    },
    月咏深雪: {
      identity: '風紀委員',
      alertness: 0,
      affection: 0,
      obedience: 0,
      lust: 65,
      arousal: 0,
      bodyParts: {
        mouth: { sensitivity: 0, tightness: 0, proficiency: 0, orgasms: 0 },
        breastLeft: { sensitivity: 0, proficiency: 0, orgasms: 0 },
        breastRight: { sensitivity: 0, proficiency: 0, orgasms: 0 },
        vagina: { sensitivity: 0, tightness: 0, proficiency: 0, orgasms: 0 },
        anus: { sensitivity: 50, tightness: 0, proficiency: 0, orgasms: 0 },
        urethra: { sensitivity: 0, tightness: 0, proficiency: 0, orgasms: 0 },
        clitoris: { sensitivity: 0, proficiency: 0, orgasms: 0 },
      },
      ownedHypnosisEffects: {
        短期味嗅覺混淆: { endTime: '2026-05-08 15:30', hypnosisType: 'temporary', description: '把水看成酒' },
      },
      inventory: {},
      ownedBodyModifications: {},
      locationState: {
        locationId: 'school_classroom_2b',
        locationStatus: '值日生，正在整理講台',
      },
    },
    犬冢夏美: {
      identity: '體育生',
      alertness: 0,
      affection: 0,
      obedience: 0,
      lust: 0,
      arousal: 0,
      bodyParts: {
        mouth: { sensitivity: 0, tightness: 0, proficiency: 0, orgasms: 0 },
        breastLeft: { sensitivity: 50, proficiency: 0, orgasms: 0 },
        breastRight: { sensitivity: 50, proficiency: 0, orgasms: 0 },
        vagina: { sensitivity: 0, tightness: 0, proficiency: 0, orgasms: 0 },
        anus: { sensitivity: 0, tightness: 0, proficiency: 0, orgasms: 0 },
        urethra: { sensitivity: 0, tightness: 0, proficiency: 0, orgasms: 0 },
        clitoris: { sensitivity: 0, proficiency: 0, orgasms: 0 },
      },
      ownedHypnosisEffects: {
        強制睡眠: { endTime: '2026-05-08 18:00', hypnosisType: 'temporary', description: '在教室睡眠' },
        身体固定: { endTime: '2026-05-08 14:00', hypnosisType: 'temporary', description: '無法移動雙腿' },
      },
      inventory: {
        item_gag: { quantity: 1, isEquipped: true, equipSlot: 'mouth', customDescription: '略微有些磨損的軟膠球口塞' },
      },
      ownedBodyModifications: {},
      locationState: {
        locationId: 'school_gym',
        locationStatus: '社團自主練習中，滿身汗水',
      },
    },
  },
};
