/**
 * 用戶資源相關輔助函式（Phase D-2）
 * 
 * 這個函式原本在 dataService.ts 中，現已下沉至此模組喵~
 */

import type { UserResources } from '../../types';
import type { SystemWithStore } from '../store/systemSchema';

/**
 * 從系統變數轉換為用戶資源喵~
 */
export function systemToUserResources(system: SystemWithStore): UserResources {
  return {
    mcEnergy: system._MC能量,
    mcEnergyMax: system._MC能量上限,
    mcPoints: system.当前MC点,
    totalConsumedMc: system._累计消耗MC点,
    money: system.持有零花钱,
    suspicion: system.主角可疑度,
  };
}
