# HypnosisOS 通用 AI 發送/接收模組重構與增改計劃
> 目標：先完成一套「跨 APP 共用」的 AI 請求管線，再回頭修復人物資訊補全 APP（CharacterEditor）功能，避免各 APP 各自拼接提示詞導致規格漂移與高風險錯誤。
---
## 一、現況與核心問題（基於現有程式碼）
### 1) 目前 CharacterEditor 的 AI 發送路徑
- `components/CharacterEditor/CharacterEditorApp.tsx`
- 直接在 `submitAiFill()` 中：
- 挑選 `promptsDb[context]`
- 呼叫 `buildEditorPrompt(...)`
- 呼叫 `sendEditorPrompt(prompt)`
- `prompts/characterEditorSend.ts`
- `buildEditorPrompt()` 目前是「字串拼接 + 硬編碼 macro 取代」
- `sendEditorPrompt()` 透過 `createChatMessages + triggerSlash('/trigger')` 送到聊天室
### 2) 現況缺口
- 提示詞模板格式未結構化，難重用到其他 APP。
- placeholder 僅固定替換（`{{裝配角色名字}}` 等），玩家無法建立自訂 placeholder。
- `PromptManager` 只有 CharacterEditor context，沒有「跨 APP 命名空間」。
- 儲存層 `DataService.characterEditorPrompts` 只支援角色編輯器，無法隔離其他 APP。
- 無世界書備份機制（且你要求備份到「不發送」條目）。
- 回傳解析責任尚未抽象（要交由來源 APP 或共用服務處理尚未明確）。
---
## 二、重構目標與邊界
### 目標
1. 建立 **通用 AI Prompt Pipeline**（組裝、替換、發送、接收、解析入口）。
2. 建立 **結構化提示詞模組**（Block + Sort + Context + App Scope）。
3. 支援 **預設 placeholder + 玩家自訂 placeholder**。
4. 支援 **每個 APP 獨立模板庫**。
5. 支援 **備份到世界書「不發送條目」**。
### 非目標（本階段）
- 不一次重寫所有 APP UI；先做通用服務，CharacterEditor 先接入。
- 不先動 AI 模型連線協定（先沿用現有 createChatMessages 方案，預留非聊天室方案接口）。
---
## 三、目標架構（新分層）
###+ A. Domain Type（`types.ts` 擴充）
新增通用型別（示意）：
- `AiAppId = 'character_editor' | 'calendar' | 'custom_hypnosis' | ...`
- `PromptTemplateV2`
- `id/title/content/enabled/isSystem/tags?`
- `scope: 'global' | 'app' | 'context'`
- `PromptContextId`（如 `full_fill`, `sec_info`, `calendar_add_event`）
- `PlaceholderDefinition`
- `key`（例如 `角色名`）
- `source: 'built_in' | 'user' | 'worldbook' | 'runtime'`
- `resolverType`（`static` / `function`）
- `AiRequestSpec`
- `appId/contextId/mode/blocks/sortOrder/parserId/outputSchema?`
- `AiResponseEnvelope`
- `rawText/parsed/result/error/meta`
###+ B. Prompt Pipeline Service（新增 `services/aiPromptService.ts`）
核心職責：
1. `composeBlocks(...)`：依排序組裝 block。
2. `resolvePlaceholders(...)`：替換預設與玩家 placeholder。
3. `buildFinalPrompt(...)`：輸出最終可發送 payload（XML tag 仍可保留）。
4. `send(...)`：先封裝現有聊天室發送器，未來可切換非聊天室 transport。
5. `receiveAndParse(...)`：統一接收/解析入口（解析器可插拔）。
###+ C. Placeholder Registry（新增 `services/aiPlaceholderService.ts`）
- 內建 placeholder：
- `{{裝配角色名字}}`
- `{{當前狀態與內容}}`
- `{{玩家輸入}}`
- `{{分區名稱}}`、`{{APP名稱}}`（新增）
- 玩家自訂 placeholder：
- 例如 `{{我的世界觀規則}}` -> 某段文字
- 可設定 app-level 或 global-level
- 世界書引用 placeholder：
- `{{WI:條目名}}` 統一在這層解析
###+ D. Template Store（擴充 `DataService`）
把目前 `characterEditorPrompts` 升級為跨 APP 結構：
- `aiPromptProfiles: Record<AiAppId, Record<PromptContextId, PromptTemplateV2[]>>`
- `aiUserPlaceholders: Record<AiAppId | 'global', PlaceholderDefinition[]>`
- 保留舊欄位讀取相容（migration）
###+ E. WorldBook Backup Service（新增 `services/aiPromptBackupService.ts`）
- 專責備份/還原模板與 placeholder。
- 使用固定條目命名（建議）：
- `[hypnoos_backup]AI提示詞模板`（不發送、禁用或 selective 且無 keys）
- 內容格式：YAML（含版本號、時間、app 分組、contexts、placeholders）
---
## 四、關鍵設計決策
### 1) 回傳解析格式應放哪？
採 **「共用服務 + APP 解析器」雙層**：
- 共用服務負責：
- 回應抓取、清理（去 code fence、trim、基礎安全檢查）
- 依 `parserId` 分派
- APP 負責：
- 自身資料模型解析（例如 CharacterEditor 的 YAML/EJS 分支）
這樣可以避免通用層被單一 APP 的資料結構綁死，同時保留一致的收發流程。
### 2) AI 發送是否脫離聊天室？
規劃 **Transport 抽象**：
- `chat_transport`：現行 `createChatMessages + triggerSlash`
- `api_transport`：未來直接打 API（對應你的「不要在聊天室發送」目標）
本輪先把介面抽好，CharacterEditor 先接入 `chat_transport`，下一階段平滑切 `api_transport`。
---
## 五、資料結構與遷移規劃
###+ 1. PersistedStore 新增欄位
在 `dataService.ts`：
- `aiPromptProfiles`（新）
- `aiUserPlaceholders`（新）
- `aiPipelineSettings`（可選，存 transport/parser 預設）
同時：
- `characterEditorPrompts` 保留讀取相容。
- 首次讀到舊資料時自動轉存到 `aiPromptProfiles.character_editor`。
###+ 2. Migration 策略
1. schema 增加 `.default({})`，避免舊存檔壞掉。
2. 讀取時偵測舊欄位 -> 一次遷移。
3. 寫入只寫新欄位（舊欄位可逐步淘汰）。
---
## 六、CharacterEditor 的接入改造（第一個導入 APP）
1. `CharacterEditorApp.tsx`
- `submitAiFill()` 改為呼叫 `AiPromptService.request(...)`
- 不再手動直接組字串與發送
2. `PromptManager.tsx`
- context 維度改為 `{appId, contextId}`
- 新增 placeholder 管理 UI 入口（可先做基本版）
- 預覽模式新增：
- 原始模板預覽
- 替換後預覽
3. `characterEditorSend.ts`
- 保留短期相容，內部可轉呼叫通用 `AiPromptService`
- 後續逐步收斂為 parser/adapter，而非主流程
---
## 七、世界書備份方案（不發送條目）
### 條目策略
- 名稱：`[hypnoos_backup]AI提示詞模板`
- `enabled: false` 或 `strategy: selective` + 空 keys（視 API 約束）
- `position` 放在固定 order，避免干擾現有 mvu_plot/mvu_update
### 備份內容建議
```yaml
version: 1
updatedAt: 1710000000000
apps:
character_editor:
contexts:
sec_info:
- id: xxx
title: 基本資訊填寫
content: ...
placeholders:
global:
- key: 我的規則
value: ...
```
### 流程
1. 玩家手動點「備份」
2. 寫入/更新世界書條目
3. 顯示成功/失敗 toast
4. 提供「還原」按鈕（覆蓋前二次確認）
---
## 八、分階段落地計劃（建議）
### Phase 1：基礎重構（高優先）
1. 新增 `AiPromptService` + `AiPlaceholderService`。
2. 擴充 `types.ts` 與 `DataService` 儲存結構（含 migration）。
3. CharacterEditor 改接新服務（保持現有功能可用）。
### Phase 2：模板與 placeholder 完整化
1. PromptManager 增加玩家自訂 placeholder CRUD。
2. 支援 app-level/global-level 模板隔離。
3. 完成替換後預覽模式。
### Phase 3：世界書備份與回復
1. 新增 `AiPromptBackupService`。
2. PromptManager/設定頁接備份按鈕。
3. 驗證「不發送」條目不干擾對話。
### Phase 4：非聊天室發送（可選，後續）
1. 加入 `api_transport`。
2. 可由 Settings 選擇 transport。
3. CharacterEditor 切換到非聊天室模式。
---
## 九、驗證清單
1. **型別/編譯**：`pnpm build:dev` 無錯。
2. **相容性**：舊 `characterEditorPrompts` 可自動遷移。
3. **功能**：
- block 排序正確
- placeholder 正確替換（內建 + 玩家自訂 + WI）
- 不同 APP 的模板互不污染
4. **備份**：可成功寫入世界書備份條目，且不參與發送。
5. **回歸**：CharacterEditor AI 填寫流程不退化。
---
## 十、風險與對策
- 風險：placeholder 過度自由導致 prompt 注入。
- 對策：限制 key 格式、提供 escape/白名單策略。
- 風險：migration 一次性改動造成舊檔讀取失敗。
- 對策：schema default + 漸進遷移 + 回滾保留舊欄位。
- 風險：世界書備份條目被誤啟用。
- 對策：建立後強制 `enabled=false` 並在檢查工具中提示。
---
## 十一、本次結論（可立即開始實作）
先以 CharacterEditor 作為第一個接入點，完成「共用 pipeline + 結構化模板 + placeholder 系統 + 跨 APP 儲存 + 世界書備份」五件事，之後其他 APP 只需提供自己的 context、block 與 parser，即可共用同一套 AI 自動填寫能力，顯著降低後續維護與出錯風險。
