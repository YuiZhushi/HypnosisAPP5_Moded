---
description: HypnosisOS APP 修復標準流程
---

# HypnosisOS APP 修復標準流程

當接收到修復 APP 錯誤或功能的任務時，請遵循以下步驟進行：

1. **理解任務與閱讀背景資料**
   - 閱讀提供的任務說明與錯誤報告（如 `任務指引/更新計劃.md`）。
   - 如果有原有的實作計畫，閱讀 `任務指引/implementation_plan.md` 等檔案，來理解 APP 的原始設計意圖與架構。

2. **收集與閱讀相關代碼**
   - 尋找該 APP 的主要入口點（通常在 `src/催眠APP前端/components/` 下的對應資料夾，例如 `CharacterEditorApp.tsx`）。
   - 尋找相關的資料處理服務（如 `src/催眠APP前端/services/dataService.ts` 或 `characterDataService.ts` 等）。
   - 尋找相關的型別定義（如 `src/催眠APP前端/types.ts`）。
   - 使用 `grep_search` 或 `list_dir` 確認是否還有其他依賴組件。

3. **分析錯誤與制定修復計畫**
   - 根據錯誤描述（例如：解析邏輯失敗、鍵值對無法填寫、UI 遮擋、AI 請求行為錯誤等），定位問題所在的程式碼片段。
   - 思考是否與 MVU 變數框架、酒館變量（`getVariables` / `replaceVariables`）、或是 React 狀態更新機制有關。
   - 先判定該能力是否為多 APP 共用：
     - 若可共用，規劃抽為通用組件/通用服務。
     - 若為 APP 專屬，規劃留在該 APP 內部實作。
   - 確保改動符合 `<RULE[項目說明.md]>` 中的架構約束（例如：組件層不直接操作底層變數、優先使用 TailwindCSS 等）。
   - 如果是複雜的邏輯問題（如重構提示詞模板或擴展 ESJ 解析邏輯），可先在計畫中列出實作邏輯。

4. **實作修復程式碼**
   - 大塊代碼使用 `multi_replace_file_content` 或 `replace_file_content` 進行精準修改。
   - 命名需可辨識作用域，避免混淆：
     - 通用能力：使用 `shared` / `common` / `os` 前綴。
     - APP 專屬能力：使用 `<appId>` 前綴（如 `settingsApp...`, `characterEditorApp...`）。
   - 若涉及持久化，鍵名與方法名需標明歸屬（`shared/common` 或 `appData.<appId>.*`）。
   - 嚴格遵守 TypeScript 型別與 Zod 驗證。
   - CSS 樣式問題優先使用 TailwindCSS 工具類解法（例如解決下拉選單被 textarea 遮住，可檢查 `z-index` 或 stacking context）。

5. **驗證與測試**
   - 若許可，透過 MCP 的 `chrome-devtools` 功能檢查酒館網頁上的熱重載結果。
   - 驗證畫面 Console 內是否無新的 `[HypnoOS]` 相關錯誤。
   - 確認修復的特定功能（如正常解析、UI 正常顯示與回饋）已達預期效果。

6. **總結與更新進度**
   - 當功能修復完成後，更新相關的 Markdown 工作清單（如 `任務指引/更新計劃.md`），標記該項目為已完成或從「工作中」移除。
   - 如果修復影響到了其他功能或結構，記得同步更新 `.md` 文件或通知使用者。

## 修復任務提交前檢查（新增）

- [ ] 已完成通用/APP 專屬判定，且實作落點正確。
- [ ] 方法名、型別名、狀態名已標明作用域，不會與其他 APP 同類功能混淆。
- [ ] 若有持久化寫入，鍵名與寫入方法名可直接辨識歸屬，未使用模糊命名。
