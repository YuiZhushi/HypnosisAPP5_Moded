# 任務進度暫存

## 任務
- 名稱：DataService 遷移狀態盤點與 Phase F 型別治理
- 目標：檢查目前 DataService 遷移狀況，列出完成與未完成部分，並繼續執行 Phase F 型別治理
- 開始時間：2026-04-16 18:31
- 完成時間：2026-04-16 18:46

## 待辦清單(重要細節不可缺失，可能遇見的問題要附上，步驟避免過於簡略)

- [x] 步驟 1：盤點 DataService 遷移現狀
  - [x] 閱讀 `任務指引/DataService方法遷移對照表.md`
  - [x] 閱讀 `任務指引/DataService拆檔實施計劃.md`
  - [x] 閱讀 `dataService.ts` 實際程式碼
  - [x] 盤點 `services/` 目錄結構
  - [x] 整理完成與未完成項目清單

- [x] 步驟 2：執行 Phase F 第二批型別治理（中風險）
  - [x] 詳細步驟 2-1：處理 `store/storeGateway.ts`
    - 細節 2-1-1：確認使用 `Record<string, unknown>` 已符合設計，無需修改
  - [x] 詳細步驟 2-2：處理 `mvuBridge.ts`
    - 細節 2-2-1：確認型別合理，依賴全域 `Mvu` 型別定義，無需修改

- [x] 步驟 3：執行 Phase F 第三批型別治理（高風險）
  - [x] 詳細步驟 3-1：處理 `worldBookService.ts`
    - 細節 3-1-1：移除不必要的型別斷言，使用 `WorldbookEntry` 型別

- [x] 步驟 4：更新相關文件以反映最新狀態
  - [x] 詳細步驟 4-1：更新 `DataService方法遷移對照表.md` 的 Phase F 進度
  - [x] 詳細步驟 4-2：更新 `DataService拆檔實施計劃.md` 的 Phase F 進度
  - [x] 詳細步驟 4-3：標記 Phase F 為已完成

- [x] 步驟 5：驗證編譯通過
  - [x] 執行 `pnpm build:dev` 確認無錯誤無警告

## 進行中
- 無，任務已完成

## 已完成
- 2026-04-16 18:31 完成步驟 1：DataService 遷移現狀盤點
- 2026-04-16 18:38 完成步驟 2：Phase F 第二批型別治理（中風險）
- 2026-04-16 18:39 完成步驟 3：Phase F 第三批型別治理（高風險）
- 2026-04-16 18:45 完成步驟 4：更新相關文件
- 2026-04-16 18:46 完成步驟 5：驗證編譯通過
- 2026-04-16 19:30 完成步驟 7：收斂 `store/systemSchema.ts` 的 `any` 型別
- 2026-04-16 19:46 完成步驟 8：收斂 `helpers/calendarCrudResolver.ts` 的 `any` 型別

## 變更紀錄
- 2026-04-16 18:31 初始化檔案並建立待辦
- 2026-04-16 18:31 完成步驟 1：DataService 遷移現狀盤點
- 2026-04-16 18:38 完成步驟 2-1：確認 `store/storeGateway.ts` 無需修改
- 2026-04-16 18:38 完成步驟 2-2：確認 `mvuBridge.ts` 無需修改
- 2026-04-16 18:39 完成步驟 3-1：修改 `worldBookService.ts` 移除不必要型別斷言
- 2026-04-16 18:40-18:45 完成步驟 4：更新兩份文件
- 2026-04-16 18:46 完成步驟 5：編譯驗證通過

## 風險與阻塞
- 無

## 用戶需要進行的檢查與確認
- 可檢視更新後的文件確認 Phase F 已完成

## 後續發現的遺漏（2026-04-16 19:13）

經過仔細比對程式碼與計畫，發現以下 `any` 型別：

**依賴外部 API（合理保留）**：
- `dataService.ts`：4 個 `any`（全域函式宣告）
- `helpers/mvuHelpers.ts`：6 個 `any`（外部依賴型別）
- `helpers/calendarEventImpl.ts`：5 個 `any`（外部依賴型別）
- `helpers/achievementQuestImpl.ts`：4 個 `any`（外部依賴型別）

**可收斂但低優先級（2026-04-16 19:46 全部完成）**：
- `store/systemSchema.ts`：1 個 `any` → ✅ 已改為 `& Record<string, unknown>`
- `helpers/calendarCrudResolver.ts`：3 個 `any` → ✅ 已使用 `CalendarCrudOp`、`CalendarCrudNode`、`CalendarResolvedState` 等型別

**處理方式**：
- 已更新兩份計畫文件，將 Phase F 狀態區分為：
  - ✅ 已完成（指定範圍）
  - ✅ 已確認合理（無需修改）
  - ✅ 已完成（低優先級）
  - ⚠️ 合理保留（依賴外部 API）

=== 全部完成 ===
