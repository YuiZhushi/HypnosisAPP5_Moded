import React from 'react';
import ReactDOM from 'react-dom/client';
import { logger } from '../催眠APP共用/debug/loggerService';
import App from './App';
import './index.css';
import * as MvuBridge from './shared/mvu/mvuBridge';
import { waitForMvuReady } from './shared/mvu/mvuBridge';

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
    logger.info('前端入口初始化?');

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
