import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { MvuBridge, waitForMvuReady } from './services/mvuBridge';
import { installConsoleBridge, logRuntime } from '../util/logger';

let root: ReactDOM.Root | undefined;

function mount() {
  const rootElement = document.getElementById('app');
  if (!rootElement) {
    throw new Error('Could not find #app element to mount to');
  }
  root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

function unmount() {
  root?.unmount();
  root = undefined;
}

$(() => {
  void (async () => {
    // 初始化統一分級 logger（硬編碼等級由 logger.ts 管理）
    installConsoleBridge({ source: 'HypnoFront' });
    logRuntime('前端入口初始化', [], { source: 'HypnoFront', key: true });

    try {
      await waitForMvuReady({ timeoutMs: 5000, pollMs: 150 });
    } catch {
      // ignore
    }
    void MvuBridge.resetThisTurnAppOperationLog();
    mount();
    $(window).on('pagehide', unmount);
  })();
});
