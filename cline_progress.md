# 任務進度暫存

## 任務
- 名稱：重構 dataService 與 hypnoAppUsecaseService
- 目標：優化依賴注入，解決過度封裝，移除 hypnoAppUsecaseService，達成純 Manager 架構，精簡 dataService。
- 開始時間：2026-04-21

## 待辦清單(重要細節不可缺失，可能遇見的問題要附上，步驟避免過於簡略)
- [x] 階段一：建立 Custom Hypnosis Manager (自訂催眠邏輯模組化)
  - [x] 詳細步驟 1-1：建立 `src/催眠APP前端/services/managers/customHypnosisManager.ts`。
  - [x] 詳細步驟 1-2：將 `hypnoAppUsecaseService.ts` 中的 `addCustomHypnosis` 與 `deleteCustomHypnosis` 邏輯遷移至此 Manager。
  - [x] 詳細步驟 1-3：將 `dataService.ts` 中直接匯出的自訂催眠相關函式整合進 Manager。
  - [x] 詳細步驟 1-4：更新 `dataService.ts`，改為呼叫 `customHypnosisManager`。
- [x] 階段二：簡化 Usecase 依賴注入 / 階段三：Usecase 職責重新分配
  - [x] 詳細步驟 2-1：將 `subscribeOrRenew`、`maybeAutoRenewSubscription`、`startSession` 移至 `resourceManager.ts`。
  - [x] 詳細步驟 2-2：將 `purchaseFeature` 移至 `featureManager.ts`。
  - [x] 詳細步驟 2-3：將 `claimAchievement`、`claimQuest` 移至 `achievementQuestManager.ts`。
  - [x] 詳細步驟 2-4：從 `dataService.ts` 移除 `createHypnoAppUsecaseService`。
  - [x] 詳細步驟 2-5：刪除 `hypnoAppUsecaseService.ts` 檔案。
- [x] 階段四：DataService 最終瘦身與檢查
  - [x] 詳細步驟 4-1：檢查 `dataService.ts` 內的匯出物件 `DataService`，確保所有方法都是簡單轉發。
  - [x] 詳細步驟 4-2：清理無用的 import 與型別定義。
  - [x] 詳細步驟 4-3：執行 `pnpm build:dev` 確認編譯無誤。

## 進行中
- 階段四：DataService 最終瘦身與檢查

## 已完成
- 階段一：建立 Custom Hypnosis Manager (自訂催眠邏輯模組化)
- 階段二：簡化 Usecase 依賴注入 / 階段三：Usecase 職責重新分配
- 階段四：DataService 最終瘦身與檢查

## 變更紀錄
- 2026-04-21 初始化檔案並建立待辦
- 2026-04-21 完成階段一：建立 Custom Hypnosis Manager
- 2026-04-21 完成階段二與階段三：移除 Usecase，改為 Manager
- 2026-04-21 完成階段四：DataService 瘦身並檢查編譯

## 風險與阻塞
- 可能遇到循環依賴或型別未定義錯誤。
- 遷移過程中確保邏輯正確。

## 用戶需要進行的檢查與確認
- 無
