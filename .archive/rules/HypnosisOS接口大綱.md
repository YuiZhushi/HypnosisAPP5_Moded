# HypnosisOS 接口大綱

本大綱列出了 HypnoOS 專案前端可用的關鍵接口。在新的領域驅動分層架構（Domain-Driven Layered Architecture）下，所有接口調用都必須遵守嚴格的層級限制。

> **⚠️ 核心規範提醒：**
>
> * **UI 層**（`ui/`）**絕對禁止**直接調用酒館助手的底層 API（如 `getVariables`）。
> * 所有資料的讀寫與持久化，必須透過 `backend/` 或 `shared/` 提供的 API 進行。

## 1. 底層 MVU 同步與橋接 (MvuBridge)

*路徑：`@src/催眠APP前端/shared/mvu/mvuBridge.ts`*

此模組負責與酒館的 MVU 變數框架進行安全通訊，並處理序列化寫入佇列。

* `MvuBridge.waitForMvuReady()`: 等待 MVU 框架初始化完成。
* `MvuBridge.getStatData()`: 獲取當前樓層的 MVU 狀態資料 (`stat_data`)。
* `MvuBridge.getSystem()` / `MvuBridge.getRoles()` / `MvuBridge.getTasks()`: 獲取特定領域的 MVU 資料。
* `MvuBridge.syncUserResources()`: 同步玩家資源（如 MC 能量、持有零花錢等）。
* `MvuBridge.syncPersistedStore()`: 同步私有持久化 Store（`系统._hypnoos`）。
* `MvuBridge.setTask()` / `MvuBridge.deleteTask()`: 更新或刪除任務狀態。
* `MvuBridge.appendThisTurnAppOperationLog()` / `MvuBridge.resetThisTurnAppOperationLog()`: 紀錄本輪 APP 操作日誌。
* `MvuBridge.getCalendarOps()` / `MvuBridge.clearCalendarOps()`: 獲取或清除日曆操作日誌。

## 2. 世界書交互 (WorldBookRepository)

*路徑：`@src/催眠APP前端/shared/worldbook/worldBookRepository.ts`*

所有與世界書相關的存取，必須透過此 Repository，避免直接依賴全域函數。

* `WorldBookRepository.getCurrentCharacterWorldbook()`: 取得當前角色卡的主世界書名稱。
* `WorldBookRepository.getEntries()`: 讀取指定世界書的所有條目。
* `WorldBookRepository.createEntries()`: 在指定世界書中建立新條目。
* `WorldBookRepository.updateEntries()`: 更新指定世界書中的條目。

## 3. 聊天訊息發送 (ChatTransport)

*路徑：`@src/催眠APP前端/shared/llm/chatTransport.ts`*

統一封裝發送訊息到酒館聊天的出口。

* `ChatTransport.sendChatMessage()`: 發送訊息到聊天並可選觸發 AI 回覆。
* `ChatTransport.setChatMessageContent()`: 修改指定樓層的訊息內容。

## 4. AI 請求管線 (AiRequestPipelineService)

*路徑：`@src/催眠APP前端/shared/ai/aiRequestPipelineService.ts`*

處理所有 AI 相關的生成、編輯與解析請求。

* `AiRequestPipelineService.sendRequest()`: 統一處理拼接、替換佔位符、發送請求與接收。
* `AiRequestPipelineService.composePrompt()`: 根據範本與變數組合提示詞。

## 5. 常見業務邏輯 (Backend Services)

*路徑：`@src/催眠APP前端/backend/{APP_NAME}/*`*

各 APP 專屬的業務邏輯接口，供 UI 層調用。

### 5.1 玩家資源與狀態

* `getUserData()` / `updateResources()`
* `getDebugEnabled()` / `setDebugEnabled()`
* `getSessionEnd()` / `setSessionEnd()`

### 5.2 催眠功能控制

* `getFeatures()` / `updateFeature()`
* `purchaseFeature()`
* `startSession()`

### 5.3 任務與成就

* `getAchievements()` / `claimAchievement()`
* `getQuests()` / `acceptQuest()` / `cancelQuest()` / `claimQuest()`

### 5.4 訂閱與權限

* `getSubscription()` / `isSubscriptionActive()`
* `canUseFeature()` / `canSubscribeTier()`

### 5.5 角色編輯器與 AST 解析

* `getEditorPromptModules()` / `saveEditorPromptModules()`
* `yamlToTree()` / `treeToYaml()` (AST 轉換)
* `buildDiffProposals()` / `applyApprovedProposals()`

## 提示詞使用方式

當你需要使用上述 API 時，請先確認你所在的層級（UI 或 Backend）。若是 UI 層，請優先尋找對應 `backend/` 提供的服務；若是 Backend 層，請透過 `shared/` 的橋接模組進行底層存取。
