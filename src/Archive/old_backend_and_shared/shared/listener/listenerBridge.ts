/**
 * ListenerBridge — 外部腳本事件傳遞橋接層
 *
 * 設計背景：
 * - 酒館事件（如 CHAT_CHANGED、MESSAGE_RECEIVED 等）在 iframe 未載入時就會觸發
 * - 因此事件監聽由外部腳本完成，外部腳本透過聊天變量傳遞事件觸發狀態
 * - 本模組提供 iframe 內的 APP 查詢/訂閱/重置這些事件變量的能力
 *
 * 職責：
 * 1. 查詢指定事件是否已觸發，並讀取觸發時傳遞的額外值
 * 2. 供其他 APP 訂閱特定事件變量，當變量值變為 true 時通知 APP
 * 3. 重置事件傳遞變量（消費完成後清除觸發狀態）
 *
 * 事件變量存儲約定：
 *   聊天變量路徑：`系統._events.<eventId>.triggered` (boolean)
 *   附加值路徑：  `系統._events.<eventId>.payload`   (unknown)
 */

import { logger } from '../../../催眠APP共用/debug/loggerService';

// ====== 類型 ======

/** 事件狀態快照 */
export type EventState<T = unknown> = {
  triggered: boolean;
  payload: T | undefined;
};

/** 訂閱回調 */
export type EventSubscriptionCallback<T = unknown> = (payload: T | undefined) => void;

/** 訂閱句柄（用於取消訂閱） */
export type EventSubscription = {
  eventId: string;
  unsubscribe: () => void;
};

// ====== 配置 ======

const CHAT_OPTION = { type: 'chat' } as const;
const EVENTS_ROOT = '_events';
const DEFAULT_POLL_INTERVAL_MS = 1000;

// ====== 內部：訂閱管理 ======

type SubscriptionEntry = {
  eventId: string;
  callback: EventSubscriptionCallback<any>;
  lastTriggered: boolean;
};

const activeSubscriptions: Map<string, SubscriptionEntry[]> = new Map();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;

// ====== 公開 API ======

/**
 * 查詢指定事件是否已觸發，並讀取附加值
 */
export function queryEvent<T = unknown>(eventId: string): EventState<T> {
  try {
    const vars = getVariables(CHAT_OPTION);
    const eventsRoot = (vars?.系统 as Record<string, any>)?.[EVENTS_ROOT];
    const eventData = eventsRoot?.[eventId];

    if (!eventData || typeof eventData !== 'object') {
      return { triggered: false, payload: undefined };
    }

    return {
      triggered: Boolean(eventData.triggered),
      payload: eventData.payload as T | undefined,
    };
  } catch (err) {
    logger.warn(`查询事件 [${eventId}] 失败`, err);
    return { triggered: false, payload: undefined };
  }
}

/**
 * 重置指定事件的觸發狀態（消費後清除）
 */
export function resetEvent(eventId: string): void {
  try {
    updateVariablesWith((vars: Record<string, unknown>) => {
      const system = (vars.系统 ?? {}) as Record<string, any>;
      const eventsRoot = system[EVENTS_ROOT] ?? {};

      if (eventsRoot[eventId]) {
        eventsRoot[eventId] = {
          ...eventsRoot[eventId],
          triggered: false,
          payload: undefined,
        };
      }

      system[EVENTS_ROOT] = eventsRoot;
      vars.系统 = system;
      return vars;
    }, CHAT_OPTION);

    logger.debug(`事件 [${eventId}] 已重置`);
  } catch (err) {
    logger.warn(`重置事件 [${eventId}] 失败`, err);
  }
}

/**
 * 訂閱指定事件變量。
 * 當 `triggered` 從 false 變為 true 時，觸發回調並傳遞 payload。
 *
 * @returns EventSubscription 可用於取消訂閱
 */
export function subscribeEvent<T = unknown>(
  eventId: string,
  callback: EventSubscriptionCallback<T>,
): EventSubscription {
  const entry: SubscriptionEntry = {
    eventId,
    callback,
    lastTriggered: queryEvent(eventId).triggered,
  };

  const subs = activeSubscriptions.get(eventId) ?? [];
  subs.push(entry);
  activeSubscriptions.set(eventId, subs);

  // 確保輪詢已啟動
  ensurePolling();

  logger.debug(`已订阅事件 [${eventId}]，当前订阅数: ${subs.length}`);

  const unsubscribe = () => {
    const currentSubs = activeSubscriptions.get(eventId);
    if (currentSubs) {
      const idx = currentSubs.indexOf(entry);
      if (idx >= 0) currentSubs.splice(idx, 1);
      if (currentSubs.length === 0) activeSubscriptions.delete(eventId);
    }
    // 如果沒有任何訂閱，停止輪詢
    if (activeSubscriptions.size === 0) stopPolling();
  };

  return { eventId, unsubscribe };
}

/**
 * 批量查詢多個事件的觸發狀態
 */
export function queryEvents(eventIds: string[]): Record<string, EventState> {
  const result: Record<string, EventState> = {};
  for (const id of eventIds) {
    result[id] = queryEvent(id);
  }
  return result;
}

/**
 * 設定輪詢間隔（毫秒）
 */
export function setPollInterval(ms: number): void {
  pollIntervalMs = Math.max(200, ms);
  if (pollTimer !== null) {
    stopPolling();
    ensurePolling();
  }
}

/**
 * 取消所有訂閱並停止輪詢。
 * 應在 pagehide 時調用。
 */
export function disposeAll(): void {
  stopPolling();
  activeSubscriptions.clear();
  logger.info('所有事件订阅已清理');
}

/**
 * 設定自動清理（pagehide 時）
 * 應在 App 入口 $(() => { ... }) 中調用一次
 */
export function setupAutoCleanup(): void {
  $(window).on('pagehide', () => {
    disposeAll();
  });
}

// ====== 內部：輪詢邏輯 ======

function ensurePolling(): void {
  if (pollTimer !== null) return;
  pollTimer = setInterval(pollTick, pollIntervalMs);
  logger.debug(`事件轮询已启动，间隔 ${pollIntervalMs}ms`);
}

function stopPolling(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
    logger.debug('事件轮询已停止');
  }
}

function pollTick(): void {
  for (const [eventId, subs] of activeSubscriptions.entries()) {
    if (subs.length === 0) continue;

    const state = queryEvent(eventId);

    for (const entry of subs) {
      // 只在 false → true 的上升沿觸發回調
      if (state.triggered && !entry.lastTriggered) {
        try {
          entry.callback(state.payload);
        } catch (err) {
          logger.error(`事件 [${eventId}] 回调执行失败`, err);
        }
      }
      entry.lastTriggered = state.triggered;
    }
  }
}
