---
name: app_repair
description: 當有APP或功能需要修復或修補時使用，先閱讀完相關的原始碼與文件後，再開始修復。
---

# APP 修復專家 (App Repair Expert) Skill

本 Skill 指導如何在 HypnosisOS（基於 React + TailwindCSS 的 iframe 前端專案）中有效地診斷與修復各種前端 APP 錯誤，並規範開發行為。

## 適用場景

當使用者提出諸如：「這個 APP 的（某特定功能）壞了」、「解析（ESJ/字串）失效」、「UI 排版被遮擋」、「重新設計某個流程（如 AI 生成內容）」等需求時。

## 核心開發原則

1. **先觀察，後修改**：不要盲目覆寫檔案。先使用閱讀工具（`read_file`、`search_files`、`list_code_definition_names`）全面理解原有代碼，尤其是組件與 Service 間的互動邏輯。
2. **遵守架構層次**：確保 React 組件只負責 UI 呈現與調度，資料的讀寫（如對接酒館變量或 MVU）必須透過 `DataService` 等服務層封裝處理。
3. **安全更新（重構/替換）**：如果遇到如文字解析流程（Regex、YAML 轉換）大改，建議先把測試情境或者各種 Edge Case 寫下，在程式碼內小心抽換邏輯，確保舊有資料不會因此崩潰。
4. **驗證與診斷**：善用 `chrome-devtools` 的 Console / Network / Snapshot，並對致命錯誤加上拋出例外或以 `console.warn / error` 記錄。
5. **先做通用/專屬判定**：修復或重構前，先評估功能是否可被多 APP 共用；可共用則抽通用組件/服務，不可共用才留在 APP 內。
6. **命名必須可辨識作用域**：通用能力與 APP 專屬能力要用不同命名策略，避免與其他 APP 的同類功能混淆。
7. **持久化命名需標明歸屬**：若修復涉及持久化，鍵名與方法名必須標明 `shared/common` 或 APP 歸屬，避免與既有服務衝突。
8. **注釋必須完整**：進行任何修改或新增功能時，必須在程式碼內加入完整的注釋，說明修改的原因、目的、影響範圍等。

## 診斷排查清單 (Diagnostic Checklist)

分析前端組件或功能卡關問題時，請針對以下幾點排查：

- [ ] **狀態同步問題（Hooks / State）**：出錯的功能，是否遺漏了 `useEffect` 的依賴？或是更改值沒有即時呼叫 Service 去持久化？
- [ ] **資料流向與結構（Zod / Data）**：功能資料在 `types.ts` 和 `dataService.ts` 的定義與現實情況有落差？如果是字串、列表、物件轉換過程錯誤，是否有加入妥善的回退機制（Fallback）？
- [ ] **解析邏輯（Parsing Mechanism）**：若需處理 YAML 或自訂文本（如 `<角色名字人设>` 的 ESJ 解析），是否處理了首尾空白、區塊丟失、不完整標籤的防呆設計？
- [ ] **介面與排版（UI/Tailwind）**：如遇到「彈出選單 / 下拉選單被其他元素（例如 Textarea）遮住」，優先檢查 `z-index`、父層的相對定位（`relative` / `absolute`）避免疊加上下文 (Stacking Context) 錯誤。
- [ ] **外部交互（Prompt / API）**：AI 請求模塊如果變更了發送地點（例如「不要在酒館聊天室發送」），檢查提示詞構造函數是否用錯 API（如誤用 `createChatMessages` 需改為安靜的後台請求機制）。

## 推薦的修復行動步驟 (Actionable Steps)

1. **確立場景**：先理清發生錯誤的源頭 `components/...` 或 `services/...`。
2. **分析與討論**：如果是複雜邏輯修改（例如對各類別的轉換行為進行重點設計），建議在回答時先詳列你的新解析邏輯，確認後再下手。
3. **精準修復**：使用 `apply_patch` 做最小修改，避免一次性大範圍重寫。
4. **必要驗證**：若有建置/型別風險，使用 `execute_command` 執行 `pnpm build:dev` 或其他非互動驗證。
5. **清理除錯痕跡**：移除除錯用的 `console.log`，只保留關鍵的 `console.info`。

## 修復任務的通用/專屬與命名檢查（必做）

在執行任何修復前，請先完成以下檢查：

1. [ ] **功能分類**：此修復內容是否為多 APP 可共用功能？
2. [ ] **實作落點**：
   - 若是通用功能 → 實作於通用組件/服務層。
   - 若是 APP 專屬功能 → 實作於該 APP 內部。
3. [ ] **命名檢查**：
   - 通用：使用 `shared` / `common` / `os` 前綴。
   - APP 專屬：使用 `<appId>` 前綴（如 `settingsApp...`, `characterEditorApp...`）。
4. [ ] **持久化檢查**：
   - APP 專屬資料落於 `appData.<appId>.*` 或同等明確命名空間。
   - 寫入方法名可直接辨識歸屬，避免 `saveConfig`/`updateState` 等模糊命名。
