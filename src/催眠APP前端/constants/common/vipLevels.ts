/**
 * VIP 等級定義
 *
 * 定義 VIP 等級的解鎖門檻與顯示名稱。
 */

import type { VipTierConfig } from '../interfaces';

export const VIP_LEVELS: VipTierConfig[] = [
  { tier: 'TRIAL', unlockThreshold: 0, label: '试用区' },
  { tier: 'VIP1', unlockThreshold: 0, label: 'VIP 1 (基础)' },
  { tier: 'VIP2', unlockThreshold: 100, label: 'VIP 2 (进阶)' },
  { tier: 'VIP3', unlockThreshold: 250, label: 'VIP 3 (高阶)' },
  { tier: 'VIP4', unlockThreshold: 500, label: 'VIP 4 (深度)' },
  { tier: 'VIP5', unlockThreshold: 1000, label: 'VIP 5 (永久)' },
  { tier: 'VIP6', unlockThreshold: 2500, label: 'VIP 6 (完全控制)' },
];
