/**
 * 催眠 APP 模擬資料檔 (Mock Data File)
 * 用於 UI 重構期間的測試與開發。
 * 包含靜態字典（催眠、裝置、組合）與玩家動態狀態。
 */

// ==========================================
// 1. 靜態字典結構設計 (Static Dictionaries)
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
  duration?: number | 'onetime' | 'permanent'; // 單次持續時間 (分鐘)，當 isOneTime=true 且 isPermanent=false 時可選，不填寫預設為 'onetime' 表示持續到被打破或觸發事件，通常這項不用設定。
  energyCost: number; // 消耗的 MC 能量 (根據 isOneTime 決定是一次性還是每分鐘)
  defaultNote?: string; // 在備註欄為空時，將會作為備註欄欄位顯示，用於提示使用者要填入什麼內容?
}

export interface EquipmentDef {
  // id: string;
  name: string;
  description: string;
  icon: string;
  tier: number; // 需求的 VIP 等級 (0~5)
  cost: CostDict;
  type: 'technology' | 'device';
  usageCostType: Array<'none' | 'mc' | 'money' | 'suspicion'>;
  usageCostRate: number; // 開啟時的消耗率 (若 usageCostType 包含 'none' 則為 0)
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
// 2. 預設的催眠和裝置區域 (Static Hypnosis and Device)
// ==========================================

export const HYPNOSIS_DICTIONARY: Record<string, HypnosisDef> = {
  trial_basic: {
    name: '潛意識引導',
    description:
      '讓被催眠者無意識下遵循一個簡單指示，指示範圍至多為執行一個舉動。無法讓被催眠者做出主觀上不願意的行為，只能用來引導願意及無意見的行為。拒絕執行與反抗都視為拒絕執行。當被催眠者拒絕執行或明確且清楚的查覺到自己無意識中做出的舉動不是自發時，就會打斷此催眠。',
    tier: 0,
    cost: { money: 500 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 5,
  },
  vip1_senses: {
    name: '短期味嗅覺混淆',
    description:
      '在生效期間內，將被催眠者對特定味道的認知從原本的替換成另一種。如果被催眠者沒有對特定味道有認知，就無法進行替換。',
    tier: 1,
    cost: { pts: 10, money: 1000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 4,
  },
  vip1_truth_serum: {
    name: '短期說謊禁止',
    description:
      '在生效期間內，被催眠者主動說話與回答問題時，沒辦法主動說謊，但可以保持沉默或避重就輕或省略資訊。若說出的話與主觀事實不符(說謊)，會主動說出修正。',
    tier: 1,
    cost: { pts: 10, money: 1000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 4,
  },
  vip1_estrus: {
    name: '短期強制發情',
    description:
      '在生效期間內，被催眠者會持續處於性興奮狀態。催眠時間結束後，被催眠者不會立刻結束性興奮狀態，而是在一段時間後才會恢復原本被催眠前的性興奮狀態。',
    tier: 1,
    cost: { pts: 10, money: 1500 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 1,
  },
  vip1_memory_erase: {
    name: '近期記憶模糊',
    description:
      '效果在結束後體現。被催眠者在催眠結束後，關於催眠生效期間的記憶會變得模糊，但是並非完全忘記，會留下模糊的印象。若被催眠者被提示關鍵字，則會想起一些相關的記憶。',
    tier: 1,
    cost: { pts: 10, money: 2000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 5,
  },
  vip1_sensitivity: {
    name: '短期敏感度修改',
    description:
      '在生效期間內，被催眠者的敏感度會被設定為一個值，對特定刺激的反應會更加強烈或減弱。分為施加期、正式生效期、退出期，施加期與退出期會透過逐漸提高或降低敏感度來進行。',
    tier: 1,
    cost: { pts: 10, money: 1500 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 5,
  },
  vip2_medium: {
    name: '潛意識控制',
    description:
      '讓被催眠者無意識下遵循一個到連續且不超過10個簡單舉動的動作序列。無法讓被催眠者做出主觀上極度不願意的行為，但可以被用來引導一般不願意及輕度不願意的行為。當被催眠者拒絕執行時會打斷此催眠，而明確且清楚的查覺到自己無意識中做出的舉動不是自發時，此催眠效果會大幅降低。',
    tier: 2,
    cost: { pts: 50 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 10,
  },
  vip2_ghost_hand: {
    name: '幽靈手',
    description: '讓被催眠者的指定部位在指定時間內，產生一種自己一直在被看不見的手玩弄的錯覺 (可以疊加)。',
    tier: 2,
    cost: { pts: 50, money: 3000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 10,
  },
  vip2_body_lock: {
    name: '身体固定',
    description: '讓被催眠者的指定部位在指定時間內，無法自己主動移動。但可以被外力移動。',
    tier: 2,
    cost: { pts: 50, money: 3500 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 12,
  },
  vip2_sense_replace: {
    name: '短期感覺替換',
    description:
      '讓被催眠者的某種特定感覺在指定時間內，轉化為另一種感覺。可由使用者定義，如觸覺、聽覺、視覺或疼痛、快感等。',
    tier: 2,
    cost: { pts: 50, money: 4000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 10,
  },
  vip2_pleasure_grant: {
    name: '快感賦予',
    description: '讓被催眠者的指定部位在指定時間內持續處於無來源的快感狀態 (可以疊加)。',
    tier: 2,
    cost: { pts: 50, money: 4500 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 12,
  },
  vip2_shame_invert: {
    name: '羞恥心反轉',
    description:
      '讓被催眠者的羞恥心反轉，對通常會感到羞恥的事情感到興奮或無所謂，對通常不會感到羞恥的事情感到羞恥或不快。',
    tier: 2,
    cost: { pts: 50, money: 5000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 15,
  },
  vip2_emperors_new_clothes: {
    name: '皇帝的新衣',
    description:
      '一次性催眠。讓被催眠者無意識下認為自己穿著特定衣服(或裸體)且完全不會懷疑。在沒有他人直接提醒的情況下，無法意識到真實穿著，即使照鏡子也會看到催眠認知的衣物。效果持續到被明確意識到真實穿著為止。',
    tier: 2,
    cost: { pts: 50, money: 6000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: true,
    energyCost: 20,
  },
  vip2_single_trigger: {
    name: '單次條件反射植入',
    description: '一次性催眠，效果會持續到被催眠者觸發條件後做出對應反應為止，且只能觸發一次，之後就會解除此催眠。',
    tier: 2,
    cost: { pts: 50, money: 7000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: true,
    energyCost: 25,
  },
  vip3_forced_orgasm: {
    name: '強制高潮',
    description: '一次性催眠。讓被催眠者直接在催眠下達後立即高潮一次。',
    tier: 3,
    cost: { pts: 150, money: 8000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: true,
    energyCost: 100,
  },
  vip3_orgasm_ban: {
    name: '絕頂禁止',
    description: '讓被催眠者在催眠生效期間內，無法透過自慰或與他人性交達到高潮，快感至多累積到相當於高潮前一刻的程度。',
    tier: 3,
    cost: { pts: 150, money: 10000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 300,
  },
  vip3_visual_filter: {
    name: '幻視濾鏡',
    description: '讓被催眠者的視覺在指定時間內，將指定事物看成另一種指定事物。',
    tier: 3,
    cost: { pts: 150, money: 12000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 25,
  },
  vip3_language_block: {
    name: '語言障礙',
    description: '讓被催眠者在指定時間內，無法認知或理解指定的詞彙或語言。',
    tier: 3,
    cost: { pts: 150, money: 13000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 20,
  },
  vip3_common_sense: {
    name: '限時常識修改',
    description: '讓被催眠者在指定時間內，將指定的常識修改為另一種指定的常識。',
    tier: 3,
    cost: { pts: 150, money: 14000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 25,
  },
  vip3_multi_trigger: {
    name: '限時條件反射植入',
    description: '讓被催眠者在指定時間內，會在無意識中對特定詞彙或特定動作產生特定的反應(可以疊加)。',
    tier: 3,
    cost: { pts: 150, money: 15000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 30,
  },
  vip3_fake_memory: {
    name: '臨時虛假記憶',
    description: '讓被催眠者的記憶在指定時間內，被植入或修改催眠者指定的記憶片段(可以疊加)。',
    tier: 3,
    cost: { pts: 150, money: 16000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 35,
  },
  vip3_forced_sleep: {
    name: '強制睡眠',
    description: '讓被催眠者在指定時間內持續處於睡眠狀態，即使有外界干擾，也無法被弄醒，直到催眠時間結束。',
    tier: 3,
    cost: { pts: 150, money: 18000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 30,
  },
  vip3_body_illusion: {
    name: '身體改造錯覺',
    description: '讓被催眠者在指定時間內，對自己的身體產生錯覺。例如覺得自己多了/少了肢體，或身體特徵改變。',
    tier: 3,
    cost: { pts: 150, money: 20000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 35,
  },
  vip3_time_distortion: {
    name: '時間感知扭曲',
    description: '讓被催眠者在指定時間內(主觀上經歷的時間)，對外界的時間流逝的快慢產生錯覺。',
    tier: 3,
    cost: { pts: 150, money: 22000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 40,
  },
  vip3_sense_sync: {
    name: '感覺同步',
    description: '讓被催眠者在指定時間內，產生了自己與指定物體或人的某種感覺同步的幻覺，需認知到對象被刺激才會產生同步感覺。',
    tier: 3,
    cost: { pts: 150, money: 25000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 45,
  },
  vip3_sense_deprivation: {
    name: '五感遮蔽',
    description: '讓被催眠者的五感在指定時間內，被剝奪特定的感官。例如眼盲、或只能聽到特定人的聲音。',
    tier: 3,
    cost: { pts: 150, money: 28000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 50,
  },
  vip3_inner_voice_leak: {
    name: '內心話外漏',
    description: '讓被催眠者在指定時間內，無法在心裡藏住想法，嘴巴就會不受控制地立刻大聲說出來。',
    tier: 3,
    cost: { pts: 150, money: 30000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 55,
  },
  vip4_advanced: {
    name: '潛意識支配',
    description: '讓被催眠者無意識下遵循一個或多個簡單指示，指示範圍可達連續且不超過10個簡單舉動的動作序列。無法做出違反生存本能的行為，但可強行引導主觀上極度不願意及有生命危險的行為（不會直接致死但會陷入危險）。當明確查覺非自發或因生存本能暫停時，效果降低但無法掙脫，只會暫停直到時間結束。',
    tier: 4,
    cost: { pts: 300 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 40,
  },
  vip4_cognitive_block: {
    name: '認知阻礙',
    description: '讓被催眠者在催眠生效期間主觀上認知到或理解不到指定的事物，並且與指定事物相關的一切都會被忽略掉，但物理反應仍然會發生。',
    tier: 4,
    cost: { pts: 300, money: 25000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 60,
  },
  vip4_fetish_implant: {
    name: '臨時性癖植入',
    description: '讓被催眠者在催眠生效期間，被植入指定的性癖，且會對指定性癖產生強烈的性興奮與快感，催眠時間結束後，植入的性癖會逐漸消失，但會在腦中留下印象。',
    tier: 4,
    cost: { pts: 300, money: 30000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 80,
  },
  vip4_conscious_action: {
    name: '保留意識控制身體行動',
    description: '讓被催眠者在催眠生效期間，仍然保留主觀意識的完全控制能力，但是會無意識地強制執行指定的一或多項簡單指令(可疊加)。人是清醒的，但身體不是自己控制的。',
    tier: 4,
    cost: { pts: 300, money: 35000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 90,
  },
  vip4_unconscious_action: {
    name: '不保留意識控制身體行動',
    description: '讓被催眠者在催眠生效期間，無意識地強制執行指定的一或多項簡單指令(可疊加)，並且無法保留主觀意識的控制能力。催眠結束後意識才恢復，並銜接催眠前的意識。',
    tier: 4,
    cost: { pts: 300, money: 35000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 90,
  },
  vip4_conditional_orgasm: {
    name: '條件限制高潮',
    description: '讓被催眠者在催眠生效期間，需要滿足指定條件才能達到性高潮，且無法透過其他方式達到性高潮。',
    tier: 4,
    cost: { pts: 300, money: 40000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 100,
  },
  vip4_no_refractory: {
    name: '絕頂不應期消除',
    description: '讓被催眠者在催眠生效期間，不再有性高潮後的不應期，可以不斷地達到性高潮。',
    tier: 4,
    cost: { pts: 300, money: 45000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 110,
  },
  vip4_excretion_control: {
    name: '排泄控制',
    description: '讓被催眠者在催眠生效期間，在催眠者指定的條件下才能主動排泄，或是在特定的條件下才能主動停止排泄。當抵達生理極限卻仍然沒有滿足指定條件，就會直接失禁。',
    tier: 4,
    cost: { pts: 300, money: 50000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 120,
  },
  vip4_action_seal: {
    name: '行為封印',
    description: '讓被催眠者在催眠生效期間，無法主動做出指定動作或姿勢或行為，但可以被外力移動。',
    tier: 4,
    cost: { pts: 300, money: 55000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 130,
  },
  vip4_age_regression: {
    name: '幼兒退行',
    description: '讓被催眠者在催眠生效期間，心智年齡逐漸退化至指定歲數，且生理年齡維持不變。催眠時間結束後，心智年齡會逐漸恢復到催眠前的狀態。',
    tier: 4,
    cost: { pts: 300, money: 60000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 140,
  },
  vip4_reason_melt: {
    name: '理智溶解',
    description: '讓被催眠者在催眠生效期間，判斷力與邏輯思考能力逐漸退化，直到完全失去理智，邏輯會變得混亂，無法正常思考。',
    tier: 4,
    cost: { pts: 300, money: 65000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 150,
  },
  vip4_pseudo_time_stop: {
    name: '偽時停',
    description: '讓被催眠者在催眠生效期間，舉動與意識會停在被催眠的那一刻，直到催眠時間結束。在催眠結束的瞬間，被催眠者會恢復意識，且恢復後，期間內所有的快感會一口氣爆發。',
    tier: 4,
    cost: { pts: 300, money: 70000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 160,
  },
  vip4_temp_personality: {
    name: '臨時人格植入',
    description: '讓被催眠者在催眠生效期間，被植入指定的人格，且會表現出該人格，催眠時間結束後，植入的人格會立刻消失，但可能會殘留些微人格特質。',
    tier: 4,
    cost: { pts: 300, money: 75000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 170,
  },
  vip4_space_common_sense: {
    name: '封閉空間常識修改',
    description: '根據指定的規則，改變指定空間內的特定常識，預設影響指定空間內除了催眠使用者以外所有人的常識。只能對封閉空間生效。',
    tier: 4,
    cost: { pts: 300, money: 80000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 180,
  },
  vip5_permanent: {
    name: '永久常識修改',
    description: '永久催眠。將被催眠者的指定常識修改為另一種指定的規定。',
    tier: 5,
    cost: { pts: 1000, money: 50000 },
    isCustom: false,
    isPermanent: true,
    isOneTime: true,
    energyCost: 2000,
  },
  vip5_personality: {
    name: '永久人格植入',
    description: '永久催眠，可疊加。對被催眠者植入一個或多個可以被反覆觸發的開關暗號，每個暗號對應一個獨立的人格設定，預設保留原始人格。聽到特定暗號就會切換到對應人格。',
    tier: 5,
    cost: { pts: 1000, money: 80000 },
    isCustom: false,
    isPermanent: true,
    isOneTime: true,
    energyCost: 3000,
  },
  vip5_third_person: {
    name: '第三人稱',
    description: '讓被催眠者在指定時間內，對自己的認知與身體控制變成第三人稱的視角，但本人仍然清楚自己是誰。',
    tier: 5,
    cost: { pts: 1000, money: 90000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 200,
  },
  vip5_vocab_pollution: {
    name: '詞彙污染',
    description: '永久催眠。強制修改大腦的語言輸出區塊，將指定的詞彙或句子替換成另一種指定的詞彙或句子。',
    tier: 5,
    cost: { pts: 1000, money: 100000 },
    isCustom: false,
    isPermanent: true,
    isOneTime: true,
    energyCost: 4000,
  },
  vip5_meat_puppet: {
    name: '肉人偶化',
    description: '永久催眠。植入隱蔽的開關暗號，接收到暗號後瞬間切換成絕對服從且沒有自我意識的肉人偶模式，此模式下生存本能會被覆蓋，即使瀕死也不會解除。',
    tier: 5,
    cost: { pts: 1000, money: 150000 },
    isCustom: false,
    isPermanent: true,
    isOneTime: true,
    energyCost: 5000,
  },
  vip5_perm_sense_replace: {
    name: '永久性感覺替換',
    description: '永久催眠。強制修改大腦的感覺接收區塊，將指定的感覺替換成另一種指定的感覺。',
    tier: 5,
    cost: { pts: 1000, money: 120000 },
    isCustom: false,
    isPermanent: true,
    isOneTime: true,
    energyCost: 4500,
  },
  vip5_perm_fetish: {
    name: '永久性癖植入',
    description: '永久催眠。強制修改大腦的性慾與性快感區塊，讓被催眠者對指定的性癖產生強烈的性興奮與快感。',
    tier: 5,
    cost: { pts: 1000, money: 130000 },
    isCustom: false,
    isPermanent: true,
    isOneTime: true,
    energyCost: 4800,
  },
  vip5_perm_fake_memory: {
    name: '永久虚假记忆',
    description: '永久催眠。將指定記憶修改為另一種記憶，或植入不存在的記憶。大腦會對與現實衝突的部分自行合理解釋或淡化。',
    tier: 5,
    cost: { pts: 1000, money: 140000 },
    isCustom: false,
    isPermanent: true,
    isOneTime: true,
    energyCost: 5000,
  },
  vip5_open_space_sense: {
    name: '開放空間常識修改',
    description: '對指定空間內的特定常識進行強制修改，預設影響空間內除了催眠使用者以外所有人的常識。催眠時間結束後解除。能對開放空間與封閉空間生效。',
    tier: 5,
    cost: { pts: 1000, money: 160000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: false,
    energyCost: 300,
  },
  vip5_forced_action: {
    name: '強制控制身體行動',
    description: '一次性催眠。效果會持續到被催眠者執行指定的行動為止，且被催眠者在執行指定行動期間無法反抗或中斷，即使是違背自身意志或面臨死亡風險也無法中斷。',
    tier: 5,
    cost: { pts: 1000, money: 180000 },
    isCustom: false,
    isPermanent: false,
    isOneTime: true,
    energyCost: 6000,
  }
};

export const EQUIPMENT_DICTIONARY: Record<string, EquipmentDef> = {
  eq_screen: {
    name: '屏幕',
    description: '基礎視覺輸出設備。',
    icon: 'monitor',
    tier: 0,
    cost: { money: 0 },
    type: 'device',
    usageCostType: ['none'],
    usageCostRate: 0,
  },
  eq_vip1_stats: {
    name: '角色状态可视化',
    description: '解锁身体属性查看APP，可以直观看到催眠效果。',
    icon: 'activity',
    tier: 1,
    cost: { pts: 10 },
    type: 'technology',
    usageCostType: ['none'],
    usageCostRate: 0,
  },
  eq_text_compiler: {
    name: '催眠文字編譯技術',
    description: '能將催眠要求轉換成具有催眠效果的文字。',
    icon: 'file-text',
    tier: 2,
    cost: { money: 2000 },
    type: 'technology',
    usageCostType: ['mc'],
    usageCostRate: 2,
  },
  eq_img_mix: {
    name: '圖像混淆技術',
    description: '能將具有催眠效果的圖像與其他圖像混合，使其更加難以察覺。',
    icon: 'image',
    tier: 3,
    cost: { money: 5000 },
    type: 'technology',
    usageCostType: ['mc'],
    usageCostRate: 5,
  },
  eq_text_mix: {
    name: '文字語意混淆技術',
    description: '能將具有催眠效果的文字與其他文字混合，使其更加難以察覺。',
    icon: 'align-center',
    tier: 3,
    cost: { money: 5000 },
    type: 'technology',
    usageCostType: ['mc'],
    usageCostRate: 5,
  },
  eq_audio_modulator: {
    name: '催眠音頻調製技術',
    description: '能將催眠要求轉換成具有催眠效果的聲音。',
    icon: 'volume-2',
    tier: 2,
    cost: { money: 2000 },
    type: 'technology',
    usageCostType: ['mc'],
    usageCostRate: 2,
  },
  eq_audio_mix: {
    name: '催眠音頻混淆技術',
    description: '能將具有催眠效果的聲音與其他聲音混合，使其更加難以察覺。',
    icon: 'music',
    tier: 3,
    cost: { money: 5000 },
    type: 'technology',
    usageCostType: ['mc'],
    usageCostRate: 5,
  },
  eq_tactile: {
    name: '觸覺震動頻率調製技術',
    description: '能將催眠要求轉換成具有催眠效果的震動訊號。',
    icon: 'smartphone',
    tier: 4,
    cost: { money: 15000 },
    type: 'technology',
    usageCostType: ['mc'],
    usageCostRate: 10,
  },
  eq_food_mix: {
    name: '食物催眠融合技術',
    description: '能將催眠要求轉換成具有催眠效果的味道配方。',
    icon: 'coffee',
    tier: 4,
    cost: { money: 15000 },
    type: 'technology',
    usageCostType: ['mc'],
    usageCostRate: 10,
  },
  eq_spice_maker: {
    name: '催眠調味料製做設備',
    description: '能依照配方製作出具有催眠效果的味道(調味料)。',
    icon: 'box',
    tier: 4,
    cost: { money: 20000 },
    type: 'device',
    usageCostType: ['money'],
    usageCostRate: 500, // 每次製作/開啟消耗金錢
  },
  eq_gas_modulator: {
    name: '催眠氣體調製技術',
    description: '能將催眠要求轉換成具有催眠效果的氣體配方。',
    icon: 'wind',
    tier: 4,
    cost: { money: 15000 },
    type: 'technology',
    usageCostType: ['mc'],
    usageCostRate: 10,
  },
  eq_gas_maker: {
    name: '催眠氣體發生設備',
    description: '能依照配方產生出具有催眠效果的氣體。',
    icon: 'cloud',
    tier: 4,
    cost: { money: 20000 },
    type: 'device',
    usageCostType: ['money'],
    usageCostRate: 500,
  },
  eq_gas_diffuser: {
    name: '氣體擴散設備',
    description: '能將具有催眠效果的氣體擴散到指定範圍內。',
    icon: 'maximize',
    tier: 4,
    cost: { money: 10000 },
    type: 'device',
    usageCostType: ['none'],
    usageCostRate: 0,
  },
  eq_em_modulator: {
    name: '催眠電磁波調製技術',
    description: '能將催眠要求轉換成具有催眠效果的電磁波訊號。',
    icon: 'radio',
    tier: 5,
    cost: { money: 50000 },
    type: 'technology',
    usageCostType: ['mc'],
    usageCostRate: 50,
  },
  eq_em_transmitter: {
    name: '催眠電磁波發射設備',
    description: '能將具有催眠效果的電磁波訊號發射到指定範圍內。',
    icon: 'wifi',
    tier: 5,
    cost: { money: 80000 },
    type: 'device',
    usageCostType: ['none'],
    usageCostRate: 0,
  },
  eq_em_receiver: {
    name: '催眠電磁波接收設備',
    description: '能接收並解碼具有催眠效果的電磁波訊號，需要被催眠者佩戴或植入 (消耗品)。',
    icon: 'cpu',
    tier: 5,
    cost: { money: 5000 },
    type: 'device',
    usageCostType: ['none'],
    usageCostRate: 0,
  }
};

// ==========================================
// 3. 測試用的靜態資料
// ==========================================

// 預設的測試用自訂催眠
export const TestCustomHypnosisInput: Record<string, HypnosisDef> = {
  ch_20260501_164434: {
    name: '測試用自訂催眠1',
    description: '這是用來測試自訂催眠的',
    tier: 1,
    cost: {money:0},
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
    cost: {mc:10,pts:12},
    isCustom: true,
    isPermanent: false,
    isOneTime: false,
    energyCost: 132,
    defaultNote: '請填入描述',
  }
};

// 預設的測試用催眠組合
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

export const TestCharDataInput: Record<string, MockcharData> = {
  '測試角色名': {
    placeholder: '測試用角色',
  },
  '白雪公主': {
    placeholder: '測試用角色2',
  },
  '其他人': {
    placeholder: '測試用角色3',
  }
};

// 預設的測試資料
export const defaultMockUserData: MockUserData = {
  userName: '測試用玩家名',
  money: 102830,
  mcEnergy: 1900,
  mcEnergyMax: 2000,
  mcPoints: 500,
  totalConsumedMc: 500,
  vipTier: 3,
  vipEndVirtualMinutes: 10056, // 一週
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
};

// ==========================================
// 4. 動態狀態結構設計 (Dynamic State)
// ==========================================

export interface MockSystemData { // 模擬可以從後端獲取的資料，將來可以替換成真正的後端資料接口
  time: string;
}

export interface MockcharData {
  placeholder: string;
}

export interface MockUserData { // 模擬可以從後端獲取的資料，將來可以替換成真正的後端資料接口
  userName: string;
  // A. 基礎資源與訂閱資訊
  money: number;
  mcEnergy: number;
  mcEnergyMax: number;
  mcPoints: number; // 持有催眠點(PTS)
  totalConsumedMc: number;
  vipTier: number; // 0~5
  vipEndVirtualMinutes: number; // 虛擬分鐘
  vipAutoRenew: boolean;
  suspicion: number; // 主角可疑度

  // B. 玩家持有的多重物件 (Record 結構)
  ownedHypnosis: Record<string, { enabled: boolean, settings?: any }>;
  ownedEquipments: Record<string, { enabled: boolean, settings?: any }>;
  ownedCombos: Record<string, { enabled: boolean, settings?: any }>;
}

export interface RuntimeData { // UI 介面使用的資料，理論上在UI層完成後不需要變更，因為所有與後端互動的邏輯都被封裝在橋接檔案中
  system: MockSystemData;
  user: MockUserData;
  chars: Record<string, MockcharData>; // name, MockcharData

  hypnosis: Record<string, HypnosisDef>; // id(其中自訂催眠使用hash值做id，ch_YYYYMMDD_hhmmss), HypnosisDef
  equipment: Record<string, EquipmentDef>; // id, EquipmentDef
  combos: Record<string, ComboDef>; // id(由於默認由玩家創建，所以使用hash值做id，chc_YYYYMMDD_hhmmss), ComboDef
}

// ==========================================
// 5. 模擬後端 API (Mock Backend API)
// ==========================================

// 內部狀態 (模擬資料庫)
let mockDatabase: MockUserData = JSON.parse(JSON.stringify(defaultMockUserData));
const mockSystemData: MockSystemData = { time: '2026-05-01 11:28:00' };

// 模擬網路延遲
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const MockApi = {
  /**
   * 查詢用戶當前的資源與狀態
   */
  async getUserInfo(): Promise<MockUserData> {
    await delay(200);
    return JSON.parse(JSON.stringify(mockDatabase));
  },

  /**
   * 查詢目前的系統狀態
   */
  async getSystemData(): Promise<MockSystemData> {
    await delay(100);
    return JSON.parse(JSON.stringify(mockSystemData));
  },

  /**
   * 查詢角色資料
   */
  async getCharData(): Promise<Record<string, MockcharData>> {
    await delay(100);
    return TestCharDataInput;
  },

  /**
   * 查詢完整的設備字典 (所有設備定義，不做擁有過濾)
   */
  async getAllEquipment(): Promise<Record<string, EquipmentDef>> {
    await delay(150);
    return { ...EQUIPMENT_DICTIONARY };
  },

  /**
   * 查詢完整的催眠字典 (所有催眠定義，包含自訂催眠，不做擁有過濾)
   */
  async getAllHypnosis(): Promise<Record<string, HypnosisDef>> {
    await delay(150);
    return { ...HYPNOSIS_DICTIONARY, ...TestCustomHypnosisInput };
  },

  /**
   * 查詢完整的催眠組合字典 (所有組合定義，不做擁有過濾)
   */
  async getAllCombos(): Promise<Record<string, ComboDef>> {
    await delay(150);
    return { ...TestComboDataInput };
  },

  /**
   * 模擬更新用戶資源 (金錢、MC 能量、PTS 等)
   */
  async updateUserResource(patch: Partial<Pick<MockUserData, 'money' | 'mcEnergy' | 'mcEnergyMax' | 'mcPoints' | 'totalConsumedMc' | 'suspicion' | 'vipTier' | 'vipEndVirtualMinutes' | 'vipAutoRenew'>>): Promise<void> {
    await delay(300);

    // 如果有消耗 MC 能量，則自動累加到 totalConsumedMc
    if (patch.mcEnergy !== undefined && patch.mcEnergy < mockDatabase.mcEnergy) {
      const consumed = mockDatabase.mcEnergy - patch.mcEnergy;
      patch.totalConsumedMc = (patch.totalConsumedMc ?? mockDatabase.totalConsumedMc) + consumed;
    }

    mockDatabase = { ...mockDatabase, ...patch };
  },

  /**
   * 模擬更新擁有的催眠狀態
   */
  async updateUserOwnedHypnosis(id: string, enabled: boolean, settings?: any): Promise<void> {
    await delay(200);
    mockDatabase.ownedHypnosis[id] = { enabled, settings: settings || mockDatabase.ownedHypnosis[id]?.settings };
  },

  /**
   * 模擬更新擁有的設備狀態
   */
  async updateUserOwnedEquipments(id: string, enabled: boolean, settings?: any): Promise<void> {
    await delay(200);
    mockDatabase.ownedEquipments[id] = { enabled, settings: settings || mockDatabase.ownedEquipments[id]?.settings };
  },

  /**
   * 模擬更新擁有的組合狀態
   */
  async updateUserOwnedCombos(id: string, enabled: boolean, settings?: any): Promise<void> {
    await delay(200);
    mockDatabase.ownedCombos[id] = { enabled, settings: settings || mockDatabase.ownedCombos[id]?.settings };
  },

  /**
   * 模擬發送催眠指令
   */
  async sendHypnosis(launchData: any[]): Promise<void> {
    await delay(500);
    console.log('[MockApi] 模擬發送催眠指令:', launchData);
  },

  /**
   * 模擬儲存自製催眠
   */
  async saveNewHypnosis(id: string, def: HypnosisDef): Promise<void> {
    await delay(300);
    TestCustomHypnosisInput[id] = def;
    // 製作出的催眠不會直接歸入已購買，而是需要玩家在去商店購買才會擁有
  },

  /**
   * 模擬儲存新的催眠組合
   */
  async saveNewCombo(comboId: string, comboDef: ComboDef): Promise<void> {
    await delay(200);
    // 更新全局組合字典
    TestComboDataInput[comboId] = comboDef;
    // 更新用戶擁有的組合
    mockDatabase.ownedCombos[comboId] = { enabled: true };
  },

  /**
   * 模擬更新已存在的催眠組合內容
   */
  async updateCombo(comboId: string, comboDef: ComboDef): Promise<void> {
    await delay(200);
    if (TestComboDataInput[comboId]) {
      TestComboDataInput[comboId] = comboDef;
    }
  },

  /**
   * 模擬刪除催眠組合
   */
  async deleteCombo(comboId: string): Promise<void> {
    await delay(200);
    delete TestComboDataInput[comboId];
    if (mockDatabase.ownedCombos[comboId]) {
      delete mockDatabase.ownedCombos[comboId];
    }
  },

  /**
   * 模擬刪除自訂催眠
   */
  async deleteHypnosis(id: string): Promise<void> {
    await delay(200);
    // 1. 從 TestCustomHypnosisInput 中刪除
    if (TestCustomHypnosisInput[id]) {
      delete TestCustomHypnosisInput[id];
    }
    // 2. 從 mockDatabase.ownedHypnosis 中移除
    if (mockDatabase.ownedHypnosis[id]) {
      delete mockDatabase.ownedHypnosis[id];
    }
    // 3. 從所有包含此催眠的組合中移除
    for (const comboId in TestComboDataInput) {
      if (TestComboDataInput[comboId].includedHypnosis[id]) {
        delete TestComboDataInput[comboId].includedHypnosis[id];

        // 如果移除後組合變為空，則刪除整個組合
        if (Object.keys(TestComboDataInput[comboId].includedHypnosis).length === 0) {
          delete TestComboDataInput[comboId];
          if (mockDatabase.ownedCombos[comboId]) {
            delete mockDatabase.ownedCombos[comboId];
          }
        }
      }
    }
  }
};



