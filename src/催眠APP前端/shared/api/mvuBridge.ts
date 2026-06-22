/**
 * Mock MvuBridge - 用於純模擬模式下的 Tavern 就緒輪詢等待
 * 保留此函數旨在未來對接真實 Tavern 時具有擴展性，且在非 Tavern 環境下不會阻礙掛載。
 */

type WaitOptions = { timeoutMs?: number; pollMs?: number };

function isMvuDefined() {
  return typeof (globalThis as any).Mvu !== 'undefined';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      value => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      err => {
        globalThis.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function safeWaitGlobalInitialized(name: string, timeoutMs: number): Promise<void> {
  const maybeWait = (globalThis as any).waitGlobalInitialized;
  if (typeof maybeWait !== 'function') return;
  await withTimeout(Promise.resolve(maybeWait(name)), timeoutMs, `waitGlobalInitialized(${name})`);
}

export async function waitForMvuReady(options: WaitOptions = {}): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? 2500;
  const pollMs = options.pollMs ?? 100;

  if (isMvuDefined()) return true;

  const maybeWait = (globalThis as any).waitGlobalInitialized;
  if (typeof maybeWait !== 'function') return false;

  const deadline = Date.now() + Math.max(0, timeoutMs);
  while (Date.now() < deadline) {
    try {
      await safeWaitGlobalInitialized('Mvu', Math.min(pollMs, Math.max(0, deadline - Date.now())));
    } catch {
      /* ignore */
    }
    if (isMvuDefined()) return true;
    await new Promise<void>(resolve => globalThis.setTimeout(resolve, pollMs));
  }

  return isMvuDefined();
}
