---
name: mvu_interaction_reference
description: 当用户输入中明确提及 MVU 时, 你应该参考本文件
---

# HypnoOS 與 MVU 變量交互參考

> 本文件為 **重要規範**，聚焦「架構、方法、規則、映射、交互方式、雙寫策略」；內容已對齊 `src/催眠APP前端/` 現況。

---

## 1. 架構總覽

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────────────┐
│  APP 組件層   │────▶│  DataService  │────▶│  MvuBridge (mvuBridge.ts) │
│  (*.tsx)     │     │              │     │                          │
│  App / Apps  │     │  聊天變量讀寫  │     │  Mvu.getMvuData()        │
│  (tsx)       │     │  Store 持久化  │     │  Mvu.replaceMvuData()    │
│              │     │  資源同步      │     │  Mvu.setMvuVariable()    │
└──────┬───────┘     └──────────────┘     └──────────────────────────┘
       │
       ▼ 訂閱事件
  Mvu.events.VARIABLE_INITIALIZED
  Mvu.events.VARIABLE_UPDATE_ENDED
```

**核心規則**：
1. 組件層優先透過 `DataService` 存取資料。
2. MVU 底層寫入由 `MvuBridge` 集中處理（含序列化隊列）。
3. 允許的直接橋接例外：
   - `Mvu.events.*` 事件訂閱
   - 只讀查詢（如 `getRoles/getSystem/getCalendarOps`）
   - 本輪操作日誌 `appendThisTurnAppOperationLog`

---

## 2. MvuBridge 方法清單

`services/mvuBridge.ts` 封裝了所有 MVU 底層操作：

| 方法                                   | 讀/寫 | MVU 路徑                 | 調用者                            |
| -------------------------------------- | :---: | ------------------------ | --------------------------------- |
| `getStatData()`                        |  讀   | `stat_data` 全部         | DataService                       |
| `getSystem()`                          |  讀   | `stat_data.系统`         | DataService, CommonApps           |
| `getRoles()`                           |  讀   | `stat_data.角色`         | DataService, CommonApps           |
| `getTasks()`                           |  讀   | `stat_data.任务`         | DataService                       |
| `getCalendarOps()`                     |  讀   | `stat_data.本轮日曆/日历操作` | CommonApps (日曆橋接)            |
| `syncUserResources(user)`              |  寫   | `系统._MC能量` 等 6 欄位 | DataService                       |
| `setTask(name, payload)`               |  寫   | `任务.<name>`            | DataService                       |
| `deleteTask(name)`                     |  寫   | `任务.<name>` (刪除)     | DataService                       |
| `syncPersistedStore(store)`            |  寫   | `系统._hypnoos`          | DataService (via updateStoreWith) |
| `syncSubscriptionTier(label)`          |  寫   | `系统._催眠APP订阅等级`  | DataService                       |
| `resetThisTurnAppOperationLog()`       |  寫   | `本轮APP操作`            | index.tsx (初始化)                |
| `appendThisTurnAppOperationLog(entry)` |  寫   | `本轮APP操作`            | HypnosisApp                       |
| `clearCalendarOps()`                   |  寫   | `本轮日曆/日历操作`      | CommonApps (橋接消耗後清空)       |

**寫入隊列**：所有寫入通過 `enqueueMvuWrite()` 序列化，防止並發寫入衝突。

**比較後寫入**：`setIfChanged()` 先比較新舊值，僅在變更時寫入；優先走 `Mvu.setMvuVariable`，最後再 `Mvu.replaceMvuData`。

**就緒檢查**：所有橋接入口最終依賴 `waitForMvuReady()`，MVU 不可用時返回 `null/false` 並走降級路徑。

---

## 3. MVU 變量路徑映射

### 3.1 `stat_data.系统` — 用戶資源 + 系統狀態

| 變量路徑                | TypeScript 欄位                 | 說明              | 讀寫方式                                         |
| ----------------------- | ------------------------------- | ----------------- | ------------------------------------------------ |
| `系统._MC能量`          | `UserResources.mcEnergy`        | MC 能量           | DataService.updateResources → syncUserResources  |
| `系统._MC能量上限`      | `UserResources.mcEnergyMax`     | MC 能量上限       | 同上                                             |
| `系统.当前MC点`         | `UserResources.mcPoints`        | MC 點數           | 同上                                             |
| `系统._累计消耗MC点`    | `UserResources.totalConsumedMc` | 累計消耗          | 同上                                             |
| `系统.持有零花钱`       | `UserResources.money`           | 零花錢            | 同上                                             |
| `系统.主角可疑度`       | `UserResources.suspicion`       | 可疑度 0-100      | 同上                                             |
| `系统._hypnoos`         | `PersistedStore`                | APP 私有 store    | updateStoreWith → syncPersistedStore             |
| `系统._催眠APP订阅等级` | string                          | 訂閱等級標籤      | syncSubscriptionTierLabel → syncSubscriptionTier |
| `系统.当前日期`         | —                               | 日期文本 (N月N日) | getSystem() 讀取，CalendarApp 使用               |
| `系统.当前时间`         | —                               | 時間文本 (HH:MM)  | getSystem() 讀取，StatusBar 使用                 |
| `系统.当前日程`         | —                               | 日程文本          | CalendarApp 讀取顯示                             |

### 3.2 `stat_data.角色` — 角色數據

| 變量路徑              | 說明           | 讀取者                 |
| --------------------- | -------------- | ---------------------- |
| `角色.<名>.警戒度`    | 警戒度 0-100   | BodyScanApp (進度條)   |
| `角色.<名>.服从度`    | 服從度 0-100   | BodyScanApp (進度條)   |
| `角色.<名>.好感度`    | 好感度         | BodyScanApp            |
| `角色.<名>.性欲`      | 性欲值         | BodyScanApp            |
| `角色.<名>.快感值`    | 快感值         | BodyScanApp            |
| `角色.<名>.*敏感度`   | 各部位敏感度   | BodyScanApp (分組展示) |
| `角色.<名>.*高潮次数` | 各部位高潮次數 | BodyScanApp (分組展示) |

> BodyScanApp 遍歷所有 `角色` 下的 key，按 `STAT_ORDER` 排序後分為進度條組、敏感度組、高潮次數組和其他。`_` 開頭的 key 被過濾。

### 3.3 `stat_data.任务` — 任務系統

| 變量路徑        | 說明                                    | 讀寫方式             |
| --------------- | --------------------------------------- | -------------------- |
| `任务.<任務名>` | `{ 完成条件: string, 已完成: boolean }` | setTask / deleteTask |

任務由 `questDb.ts` 定義，通過 DataService 的 `acceptQuest` / `cancelQuest` / `claimQuest` 管理。

### 3.4 `stat_data.本轮APP操作` — 操作日誌

| 變量路徑      | 默認值 | 說明                                  |
| ------------- | ------ | ------------------------------------- |
| `本轮APP操作` | `"无"` | 記錄本輪 APP 操作，供角色卡世界書讀取 |

### 3.5 `stat_data.本轮日曆操作 / 本轮日历操作` — 日曆橋接操作

| 變量路徑 | 內容 | 讀寫方式 |
| --- | --- | --- |
| `本轮日曆操作` / `本轮日历操作` | AI/橋接注入的日曆操作列表 | `getCalendarOps()` 讀取，處理後 `clearCalendarOps()` 清空 |

---

## 4. 各 APP 的 MVU 交互方式

### 4.1 入口 `index.tsx`

| 時機   | 操作                                                   |
| ------ | ------------------------------------------------------ |
| 掛載   | `waitForMvuReady()` 等待 MVU 初始化（5s 超時）         |
| 掛載後 | `resetThisTurnAppOperationLog()` 重置操作日誌為 `"无"` |

### 4.2 主畫面 `App.tsx`

| MVU 交互                            | 說明                                              |
| ----------------------------------- | ------------------------------------------------- |
| 訂閱 `VARIABLE_INITIALIZED`         | 刷新首頁時間 + 解鎖狀態 + 用戶數據                |
| 訂閱 `VARIABLE_UPDATE_ENDED`        | 刷新首頁時間 + 解鎖狀態                           |
| 通過 `DataService.getSystemClock()` | 讀取 `系统.当前日期` / `系统.当前时间` 顯示在桌面 |
| 通過 `DataService.getUnlocks()`     | 判斷是否顯示「身體檢測」APP 圖標                  |

### 4.3 催眠APP `HypnosisApp.tsx`

| MVU 交互                                               | 說明                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| `DataService.getUserData()`                            | 讀取用戶資源（優先從 MVU、降級到聊天變量）                     |
| `DataService.updateResources()`                        | 寫入資源變更 → `syncUserResources`                             |
| `DataService.getFeatures()` / `updateFeature()`        | 讀寫 `_hypnoos.features`                                       |
| `DataService.getSubscription()` / `subscribeOrRenew()` | 讀寫 `_hypnoos.subscription` + `_催眠APP订阅等级`              |
| `DataService.getSystemClock()`                         | 讀取虛擬時間計算訂閱到期                                       |
| `appendThisTurnAppOperationLog()`                      | **直接調用 MvuBridge**：記錄訂閱、解鎖、購買、充值、催眠等操作 |

**操作日誌記錄內容包括**：
- `自动续订 VIP${tier}（-¥${price}）`
- `订阅 VIP${tier}（-¥${price}）`
- `解锁功能「${title}」（-${price} PT）`
- `购买能量 +${amount} MC（-¥${cost}）`
- `提升能量上限 +${amount}（-${amount} PT）`
- `充值点数 +${amount} PT（-¥${cost}）`
- 催眠開始信息

### 4.4 身體檢測 `BodyScanApp`（CommonApps.tsx）

| MVU 交互                     | 說明                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| `MvuBridge.getRoles()`       | **直接調用 MvuBridge**：讀取 `stat_data.角色` 顯示所有角色屬性 |
| 訂閱 `VARIABLE_INITIALIZED`  | 自動刷新角色數據                                               |
| 訂閱 `VARIABLE_UPDATE_ENDED` | 自動刷新角色數據                                               |
| `DataService.getUnlocks()`   | 判斷 VIP1 是否解鎖身體檢測                                     |

### 4.5 日曆 `CalendarDarkApp`（CommonApps.tsx）

| MVU 交互                     | 說明                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| `MvuBridge.getSystem()`      | **直接調用 MvuBridge**：讀取 `系统.当前日期` / `系统.当前日程` |
| `MvuBridge.getCalendarOps()` | 讀取橋接日曆操作列表（新增/修改/刪除）                         |
| `MvuBridge.clearCalendarOps()` | 消耗橋接操作後清空                                             |
| 訂閱 `VARIABLE_INITIALIZED`  | 自動更新日期高亮                                               |
| 訂閱 `VARIABLE_UPDATE_ENDED` | 自動更新日期高亮                                               |

> 橋接操作真正落地由 `DataService.add/update/deleteCalendarEvent` 完成（仍遵守 DataService 主導資料寫入）。

### 4.6 成就中心 `AchievementApp.tsx`

| MVU 交互                         | 說明                                                   |
| -------------------------------- | ------------------------------------------------------ |
| `DataService.getAchievements()`  | 內部調用 `getRoles()` + `getSystem()` 動態生成成就列表 |
| `DataService.getQuests()`        | 內部調用 `getTasks()` 讀取任務完成狀態                 |
| `DataService.acceptQuest()`      | 調用 `setTask()` 寫入 MVU 任務                         |
| `DataService.cancelQuest()`      | 調用 `deleteTask()` 刪除 MVU 任務                      |
| `DataService.claimQuest()`       | 調用 `deleteTask()` + `updateResources()`              |
| `DataService.claimAchievement()` | 調用 `updateResources()` + `updateStoreWith()`         |
| 訂閱 `VARIABLE_INITIALIZED`      | 自動刷新成就/任務列表                                  |
| 訂閱 `VARIABLE_UPDATE_ENDED`     | 自動刷新成就/任務列表                                  |

### 4.7 MC匿名版（App.tsx 快捷動作）

| MVU 交互        | 說明                                                    |
| --------------- | ------------------------------------------------------- |
| 無直接 MVU 交互 | 透過 `getChatMessages` / `setChatMessages` 操作消息文本 |

### 4.8 幫助 / WIP

| MVU 交互    | 說明       |
| ----------- | ---------- |
| 無 MVU 交互 | 純靜態界面 |

### 4.9 角色編輯器 `CharacterEditorApp.tsx`

| MVU 交互 | 說明 |
| --- | --- |
| `MvuBridge.getRoles()` | 讀取角色清單或角色資料以支援編輯流程 |

---

## 5. 事件訂閱模式

所有需要即時響應 MVU 變量變化的組件，都遵循相同模式：

```tsx
useEffect(() => {
  let stops: Array<{ stop: () => void }> = [];
  void (async () => {
    const ready = await waitForMvuReady({ timeoutMs: 5000, pollMs: 150 });
    if (!ready) return;
    stops = [
      eventOn(Mvu.events.VARIABLE_INITIALIZED, () => refresh()),
      eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, () => refresh()),
    ];
  })();
  return () => stops.forEach(s => s.stop());
}, []);
```

**使用此模式的組件**：
- `App.tsx` — 首頁時間/解鎖/用戶數據
- `BodyScanApp` — 角色屬性
- `CalendarDarkApp` — 系統日期
- `AchievementApp` — 成就/任務列表

---

## 6. 數據落地雙寫策略

`DataService` 對關鍵資料採用**雙寫策略**：先寫聊天變量，再同步 MVU。

```
寫入流程：
1. updateVariablesWith(vars => { ... }, CHAT_OPTION)  // 寫入聊天變量
2. MvuBridge.sync*(...)                               // 寫入 MVU 變量

讀取流程（優先 MVU，失敗回退聊天變量）：
1. 嘗試 MvuBridge.getSystem()
2. 失敗則降級到 getVariables(CHAT_OPTION)
```

關鍵方法 `updateStoreWith()` 是 store 持久化的核心：
1. 先用 `updateVariablesWith` 寫入聊天變量 `系统._hypnoos`
2. 再用 `MvuBridge.syncPersistedStore()` 同步到 MVU

### 6.1 已確認的雙寫/同步入口

- `updateStoreWith(...)`：`系统._hypnoos`（含 features/subscription/quests/calendarCRUD 等）
- `updateResources(...)`：`系统` 六項資源 + `MvuBridge.syncUserResources`
- 訂閱等級：`syncSubscriptionTierLabel` / `subscribeOrRenew` / `clearSubscription` 會更新聊天變量並 `syncSubscriptionTier`

### 6.2 任務與日曆的同步特性

- 任務（`任务.*`）以 MVU 為主真相來源：
  - `acceptQuest/cancelQuest/claimQuest` 直接透過 `MvuBridge.setTask/deleteTask`
  - `store.quests` 主要記錄 `CLAIMED` 狀態
- 日曆採「聊天變量 store（calendarCRUD）為持久化主體 + MVU bridge ops 作事件輸入」：
  - App 啟動時 `processCalendarBridgeEventsOnLoad()` 消化 bridge 事件
  - UI 中可直接操作 `DataService.add/update/deleteCalendarEvent`

## 7. 變更時必查清單（嚴格）

- [ ] 是否先確認 `waitForMvuReady()` 失敗時的降級流程？
- [ ] 是否避免在組件中直接寫 `Mvu.*`（除事件訂閱/允許例外）？
- [ ] 是否沿用 `updateStoreWith` / `updateResources` 既有雙寫入口？
- [ ] 是否維持 `任务`、`本轮APP操作`、`本轮日曆/日历操作` 路徑相容？
- [ ] 新增 MVU 寫入時是否掛入 `enqueueMvuWrite()` 防並發衝突？
