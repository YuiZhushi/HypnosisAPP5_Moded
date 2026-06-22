---
name: script_write
description: 當需要編寫獨立腳本時，你應該參考本文件
---

# 腳本編寫

在 HypnoOS 專案中，除了主體的「前端介面」外，還有背景運行的獨立腳本。

- **`src/催眠APP腳本/`**：負責與 UI 無關的遊戲機制腳本（如每日結算、能量恢復）。
- **`src/催眠APP監聽/`**：背景腳本，負責監聽酒館關鍵事件（如訊息刪除、滑動），並橋接至聊天變數供 iframe 讀取。

這些腳本以無沙盒 iframe 的形式在酒館後台運行，沒有自己的獨立頁面，主要是代碼邏輯的執行。

## jQuery 的使用

腳本中的 jQuery 將直接作用於整個酒館頁面而非僅作用於腳本所在的 iframe，因為它是透過 `window.$ = window.parent.$` 得到的。例如 `$('body')` 將選擇酒館網頁的 `<body>` 標籤，而不是腳本所在 iframe 的 `<body>` 標籤。

## React 與 UI 渲染

若腳本需要向酒館網頁掛載額外的 UI 元素（例如懸浮窗或提示框）：

由於腳本運行在 iframe 中，當需要在腳本中向酒館頁面掛載 React 組件時，你應該使用 jQuery 來創建一個要掛載的位置，將其添加到酒館網頁上，並使用 `createRoot` 來掛載。

```tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';

$(() => {
  const $app = $('<div id="my-script-container"></div>').appendTo('body');
  const root = createRoot($app[0]);
  root.render(<App />);

  // 關閉腳本時卸載組件
  $(window).on('pagehide', () => {
    root.unmount();
    $app.remove();
  });
});
```

### 樣式與 TailwindCSS

由於腳本運行在 iframe 中，若直接將組件掛載到酒館網頁（父層 DOM），iframe 內的 TailwindCSS 樣式將無法直接生效。若需要隔離樣式或使用 TailwindCSS，建議將組件掛載於一個新建立的 iframe 內部：

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

這種情況應該**優先使用無須自行複製樣式的 TailwindCSS class**。若有需要複製的樣式，可以使用 `teleportStyle($app[0].contentDocument!.head)` 函數來複製樣式。

## 腳本變數與設置

如果需要為用戶提供自定義設置，可以使用聊天變數，並用 `zod` 來定義設置的類型和預設值。

## 註冊按鈕事件

腳本可以在酒館助手腳本庫介面中設置按鈕，用戶點擊按鈕時將會觸發對應的事件。

我們可以在代碼中這樣註冊按鈕事件：

```typescript
eventOn(getButtonEvent('按鈕名'), () => {
  logger.info('[HypnoOS] 按鈕被點擊了');
});
```