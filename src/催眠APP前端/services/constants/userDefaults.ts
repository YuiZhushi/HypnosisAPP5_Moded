/**
 * 用戶資源預設值（Phase D-2）
 * 
 * 這個常數原本在 dataService.ts 中，現已下沉至此模組喵~
 */

import type { UserResources } from '../../types';

/**
 * 用戶資源的預設值喵~
 * 當系統變數中沒有對應欄位時，會使用這些預設值
 */
export const DEFAULT_USER_DATA: UserResources = {
  mcEnergy: 25,
  mcEnergyMax: 25,
  mcPoints: 25,
  totalConsumedMc: 0,
  money: 6000,
  suspicion: 0,
};
