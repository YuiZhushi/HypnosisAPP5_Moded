# HypnosisOS 接口大綱

> **開發指南提醒**：目前專案處於開發期，UI 主要調用 MockAPI 接口。若需要切換回真實環境對接，可調用底層的 `MvuBridge` 或其他 Shared API。

---

## 1. 開發期 MockAPI 接口 (記憶體模擬)

在目前的開發期，所有的數據存取都應該經由 MockAPI（或對應的 Service）完成：

### 1.1 玩家資源與狀態
* `getMockUserData()`: 取得當前記憶體中的玩家數據與資源（MC 能量、零花錢、可疑度）。
* `updateMockResources(delta)`: 增減玩家資源。

### 1.2 催眠功能控制
* `getMockFeatures()`: 獲取所有催眠功能 (Feature) 列表及其購買/啟用狀態。
* `purchaseMockFeature(featureId)`: 購買特定的催眠功能。
* `updateMockFeature(featureId, data)`: 更新特定功能的啟用狀態或其他狀態。

### 1.3 任務與成就
* `getMockAchievements()`: 獲取成就列表與解鎖進度。
* `claimMockAchievement(id)`: 領取成就獎勵。
* `getMockQuests()`: 獲取任務列表（包含進行中、可接取、已完成任務）。
* `acceptMockQuest(id)` / `cancelMockQuest(id)` / `claimMockQuest(id)`: 任務狀態變更與結算。

### 1.4 角色編輯器與 AST
* `getMockEditorPromptModules()`: 取得角色編輯器的 Prompt 模組數據。
* `applyMockApprovedProposals(proposals)`: 套用 AI 修改建議，並同步更新至模擬的角色卡中。

---

## 2. 真實環境對接 API (酒館 / MVU)

當正式對接 SillyTavern 時，所有數據操作都必須通過 `shared/` 的各模組進行：

### 2.1 MvuBridge (底層 MVU 同步與寫入佇列)
*路徑：`@src/催眠APP前端/shared/mvu/mvuBridge.ts`*
* `MvuBridge.waitForMvuReady()`: 等待 MVU 框架初始化。
* `MvuBridge.getStatData()`: 獲取當前樓層的 MVU 狀態資料 (`stat_data`)。
* `MvuBridge.syncUserResources(resources)`: 將玩家資源同步回寫到聊天變數 `系统`。
* `MvuBridge.syncPersistedStore(store)`: 將私有持久化 Store 同步回寫到聊天變數 `系统._hypnoos`。
* `MvuBridge.setTask(taskId, taskState)`: 更新任務的狀態。

### 2.2 WorldBookRepository (世界書存取)
*路徑：`@src/催眠APP前端/shared/worldbook/worldBookRepository.ts`*
* `WorldBookRepository.getCurrentCharacterWorldbook()`: 取得當前角色卡的主世界書名稱。
* `WorldBookRepository.getEntries(worldbookName)`: 讀取指定世界書的所有條目。
* `WorldBookRepository.createEntries(worldbookName, entries)`: 在世界書中建立新條目。
* `WorldBookRepository.updateEntries(worldbookName, entries)`: 更新世界書中的條目。

### 2.3 ChatTransport (聊天訊息發送)
*路徑：`@src/催眠APP前端/shared/llm/chatTransport.ts`*
* `ChatTransport.sendChatMessage(content, triggerAi)`: 發送訊息到聊天並可選擇是否觸發 AI 回覆。
* `ChatTransport.setChatMessageContent(messageId, content)`: 修改指定樓層的訊息內容。

### 2.4 AiRequestPipelineService (AI 請求管線)
*路徑：`@src/催眠APP前端/shared/ai/aiRequestPipelineService.ts`*
* `AiRequestPipelineService.sendRequest(params)`: 統一處理提示詞拼接、替換佔位符、發送請求與接收，主要實作「食材與食譜」模式。
* `AiRequestPipelineService.composePrompt(template, variables)`: 根據範本與變數組合提示詞。
