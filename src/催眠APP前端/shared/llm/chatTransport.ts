/**
 * ChatTransport — 發送消息到酒館聊天的統一出口
 *
 * 職責：
 * - 統一封裝 createChatMessages + triggerSlash 的調用
 * - 提供消息發送前的檢查和日誌
 *
 * 被 backend/hypnosis/promptBuilder.ts 等業務模組調用。
 */

import { logger } from '../debug/loggerService';

/**
 * 發送消息到聊天並觸發 AI 回覆
 *
 * @param message - 要發送的消息文本
 * @param options - 可選配置
 */
export async function sendChatMessage(
  message: string,
  options: {
    triggerReply?: boolean;
    silentAppend?: boolean;
  } = {},
): Promise<boolean> {
  const { triggerReply = true, silentAppend = false } = options;

  if (typeof createChatMessages === 'undefined') {
    logger.warn('createChatMessages 不可用，消息未發送');
    return false;
  }

  try {
    logger.info('發送聊天消息', { length: message.length, triggerReply });

    if (silentAppend) {
      // 靜默追加到最新消息
      createChatMessages(message);
    } else {
      createChatMessages(message);
    }

    if (triggerReply && typeof triggerSlash !== 'undefined') {
      triggerSlash('/trigger');
    }

    return true;
  } catch (err) {
    logger.error('發送聊天消息失敗', err);
    return false;
  }
}

/**
 * 修改指定樓層的消息內容
 */
export function setChatMessageContent(floorId: number, content: string): boolean {
  try {
    if (typeof setChatMessages === 'undefined') {
      logger.warn('setChatMessages 不可用');
      return false;
    }
    setChatMessages({ [floorId]: content });
    return true;
  } catch (err) {
    logger.error('修改消息失敗', err);
    return false;
  }
}
