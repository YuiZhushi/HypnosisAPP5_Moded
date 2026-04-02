/**
 * 全專案統一 Logger：
 * - 以硬編碼常數手動切換等級（LOG_LEVEL）
 * - 支援訊息類型：runtime / logic / generation / error
 * - 支援舊有 console.* 呼叫橋接（installConsoleBridge）
 */

export type LogType = 'runtime' | 'logic' | 'generation' | 'error';
export type LogLevel = 'full' | 'detail' | 'brief' | 'release';

/**
 * 手動硬編碼切換等級：
 * - 'full'    : 顯示所有訊息（詳細）
 * - 'detail'  : 顯示 runtime/logic/generation/error（詳細）
 * - 'brief'   : 顯示關鍵 runtime/logic/error（僅標題）
 * - 'release' : 顯示 error 標題 + 關鍵 runtime 標題
 */
const LOG_LEVEL: LogLevel = 'detail';

type LogOptions = {
  key?: boolean;
  source?: string;
};

type BridgeOptions = {
  source?: string;
};

type ConsoleMethod = 'debug' | 'info' | 'log' | 'warn' | 'error';

const rawConsole = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

let bridgeInstalled = false;

function stringifyAny(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof Error) return input.message;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

function buildTitleFromArgs(args: unknown[]): string {
  if (args.length === 0) return '(empty log message)';
  const first = args[0];
  const text = stringifyAny(first);
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function shouldShow(type: LogType, key: boolean): { show: boolean; detail: boolean } {
  switch (LOG_LEVEL) {
    case 'full':
      return { show: true, detail: true };
    case 'detail':
      return { show: true, detail: true };
    case 'brief':
      if (type === 'generation') return { show: false, detail: false };
      if (type === 'error') return { show: true, detail: false };
      return key ? { show: true, detail: false } : { show: false, detail: false };
    case 'release':
      if (type === 'error') return { show: true, detail: false };
      if (type === 'runtime' && key) return { show: true, detail: false };
      return { show: false, detail: false };
    default:
      return { show: true, detail: true };
  }
}

function pickConsoleMethodByType(type: LogType): ConsoleMethod {
  if (type === 'error') return 'error';
  if (type === 'logic') return 'log';
  if (type === 'generation') return 'info';
  return 'info';
}

function emit(type: LogType, title: string, details: unknown[], options?: LogOptions) {
  const key = Boolean(options?.key);
  const { show, detail } = shouldShow(type, key);
  if (!show) return;

  const source = options?.source ?? 'APP';
  const prefix = `[HypnoOS][${source}][${type.toUpperCase()}]`;
  const method = rawConsole[pickConsoleMethodByType(type)];

  if (detail) {
    method(`${prefix} ${title}`, ...details);
    return;
  }

  method(`${prefix} ${title}`);
}

export function logRuntime(title: string, details: unknown[] = [], options?: LogOptions) {
  emit('runtime', title, details, options);
}

export function logLogic(title: string, details: unknown[] = [], options?: LogOptions) {
  emit('logic', title, details, options);
}

export function logGeneration(title: string, details: unknown[] = [], options?: LogOptions) {
  emit('generation', title, details, options);
}

export function logError(title: string, details: unknown[] = [], options?: LogOptions) {
  emit('error', title, details, options);
}

function mapConsoleMethodToType(method: ConsoleMethod): LogType {
  if (method === 'error' || method === 'warn') return 'error';
  if (method === 'log') return 'logic';
  return 'runtime';
}

/**
 * 將既有 console 訊息接入分級系統。
 * 注意：不使用批量腳本替換既有 console 呼叫，透過 bridge 降低改動風險。
 */
export function installConsoleBridge(options?: BridgeOptions) {
  if (bridgeInstalled) return;
  bridgeInstalled = true;

  const source = options?.source ?? 'APP';

  const install = (method: ConsoleMethod) => {
    const original = rawConsole[method];
    (console as any)[method] = (...args: unknown[]) => {
      const type = mapConsoleMethodToType(method);
      const title = buildTitleFromArgs(args);
      const key = method === 'warn' || method === 'error';

      const { show, detail } = shouldShow(type, key);
      if (!show) return;

      const prefix = `[HypnoOS][${source}][${type.toUpperCase()}]`;
      if (detail) {
        original(`${prefix} ${title}`, ...args.slice(1));
      } else {
        original(`${prefix} ${title}`);
      }
    };
  };

  install('debug');
  install('info');
  install('log');
  install('warn');
  install('error');
}
