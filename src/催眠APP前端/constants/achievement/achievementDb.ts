/**
 * 成就資料庫
 *
 * 靜態成就定義（不依賴角色數據，只取決於玩家資源）
 * 動態成就（角色相關）在 backend/achievement/achievementLogic.ts 中運行時生成
 */

import type { Achievement, UserResources } from '../interfaces';

/** 靜態成就模板 */
export const STATIC_ACHIEVEMENTS: Array<Omit<Achievement, 'isClaimed'>> = [
  {
    id: 'ach_newbie',
    title: '初次接触',
    description: '累计消耗超过 10 点 MC 能量。',
    rewardMcPoints: 5,
    checkCondition: (u: UserResources) => u.totalConsumedMc >= 10,
  },
  {
    id: 'ach_vip2',
    title: '进阶会员',
    description: '解锁 VIP 2 权限 (累计消耗 100 MC)。',
    rewardMcPoints: 20,
    checkCondition: (u: UserResources) => u.totalConsumedMc >= 100,
  },
  {
    id: 'ach_rich',
    title: '资金充裕',
    description: '持有金钱超过 50,000 円。',
    rewardMcPoints: 10,
    checkCondition: (u: UserResources) => u.money >= 50000,
  },
  {
    id: 'ach_sus',
    title: '隐秘行动',
    description: '将可疑度控制在 5% 以下。',
    rewardMcPoints: 50,
    checkCondition: (u: UserResources) => u.suspicion <= 5,
  },
];

/** 動態成就閾值定義 */
export const ACHIEVEMENT_THRESHOLDS = {
  /** 可疑度門檻 */
  suspicion: [25, 50, 75, 100] as const,
  /** MC能量上限門檻 [門檻, 獎勵] */
  energyMax: [
    [100, 10],
    [300, 30],
    [1000, 50],
  ] as const,
  /** 敏感度門檻 */
  sensitivity: [200, 300, 400, 500] as const,
  /** 高潮次數門檻 */
  orgasm: [1, 5, 25, 100] as const,
  /** 百分比門檻（警戒/服從度） */
  percent: [25, 50, 75, 100] as const,
} as const;
