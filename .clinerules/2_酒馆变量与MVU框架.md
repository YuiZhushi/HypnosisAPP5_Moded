# HypnoOS 酒館變數與 MVU 框架規範

> **核心資料流提醒**：在開發期，所有變數系統主要基於模擬的 MVU 與 Chat 機制運作。在正式上線對接時，將切換為真實的酒館變數與 MVU 框架。

---

## 1. 變數生命週期與類型

開發時必須清楚區分以下三種變數的生命週期與適用場景：

1. **Runtime 變數**：僅存在於 iframe 記憶體中（如 React 組件的 `useState` 或一般變數），重新整理頁面即消失，無法持久化。
2. **聊天變數 (Chat Variables)**：綁定在某角色卡的單一聊天對話上。在對話內保持跨樓層通用，適合儲存全域狀態（如玩家資源、系統設定等）。
3. **MVU 變數 (Message Variables)**：綁定在特定的消息樓層上。在不同樓層、不同分支中獨立儲存，並自動繼承上一樓層的狀態。適合儲存與時間軸/劇情強相關的資料（如好感度、角色狀態、任務進度等）。

---

## 2. 開發期與真實期變數存取規範

### 2.1 開發期 (Mock 變數)
* **資料來源**：目前變數系統由 Mock 數據庫在記憶體中模擬維護。
* **讀寫限制**：UI 層不直接調用任何變數讀寫 API，而是**統一經由 MockAPI 進行資料的存取與修改**。

### 2.2 上線期/對接期 (真實變數與 MvuBridge)
當切換回真實酒館環境時，必須遵守以下存取規範：
* **禁止 UI 直接操作變數**：UI 層禁止調用 `getVariables`、`updateVariablesWith` 等酒館全局變數函數。
* **Backend 統一調配**：Backend 負責處理 UI 層的意圖，並調用 `shared/mvu/mvuBridge.ts` 封裝好的 API 進行讀寫。
* **寫入佇列 (Enqueue)**：`MvuBridge` 提供了序列化寫入佇列 (`enqueueMvuWrite`)，防止並發寫入導致的資料衝突。
* **Zod 驗證與糾錯**：所有寫入酒館變數的資料，必須通過 Zod Schema 驗證與糾錯（如 `z.coerce.number()`），自動補齊舊存檔缺失的欄位並填入預設值。

---

## 3. 持久化變數映射契約

為了確保資料結構的正確性，所有持久化變數（不論是模擬還是真實對接）均需遵守以下欄位對照：

### 3.1 用戶資源 (`UserResources`) -> 聊天變數 `系统`
* `mcEnergy` -> `系统._MC能量` (MC 當前能量)
* `mcEnergyMax` -> `系统._MC能量上限` (MC 能量上限)
* `mcPoints` -> `系统.当前MC点` (當前 MC 點數)
* `totalConsumedMc` -> `系统._累计消耗MC点` (累計消耗的 MC 點數)
* `money` -> `系统.持有零花钱` (玩家持有零花錢)
* `suspicion` -> `系统.主角可疑度` (主角可疑度)

### 3.2 私有持久化 Store (`系统._hypnoos` -> `PersistedStore`)
包含 `debugEnabled`, `sessionEndVirtualMinutes`, `sessionEndAtMs`, `subscription`, `features`, `achievements`, `quests` 等。
* **寫入規則**：所有對 store 的寫入必須透過後端 API 完成，寫入後自動調用 `MvuBridge.syncPersistedStore(...)` 做 MVU 同步。

---

## 4. 事件驅動與畫面刷新 (真實期)

真實環境下的 MVU 框架提供了事件機制，作為 UI 重新拉取資料與刷新的觸發器：

### 4.1 `VARIABLE_UPDATE_ENDED` (變數更新結束)
* **React UI 刷新**：UI 組件訂閱此事件。當事件觸發時，呼叫 Backend API 重新拉取最新資料並觸發 React 重新渲染。嚴禁在事件回呼中直接操作 DOM。
* **變數攔截與修正**：可以在此事件中獲取更新前後的變數，進行攔截處理。

### 4.2 `COMMAND_PARSED` (更新命令解析完成)
* 用於在變數更新命令實際執行前，攔截並修復 AI 輸出的格式錯誤（如多餘的符號）。

---

## 5. 自行解析 AI 宏指令 (真實期)

當使用 AI 請求管線生成輸出，且輸出中包含需要執行的 MVU 宏指令（如 `<% setvar(...) %>`）時，由於不會產生新消息樓層，MVU 不會自動解析。
* **處理流程**：APP 的 Backend 邏輯在收到 AI 回傳的 raw 內容時，需手動調用 `Mvu.parseMessage` 解析該內容，再透過 `MvuBridge` 將更新後的變數寫回當前樓層。
