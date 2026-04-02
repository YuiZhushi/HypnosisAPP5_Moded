# 任務進度暫存

## 任務
- 名稱：資料一致性止血（移除假讀取寫入）
- 目標：確認並移除 `updateStoreWith(s => s)` 的多餘讀寫，改為純讀快照，降低非必要同步與競態風險。
- 開始時間：2026-04-02 21:45

## 待辦清單(重要細節不可缺失，可能遇見的問題要附上，步驟避免過於簡略)
- [x] 步驟 1：建立純讀 Store 快照入口
  - [x] 詳細步驟 1-1：新增 `readStoreSnapshot()`，只透過 `getVariables + normalize + parse` 取得 store
  - [x] 詳細步驟 1-2：確認純讀流程不觸發 `updateVariablesWith` 與 `MvuBridge.syncPersistedStore`
- [x] 步驟 2：替換多餘讀寫呼叫點
  - [x] 詳細步驟 2-1：`subscribeOrRenew()` 改用純讀快照
  - [x] 詳細步驟 2-2：`purchaseFeature()` 改用純讀快照
  - [x] 詳細步驟 2-3：`claimAchievement()` 改用純讀快照
- [x] 步驟 3：一致性驗證與收尾
  - [x] 詳細步驟 3-1：全文搜尋確認不再有 `updateStoreWith(s => s)`
  - [x] 詳細步驟 3-2：執行 `pnpm build:dev` 檢查型別/建置
  - [x] 詳細步驟 3-3：更新完成摘要與風險評估

## 進行中
- 目前處理：已完成，待使用者驗收

## 已完成
- 已新增 `readStoreSnapshot()` 作為純讀 store 入口，避免透過 `updateStoreWith(s => s)` 進行假讀取。
- 已將以下三處前置檢查改為純讀：`subscribeOrRenew()`、`purchaseFeature()`、`claimAchievement()`。
- 已搜尋確認 `src/催眠APP前端/services` 中不再存在 `updateStoreWith(s => s)`。
- 已執行 `pnpm build:dev`，建置與型別檢查通過。

## 變更紀錄
- 21:45 初始化新任務並清空舊進度，重建止血任務待辦
- 21:45 新增 `readStoreSnapshot()` 並替換 3 個誤用點
- 21:45 完成搜尋驗證與建置驗證，整理影響評估

## 風險與阻塞
- 風險：若既有流程隱性依賴「讀取時同步」，改為純讀後可能暴露時序假設問題（目前未觀察到建置層面問題）。
- 阻塞：無

=== 全部完成 ===
