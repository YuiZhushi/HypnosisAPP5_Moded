import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { MvuBridge, waitForMvuReady } from './services/mvuBridge';

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
