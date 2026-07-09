# MVU 變量框架規則

MVU (Model-View-Update) 變量框架是一個獨立的酒館助手腳本。它作用於**消息樓層變數**，允許在不同樓層、不同 Swipe 中獨立儲存資料，並自動繼承上一樓層的狀態。

在 HypnoOS 的 React + TailwindCSS 新架構中，MVU 的使用必須遵循嚴格的分層與單向資料流原則。

## 1. 架構分層與職責 (Model-View-Update)

* **Model (資料模型)**：定義於 `constants/` (Zod Schemas) 與 `shared/store/`。代表應用程式的唯一真相來源 (Single Source of Truth)。
* **View (畫面呈現)**：定義於 `ui/` (React Components)。純粹根據傳入的 Props 或取得的狀態來渲染畫面，**嚴禁雙向綁定 (Two-way Binding)** 直接修改 Model。
* **Update (狀態更新)**：定義於 `backend/` 業務邏輯層。接收來自 View 的動作 (Actions/Intents)，執行邏輯判斷後，透過 `shared/mvu/mvuBridge.ts` 來更新 Model。

## 2. 存取與同步規範

### 2.1 透過橋接層 (MvuBridge) 存取

所有對 MVU 變數的讀寫，**必須**透過 `@src/催眠APP前端/shared/mvu/mvuBridge.ts` 進行。

*   **初始化等待**：在任何存取前，`MvuBridge` 負責執行 `await waitGlobalInitialized('Mvu')` 等待 MVU 框架就緒。
*   **寫入佇列**：`MvuBridge` 封裝了序列化寫入佇列 (`enqueueMvuWrite`)，防止並發寫入導致的資料衝突。

### 2.2 Zod Schema 驗證

所有存入 MVU 的資料（`stat_data`）都必須經過 Zod 驗證與糾錯。

*   優先使用 `z.coerce.number()` 並配合 `z.transform` 進行自動糾錯（如 `_.clamp`）。
*   禁止將未體驗證的原始資料直接寫入 MVU。

## 3. 事件驅動與畫面刷新

MVU 框架提供了多種事件 (`Mvu.events.*`)，可用於監聽變數變化。

### 3.1 `VARIABLE_UPDATE_ENDED` (變數更新結束)

這是 UI 層感知底層資料變更的主要途徑，也是攔截並修正變數的最佳時機。

*   **React UI 刷新**：UI 組件可以訂閱此事件，當事件觸發時，呼叫 Backend API 重新拉取最新資料並觸發 React 重新渲染 (Re-render)。**嚴禁**在事件回呼中直接操作 DOM。
*   **攔截與修正 (Backend)**：可以獲取到更新前後的變數 (`new_variables`, `old_variables`)，藉此進行額外處理。例如：限制變動幅度、或在變數突破特定值時觸發事件。

```typescript
// 範例：攔截並限制依存度變動幅度不超過 3
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (new_variables, old_variables) => {
  const old_value = _.get(old_variables, 'stat_data.白娅.依存度');
  _.update(new_variables, 'stat_data.白娅.依存度', value => _.clamp(value, old_value - 3, old_value + 3));
});
```

### 3.2 `COMMAND_PARSED` (變數更新命令解析完成)

用於在命令實際執行前，獲取並修復 AI 輸出的格式錯誤。

```typescript
// 範例：修復 AI 輸出的錯誤符號
eventOn(Mvu.events.COMMAND_PARSED, commands => {
  commands.forEach(command => {
    command.args[0] = command.args[0].replaceAll('-', '');
  });
});
```

## 4. 自行解析變數 (Parse Message)

當透過 `shared/ai/aiRequestPipelineService.ts` 自行生成 AI 輸出時，由於不會產生新消息樓層，MVU 不會自動解析命令。APP 的 Backend 邏輯應負責解析回傳的 raw 值（如 JSON、YAML 或正則提取）。

**只有當** AI 輸出包含需要執行的 MVU 宏指令（如 `<% setvar(...) %>`）時，才需要手動調用 `Mvu.parseMessage` 來處理：

* **在 Backend 邏輯中**，手動調用 `Mvu.parseMessage` 處理包含宏指令的 AI 生成內容。
* **解析完成後**，透過 `MvuBridge` (或 `Mvu.replaceMvuData`) 將更新後的變數寫回當前樓層。

```typescript
// 範例：自行解析包含 MVU 宏指令的 AI 輸出
const old_data = Mvu.getMvuData({ type: 'message', message_id: getCurrentMessageId() });
const content = await generate({ user_input: '你好' }); // 假設 content 內含 <% setvar(...) %>
const new_data = await Mvu.parseMessage(content, old_data);
await Mvu.replaceMvuData(new_data, { type: 'message', message_id: getCurrentMessageId() });
```
