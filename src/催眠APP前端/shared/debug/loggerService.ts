/**
 * LoggerService — 分級調試訊息管理
 *
 * 提供三級日誌控制：
 * - 'all'     → 輸出所有 console.info/debug/warn/error
 * - 'verbose' → 輸出 console.info/warn/error（跳過 debug）
 * - 'brief'   → 只輸出 console.warn/error
 *
 * 使用方式：
 *   import { logger } from 'shared/debug/loggerService';
 *   logger.info('xxx');   // 受 logLevel 控制
 *   logger.debug('xxx');  // 受 logLevel 控制
 *   logger.warn('xxx');   // 始終輸出
 *   logger.error('xxx');  // 始終輸出
 */

export type LogLevel = 'all' | 'verbose' | 'brief';

let currentLevel: LogLevel = 'verbose';

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
  console.info(`[HypnoOS] 日志级别已设为: ${level}`);
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

const PREFIX = '[HypnoOS]';

export const logger = {
  debug: (...args: unknown[]) => {
    if (currentLevel === 'all') console.debug(PREFIX, ...args);
  },

  info: (...args: unknown[]) => {
    if (currentLevel === 'all' || currentLevel === 'verbose') console.info(PREFIX, ...args);
  },

  warn: (...args: unknown[]) => {
    console.warn(PREFIX, ...args);
  },

  error: (...args: unknown[]) => {
    console.error(PREFIX, ...args);
  },
};
