# MCP 規則與使用指引

本文件說明在 HypnoOS 專案中，如何正確地使用 MCP（Model Context Protocol）工具與指令，特別是透過 `chrome-devtools` 進行開發與除錯的規範。

## 1. `chrome-devtools`：自行閱讀和操控酒館網頁

在開發與除錯過程中，你應該使用 `chrome-devtools` MCP 工具連接已打開的瀏覽器，從中讀取或操縱連接到的酒館網頁（SillyTavern）。

*   **網址配置**：網址應與 `.vscode/launch.json` 中配置的 `url` 一致。
*   **主要用途**：
    *   獲取當前的 DOM 結構與實際顯示情況。
    *   讀取 Console 錯誤與日誌。
    *   模擬點擊與操作介面，以驗證功能互動是否正常。

## 2. 檢查介面與腳本熱重載 (Hot Reload)

HypnoOS 專案支援即時的熱重載，大幅提升開發效率。

*   **確認監聽狀態**：打開網頁後，請檢查 `$('#extensions_settings')` 中的「酒館助手-實時監聽-允許監聽」開關是否處於**啟用**狀態。
*   **自動更新**：一旦啟用，介面與腳本程式碼到酒館網頁的即時同步即建立完成。程式碼變更後，酒館網頁將會自動熱重載新的腳本或介面。
*   **禁止手動建置**：在熱重載啟用的情況下，你**不需要**重新整理酒館網頁，也**不需要**自己執行 `pnpm build` 來更新打包結果，直接查看網頁即可。

## 3. 開發規範與限制

在使用 MCP 工具進行開發與除錯時，必須嚴格遵守 HypnoOS 的領域驅動分層架構（Domain-Driven Layered Architecture）：

*   **禁止直接操作 DOM**：雖然 `chrome-devtools` 允許直接操作 DOM，但在撰寫程式碼時，UI 的更新必須完全交由 **React** 處理。嚴禁在 `backend/` 或 `shared/` 層撰寫直接操作 DOM 或注入 HTML 的程式碼。
*   **通訊界線**：MCP 若涉及前端 UI 的渲染或資料更新，必須透過 `shared/` 介面層（如 `mvuBridge.ts`）來通訊。後端邏輯絕對不可直接操作 React 的內部狀態。
*   **廢棄 Vue/Pinia**：專案已全面轉向 React + TailwindCSS。在除錯或撰寫測試腳本時，請確保不再包含任何 Vue 或 Pinia 相關的生命週期、狀態注入或語法檢查。
