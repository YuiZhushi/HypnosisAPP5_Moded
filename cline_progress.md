# 任務進度暫存

## 任務
- 名稱：重構執行計畫：終極解耦與模組化
- 目標：解決「God Object (characterDataService.ts)」、「依賴倒置 (dataService.ts)」與「邏輯分散 (Worldbook API 操作)」問題，將實作拆分為四個階段。
- 開始時間：2026-04-21

## 待辦清單
- [ ] 階段一：統一 Worldbook 存取層與抽象化 (Repository Pattern)
  - [x] 步驟 1-1：建立 Repository 層 (`worldBookRepository.ts`)
    - 封裝 `getCharWorldbookNames`、`getWorldbook`、`updateWorldbookWith` 等全域函數呼叫
    - 提供高階 API：`getCurrentCharacterWorldbook()`、`findEntryByName()` 等
  - [x] 步驟 1-2：重構 `worldBookService.ts`
    - 移除全域 API 呼叫，改用 `worldBookRepository`
    - 保留 `checkAndEnsureEntry` 等業務邏輯
  - [x] 步驟 1-3：重構 `characterDataService.ts` (部分)
    - 修改 `loadCharacter` 與 `saveCharacter`，改為呼叫 `worldBookRepository`
- [x] 階段二：拆解 God Object (`characterDataService.ts`)
  - [x] 步驟 2-1：抽離 AST 與 YAML 轉換器 (`astYamlHelper.ts`)
  - [x] 步驟 2-2：抽離 EJS 行為分支解析器 (`behaviorBranchHelper.ts`)
  - [x] 步驟 2-3：抽離預設模板與常數 (`characterDefaults.ts`)
  - [x] 步驟 2-4：瘦身 `characterDataService.ts`
- [x] 階段三：消除 `dataService.ts` 的依賴倒置與過度封裝
  - [x] 步驟 3-1：遷移核心資源邏輯 (`resourceManager.ts` 或 `systemCoreManager.ts`)
  - [x] 步驟 3-2：重構 Manager 的初始化
  - [x] 步驟 3-3：極致瘦身 `dataService.ts`
- [x] 階段四：重新命名與清理
  - [x] 步驟 4-1：簡化 AST 處理服務命名 (`aiPatchParser.ts`, `astDiffService.ts`, `astMergeService.ts`)
  - [x] 步驟 4-2：更新引用路徑 (components)
  - [x] 步驟 4-3：最終驗證 (`pnpm build:dev`)

## 進行中
- 無

## 已完成
- 階段一到四已全部完成。

## 變更紀錄
- 2026-04-21 初始化檔案並建立待辦

## 風險與阻塞
- 無

## 用戶需要進行的檢查與確認
- 確認重構後程式碼能通過編譯與基本功能測試

=== 全部完成 ===
