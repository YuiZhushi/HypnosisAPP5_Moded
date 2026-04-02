# 任務進度暫存

## 任務
- 名稱：全專案（排除示例）Debug 訊息分級與硬編碼切換
- 目標：建立統一 Logger 分級機制，讓 debug 訊息可依等級（完整/詳細/簡略/發行版）顯示，並以硬編碼常數手動切換。
- 開始時間：2026-04-02 22:43

## 待辦清單(重要細節不可缺失，可能遇見的問題要附上，步驟避免過於簡略)
- [x] 步驟 1：建立共用 Logger 與分級規則（硬編碼切換）
  - [x] 詳細步驟 1-1：新增共用 logger 檔案，定義訊息類型與等級
  - [x] 詳細步驟 1-2：定義每個等級可顯示的類型與顯示內容（標題/詳細）
  - [x] 詳細步驟 1-3：提供 console 橋接，讓既有 console 訊息被統一分級處理
- [x] 步驟 2：套用到全專案正式程式（排除示例）
  - [x] 詳細步驟 2-1：在主要入口初始化 logger/console bridge
  - [x] 詳細步驟 2-2：關鍵模組改用具類型的 logger 呼叫（尤其生成流程）
  - [x] 詳細步驟 2-3：確認不改動示例與範例路徑
- [x] 步驟 3：驗證與收尾
  - [x] 詳細步驟 3-1：搜尋確認正式程式已套用分級機制
  - [x] 詳細步驟 3-2：執行 `pnpm build:dev` 驗證型別/建置
  - [x] 詳細步驟 3-3：整理風險與完成摘要

## 進行中
- 目前處理：已完成，待使用者驗收

## 已完成
- 已清空舊任務進度並建立本次任務框架。
- 已新增 `src/util/logger.ts`，提供統一訊息類型（runtime/logic/generation/error）與分級（full/detail/brief/release）控制，並以硬編碼常數 `LOG_LEVEL` 手動切換。
- 已在正式入口初始化 console bridge：`src/催眠APP前端/index.tsx`、`src/催眠APP脚本/index.ts`、`src/MChan/index.ts`，使既有 `console.*` 訊息納入統一分級顯示。
- 已在 `src/催眠APP前端/services/aiRequestPipelineService.ts` 將生成流程改為顯式分類 logger 呼叫（runtime / generation / error）。
- 已執行 `pnpm build:dev`，建置通過。

## 變更紀錄
- 22:43 初始化檔案並建立待辦
- 22:46 新增共用 logger 與分級規則，加入 console bridge
- 22:49 在正式入口套用 bridge（前端/腳本/MChan）
- 22:52 AI 生成管線改為分類 logger 呼叫
- 22:53 完成建置驗證與收尾整理

## 風險與阻塞
- 風險：bridge 會將歷史 `console.warn/error` 一律映射為 error 類型，若未來需更細分可再逐檔轉為顯式 `logLogic/logRuntime/...`。
- 阻塞：無

## 用戶需要進行的檢查與確認
- 待我完成後，請確認四種等級輸出是否符合你的閱讀偏好。

=== 全部完成 ===
