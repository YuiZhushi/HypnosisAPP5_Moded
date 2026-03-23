---
trigger: model_decision
description: 當需要查詢或使用HypnosisOS 接口時。
---

# HypnosisOS 接口詳細說明

這份文件記錄了 HypnosisAPP5_Moded 中，與催眠 APP 前端 MVU 的變數操作、資料持久化、權限判定相關的核心 API。
當你從 `HypnosisOS接口大纲.md` 找到需要的介面後，可以在此處查看詳細的型別與使用方法。

## 1. 核心資料結構 (`src/催眠APP前端/types.ts`)

### `UserResources` (玩家資源)
```ts
export interface UserResources {
  mcEnergy: number;         // MC能量
  mcEnergyMax: number;      // MC能量上限
  mcPoints: number;         // 目前 MC 點數
  totalConsumedMc: number;  // 累計消耗 MC 點數 (用於 VIP 等級解鎖)
  money: number;            // 持有零花錢 (Yen)
  suspicion: number;        // 主角可疑度 (0-100)
}
```

### `HypnosisFeature` (催眠功能)
```ts
export interface HypnosisFeature {
  id: string;
  title: string;
  description: string;
  tier: 'TRIAL' | 'VIP1' | 'VIP2' | 'VIP3' | 'VIP4' | 'VIP5' | 'VIP6';
  costType: 'PER_MINUTE' | 'ONE_TIME';
  costValue: number;
  isEnabled: boolean; // 是否啟用
  userNote?: string;  // 玩家自訂筆記
  userNumber?: number;// 玩家自訂數值
  isPurchased?: boolean;
  // ... 其他欄位
}
```

---

## 2. 核心持久化與業務層 (`src/催眠APP前端/services/dataService.ts`)

`DataService` 是組件層唯一應該互動的資料對象，包含以下靜態方法：

### 玩家資源與狀態控制
- `getUserData(): Promise<UserResources>`: 取得目前玩家的資源狀態。
- `updateResources(newData: Partial<UserResources>): Promise<UserResources>`: 更新玩家資源，這會自動觸發 MVU 同步寫入。
  ```ts
  // 範例：扣除零花錢
  const user = await DataService.getUserData();
  await DataService.updateResources({ money: user.money - 500 });
  ```
- `getSystemClock(): Promise<{ dateText?: string; timeText?: string; virtualMinutes: number | null }>`: 取得系統時間並轉換為虛擬分鐘數。
- `getSessionEnd()` / `setSessionEnd(...)` / `clearSessionEnd()`: 讀寫或清除催眠的虛擬與現實結束時間。
- `getDebugEnabled(): Promise<boolean>` / `setDebugEnabled(enabled: boolean)`: 取得 / 設定除錯模式狀態。
- `getUnlocks(): Promise<{ debugEnabled: boolean; bodyStatsUnlocked: boolean }>`: 取得基礎解鎖狀態（包含身體狀態可視化是否解鎖）。

### 催眠功能相關
- `getFeatures(): Promise<HypnosisFeature[]>`: 取得系統內所有的催眠功能清單（包含客製化催眠）。
- `updateFeature(id: string, patch: { isEnabled?: boolean; userNote?: string; userNumber?: number })`: 更新特定催眠功能的狀態。
- `purchaseFeature(id: string): Promise<{ ok: boolean; message?: string; user?: UserResources }>`: 購買催眠功能。
- `startSession(payload: any): Promise<boolean>`: 開始催眠流程。
- `resetFeatures()`: 重設所有催眠功能，僅保留設定中要求保留的部分 (`PERSISTENT_FEATURE_IDS`)。

### 訂閱與權限
- `getSubscriptionTiers(): readonly SubscriptionTier[]`: 取得系統預設的全部訂閱層級。
- `getSubscription(): Promise<SubscriptionState | null>`: 取得訂閱狀態。
- `subscribeOrRenew(...)`: 訂閱或手動續訂服務。
- `maybeAutoRenewSubscription(nowVirtualMinutes: number | null): Promise<{ renewed: boolean }>`: 確認訂閱並在必要時嘗試自動扣款續訂。
- `setSubscriptionAutoRenew(autoRenew: boolean)` / `clearSubscription()`: 設定是否自動續訂 / 強制解除訂閱並降級。
- `isSubscriptionActive(ctx: AccessContext): boolean`: 確認訂閱在此刻是否有效。
- `canUseFeature(feature: HypnosisFeature, ctx: AccessContext): boolean`: 判斷在當前權限下，是否能使用指定的催眠功能。

### 任務與成就
- `getAchievements(): Promise<Achievement[]>`: 取得成就清單與領取狀態。
- `claimAchievement(id: string, currentPoints: number)`: 領取成就獎勵。
- `getQuests(): Promise<Quest[]>`: 取得任務清單。
- `acceptQuest(id: string)` / `cancelQuest(id: string)` / `claimQuest(id: string, currentPoints: number)`: 接取/取消/領取任務。
- `publishCustomQuest(...)` / `deleteCustomQuest(...)`: 發布/刪除自訂任務。

### 日曆事件
- `getCalendarEvents(): CustomCalendarEvent[]`
- `addCalendarEvent(...)` / `updateCalendarEvent(...)` / `deleteCalendarEvent(...)`
- `findCalendarEventByTitleAndDate(title, month, day)`: 依據標題和日期找出既有事件（用於防止重複新增）。

### 自定義催眠與 API 設定
- `getCustomHypnosis(): CustomHypnosisDef[]`: 取得所有自定義催眠清單。
- `addCustomHypnosis(def)` / `deleteCustomHypnosis(id)`: 新增或刪除自訂催眠，會自動計算並扣除所需金錢。
- `calculateCustomHypnosisCost(tier, costType, costValue)`: 計算建立自訂催眠所需金錢。
- `getApiSettings()` / `updateApiSettings(patch)`: 取得 / 更新全域的 AI 介接設定 (API Key、模型、Temperature 等)。
- `fetchAvailableModels(endpoint, apiKey)`: 從指定的 endpoint 獲取可用模型清單。

### 角色編輯器用的提示詞
- `getEditorPrompts()` / `saveEditorPrompts(prompts)`: 讀取 / 儲存角色編輯器中的提示詞 (`characterEditorPrompts`)。

---

## 3. MVU 通訊橋梁 (`src/催眠APP前端/services/mvuBridge.ts`)

`MvuBridge` 用於處理與 MVU 變量框架的直接寫入同步，通常你不應該在組件中直接調用，而是透過 `DataService`。但如果是自訂行為或讀取底層，這非常有用：

- `MvuBridge.syncUserResources(user: UserResources)`: 同步 `UserResources` 到 MVU。
- `MvuBridge.getSystem(): Promise<Record<string, any> | null>`: 取得目前 MVU 上的 `系统` 變量。
- `MvuBridge.getRoles(): Promise<Record<string, any> | null>`: 取得目前 MVU 上的 `角色` 變量。
- `MvuBridge.getTasks(): Promise<Record<string, any> | null>`: 取得目前 MVU 上的 `任务` 變量。
- `MvuBridge.syncPersistedStore(store: unknown)`: 同步私有儲存 `_hypnoos`。
- `MvuBridge.syncSubscriptionTier(tier: string)`: 同步訂閱層級字串(`_催眠APP订阅等级`)。
- `MvuBridge.setTask(name, payload)` / `MvuBridge.deleteTask(name)`: 對 MVU 任務字典進行單項寫入或刪除。
- `MvuBridge.appendThisTurnAppOperationLog(entry: string)`: 追加寫入本回合的 APP 操作日誌。
- `waitForMvuReady()`: Promise 等待 MVU 框架載入完成。

---

## 4. 權限核心邏輯 (`src/催眠APP前端/services/access.ts`)

`access.ts` 封裝了純函數邏輯，不涉及 IO 讀寫。
- `getSubscriptionUnlockThreshold(tier: SubscriptionTier): number`: 獲取解鎖訂閱所需累計消耗的 MC 點數。
- `canSubscribeTier(ctx: { tier: SubscriptionTier; debugEnabled: boolean; totalConsumedMc: number })`: 判斷是否達到訂閱門檻。

---

## 5. 角色設定編輯器與世界書服務

處理酒館世界書與角色人設 Markdown/XML 的解析、更新。此部份不直接使用 MVU 變量字典，而是操縱世界書。

### `src/催眠APP前端/services/characterDataService.ts`
用於從世界書中讀取並解析角色的「人設」與「行為指導」XML 區段。
- `loadCharacter(charName: string): Promise<LoadResult>`: 讀取角色資料，將 YAML 轉為 `EditorNode[]` 給編輯器使用。
- `saveCharacter(charName, sectionData, rawFallbacks, entryUid): Promise<boolean>`: 將 `EditorNode[]` 轉回 YAML 並寫回角色世界書。
- `yamlToTree(obj)` / `treeToYaml(nodes)`: 負責 JS 物件與編輯器 `EditorNode` 樹狀結構的雙向轉換。

### `src/催眠APP前端/services/worldBookService.ts`
用於自動檢查與修補世界書條目。
- `WorldBookService.checkAndEnsureEntry(roleName)`: 檢查並補足 `[mvu_update]角色名变量` 世界書條目，確保變量能夠正確更新到酒館上下文。
- `WorldBookService.checkAndEnsurePlotEntry(roleName)`: 檢查並補足 `[mvu_plot]角色名人设` 條目，確保角色編輯器有預設的人設模板可以編輯。

---

## 6. 消息發送構造與調用 (Prompts)

封裝了構造發送給 AI 聊天文本的純函數。

### `src/催眠APP前端/prompts/hypnosisSend.ts`
- `buildHypnosisSendMessage({ features, durationMinutes, globalNote }): string`: 根據選擇的催眠功能、時長、全局備註，構造出 `<催眠发送>...</催眠发送>` 格式的完整提示詞字串。

### `src/催眠APP前端/prompts/characterEditorSend.ts`
- `buildEditorPrompt(params): string`: 根據角色名、目標分區、填入的具體資料等，構造出用來要求 AI 填寫或擴寫角色設定的提示詞字串。
- `sendEditorPrompt(prompt: string): Promise<boolean>`: 調用酒館助手的 `createChatMessages` 將前述提示詞以 user 身分靜默發送，並以 `triggerSlash('/trigger')` 驅動 AI 生成回覆。
