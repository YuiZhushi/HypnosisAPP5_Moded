import { z } from 'zod';
import { QUEST_DB, type QuestDefinition } from '../data/questDb';
import { Achievement, HypnosisFeature, Quest, QuestStatus, UserResources } from '../types';
import {
  canSubscribeTier,
  canUseFeature as canUseFeatureBySubscription,
  getBodyStatsUnlocked,
  getSubscriptionUnlockThreshold,
  isSubscriptionActive,
  SUBSCRIPTION_TIERS,
  type AccessContext,
  type SubscriptionState,
  type SubscriptionTier,
} from './access';
import { MvuBridge } from './mvuBridge';

const CHAT_OPTION = { type: 'chat' } as const;

const DEFAULT_USER_DATA: UserResources = {
  mcEnergy: 25,
  mcEnergyMax: 25,
  mcPoints: 25,
  totalConsumedMc: 0,
  money: 6000,
  suspicion: 0,
};

const FEATURES: HypnosisFeature[] = [
  // TRIAL
  {
    id: 'trial_basic',
    title: '初级一般催眠',
    description: '被催眠者无意识遵循简单指示, 不能指令被催眠对象非常不愿意的行为, 强行指令会退出催眠.',
    tier: 'TRIAL',
    costType: 'PER_MINUTE',
    costValue: 5,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
    notePlaceholder: '输入简单动作指示...',
  },

  // VIP 1
  {
    id: 'vip1_stats',
    title: '角色状态可视化',
    description: '解锁身体属性查看APP.',
    tier: 'VIP1',
    costType: 'ONE_TIME',
    costValue: 0,
    isEnabled: false,
  },
  {
    id: 'vip1_senses',
    title: '味嗅觉修改',
    description: '将一种味道修改成另一种味道.',
    tier: 'VIP1',
    costType: 'PER_MINUTE',
    costValue: 4,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
    notePlaceholder: '目标味道 -> 替换味道',
  },
  {
    id: 'vip1_temp_sensitivity',
    title: '临时敏感度修改',
    description: '临时修改被催眠者一个部位的敏感度.',
    tier: 'VIP1',
    costType: 'PER_MINUTE',
    costValue: 5,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
    notePlaceholder: '输入要修改的部位',
  },
  {
    id: 'vip1_truth_serum',
    title: '吐真',
    description: '强制被催眠者说出内心真实想法.',
    tier: 'VIP1',
    costType: 'PER_MINUTE',
    costValue: 4,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
    notePlaceholder: '想问的问题 / 引导语',
  },
  {
    id: 'vip1_estrus',
    title: '发情',
    description: '强制被催眠者发情.',
    tier: 'VIP1',
    costType: 'ONE_TIME',
    costValue: 1,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
    notePlaceholder: '输入要增加的发情值',
  },
  {
    id: 'vip1_memory_erase',
    title: '记忆消除',
    description: '消除一段时间内的记忆, 如果时间太长目标可能会因为记忆缺失产生怀疑.',
    tier: 'VIP1',
    costType: 'ONE_TIME',
    costValue: 5,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
    notePlaceholder: '输入要清除的记忆时长',
  },

  // VIP 2
  {
    id: 'vip2_medium',
    title: '中级一般催眠',
    description:
      '被催眠者无意识遵循简单指示, 可以指令被催眠对象一般不愿意的指示, 不能指令极端不愿意的行为, 强行指令会退出催眠.',
    tier: 'VIP2',
    costType: 'PER_MINUTE',
    costValue: 10,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
  },
  {
    id: 'vip2_pleasure',
    title: '快感赋予',
    description: '给予一个部位无来源的快感.',
    tier: 'VIP2',
    costType: 'PER_MINUTE',
    costValue: 5,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
    notePlaceholder: '部位',
  },
  {
    id: 'vip2_ghost_hand',
    title: '幽灵手',
    description: '让被催眠者错觉自己一直在被看不见的手玩弄.',
    tier: 'VIP2',
    costType: 'PER_MINUTE',
    costValue: 10,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
  },
  {
    id: 'vip2_body_lock',
    title: '身体固定',
    description: '强行让被催眠者身体无法行动, 但意识会保持清醒.',
    tier: 'VIP2',
    costType: 'PER_MINUTE',
    costValue: 12,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
  },
  {
    id: 'vip2_pain_to_pleasure',
    title: '痛觉转化',
    description: '将痛觉转换为快感.',
    tier: 'VIP2',
    costType: 'PER_MINUTE',
    costValue: 10,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
  },
  {
    id: 'vip2_emperors_new_clothes',
    title: '皇帝的新衣',
    description: '让被催眠着没穿着衣服的情况下觉得自己穿着衣服.',
    tier: 'VIP2',
    costType: 'PER_MINUTE',
    costValue: 10,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
  },
  {
    id: 'vip2_new_emperor',
    title: '新衣的皇帝',
    description: '让被催眠着在穿着衣服的情况下觉得自己没穿衣服.',
    tier: 'VIP2',
    costType: 'PER_MINUTE',
    costValue: 10,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
  },

  // VIP 3
  {
    id: 'vip3_forced',
    title: '强制高潮',
    description: '直接让被催眠者强制高潮.',
    tier: 'VIP3',
    costType: 'ONE_TIME',
    costValue: 100,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
  },
  {
    id: 'vip3_orgasm_ban',
    title: '绝顶禁止',
    description: '永远无法高潮 (寸止).',
    tier: 'VIP3',
    costType: 'ONE_TIME',
    costValue: 300,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
  },
  {
    id: 'vip3_visual_filter',
    title: '幻视滤镜',
    description: '被催眠者会将使用者看作是其他人.',
    tier: 'VIP3',
    costType: 'PER_MINUTE',
    costValue: 25,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
  },
  {
    id: 'vip3_conditioned_reflex',
    title: '条件反射植入',
    description: '让被催眠者在特定的刺激下作出特定的条件反射行为.',
    tier: 'VIP3',
    costType: 'ONE_TIME',
    costValue: 300,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
    notePlaceholder: '触发条件 -> 反射行为',
  },
  {
    id: 'vip3_temp_common_sense',
    title: '限时常识修改',
    description: '在一定时间内修改被催眠者的一项常识.',
    tier: 'VIP3',
    costType: 'PER_MINUTE',
    costValue: 10,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
    notePlaceholder: '输入要修改的常识...',
  },
  {
    id: 'vip3_shame_invert',
    title: '羞耻心反转',
    description: '将羞耻感直接转化为快感.',
    tier: 'VIP3',
    costType: 'PER_MINUTE',
    costValue: 10,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
  },
  {
    id: 'vip3_temp_false_memory',
    title: '临时虚假记忆',
    description: '给被催眠者临时植入一段记忆.',
    tier: 'VIP3',
    costType: 'ONE_TIME',
    costValue: 250,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
    notePlaceholder: '输入要植入的记忆...',
  },
  {
    id: 'vip3_pseudo_time_stop',
    title: '伪时停',
    description: '让被催眠者在当前的状态停止活动和意识, 快感会累计到结束时一起释放.',
    tier: 'VIP3',
    costType: 'PER_MINUTE',
    costValue: 30,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
  },

  // VIP 4
  {
    id: 'vip4_advanced',
    title: '高级一般催眠',
    description: '被催眠者无意识遵循简单指示, 可以指令任何行为.',
    tier: 'VIP4',
    costType: 'PER_MINUTE',
    costValue: 40,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
  },
  {
    id: 'vip4_closed_space_common_sense',
    title: '封闭空间常识修改',
    description: '修改封闭空间内的规则或常识.',
    tier: 'VIP4',
    costType: 'PER_MINUTE',
    costValue: 2,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
    notePlaceholder: '输入空间人数（数字）+ 要修改的规则/常识',
  },
  {
    id: 'vip4_excretion_control',
    title: '排泄控制',
    description: '必须在指定条件下才能排泄.',
    tier: 'VIP4',
    costType: 'ONE_TIME',
    costValue: 300,
    costCurrency: 'MC_POINTS',
    isEnabled: false,
    notePlaceholder: '输入排泄条件...',
  },
  {
    id: 'vip4_control_body_keep_conscious',
    title: '保留意识控制身体行动',
    description: '保留被催眠者意识的情况下, 强行控制被催眠者的身体.',
    tier: 'VIP4',
    costType: 'PER_MINUTE',
    costValue: 50,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
  },
  {
    id: 'vip4_control_body_no_conscious',
    title: '不保留意识控制身体行动',
    description: '在被催眠者无意识的情况下, 强行控制被催眠者的身体.',
    tier: 'VIP4',
    costType: 'PER_MINUTE',
    costValue: 50,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
  },
  {
    id: 'vip4_cognitive_block',
    title: '认知妨碍',
    description: '心理学隐身, 不会被他人意识到存在.',
    tier: 'VIP4',
    costType: 'PER_MINUTE',
    costValue: 60,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
  },
  {
    id: 'vip4_fetish_implant',
    title: '性癖植入',
    description: '永久性地给被催眠者植入一个性癖.',
    tier: 'VIP4',
    costType: 'ONE_TIME',
    costValue: 800,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
    notePlaceholder: '输入要植入的性癖...',
  },
  {
    id: 'vip4_temp_personality',
    title: '临时人格植入',
    description: '临时将一个人格植入被催眠者.',
    tier: 'VIP4',
    costType: 'PER_MINUTE',
    costValue: 50,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
    notePlaceholder: '输入人格设定...',
  },
  {
    id: 'vip4_lactation',
    title: '泌乳诱导',
    description: '修改内分泌系统，让非哺乳期女性分泌乳汁.',
    tier: 'VIP4',
    costType: 'ONE_TIME',
    costValue: 500,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
  },

  // VIP 5
  {
    id: 'vip5_permanent',
    title: '永久常识修改',
    description: '永久修改被催眠者的一项常识.',
    tier: 'VIP5',
    costType: 'ONE_TIME',
    costValue: 2000,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
    notePlaceholder: '输入要修改的常识...',
  },
  {
    id: 'vip5_permanent_false_memory',
    title: '永久虚假记忆',
    description: '给被催眠者永久植入一段记忆.',
    tier: 'VIP5',
    costType: 'ONE_TIME',
    costValue: 1500,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
    notePlaceholder: '输入要植入的记忆...',
  },
  {
    id: 'vip5_permanent_personality',
    title: '永久人格植入',
    description: '永久将一个人格植入被催眠者.',
    tier: 'VIP5',
    costType: 'ONE_TIME',
    costValue: 3000,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
    notePlaceholder: '输入人格设定...',
  },
  {
    id: 'vip5_open_space_common_sense',
    title: '开放空间常识修改',
    description: '修改开放空间内的规则或常识.',
    tier: 'VIP5',
    costType: 'PER_MINUTE',
    costValue: 100,
    costCurrency: 'MC_ENERGY',
    isEnabled: false,
    notePlaceholder: '输入要修改的规则/常识...',
  },
];

const PURCHASE_PRICE_BY_TIER: Record<HypnosisFeature['tier'], number> = {
  TRIAL: 0,
  VIP1: 10,
  VIP2: 50,
  VIP3: 150,
  VIP4: 300,
  VIP5: 1000,
  VIP6: 1000,
};

const FIRST_FEATURE_ID_BY_TIER = (() => {
  const map = new Map<HypnosisFeature['tier'], string>();
  for (const feature of FEATURES) {
    if (feature.tier === 'TRIAL') continue;
    if (!map.has(feature.tier)) map.set(feature.tier, feature.id);
  }
  return map;
})();

function isPurchaseRequired(feature: HypnosisFeature): boolean {
  if (feature.tier === 'TRIAL') return false;
  const firstId = FIRST_FEATURE_ID_BY_TIER.get(feature.tier);
  return Boolean(firstId) && feature.id !== firstId;
}

function getPurchasePricePoints(feature: HypnosisFeature): number | null {
  if (!isPurchaseRequired(feature)) return null;
  return PURCHASE_PRICE_BY_TIER[feature.tier] ?? PURCHASE_PRICE_BY_TIER.VIP5;
}

type PersistedStore = {
  version: number;
  debugEnabled: boolean;
  sessionEndVirtualMinutes?: number;
  sessionEndAtMs?: number;
  hasUsedHypnosis: boolean;
  subscription?: {
    tier: 'VIP1' | 'VIP2' | 'VIP3' | 'VIP4' | 'VIP5';
    endVirtualMinutes: number;
    autoRenew: boolean;
  };
  features: Record<string, { isEnabled?: boolean; userNote?: string; userNumber?: number }>;
  purchases: Record<string, boolean>;
  achievements: Record<string, boolean>;
  quests: Record<string, QuestStatus>;
};

const STORE_SCHEMA: z.ZodType<PersistedStore> = z
  .object({
    version: z.coerce.number().default(1),
    debugEnabled: z.coerce.boolean().default(false),
    sessionEndVirtualMinutes: z.coerce.number().optional(),
    sessionEndAtMs: z.coerce.number().optional(),
    hasUsedHypnosis: z.coerce.boolean().default(false),
    subscription: z
      .object({
        tier: z.enum(['VIP1', 'VIP2', 'VIP3', 'VIP4', 'VIP5']),
        endVirtualMinutes: z.coerce.number(),
        autoRenew: z.coerce.boolean().default(false),
      })
      .optional(),
    features: z
      .record(
        z.string(),
        z
          .object({
            isEnabled: z.boolean().optional(),
            userNote: z.string().optional(),
            userNumber: z.coerce.number().optional(),
          })
          .passthrough(),
      )
      .default({}),
    purchases: z.record(z.string(), z.coerce.boolean()).default({}),
    achievements: z.record(z.string(), z.boolean()).default({}),
    quests: z.record(z.string(), z.enum(['AVAILABLE', 'ACTIVE', 'COMPLETED', 'CLAIMED'])).default({}),
  })
  .default({
    version: 1,
    debugEnabled: false,
    hasUsedHypnosis: false,
    features: {},
    purchases: {},
    achievements: {},
    quests: {},
  });

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeSystemAliases(systemRaw: Record<string, any>) {
  const existingEnergy = toFiniteNumber(systemRaw._MC能量);
  if (existingEnergy === null) {
    const mcEnergy = toFiniteNumber(systemRaw.MC能量);
    if (mcEnergy !== null) systemRaw._MC能量 = mcEnergy;
  }

  const existingEnergyMax = toFiniteNumber(systemRaw._MC能量上限);
  if (existingEnergyMax === null) {
    const mcEnergyMax = toFiniteNumber(systemRaw.MC能量上限);
    if (mcEnergyMax !== null) systemRaw._MC能量上限 = mcEnergyMax;
  }
  return systemRaw;
}

function idSafe(part: string): string {
  return encodeURIComponent(part).replaceAll('%', '_');
}

function makeAchievementId(prefix: string, ...parts: string[]) {
  return [prefix, ...parts.map(idSafe)].join('__');
}

export const SUBSCRIPTION_PRICES: Record<SubscriptionTier, number> = {
  VIP1: 3000,
  VIP2: 6000,
  VIP3: 10000,
  VIP4: 20000,
  VIP5: 40000,
};

const SUBSCRIPTION_WEEK_MINUTES = 7 * 24 * 60;

function parseVirtualMinutesFrom(dateText?: string, timeText?: string): number | null {
  if (!dateText || !timeText) return null;
  const dateMatch = dateText.match(/(\d+)\s*月\s*(\d+)\s*日/);
  const timeMatch = timeText.match(/(\d{1,2})\s*:\s*(\d{1,2})(?:\s*:\s*(\d{1,2}))?/);
  if (!dateMatch || !timeMatch) return null;

  const month = Number(dateMatch[1]);
  const day = Number(dateMatch[2]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const seconds = timeMatch[3] === undefined ? 0 : Number(timeMatch[3]);
  if (![month, day, hours, minutes].every(Number.isFinite)) return null;
  if (!Number.isFinite(seconds)) return null;

  const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const mIndex = Math.max(1, Math.min(12, month)) - 1;
  const dIndex = Math.max(1, Math.min(monthDays[mIndex], day)) - 1;
  const dayOfYear = monthDays.slice(0, mIndex).reduce((a, b) => a + b, 0) + dIndex;

  const h = Math.max(0, Math.min(23, hours));
  const min = Math.max(0, Math.min(59, minutes));
  const sec = Math.max(0, Math.min(59, seconds));
  return dayOfYear * 24 * 60 + h * 60 + min + sec / 60;
}

function getSystemClockFrom(system: Record<string, any> | null | undefined) {
  const dateText = typeof system?.当前日期 === 'string' ? system.当前日期 : undefined;
  const timeText = typeof system?.当前时间 === 'string' ? system.当前时间 : undefined;
  return {
    dateText,
    timeText,
    virtualMinutes: parseVirtualMinutesFrom(dateText, timeText),
  };
}

async function getRolesAndSystemSnapshot(): Promise<{ system: Record<string, any>; roles: Record<string, any> }> {
  let system: Record<string, any> | null = null;
  let roles: Record<string, any> | null = null;
  try {
    system = await MvuBridge.getSystem();
    if (system) normalizeSystemAliases(system);
    roles = await MvuBridge.getRoles();
  } catch {
    // ignore
  }

  if (system && roles) return { system, roles };

  const vars = getVariables(CHAT_OPTION);
  const normalized = normalizeChatVariables(vars);
  system ??= normalized.system as any;
  roles ??= (vars as any)?.角色 ?? {};
  return { system, roles };
}

type SystemWithStore = {
  _MC能量: number;
  _MC能量上限: number;
  当前MC点: number;
  _累计消耗MC点: number;
  持有零花钱: number;
  主角可疑度: number;
  _hypnoos?: PersistedStore;
  [key: string]: any;
};

const SYSTEM_SCHEMA: z.ZodType<SystemWithStore> = z
  .object({
    _MC能量: z.coerce.number().default(DEFAULT_USER_DATA.mcEnergy),
    _MC能量上限: z.coerce.number().default(DEFAULT_USER_DATA.mcEnergyMax),
    当前MC点: z.coerce.number().default(DEFAULT_USER_DATA.mcPoints),
    _累计消耗MC点: z.coerce.number().default(DEFAULT_USER_DATA.totalConsumedMc),
    持有零花钱: z.coerce.number().default(DEFAULT_USER_DATA.money),
    主角可疑度: z.coerce.number().default(DEFAULT_USER_DATA.suspicion),
    _hypnoos: STORE_SCHEMA.optional(),
  })
  .passthrough()
  .default({} as SystemWithStore);

function systemToUserResources(system: SystemWithStore): UserResources {
  return {
    mcEnergy: system._MC能量,
    mcEnergyMax: system._MC能量上限,
    mcPoints: system.当前MC点,
    totalConsumedMc: system._累计消耗MC点,
    money: system.持有零花钱,
    suspicion: system.主角可疑度,
  };
}

function normalizeChatVariables(variables: Record<string, any>) {
  const systemRaw = normalizeSystemAliases(variables?.系统 ?? {});
  const system = SYSTEM_SCHEMA.parse(systemRaw);
  system._hypnoos = STORE_SCHEMA.parse(system._hypnoos ?? {});
  variables.系统 = system;
  return { variables, system, store: system._hypnoos };
}

async function updateStoreWith(updater: (store: PersistedStore) => PersistedStore) {
  let nextStore: PersistedStore | undefined;
  updateVariablesWith(vars => {
    const { system, store } = normalizeChatVariables(vars);
    nextStore = STORE_SCHEMA.parse(updater(store));
    system._hypnoos = nextStore;
    vars.系统 = system;
    return vars;
  }, CHAT_OPTION);

  const result = nextStore ?? STORE_SCHEMA.parse({});
  await MvuBridge.syncPersistedStore(result);
  return result;
}

const STATIC_ACHIEVEMENTS: Array<Omit<Achievement, 'isClaimed'>> = [
  {
    id: 'ach_newbie',
    title: '初次接触',
    description: '累计消耗超过 10 点 MC 能量。',
    rewardMcPoints: 5,
    checkCondition: u => u.totalConsumedMc >= 10,
  },
  {
    id: 'ach_vip2',
    title: '进阶会员',
    description: '解锁 VIP 2 权限 (累计消耗 100 MC)。',
    rewardMcPoints: 20,
    checkCondition: u => u.totalConsumedMc >= 100,
  },
  {
    id: 'ach_rich',
    title: '资金充裕',
    description: '持有金钱超过 50,000 円。',
    rewardMcPoints: 10,
    checkCondition: u => u.money >= 50000,
  },
  {
    id: 'ach_sus',
    title: '隐秘行动',
    description: '将可疑度控制在 5% 以下。',
    rewardMcPoints: 50,
    checkCondition: u => u.suspicion <= 5,
  },
];

async function buildRoleBasedAchievements(store: PersistedStore): Promise<Array<Omit<Achievement, 'isClaimed'>>> {
  const { system, roles } = await getRolesAndSystemSnapshot();

  const achievements: Array<Omit<Achievement, 'isClaimed'>> = [];

  achievements.push({
    id: 'ach_first_hypnosis',
    title: '首次使用催眠',
    description: '首次启动催眠流程。',
    rewardMcPoints: 15,
    checkCondition: () => Boolean(store.hasUsedHypnosis),
  });

  const suspicion = toFiniteNumber(system?.主角可疑度) ?? 0;
  for (const t of [25, 50, 75, 100]) {
    achievements.push({
      id: makeAchievementId('ach_suspicion', String(t)),
      title: `主角可疑度达到 ${t}`,
      description: `主角可疑度达到 ${t}%（系统.主角可疑度）`,
      rewardMcPoints: t,
      checkCondition: () => suspicion >= t,
    });
  }

  const energyMax = toFiniteNumber(system?._MC能量上限) ?? 0;
  const energyMaxThresholds: Array<[number, number]> = [
    [100, 10],
    [300, 30],
    [1000, 50],
  ];
  for (const [t, reward] of energyMaxThresholds) {
    achievements.push({
      id: makeAchievementId('ach_energy_max', String(t)),
      title: `MC能量上限达到 ${t}`,
      description: `MC能量上限达到 ${t}（系统._MC能量上限）`,
      rewardMcPoints: reward,
      checkCondition: () => energyMax >= t,
    });
  }

  const sensitivityThresholds = [200, 300, 400, 500];
  const orgasmThresholds = [1, 5, 25, 100];
  const percentThresholds = [25, 50, 75, 100];

  for (const [roleName, roleDataRaw] of Object.entries(roles ?? {})) {
    if (!roleName) continue;
    if (!roleDataRaw || typeof roleDataRaw !== 'object') continue;
    const roleData = roleDataRaw as Record<string, any>;

    const guard = toFiniteNumber(roleData['警戒度']) ?? 0;
    const obey = toFiniteNumber(roleData['服从度']) ?? 0;

    for (const t of percentThresholds) {
      achievements.push({
        id: makeAchievementId('ach_role_guard', roleName, String(t)),
        title: `${roleName} 警戒度达到 ${t}`,
        description: `${roleName} 的警戒度达到 ${t}（角色.${roleName}.警戒度）`,
        rewardMcPoints: t,
        checkCondition: () => guard >= t,
      });
      achievements.push({
        id: makeAchievementId('ach_role_obey', roleName, String(t)),
        title: `${roleName} 服从度达到 ${t}`,
        description: `${roleName} 的服从度达到 ${t}（角色.${roleName}.服从度）`,
        rewardMcPoints: t,
        checkCondition: () => obey >= t,
      });
    }

    const sensitivityKeys = Object.keys(roleData).filter(k => k.includes('敏感度'));
    for (const key of sensitivityKeys) {
      const value = toFiniteNumber(roleData[key]);
      if (value === null) continue;
      for (const t of sensitivityThresholds) {
        achievements.push({
          id: makeAchievementId('ach_sensitivity', roleName, key, String(t)),
          title: `${roleName}·${key} ≥ ${t}`,
          description: `${roleName} 的 ${key} 达到 ${t}（角色.${roleName}.${key}）`,
          rewardMcPoints: 20,
          checkCondition: () => value >= t,
        });
      }
    }

    const orgasmKeys = Object.keys(roleData).filter(k => k.includes('高潮次数'));
    for (const key of orgasmKeys) {
      const value = toFiniteNumber(roleData[key]);
      if (value === null) continue;
      for (const t of orgasmThresholds) {
        achievements.push({
          id: makeAchievementId('ach_orgasm', roleName, key, String(t)),
          title: `${roleName}·${key} ≥ ${t}`,
          description: `${roleName} 的 ${key} 达到 ${t}（角色.${roleName}.${key}）`,
          rewardMcPoints: 20,
          checkCondition: () => value >= t,
        });
      }
    }
  }

  return achievements;
}

function validateQuestDb(db: QuestDefinition[]) {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const q of db) {
    if (ids.has(q.id)) throw new Error(`[HypnoOS] QUEST_DB 重复 id: ${q.id}`);
    ids.add(q.id);
    if (names.has(q.name)) throw new Error(`[HypnoOS] QUEST_DB 重复 name: ${q.name}`);
    names.add(q.name);
  }
  return db;
}

const QUEST_DATABASE = validateQuestDb(QUEST_DB);

const PERSISTENT_FEATURE_IDS = new Set<string>([]);

const SUBSCRIPTION_TIER_TRIAL_LABEL = '试用期';

function getSubscriptionTierLabel(
  subscription: SubscriptionState | null,
  nowVirtualMinutes: number | null,
): string | null {
  if (!subscription) return SUBSCRIPTION_TIER_TRIAL_LABEL;
  if (nowVirtualMinutes === null) return null;
  return subscription.endVirtualMinutes > nowVirtualMinutes ? subscription.tier : SUBSCRIPTION_TIER_TRIAL_LABEL;
}

async function syncSubscriptionTierLabel(nowVirtualMinutes: number | null): Promise<void> {
  const { system, store } = normalizeChatVariables(getVariables(CHAT_OPTION));
  const subscription = (store.subscription as SubscriptionState | undefined) ?? null;
  const desired = getSubscriptionTierLabel(subscription, nowVirtualMinutes);
  if (desired === null) return;
  if (system._催眠APP订阅等级 === desired) return;

  updateVariablesWith(vars => {
    const { system: nextSystem } = normalizeChatVariables(vars);
    nextSystem._催眠APP订阅等级 = desired;
    vars.系统 = nextSystem;
    return vars;
  }, CHAT_OPTION);

  await MvuBridge.syncSubscriptionTier(desired);
}

export const DataService = {
  getUnlocks: async (): Promise<{ debugEnabled: boolean; bodyStatsUnlocked: boolean }> => {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    const debugEnabled = Boolean(store.debugEnabled);
    const nowVirtualMinutes = (await DataService.getSystemClock()).virtualMinutes;
    const subscription = (store.subscription as SubscriptionState | undefined) ?? null;
    const accessContext: AccessContext = { debugEnabled, subscription, nowVirtualMinutes };

    const subscriptionActive = isSubscriptionActive(accessContext);
    let vip1StatsUnlocked = Boolean(store.purchases?.vip1_stats);

    // 兼容旧数据：曾经订阅过（能解锁 vip1_stats）但未写入永久解锁标记时，自动补写一次。
    if (!vip1StatsUnlocked && subscriptionActive) {
      await updateStoreWith(s => ({ ...s, purchases: { ...s.purchases, vip1_stats: true } }));
      vip1StatsUnlocked = true;
    }

    return { debugEnabled, bodyStatsUnlocked: getBodyStatsUnlocked({ debugEnabled, vip1StatsUnlocked }) };
  },

  getSubscriptionUnlockThreshold: (tier: SubscriptionTier): number => getSubscriptionUnlockThreshold(tier),

  canSubscribeTier: (tier: SubscriptionTier, ctx: { debugEnabled: boolean; totalConsumedMc: number }): boolean =>
    canSubscribeTier({ tier, debugEnabled: ctx.debugEnabled, totalConsumedMc: ctx.totalConsumedMc }),

  isSubscriptionActive: (ctx: AccessContext): boolean => isSubscriptionActive(ctx),

  canUseFeature: (feature: HypnosisFeature, ctx: AccessContext): boolean => {
    if (ctx.debugEnabled) return true;
    if (feature.id === 'vip1_stats') {
      const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
      if (store.purchases?.vip1_stats) return true;
    }
    return canUseFeatureBySubscription(feature, ctx);
  },

  getSubscriptionTiers: (): readonly SubscriptionTier[] => SUBSCRIPTION_TIERS,

  getUserData: async (): Promise<UserResources> => {
    let user: UserResources | undefined;
    try {
      const mvuSystem = await MvuBridge.getSystem();
      if (mvuSystem) {
        user = systemToUserResources(SYSTEM_SCHEMA.parse(normalizeSystemAliases(mvuSystem)));
      }
    } catch (err) {
      console.warn('[HypnoOS] 读取 MVU 系统变量失败，回退到聊天变量', err);
    }

    updateVariablesWith(vars => {
      const { system } = normalizeChatVariables(vars);
      user ??= systemToUserResources(system);
      return vars;
    }, CHAT_OPTION);

    if (user) {
      updateVariablesWith(vars => {
        const { system, store } = normalizeChatVariables(vars);
        system._MC能量 = user.mcEnergy;
        system._MC能量上限 = user.mcEnergyMax;
        system.当前MC点 = user.mcPoints;
        system._累计消耗MC点 = user.totalConsumedMc;
        system.持有零花钱 = user.money;
        system.主角可疑度 = user.suspicion;
        system._hypnoos = store;
        vars.系统 = system;
        return vars;
      }, CHAT_OPTION);
    }

    return user ?? DEFAULT_USER_DATA;
  },

  getSystemClock: async (): Promise<{ dateText?: string; timeText?: string; virtualMinutes: number | null }> => {
    const maybeSync = async (clock: { virtualMinutes: number | null }) => {
      try {
        await syncSubscriptionTierLabel(clock.virtualMinutes);
      } catch (err) {
        console.warn('[HypnoOS] 同步订阅等级变量失败', err);
      }
      return clock;
    };

    try {
      const mvuSystem = await MvuBridge.getSystem();
      if (mvuSystem) return await maybeSync(getSystemClockFrom(mvuSystem));
    } catch (err) {
      console.warn('[HypnoOS] 读取 MVU 系统时间失败，回退到聊天变量', err);
    }

    const { system } = normalizeChatVariables(getVariables(CHAT_OPTION));
    return await maybeSync(getSystemClockFrom(system));
  },

  getSessionEnd: async (): Promise<{ endVirtualMinutes: number | null; endAtMs: number | null }> => {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    const endVirtualMinutes =
      typeof store.sessionEndVirtualMinutes === 'number' && Number.isFinite(store.sessionEndVirtualMinutes)
        ? store.sessionEndVirtualMinutes
        : null;
    const endAtMs =
      typeof store.sessionEndAtMs === 'number' && Number.isFinite(store.sessionEndAtMs) ? store.sessionEndAtMs : null;
    return { endVirtualMinutes, endAtMs };
  },

  setSessionEnd: async ({
    endVirtualMinutes,
    endAtMs,
  }: {
    endVirtualMinutes: number | null;
    endAtMs: number | null;
  }) => {
    await updateStoreWith(store => {
      const next: PersistedStore = { ...store };
      if (endVirtualMinutes === null || !Number.isFinite(endVirtualMinutes)) delete next.sessionEndVirtualMinutes;
      else next.sessionEndVirtualMinutes = endVirtualMinutes;

      if (endAtMs === null || !Number.isFinite(endAtMs)) delete next.sessionEndAtMs;
      else next.sessionEndAtMs = endAtMs;

      return next;
    });
  },

  clearSessionEnd: async () => {
    await DataService.setSessionEnd({ endVirtualMinutes: null, endAtMs: null });
  },

  getSubscription: async (): Promise<SubscriptionState | null> => {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    return (store.subscription as SubscriptionState | undefined) ?? null;
  },

  setSubscriptionAutoRenew: async (autoRenew: boolean) => {
    await updateStoreWith(store => ({
      ...store,
      subscription: store.subscription ? { ...store.subscription, autoRenew } : store.subscription,
    }));
  },

  clearSubscription: async () => {
    await updateStoreWith(store => {
      const next: PersistedStore = { ...store };
      delete next.subscription;
      return next;
    });
    updateVariablesWith(vars => {
      const { system } = normalizeChatVariables(vars);
      if (system._催眠APP订阅等级 === SUBSCRIPTION_TIER_TRIAL_LABEL) return vars;
      system._催眠APP订阅等级 = SUBSCRIPTION_TIER_TRIAL_LABEL;
      vars.系统 = system;
      return vars;
    }, CHAT_OPTION);
    await MvuBridge.syncSubscriptionTier(SUBSCRIPTION_TIER_TRIAL_LABEL);
  },

  subscribeOrRenew: async ({
    tier,
    nowVirtualMinutes,
    extendFromExistingIfActive = true,
  }: {
    tier: SubscriptionTier;
    nowVirtualMinutes: number | null;
    extendFromExistingIfActive?: boolean;
  }): Promise<{ ok: boolean; message?: string; subscription?: SubscriptionState | null }> => {
    if (nowVirtualMinutes === null) return { ok: false, message: '无法读取当前日期/时间，无法计算订阅到期时间' };

    const price = SUBSCRIPTION_PRICES[tier];
    const user = await DataService.getUserData();
    if (user.money < price) return { ok: false, message: '零花钱不足' };

    const storeBefore = await updateStoreWith(s => s);
    const prev = storeBefore.subscription;
    const prevActive = Boolean(prev) && prev!.endVirtualMinutes > nowVirtualMinutes;

    const base =
      extendFromExistingIfActive && prevActive
        ? Math.max(nowVirtualMinutes, prev!.endVirtualMinutes)
        : nowVirtualMinutes;

    const nextSub: SubscriptionState = {
      tier,
      endVirtualMinutes: base + SUBSCRIPTION_WEEK_MINUTES,
      autoRenew: prev?.autoRenew ?? false,
    };

    await DataService.updateResources({
      money: user.money - price,
    });

    const next = await updateStoreWith(store => ({
      ...store,
      subscription: nextSub,
      // “角色状态可视化(vip1_stats)”购买/订阅成功一次后永久解锁，用于主屏幕显示“身体检测”APP。
      purchases: { ...store.purchases, vip1_stats: true },
    }));

    updateVariablesWith(vars => {
      const { system } = normalizeChatVariables(vars);
      if (system._催眠APP订阅等级 === tier) return vars;
      system._催眠APP订阅等级 = tier;
      vars.系统 = system;
      return vars;
    }, CHAT_OPTION);
    await MvuBridge.syncSubscriptionTier(tier);

    return { ok: true, subscription: (next.subscription as SubscriptionState | undefined) ?? null };
  },

  maybeAutoRenewSubscription: async (
    nowVirtualMinutes: number | null,
  ): Promise<{ renewed: boolean; message?: string }> => {
    if (nowVirtualMinutes === null) return { renewed: false };
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    const sub = store.subscription;
    if (!sub || !sub.autoRenew) return { renewed: false };
    if (sub.endVirtualMinutes > nowVirtualMinutes) return { renewed: false };

    const result = await DataService.subscribeOrRenew({
      tier: sub.tier,
      nowVirtualMinutes,
      extendFromExistingIfActive: false,
    });
    if (!result.ok) return { renewed: false, message: result.message };
    return { renewed: true };
  },

  getFeatures: async (): Promise<HypnosisFeature[]> => {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    return FEATURES.map(f => ({
      ...f,
      isEnabled: store.features?.[f.id]?.isEnabled ?? f.isEnabled,
      userNote: store.features?.[f.id]?.userNote ?? f.userNote,
      userNumber: store.features?.[f.id]?.userNumber ?? f.userNumber,
      purchaseRequired: isPurchaseRequired(f),
      purchasePricePoints: getPurchasePricePoints(f) ?? undefined,
      isPurchased: !isPurchaseRequired(f) || Boolean(store.purchases?.[f.id]),
    }));
  },

  purchaseFeature: async (id: string): Promise<{ ok: boolean; message?: string; user?: UserResources }> => {
    const feature = FEATURES.find(f => f.id === id);
    if (!feature) return { ok: false, message: '未知功能' };

    const price = getPurchasePricePoints(feature);
    if (price === null) return { ok: false, message: '该功能无需购买' };

    const storeBefore = await updateStoreWith(s => s);
    if (storeBefore.purchases?.[id]) return { ok: false, message: '已购买' };

    const user = await DataService.getUserData();
    if (user.mcPoints < price) return { ok: false, message: `MC点不足：需要 ${price} PT` };

    await updateStoreWith(store => ({ ...store, purchases: { ...store.purchases, [id]: true } }));
    const nextUser = await DataService.updateResources({
      mcPoints: user.mcPoints - price,
      totalConsumedMc: user.totalConsumedMc + price,
    });

    return { ok: true, user: nextUser };
  },

  getDebugEnabled: async (): Promise<boolean> => {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    return Boolean(store.debugEnabled);
  },

  setDebugEnabled: async (enabled: boolean) => {
    await updateStoreWith(store => ({ ...store, debugEnabled: enabled }));
  },

  updateResources: async (newData: Partial<UserResources>): Promise<UserResources> => {
    const merged: UserResources = { ...(await DataService.getUserData()), ...newData };
    updateVariablesWith(vars => {
      const { system, store } = normalizeChatVariables(vars);
      system._MC能量 = merged.mcEnergy;
      system._MC能量上限 = merged.mcEnergyMax;
      system.当前MC点 = merged.mcPoints;
      system._累计消耗MC点 = merged.totalConsumedMc;
      system.持有零花钱 = merged.money;
      system.主角可疑度 = merged.suspicion;
      system._hypnoos = store;
      vars.系统 = system;
      return vars;
    }, CHAT_OPTION);

    await MvuBridge.syncUserResources(merged);
    return merged;
  },

  startSession: async (payload: any): Promise<boolean> => {
    console.log('[Backend] Session Started:', payload);
    await updateStoreWith(store => ({ ...store, hasUsedHypnosis: true }));
    return true;
  },

  updateFeature: async (id: string, patch: { isEnabled?: boolean; userNote?: string; userNumber?: number }) => {
    await updateStoreWith(store => ({
      ...store,
      features: { ...store.features, [id]: { ...store.features[id], ...patch } },
    }));
  },

  resetFeatures: async () => {
    await updateStoreWith(store => {
      const preserved: PersistedStore['features'] = {};
      for (const [id, state] of Object.entries(store.features ?? {})) {
        if (!PERSISTENT_FEATURE_IDS.has(id)) continue;
        preserved[id] = state;
      }
      return { ...store, features: preserved };
    });
  },

  getAchievements: async (): Promise<Achievement[]> => {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    const dynamic = await buildRoleBasedAchievements(store);
    const all = [...STATIC_ACHIEVEMENTS, ...dynamic];
    return all.map(a => ({ ...a, isClaimed: store.achievements[a.id] ?? false }));
  },

  getQuests: async (): Promise<Quest[]> => {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    const claimed = store.quests ?? {};
    const tasks = (await MvuBridge.getTasks().catch(() => null)) ?? {};

    const quests = QUEST_DATABASE.map(q => {
      const locked = claimed[q.id] === 'CLAIMED';
      if (locked) {
        return {
          id: q.id,
          title: q.name,
          description: q.condition,
          rewardMcPoints: q.rewardMcPoints,
          status: 'CLAIMED' as QuestStatus,
        };
      }

      const taskState = (tasks as any)[q.name];
      const completed = Boolean(taskState && typeof taskState === 'object' && taskState.已完成 === true);
      const active = Boolean(taskState && typeof taskState === 'object' && typeof taskState.已完成 === 'boolean');
      return {
        id: q.id,
        title: q.name,
        description: q.condition,
        rewardMcPoints: q.rewardMcPoints,
        status: completed
          ? ('COMPLETED' as QuestStatus)
          : active
            ? ('ACTIVE' as QuestStatus)
            : ('AVAILABLE' as QuestStatus),
      };
    });

    const order: Record<QuestStatus, number> = { COMPLETED: 0, ACTIVE: 1, AVAILABLE: 2, CLAIMED: 3 };
    quests.sort((a, b) => order[a.status] - order[b.status]);
    return quests;
  },

  claimAchievement: async (id: string, currentPoints: number): Promise<{ success: boolean; newPoints: number }> => {
    const achievements = await DataService.getAchievements();
    const ach = achievements.find(a => a.id === id);
    if (!ach) return { success: false, newPoints: currentPoints };

    const store = await updateStoreWith(s => s);
    if (store.achievements[id]) return { success: false, newPoints: currentPoints };

    const user = await DataService.getUserData();
    if (!ach.checkCondition(user)) return { success: false, newPoints: currentPoints };

    const newPoints = currentPoints + ach.rewardMcPoints;
    await DataService.updateResources({ mcPoints: newPoints });
    await updateStoreWith(s => ({ ...s, achievements: { ...s.achievements, [id]: true } }));
    return { success: true, newPoints };
  },

  acceptQuest: async (id: string): Promise<{ success: boolean; message?: string }> => {
    const def = QUEST_DATABASE.find(q => q.id === id);
    if (!def) return { success: false, message: '未知任务' };
    if (def.name.includes('.')) return { success: false, message: '任务名不能包含“.”' };

    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    if (store.quests?.[def.id] === 'CLAIMED') return { success: false, message: '该任务已完成并锁定' };

    const tasks = await MvuBridge.getTasks();
    if (!tasks) return { success: false, message: 'MVU 未就绪，无法接取任务' };

    const activeTaskNames = Object.entries(tasks).filter(
      ([, v]) => v && typeof v === 'object' && typeof (v as any).已完成 === 'boolean',
    );
    if (activeTaskNames.length >= 3) return { success: false, message: '同时最多只能接取3个任务' };
    if ((tasks as any)[def.name]) return { success: false, message: '该任务已在进行中' };

    try {
      await MvuBridge.setTask(def.name, { 完成条件: def.condition, 已完成: false });
      const after = await MvuBridge.getTasks();
      if (!after || !(def.name in after)) {
        return { success: false, message: '接取失败：任务未写入 MVU（请确认 MVU schema 已包含“任务”）' };
      }
      return { success: true };
    } catch (err) {
      console.warn('[HypnoOS] 接取任务写入失败', err);
      return { success: false, message: '接取失败：写入 MVU 出错' };
    }
  },

  cancelQuest: async (id: string): Promise<{ success: boolean; message?: string }> => {
    const def = QUEST_DATABASE.find(q => q.id === id);
    if (!def) return { success: false, message: '未知任务' };
    if (def.name.includes('.')) return { success: false, message: '任务名不能包含“.”' };

    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    if (store.quests?.[def.id] === 'CLAIMED') return { success: false, message: '该任务已完成并锁定' };

    const tasks = await MvuBridge.getTasks();
    if (!tasks) return { success: false, message: 'MVU 未就绪，无法取消任务' };

    if (!(def.name in (tasks as any))) return { success: false, message: '该任务未在进行中' };

    try {
      await MvuBridge.deleteTask(def.name);
      const after = await MvuBridge.getTasks();
      if (after && def.name in after) return { success: false, message: '取消失败：任务未从 MVU 删除' };
      return { success: true };
    } catch (err) {
      console.warn('[HypnoOS] 取消任务失败', err);
      return { success: false, message: '取消失败：写入 MVU 出错' };
    }
  },

  claimQuest: async (id: string, currentPoints: number): Promise<{ success: boolean; newPoints: number }> => {
    const def = QUEST_DATABASE.find(q => q.id === id);
    if (!def) return { success: false, newPoints: currentPoints };
    if (def.name.includes('.')) return { success: false, newPoints: currentPoints };

    const tasks = await MvuBridge.getTasks();
    if (!tasks) return { success: false, newPoints: currentPoints };
    const taskState = (tasks as any)[def.name];
    if (!taskState || typeof taskState !== 'object' || taskState.已完成 !== true)
      return { success: false, newPoints: currentPoints };

    const newPoints = currentPoints + def.rewardMcPoints;
    await DataService.updateResources({ mcPoints: newPoints });
    await updateStoreWith(s => ({ ...s, quests: { ...s.quests, [id]: 'CLAIMED' } }));
    await MvuBridge.deleteTask(def.name);
    return { success: true, newPoints };
  },
};
