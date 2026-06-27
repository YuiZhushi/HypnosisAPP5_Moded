---
name: script_write
description: 當需要編寫獨立腳本時，你應該參考本文件
---

# script_write 技能指引

在 HypnoOS 專案中，除了前台的 UI 介面，還有背景運行的獨立腳本：
* **`src/催眠APP腳本/`**：處理與 UI 無關的後台遊戲機制（如每日結算、能量自動恢復）。
* **`src/催眠APP監聽/`**：背景腳本，負責監聽酒館的關鍵事件（如訊息刪除、滑動），並將其寫入聊天變數供前台 iframe 讀取。

這些腳本在酒館後台以 iframe 形式運行，無獨立頁面，以純邏輯執行為主。

---

## 1. jQuery 的全局作用域影響

腳本中的 jQuery 經由 `window.$ = window.parent.$` 引入，將會**作用於整個酒館宿主頁面**而非腳本所在的 iframe：
* 例如 `$('body')` 會選擇酒館網頁的 `<body>` 標籤，操作時必須極度小心，避免破壞宿主的 DOM 結構與影響效能。

---

## 2. React 與 UI 動態掛載

若腳本需要向酒館網頁掛載額外的懸浮窗或提示框：
* 使用 jQuery 在酒館網頁創建掛載節點，使用 React `createRoot` 掛載。
* **卸載機制**：在 `pagehide` 事件觸發時，必須將其安全 unmount 並移除 DOM 節點，防止記憶體洩漏。

```tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';

$(() => {
  // 創建並掛載到父頁面 body
  const $app = $('<div id="my-script-container"></div>').appendTo('body');
  const root = createRoot($app[0]);
  root.render(<App />);

  // 卸載清理
  $(window).on('pagehide', () => {
    root.unmount();
    $app.remove();
  });
});
```

### 樣式隔離 (Iframe 包裹)
若組件掛載於父 DOM，iframe 內的 Tailwind 樣式無法直接生效。若需要隔離樣式，建議使用 `createScriptIdIframe()` 掛載於獨立 iframe 中：

```tsx
import { createScriptIdIframe } from 'util/script';
import { createRoot } from 'react-dom/client';

$(() => {
  const $app = createScriptIdIframe().appendTo('body');
  const root = createRoot($app[0].contentDocument!.body);
  root.render(<App />);

  $(window).on('pagehide', () => {
    root.unmount();
    $app.remove();
  });
});
```
可以使用 `teleportStyle($app[0].contentDocument!.head)` 函數將樣式複製到 iframe 中。

---

## 3. 按鈕事件註冊 (真實對接期)

腳本若要在酒館助手的設置介面註冊按鈕事件，可使用 `eventOn` 與 `getButtonEvent`：

```typescript
eventOn(getButtonEvent('按鈕名'), () => {
  logger.info('[HypnoOS] 背景腳本按鈕被點擊');
});
```
