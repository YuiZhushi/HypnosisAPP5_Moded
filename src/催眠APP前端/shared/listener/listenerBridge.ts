/**
 * ListenerBridge — 酒館事件監聽統一管理
 *
 * 職責：
 * - 統一管理 eventOn / eventOff 的生命週期
 * - 在 pagehide 時自動清理所有監聽器
 * - 提供聊天變更時自動重載的工具
 *
 * 參考：日曆 bridge 模式
 */

import { logger } from '../debug/loggerService';

type ListenerDisposer = () => void;

const activeListeners: ListenerDisposer[] = [];

/**
 * 註冊事件監聽器，並自動納入清理管理
 */
export function registerListener(disposer: ListenerDisposer): void {
  activeListeners.push(disposer);
}

/**
 * 清理所有已註冊的監聽器
 */
export function disposeAllListeners(): void {
  logger.info(`清理 ${activeListeners.length} 个事件监听器`);
  while (activeListeners.length > 0) {
    try {
      activeListeners.pop()!();
    } catch (err) {
      logger.warn('清理监听器时出错', err);
    }
  }
}

/**
 * 自動在 pagehide 時清理所有監聽器
 * 應在 App 入口 $(() => { ... }) 中調用一次
 */
export function setupAutoCleanup(): void {
  $(window).on('pagehide', () => {
    disposeAllListeners();
  });
}

/**
 * 監聽聊天切換，觸發重載
 * 返回 disposer，呼叫端可手動取消
 */
export function reloadOnChatChange(): ListenerDisposer {
  let chatId = SillyTavern.getCurrentChatId();
  const handle = eventOn(tavern_events.CHAT_CHANGED, (newChatId: string) => {
    if (chatId !== newChatId) {
      chatId = newChatId;
      logger.info('聊天切换，正在重载...');
      window.location.reload();
    }
  });
  const disposer = typeof handle === 'function' ? handle : () => {};
  registerListener(disposer);
  return disposer;
}
