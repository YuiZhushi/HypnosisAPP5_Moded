---
trigger: model_decision
description: 当用户输入中明确提及 MVU 时, 你应该参考本文件
---

# HypnoOS 與 MVU 變量交互參考

> 本文件描述 HypnoOS 中每個 APP 如何與 MVU 變量交互，供開發時對照使用。

---

## 1. 架構總覽

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────────────┐
│  APP 組件層   │────▶│  DataService  │────▶│  MvuBridge (mvuBridge.ts) │
│  (*.tsx)     │     │              │     │                          │
│  LifeEvents  │     │  聊天變量讀寫  │     │  Mvu.getMvuData()        │
│  Operation   │     │  Store 持久化  │     │  Mvu.replaceMvuData()    │
│  Log         │     │  資源同步      │     │  Mvu.setMvuVariable()    │
└──────┬───────┘     └──────────────┘     └──────────────────────────┘
       │
       ▼ 訂閱事件
  Mvu.events.VARIABLE_INITIALIZED
  Mvu.events.VARIABLE_UPDATE_ENDED
```

**核心規則**：組件不直接調用 `Mvu.*`，而是通過 `DataService` → `MvuBridge` 鏈路讀寫數據。唯一例外是事件訂閱和操作日誌。

---

## 2. MvuBridge 方法清單

`services/mvuBridge.ts` 封裝了所有 MVU 底層操作：

| 方法 | 讀/寫 | MVU 路徑 | 調用者 |
|------|:---:|---------|--------|
| `getStatData()` | 讀 | `stat_data` 全部 | DataService |
| `getSystem()` | 讀 | `stat_data.系统` | DataService, CommonApps |
| `getRoles()` | 讀 | `stat_data.角色` | DataService, CommonApps |
| `getTasks()` | 讀 | `stat_data.任务` | DataService |
| `syncUserResources(user)` | 寫 | `系统._MC能量` 等 6 欄位 | DataService |
| `setTask(name, payload)` | 寫 | `任务.<name>` | DataService |
| `deleteTask(name)` | 寫 | `任务.<name>` (刪除) | DataService |
| `syncPersistedStore(store)` | 寫 | `系统._hypnoos` | DataService (via updateStoreWith) |
| `syncSubscriptionTier(label)` | 寫 | `系统._催眠APP订阅等级` | DataService |
| `resetThisTurnAppOperationLog()` | 寫 | `本轮APP操作` | index.tsx (初始化) |
| `appendThisTurnAppOperationLog(entry)` | 寫 | `本轮APP操作` | HypnosisApp |

**寫入隊列**：所有寫入通過 `enqueueMvuWrite()` 序列化，防止並發寫入衝突。

**比較後寫入**：`setIfChanged()` 會先比較新舊值，僅在值變化時才呼叫 `Mvu.setMvuVariable()` + `Mvu.replaceMvuData()`。

---

## 3. MVU 變量路徑映射

### 3.1 `stat_data.系统` — 用戶資源 + 系統狀態

| 變量路徑 | TypeScript 欄位 | 說明 | 讀寫方式 |
|---------|----------------|------|---------|
| `系统._MC能量` | `UserResources.mcEnergy` | MC 能量 | DataService.updateResources → syncUserResources |
| `系统._MC能量上限` | `UserResources.mcEnergyMax` | MC 能量上限 | 同上 |
| `系统.当前MC点` | `UserResources.mcPoints` | MC 點數 | 同上 |
| `系统._累计消耗MC点` | `UserResources.totalConsumedMc` | 累計消耗 | 同上 |
| `系统.持有零花钱` | `UserResources.money` | 零花錢 | 同上 |
| `系统.主角可疑度` | `UserResources.suspicion` | 可疑度 0-100 | 同上 |
| `系统._hypnoos` | `PersistedStore` | APP 私有 store | updateStoreWith → syncPersistedStore |
| `系统._催眠APP订阅等级` | string | 訂閱等級標籤 | syncSubscriptionTierLabel → syncSubscriptionTier |
| `系统.当前日期` | — | 日期文本 (N月N日) | getSystem() 讀取，CalendarApp 使用 |
| `系统.当前时间` | — | 時間文本 (HH:MM) | getSystem() 讀取，StatusBar 使用 |
| `系统.当前日程` | — | 日程文本 | CalendarApp 讀取顯示 |

### 3.2 `stat_data.角色` — 角色數據

| 變量路徑 | 說明 | 讀取者 |
|---------|------|--------|
| `角色.<名>.警戒度` | 警戒度 0-100 | BodyScanApp (進度條) |
| `角色.<名>.服从度` | 服從度 0-100 | BodyScanApp (進度條) |
| `角色.<名>.好感度` | 好感度 | BodyScanApp |
| `角色.<名>.性欲` | 性欲值 | BodyScanApp |
| `角色.<名>.快感值` | 快感值 | BodyScanApp |
| `角色.<名>.*敏感度` | 各部位敏感度 | BodyScanApp (分組展示) |
| `角色.<名>.*高潮次数` | 各部位高潮次數 | BodyScanApp (分組展示) |

> BodyScanApp 遍歷所有 `角色` 下的 key，按 `STAT_ORDER` 排序後分為進度條組、敏感度組、高潮次數組和其他。`_` 開頭的 key 被過濾。

### 3.3 `stat_data.任务` — 任務系統

| 變量路徑 | 說明 | 讀寫方式 |
|---------|------|---------|
| `任务.<任務名>` | `{ 完成条件: string, 已完成: boolean }` | setTask / deleteTask |

任務由 `questDb.ts` 定義，通過 DataService 的 `acceptQuest` / `cancelQuest` / `claimQuest` 管理。

### 3.4 `stat_data.本轮APP操作` — 操作日誌

| 變量路徑 | 默認值 | 說明 |
|---------|--------|------|
| `本轮APP操作` | `"无"` | 記錄本輪 APP 操作，供角色卡世界書讀取 |

---

## 4. 各 APP 的 MVU 交互方式

### 4.1 入口 `index.tsx`

| 時機 | 操作 |
|------|------|
| 掛載 | `waitForMvuReady()` 等待 MVU 初始化（5s 超時） |
| 掛載後 | `resetThisTurnAppOperationLog()` 重置操作日誌為 `"无"` |

### 4.2 主畫面 `App.tsx`

| MVU 交互 | 說明 |
|----------|------|
| 訂閱 `VARIABLE_INITIALIZED` | 刷新首頁時間 + 解鎖狀態 + 用戶數據 |
| 訂閱 `VARIABLE_UPDATE_ENDED` | 刷新首頁時間 + 解鎖狀態 |
| 通過 `DataService.getSystemClock()` | 讀取 `系统.当前日期` / `系统.当前时间` 顯示在桌面 |
| 通過 `DataService.getUnlocks()` | 判斷是否顯示「身體檢測」APP 圖標 |

### 4.3 催眠APP `HypnosisApp.tsx`

| MVU 交互 | 說明 |
|----------|------|
| `DataService.getUserData()` | 讀取用戶資源（優先從 MVU、降級到聊天變量） |
| `DataService.updateResources()` | 寫入資源變更 → `syncUserResources` |
| `DataService.getFeatures()` / `updateFeature()` | 讀寫 `_hypnoos.features` |
| `DataService.getSubscription()` / `subscribeOrRenew()` | 讀寫 `_hypnoos.subscription` + `_催眠APP订阅等级` |
| `DataService.getSystemClock()` | 讀取虛擬時間計算訂閱到期 |
| `appendThisTurnAppOperationLog()` | **直接調用 MvuBridge**：記錄訂閱、解鎖、購買、充值、催眠等操作 |

**操作日誌記錄內容包括**：
- `自动续订 VIP${tier}（-¥${price}）`
- `订阅 VIP${tier}（-¥${price}）`
- `解锁功能「${title}」（-${price} PT）`
- `购买能量 +${amount} MC（-¥${cost}）`
- `提升能量上限 +${amount}（-${amount} PT）`
- `充值点数 +${amount} PT（-¥${cost}）`
- 催眠開始信息

### 4.4 身體檢測 `BodyScanApp`（CommonApps.tsx）

| MVU 交互 | 說明 |
|----------|------|
| `MvuBridge.getRoles()` | **直接調用 MvuBridge**：讀取 `stat_data.角色` 顯示所有角色屬性 |
| 訂閱 `VARIABLE_INITIALIZED` | 自動刷新角色數據 |
| 訂閱 `VARIABLE_UPDATE_ENDED` | 自動刷新角色數據 |
| `DataService.getUnlocks()` | 判斷 VIP1 是否解鎖身體檢測 |

### 4.5 日曆 `CalendarDarkApp`（CommonApps.tsx）

| MVU 交互 | 說明 |
|----------|------|
| `MvuBridge.getSystem()` | **直接調用 MvuBridge**：讀取 `系统.当前日期` / `系统.当前日程` |
| 訂閱 `VARIABLE_INITIALIZED` | 自動更新日期高亮 |
| 訂閱 `VARIABLE_UPDATE_ENDED` | 自動更新日期高亮 |

### 4.6 成就中心 `AchievementApp.tsx`

| MVU 交互 | 說明 |
|----------|------|
| `DataService.getAchievements()` | 內部調用 `getRoles()` + `getSystem()` 動態生成成就列表 |
| `DataService.getQuests()` | 內部調用 `getTasks()` 讀取任務完成狀態 |
| `DataService.acceptQuest()` | 調用 `setTask()` 寫入 MVU 任務 |
| `DataService.cancelQuest()` | 調用 `deleteTask()` 刪除 MVU 任務 |
| `DataService.claimQuest()` | 調用 `deleteTask()` + `updateResources()` |
| `DataService.claimAchievement()` | 調用 `updateResources()` + `updateStoreWith()` |
| 訂閱 `VARIABLE_INITIALIZED` | 自動刷新成就/任務列表 |
| 訂閱 `VARIABLE_UPDATE_ENDED` | 自動刷新成就/任務列表 |

### 4.7 MC匿名版（App.tsx 快捷動作）

| MVU 交互 | 說明 |
|----------|------|
| 無直接 MVU 交互 | 透過 `getChatMessages` / `setChatMessages` 操作消息文本 |

### 4.8 幫助 / WIP

| MVU 交互 | 說明 |
|----------|------|
| 無 MVU 交互 | 純靜態界面 |

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

`DataService` 對數據採用**雙寫策略**：同時寫入聊天變量和 MVU 變量。

```
寫入流程：
1. updateVariablesWith(vars => { ... }, CHAT_OPTION)  // 寫入聊天變量
2. MvuBridge.sync*(...)                               // 寫入 MVU 變量

讀取流程（優先 MVU）：
1. 嘗試 MvuBridge.getSystem()
2. 失敗則降級到 getVariables(CHAT_OPTION)
```

關鍵方法 `updateStoreWith()` 是 store 持久化的核心：
1. 先用 `updateVariablesWith` 寫入聊天變量 `系统._hypnoos`
2. 再用 `MvuBridge.syncPersistedStore()` 同步到 MVU
