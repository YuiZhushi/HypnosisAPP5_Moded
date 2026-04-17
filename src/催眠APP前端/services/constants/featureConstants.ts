/**
 * 功能相關常數（Phase D-2）
 * 
 * 這個常數原本在 dataService.ts 中，現已下沉至此模組喵~
 */

/**
 * 重置功能時保留的功能 ID 集合喵~
 * 這些功能在重置後不會被清除
 */
export const PERSISTENT_FEATURE_IDS = new Set<string>([]);
