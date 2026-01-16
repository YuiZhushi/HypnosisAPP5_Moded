// Enum for application state (which app is open)
export enum AppMode {
  HOME = 'HOME',
  HYPNOSIS = 'HYPNOSIS',
  BODY_STATS = 'BODY_STATS',
  CALENDAR = 'CALENDAR',
  HELP = 'HELP',
  ACHIEVEMENTS = 'ACHIEVEMENTS', // Replaces Ghost/WIP
  WIP = 'WIP',
}

// User Resources Data Structure
export interface UserResources {
  mcEnergy: number;
  mcEnergyMax: number;
  mcPoints: number;
  totalConsumedMc: number; // Used for VIP progress
  money: number; // Yen
  suspicion: number; // 0-100
}

// Hypnosis Feature Definition
export interface HypnosisFeature {
  id: string;
  title: string;
  description: string; // Detail shown when expanded
  tier: 'TRIAL' | 'VIP1' | 'VIP2' | 'VIP3' | 'VIP4' | 'VIP5' | 'VIP6';
  costType: 'PER_MINUTE' | 'ONE_TIME';
  costValue: number;
  costCurrency?: 'MC_ENERGY' | 'MC_POINTS';
  notePlaceholder?: string;
  userNote?: string; // User input
  userNumber?: number; // Numeric input for some features
  isEnabled: boolean; // Toggle state
  purchaseRequired?: boolean; // Must be permanently purchased to use
  purchasePricePoints?: number; // Price in MC points for purchase
  isPurchased?: boolean; // Permanently purchased (or free to use)
}

// Achievement Data Structure
export interface Achievement {
  id: string;
  title: string;
  description: string;
  rewardMcPoints: number;
  isClaimed: boolean;
  // Function to check if unlocked based on current user stats
  // Returns true if the condition is met
  checkCondition: (user: UserResources) => boolean;
}

// Quest Data Structure
export type QuestStatus = 'AVAILABLE' | 'ACTIVE' | 'COMPLETED' | 'CLAIMED';

export interface Quest {
  id: string;
  title: string;
  description: string;
  rewardMcPoints: number;
  status: QuestStatus;
}

// Data payload for backend submission
export interface SessionStartPayload {
  startTime: number;
  durationMinutes: number;
  selectedFeatures: {
    id: string;
    note?: string;
  }[];
  globalNote: string;
}

// VIP Tier Config
export interface VipTierConfig {
  tier: string;
  unlockThreshold: number; // Total consumed MC required
  label: string;
}

export const VIP_LEVELS: VipTierConfig[] = [
  { tier: 'TRIAL', unlockThreshold: 0, label: '试用区' },
  { tier: 'VIP1', unlockThreshold: 0, label: 'VIP 1 (基础)' },
  { tier: 'VIP2', unlockThreshold: 100, label: 'VIP 2 (进阶)' },
  { tier: 'VIP3', unlockThreshold: 250, label: 'VIP 3 (高阶)' },
  { tier: 'VIP4', unlockThreshold: 500, label: 'VIP 4 (深度)' },
  { tier: 'VIP5', unlockThreshold: 1000, label: 'VIP 5 (永久)' },
  { tier: 'VIP6', unlockThreshold: 2500, label: 'VIP 6 (完全控制)' },
];
