---
name: app_develop
description: 當需要規劃或開發新的前端 APP 功能時，必須參考的注意事項與架構設計指南。
---

# app_or_function_develop

在開發 HypnoOS 的新桌面應用（APP）或新的功能模組時，為了保證代碼的健壯性和可維護性，請嚴格遵守以下基於 React + TailwindCSS 的**領域驅動分層架構 (Domain-Driven Layered Architecture)**。

## 1. 嚴格的分層架構 (Layered Architecture)

HypnoOS 採用嚴格的四層架構，各司其職，**嚴禁跨層逆向調用或在 UI 組件內寫死複雜的數據流邏輯**。

- **`constants/` (常數與資料層)**：集中管理各 APP 的大量常數、預置資料與 Zod Schemas。禁止在業務邏輯或 UI 檔案內自行宣告大量常設變數。
- **`shared/` (共用基礎設施層)**：存放多個 APP 重複使用的底層服務與橋接工具（如 `mvuBridge.ts`, `worldBookRepository.ts`, `aiRequestPipelineService.ts`, `chatTransport.ts`）。
- **`backend/` (後端業務邏輯層)**：處理各 APP 專屬的業務邏輯、狀態計算、資料持久化與傳輸。負責接收 UI 層的意圖（Intent）並處理。**嚴禁**直接操作 DOM 或 React UI 狀態。
- **`ui/` (前端 UI 層)**：負責畫面渲染（React Components）與使用者操作交互。**絕對禁止**直接調用酒館助手的底層 API（如 `getVariables`）或直接操作本地存儲。只能依賴 `shared/` 與 `constants/`，並呼叫 `backend/` 提供的 API。

**依賴方向**：`ui` -> `backend` -> `shared` -> `constants`

## 2. 數據處理與持久化邏輯

在規劃新 APP 前，必須明確數據的讀寫來源與存儲方式：

- **存儲落點明確**：區分 Runtime 變數、聊天變數 (Chat Variables) 與 MVU 變數。
- **寫入規則**：所有對持久化 Store（如 `系統._hypnoos`）的寫入必須透過後端 API 完成，寫入後自動調用 `MvuBridge.syncPersistedStore(...)` 做 MVU 同步。
- **向後兼容與 Zod 校驗**：所有持久化資料必須透過 Zod 進行驗證與糾錯（優先使用 `z.coerce.number()`）。這能確保玩家讀取舊存檔時系統能自動補齊默認值。

## 3. MVU 交互與事件驅動

- **單一資料源**：統一通過 `MvuBridge` 維護狀態模型。
- **事件驅動刷新**：利用 `Mvu.events.VARIABLE_UPDATE_ENDED` 等事件作為 UI 重新拉取資料與刷新的觸發器，**嚴禁雙向綁定**。
- **自行解析變數**：若透過 `aiRequestPipelineService.ts` 自行生成 AI 輸出（不產生新消息樓層），APP 的 Backend 邏輯應負責解析回傳的 raw 值（如 JSON、YAML 或正則提取）。**只有當** AI 輸出包含需要執行的 MVU 宏指令（如 `<% setvar(...) %>`）時，才需要手動調用 `Mvu.parseMessage` 處理，最後再透過 `MvuBridge` 或 `DataService` 將更新後的資料寫回。

## 4. UI 布局與 Iframe 限制

HypnoOS 是一個**嵌套在 iframe 中的偽手機系統**，UI 設計必須遵守硬性限制：

- **優先使用 TailwindCSS 原子類**，避免散落的全局 CSS。
- **絕對禁止使用 `vh` / `vw` 單位**：這會受宿主容器高度影響導致排版崩潰。請使用 `width` + `aspect-ratio` 或 Tailwind 的 `h-full w-full` 控制。
- **避免撐高容器**：避免使用會撐高外層容器的屬性，內部具體內容區塊使用 `overflow-y-auto`。
- **載入與卸載**：禁止使用 `DOMContentLoaded`，必須使用 jQuery 的 `$(() => { ... })`。清理工作必須使用 `pagehide` 事件，禁止使用 `'unload'`。

## 5. AI 生成與 API 整合 (Pipeline)

若新 APP 的功能包含利用 AI 進行內容生成，必須遵循「食材與食譜」模式：

1. **準備 (APP 層)**：在 `constants/` 或 `backend/` 準備專屬的提示詞模塊與模板。
2. **烹飪 (Shared 層)**：交由 `shared/ai/aiRequestPipelineService.ts` 統一處理拼接、替換佔位符、發送請求與接收。
3. **擺盤 (APP 層)**：各 APP 收到原始資料後，於 `backend/` 依照自己的格式需求進行解析與最終處理。

## 6. 新增功能前的「通用 / APP 專屬」判定（必做）

在新增功能前，必須先做一次功能歸類，避免後續重複實作與命名衝突。

- **通用功能（多 APP 共用）**：若兩個以上 APP 會使用到同一能力，優先放置於 `shared/` 或 `constants/`。
- **APP 專屬功能**：若邏輯明顯綁定某 APP 業務語義，則必須實作在該 APP 的 `backend/` 或 `ui/` 內部。

---

## ✅ 開發前審查清單 (Checklist)

1. [ ] **層級分離**：確認新增的檔案是否正確放置於 `ui/`, `backend/`, `shared/`, `constants/` 的對應位置？
2. [ ] **單向依賴**：確認 `ui/` 是否**沒有**直接調用底層酒館 API？確認 `shared/` 是否**沒有**依賴 `ui/`？
3. [ ] **持久化設計**：數據存儲是否明確定義為聊天變數或 MVU 變數？同步回寫機制（Zod 校驗）是否完善？
4. [ ] **適配 iframe 布局**：確認**沒有使用** `vh`/`vw` 單位？
5. [ ] **AI 整合完整度**：給 AI 的請求是否交由 `aiRequestPipelineService.ts` 統一處理？
6. [ ] **生命週期**：初始化與清理是否正確使用了 `$(() => {})` 與 `pagehide`？