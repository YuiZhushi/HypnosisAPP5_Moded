---
name: app_repair
description: 當有APP或功能需要修復或修補時使用，先閱讀完相關的原始碼與文件後，再開始修復。
---

# APP 修復專家 (App Repair Expert) Skill

本 Skill 指導如何在 HypnoOS（基於 React + TailwindCSS 的領域驅動分層架構 iframe 前端專案）中有效地診斷與修復各種前端 APP 錯誤，並規範開發行為。

## 適用場景

當使用者提出諸如：「這個 APP 的（某特定功能）壞了」、「解析（ESJ/字串）失效」、「UI 排版被遮擋」、「重新設計某個流程（如 AI 生成內容）」等需求時。

## 核心開發原則

1. **先觀察，後修改**：不要盲目覆寫檔案。先使用閱讀工具（`read`、`glob`、`grep`）全面理解原有代碼，特別是 `ui/`、`backend/` 與 `shared/` 之間的單向依賴邏輯。
2. **遵守架構層次**：確保 React 組件 (`ui/`) 只負責 UI 呈現與調度，**絕對禁止**直接調用酒館變量或底層 API。資料的讀寫必須透過 `backend/` 提供的服務，或 `shared/mvuBridge.ts` 封裝處理。
3. **安全更新與 Zod 驗證**：如果遇到資料結構變更，必須確保 Zod Schema 具備向下相容與糾錯能力（如 `z.coerce.number()`），確保舊有資料不會因此崩潰。
4. **驗證與診斷**：善用 `chrome-devtools` 的 Console / Network / Snapshot，並對致命錯誤加上拋出例外或以 `logger.error` 記錄（統一加上 `[HypnoOS]` 前綴）。
5. **先做通用/專屬判定**：修復或重構前，先評估功能是否可被多 APP 共用；可共用則放置於 `shared/` 或 `constants/`，不可共用才留在各 APP 的 `backend/` 內。
6. **事件驅動刷新**：修復畫面未更新的問題時，檢查是否正確訂閱了 `Mvu.events.VARIABLE_UPDATE_ENDED` 等事件作為 UI 重新拉取資料的觸發器，嚴禁雙向綁定。

## 診斷排查清單 (Diagnostic Checklist)

分析前端組件或功能卡關問題時，請針對以下幾點排查：

- [ ] **狀態同步問題（Hooks / State）**：出錯的功能，是否遺漏了 `useEffect` 的依賴？或是更改值後沒有呼叫 `backend/` API 去持久化？
- [ ] **資料流向與結構（Zod / Data）**：功能資料在 `constants/` 的 Zod 定義與現實情況有落差？若是從 MVU 讀取的資料，是否經過了正確的 `MvuBridge` 解析？
- [ ] **解析邏輯（Parsing Mechanism）**：若需處理 AI 回傳的文本，是否使用了 `shared/ai/aiRequestPipelineService.ts` 標準管線，並在 `backend/` 正確解析？
- [ ] **介面與排版（UI/Tailwind）**：如遇到排版崩潰，優先檢查是否誤用了 `vh` / `vw` 單位（應改用 `w-full h-full` 搭配 `aspect-ratio`）。如遇到選單被遮擋，檢查 `z-index` 與父層的 `relative` / `absolute`。
- [ ] **外部交互與生命週期**：是否誤用了 `DOMContentLoaded` 或 `'unload'`？在 iframe 中必須使用 `$(() => {})` 初始化與 `pagehide` 進行清理。

## 推薦的修復行動步驟 (Actionable Steps)

1. **確立場景**：先理清發生錯誤的源頭位於哪一層 (`ui/`, `backend/`, `shared/`, `constants/`)。
2. **分析與討論**：如果是複雜邏輯修改，建議在回答時先詳列你的新解析邏輯，確認後再下手。
3. **精準修復**：使用 `edit` 做最小修改，避免一次性大範圍重寫。
4. **必要驗證**：若有建置/型別風險，使用 `bash` 執行 `pnpm build:dev` 或其他非互動驗證。
5. **日誌規範**：統一使用 `@src/催眠APP共用/debug/loggerService.ts` 進行日誌輸出。

## 修復任務的通用/專屬與命名檢查（必做）

在執行任何修復前，請先完成以下檢查：

1. [ ] **功能分類**：此修復內容是否為多 APP 可共用功能？
2. [ ] **實作落點**：
   - 若是通用功能 → 實作於 `shared/` 或 `constants/`。
   - 若是 APP 專屬功能 → 實作於該 APP 的 `backend/` 或 `ui/`。
3. [ ] **依賴方向**：確認修改後仍符合 `ui` -> `backend` -> `shared` -> `constants` 的單向依賴，無循環引用。