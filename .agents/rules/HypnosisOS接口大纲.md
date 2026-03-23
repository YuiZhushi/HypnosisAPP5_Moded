---
trigger: always_on
---

# HypnosisOS 接口大纲

本大纲列出了催眠 APP 前端可用的关键接口。详细的参数说明与定义，请阅读 `@.agents/rules/sub_skills/HypnosisOS接口详细说明.md`。

## 1. 玩家资源与状态
- `DataService.getUserData()`
- `DataService.updateResources()`
- `DataService.getUnlocks()`
- `DataService.getDebugEnabled()` / `setDebugEnabled()`
- `DataService.getSystemClock()`
- `DataService.getSessionEnd()` / `setSessionEnd()` / `clearSessionEnd()`

## 2. 催眠功能控制
- `DataService.getFeatures()`
- `DataService.updateFeature()`
- `DataService.purchaseFeature()`
- `DataService.startSession()`
- `DataService.resetFeatures()`

## 3. 任务与成就
- `DataService.getAchievements()`
- `DataService.claimAchievement()`
- `DataService.getQuests()`
- `DataService.acceptQuest()` / `cancelQuest()` / `claimQuest()`
- `DataService.publishCustomQuest()` / `deleteCustomQuest()`

## 4. 订阅与权限
- `DataService.getSubscription()`
- `DataService.subscribeOrRenew()` / `maybeAutoRenewSubscription()`
- `DataService.setSubscriptionAutoRenew()` / `clearSubscription()`
- `DataService.isSubscriptionActive()`
- `DataService.canUseFeature()`
- `DataService.getSubscriptionTiers()`
- `DataService.getSubscriptionUnlockThreshold()` / `canSubscribeTier()`

## 5. 日历事件
- `DataService.getCalendarEvents()`
- `DataService.addCalendarEvent()`
- `DataService.updateCalendarEvent()`
- `DataService.deleteCalendarEvent()`
- `DataService.findCalendarEventByTitleAndDate()`

## 6. 底层 MVU 同步 (MvuBridge)
- `MvuBridge.getSystem()` / `getRoles()` / `getTasks()`
- `MvuBridge.syncUserResources()`
- `MvuBridge.syncPersistedStore()`
- `MvuBridge.syncSubscriptionTier()`
- `MvuBridge.setTask()` / `deleteTask()`
- `MvuBridge.appendThisTurnAppOperationLog()`
- `waitForMvuReady()`

## 7. 自定义催眠与 AI 设定
- `DataService.getCustomHypnosis()` / `addCustomHypnosis()` / `deleteCustomHypnosis()` / `calculateCustomHypnosisCost()`
- `DataService.getApiSettings()` / `updateApiSettings()` / `fetchAvailableModels()`

## 8. 角色编辑器与世界书服务
- `DataService.getEditorPrompts()` / `saveEditorPrompts()`
- `loadCharacter()` / `saveCharacter()` (from `characterDataService.ts`)
- `yamlToTree()` / `treeToYaml()` (from `characterDataService.ts`)
- `WorldBookService.checkAndEnsureEntry()`
- `WorldBookService.checkAndEnsurePlotEntry()`

## 9. 消息发送构造 (Prompts)
- `buildHypnosisSendMessage()` (from `hypnosisSend.ts`)
- `buildEditorPrompt()` / `sendEditorPrompt()` (from `characterEditorSend.ts`)

## 提示词使用方式
当你需要使用上述 API 时，請打開 `@.agents/rules/sub_skills/HypnosisOS接口详细说明.md` 文件來獲取詳細的參數定義與範例，藉此減少 token 消耗，精準尋找你要的接口。
