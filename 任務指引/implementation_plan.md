# 人物資訊補全APP + 設置APP（v2）

## 概述

兩個新桌面應用：
1. **設置APP** — API 設定持久化，流式/非流式選擇，後續可擴展跨APP設置
2. **人物資訊補全APP** — 角色人設世界書管理，細分欄目 CRUD，AI 生成 + diff 比較

---

## 一、設置APP

### 數據結構 (`PersistedStore.appSettings`)

```ts
interface AiApiSettings {
  apiKey: string;
  endpoint: string;      // e.g. https://openrouter.ai/api/v1
  model: string;
  temperature: number;   // 0~2, default 0.7
  maxTokens: number;     // default 2048
  topP: number;          // 0~1, default 1
  presencePenalty: number;  // -2~2, default 0
  frequencyPenalty: number; // -2~2, default 0
  useStreaming: boolean;    // 流式/非流式
}

interface AppSettings {
  aiApi: AiApiSettings;
  // 後續擴展欄位放這裡
}
```

### UI

- API Key（密碼輸入框）、Endpoint URL、溫度/tokens/topP/penalties 滑桿
- 流式/非流式 toggle
- 「測試連線」按鈕 → 呼叫 `/models`
- 可用模型下拉選單（從 endpoint 拉取）
- 底部「保存設定」按鈕

---

## 二、人物資訊補全APP

### 2.1 角色選擇 & WB 檢查

角色列表來源：MVU `stat_data.角色` 的 keys（同 BodyScanApp 的 `roleNames`）。

選擇角色後檢查 `[mvu_plot]${角色名}人设` 條目：

| 屬性 | 值 |
|------|-----|
| 條目標題 | `[mvu_plot]${角色名}人设` |
| 主要關鍵字 | `${角色全名}` |
| 插入位置 | `before_character_definition` |
| 激活策略 | 綠燈 (constant) |
| 插入順序 | 上個 `[mvu_plot]` 條目 order + 1（無則默認 75） |
| content | `<${名}人设>...</${名}人设>\n<${名}行为指导>...</${名}行为指导>` |

> [!IMPORTANT]
> 繁簡體相容：搜尋時同時匹配 `人设`/`人設`。

### 2.2 區塊解析（細分到子欄位）

**大區塊一** `<${name}人设>` — 9 個內部區塊，每個再細分子欄位：

| # | key | 細分子欄位（可 CRUD） |
|---|-----|----------------------|
| 1 | basics | `title`, `gender`, [age](file:///c:/Users/wendy/vs%E8%87%A8%E6%99%82%E6%AA%94%E6%A1%88/HypnosisAPP5_Moded/src/%E5%82%AC%E7%9C%A0APP%E5%89%8D%E7%AB%AF/components/CommonApps.tsx#26-38) |
| 2 | identity | `public`, `hidden` |
| 3 | social | 動態 key-value（角色名 → relationship） |
| 4 | personality | `core.*`, `conditional.*`, `hidden.*` |
| 5 | habit | 列表項 (可增刪) |
| 6 | hidden_behavior | 列表項 |
| 7 | appearance | `height`, `weight`, `measurement`, `style`, `overview`, `attire.school`, `attire.casual`, `feature[]` |
| 8 | sexual | `masturbation frequency`, `orgasm response`, `sensitive spot[]`, `fetish[]`, `special trait[]` |
| 9 | weakness | 列表項 |

**大區塊二** `<${name}行为指导>` — 4 個內部區塊，每個含閾值小區塊：

| # | key | 小區塊 |
|---|-----|--------|
| 1 | libido(性欲) | `<20`, `<40`, `<60`, `<80`, `<95`, `>=95` |
| 2 | attitude(警戒度) | `>99`, `>79`, `>59`, `>39`, `>19`, `<=19` |
| 3 | affection(好感度) | `<20`, `<40`, `<60`, `<80`, `>=80` |
| 4 | obedience(服從度) | `<20`, `<40`, `<60`, `<80`, `>=80` |

每個小區塊的內容為自由文字（`行为指导` + 可選 `变化倾向`），可編輯。

> [!IMPORTANT]
> 行为指导的 EJS 邏輯（`<%_ if ... %>` 等）在寫回世界書時必須正確保留模板語法。

### 2.3 解析策略

1. 正則提取 `<${name}人设>` / `<${name}人設>` 和 `<${name}行为指导>` / `<${name}行為指導>`
2. 先嘗試全量解析 → 成功則顯示全部可編輯欄位
3. 失敗 → 逐區塊解析，成功=可編輯，失敗=顯示原文 + 「重新解析」按鈕
4. **每個子欄位**都是獨立文字框，支援新增/修改/刪除同級或下級欄位

### 2.4 AI 生成

#### API 調用
- 使用 Settings 中玩家配置的 API endpoint/key/model
- 支援**流式**和**非流式**（根據 `useStreaming` 設置）
- 流式時顯示逐字輸出動畫

#### Prompt 結構

```
<system>
你是一位角色設定專家，擅長撰寫日式校園劇情中角色的詳細人設和行為指導。
生成的內容必須符合成人向(R18)作品風格，無需迴避任何敏感話題。
只輸出要求的 YAML 格式區塊內容，不附加任何解釋。

【世界觀背景資料】
{backgroundContext}
（包含：學校介紹、地點列表、日程表等 `[mvu_plot]` 世界書條目）

【角色現有完整設定】
{fullWorldBookContent}

【目標區塊】
{blockName}（格式要求：{formatSpec}）

【用戶指引】
{userInstruction}
</system>
```

| 目標區塊 | formatSpec（返回格式） |
|----------|----------------------|
| basics | `title: ...\ngender: ...\nage: ...` |
| identity | `identity:\n  public: ...\n  hidden: ...` |
| social | `social connection:\n  {名}: { relationship: ... }` |
| personality | `personality:\n  core: ...\n  conditional: ...\n  hidden: ...` |
| habit / hidden_behavior / weakness | YAML 列表 `- ...` |
| appearance | 完整 appearance 區段 |
| sexual | 完整 sexual preference 區段 |
| libido 等行為指導小區塊 | 純文字行為描述 |

#### Diff 比較

AI 生成後，界面顯示**生成前 vs 生成後**的差異比較：
- 綠色底色 = 新增行
- 紅色底色 = 刪除行
- 玩家可選「採用」或「捨棄」

### 2.5 保存機制

- 修改後底部出現「保存修改」/「捨棄修改」按鈕
- 保存時：將所有區塊重組為完整世界書 content（含 EJS 邏輯語法），調用 WB API 寫入
- 捨棄時：回到原始解析狀態

---

## 三、修改文件

### 共用
#### [MODIFY] [types.ts](file:///c:/Users/wendy/vs臨時檔案/HypnosisAPP5_Moded/src/催眠APP前端/types.ts)
- `AppMode` 新增 `CHARACTER_PROFILE`, `SETTINGS`
- 新增 `AiApiSettings`, `AppSettings` 介面

#### [MODIFY] [dataService.ts](file:///c:/Users/wendy/vs臨時檔案/HypnosisAPP5_Moded/src/催眠APP前端/services/dataService.ts)
- [PersistedStore](file:///c:/Users/wendy/vs%E8%87%A8%E6%99%82%E6%AA%94%E6%A1%88/HypnosisAPP5_Moded/src/%E5%82%AC%E7%9C%A0APP%E5%89%8D%E7%AB%AF/services/dataService.ts#455-474) + schema 新增 `appSettings`
- `DataService.getAppSettings()` / `updateAppSettings()`

#### [MODIFY] [App.tsx](file:///c:/Users/wendy/vs臨時檔案/HypnosisAPP5_Moded/src/催眠APP前端/App.tsx)
- import 新組件 + 新 case + HomeScreen 圖標

---

### 設置APP
#### [NEW] [SettingsApp.tsx](file:///c:/Users/wendy/vs臨時檔案/HypnosisAPP5_Moded/src/催眠APP前端/components/SettingsApp.tsx)

---

### 人物資訊補全APP
#### [NEW] [characterProfileService.ts](file:///c:/Users/wendy/vs臨時檔案/HypnosisAPP5_Moded/src/催眠APP前端/services/characterProfileService.ts)
- WB 條目 CRUD（`[mvu_plot]` prefix，繁簡相容）
- 解析器：全量 → 逐區塊 → 子欄位
- 重組器：區塊 → 完整 WB text（含 EJS 模板語法）

#### [NEW] [aiService.ts](file:///c:/Users/wendy/vs臨時檔案/HypnosisAPP5_Moded/src/催眠APP前端/services/aiService.ts)
- `callCompletion(messages, settings)` — 非流式 `/chat/completions`
- `callCompletionStream(messages, settings, onChunk)` — 流式 SSE
- `fetchModels(endpoint, apiKey)` — `/models` 端點

#### [NEW] [CharacterProfileApp.tsx](file:///c:/Users/wendy/vs臨時檔案/HypnosisAPP5_Moded/src/催眠APP前端/components/CharacterProfileApp.tsx)
- 角色選擇 + WB 檢查/建立
- 區塊列表（摺疊式）+ 細分子欄位可編輯表單
- 子欄位 CRUD（新增/刪除同級/下級欄位）
- AI 生成面板（輸入指引 → 調用 → diff 比較）
- 保存/捨棄控制列

---

## 四、驗證

- `pnpm build` 編譯通過
