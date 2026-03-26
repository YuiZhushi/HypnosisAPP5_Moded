# 角色編輯器 (CharacterEditorApp) 實現計劃

基於 [CharacterEditorPreview.html](file:///c:/Users/wendy/vs臨時檔案/HypnosisAPP5_Moded/src/臨時介面設計預覽/CharacterEditorPreview.html) (V7) 的 UI 原型，將所有功能以 React + TailwindCSS 實作，融入現有 HypnoOS 分層架構。

> [!IMPORTANT]
> 預覽頁面的 Alpine.js / SortableJS 邏輯 **不會被複用**，將完全以 React `useState` / `useReducer` + 自研拖曳邏輯（或輕量 `@dnd-kit`）重寫。玩家的操作流程與 UI 佈局保持不變。

---

## 一、總覽：功能模組與對應檔案

| 模組 | 新增/修改檔案 | 核心職責 |
|------|-------------|---------|
| **路由與入口** | [types.ts](file:///c:/Users/wendy/vs%E8%87%A8%E6%99%82%E6%AA%94%E6%A1%88/HypnosisAPP5_Moded/src/%E5%82%AC%E7%9C%A0APP%E5%89%8D%E7%AB%AF/types.ts), [App.tsx](file:///c:/Users/wendy/vs%E8%87%A8%E6%99%82%E6%AA%94%E6%A1%88/HypnosisAPP5_Moded/src/%E5%82%AC%E7%9C%A0APP%E5%89%8D%E7%AB%AF/App.tsx) | 新增 `AppMode.CHARACTER_EDITOR`，桌面圖標，路由 |
| **資料模型與解析** | `services/characterDataService.ts` [NEW] | 解析世界書 Markdown → 巢狀樹，序列化樹 → Markdown |
| **樹狀節點元件** | `components/CharacterEditor/NodeTree.tsx` [NEW] | 遞迴渲染、增刪改、類型轉換的核心 UI 元件 |
| **提示詞管理元件** | `components/CharacterEditor/PromptManager.tsx` [NEW] | 提示詞卡片 CRUD、拖曳排序、Macro 插入、組合預覽 |
| **編輯器殼層** | `components/CharacterEditor/CharacterEditorApp.tsx` [NEW] | 頁面骨架、Tab 路由、工具列、AI Modal |
| **提示詞構建** | `prompts/characterEditorSend.ts` [NEW] | 構造發送給 AI 的提示詞純函數 |
| **世界書橋接** | [services/worldBookService.ts](file:///c:/Users/wendy/vs%E8%87%A8%E6%99%82%E6%AA%94%E6%A1%88/HypnosisAPP5_Moded/src/%E5%82%AC%E7%9C%A0APP%E5%89%8D%E7%AB%AF/services/worldBookService.ts) [MODIFY] | 新增條目存在性檢查方法 |

---

## 二、各模組詳細實現

---

### 模組 1：路由與入口

#### [MODIFY] [types.ts](file:///c:/Users/wendy/vs臨時檔案/HypnosisAPP5_Moded/src/催眠APP前端/types.ts)

```diff
 export enum AppMode {
   HOME = 'HOME',
   ...
   WIP = 'WIP',
+  CHARACTER_EDITOR = 'CHARACTER_EDITOR',
 }
```

新增類型定義：

```ts
// ====== Character Editor 相關 ======

/** 樹狀節點的三種型別 */
export type NodeType = 'string' | 'list' | 'object';

/** 遞迴樹節點 */
export interface EditorNode {
  id: string;             // uuid
  key: string;            // YAML key 名稱
  type: NodeType;
  value: string;          // type='string' 時的值
  children: EditorNode[]; // type='object'/'list' 時的子項
  isLocked: boolean;      // 頂層預設欄位不可刪除/改 key
}

/** 提示詞模板卡片 */
export interface PromptTemplate {
  id: string;
  title: string;
  content: string;
  isSystem: boolean;      // 系統保留欄不可編輯內容
}

/** 提示詞情境 key（分區 ID 或全域） */
export type PromptContextKey =
  | 'global_output'
  | 'full_fill'
  | `sec_${string}`;

/** 角色編輯器的分區定義 */
export interface EditorSection {
  id: string;
  name: string;          // UI 顯示名稱
  category: 'data' | 'behavior'; // data=純YAML, behavior=EJS邏輯區
}
```

#### [MODIFY] [App.tsx](file:///c:/Users/wendy/vs臨時檔案/HypnosisAPP5_Moded/src/催眠APP前端/App.tsx)

- 在 [renderCurrentApp()](file:///c:/Users/wendy/vs%E8%87%A8%E6%99%82%E6%AA%94%E6%A1%88/HypnosisAPP5_Moded/src/%E5%82%AC%E7%9C%A0APP%E5%89%8D%E7%AB%AF/App.tsx#171-216) 的 `switch` 中新增 `case AppMode.CHARACTER_EDITOR`
- 在 [HomeScreen](file:///c:/Users/wendy/vs%E8%87%A8%E6%99%82%E6%AA%94%E6%A1%88/HypnosisAPP5_Moded/src/%E5%82%AC%E7%9C%A0APP%E5%89%8D%E7%AB%AF/App.tsx#239-415) 的 `apps[]` 陣列新增桌面圖標

---

### 模組 2：資料模型與解析

#### [NEW] [characterDataService.ts](file:///c:/Users/wendy/vs臨時檔案/HypnosisAPP5_Moded/src/催眠APP前端/services/characterDataService.ts)

**職責**：讀取世界書 Markdown 中的 YAML → 解析成 `EditorNode[]` 樹 → 編輯後序列化回 Markdown。

核心方法：

| 方法 | 說明 |
|------|------|
| `parseYamlToTree(yamlStr)` | 將 YAML 字串解析為 `EditorNode[]` |
| `treeToYaml(nodes)` | 將 `EditorNode[]` 序列化回 YAML 字串 |
| `getCharacterList()` | 掃描世界書條目，回傳可選角色清單 |
| `loadCharacter(name)` | 從世界書載入某角色的完整 Markdown，按分區切割並解析 |
| `saveCharacter(name, sections)` | 將修改後的分區資料回寫世界書 |
| `getSnapshot() / diffSnapshots()` | 快照比對，供 Diff 模式使用 |

> [!NOTE]
> EJS 邏輯區塊（`<%_ if ... _%>`）不解析為 YAML 節點，而是按數值分支 key（如 `<20`, `<40` ...）分別儲存獨立的 `EditorNode[]`。切換分支 tab 時直接切換對應子樹。

> [!WARNING]
> **解析失敗的容錯處理**：若某個分區的 YAML 解析失敗（格式損壞、未知語法等），該區域應 **直接顯示原始 Markdown 文字** 於一個可編輯的 `<textarea>` 中，讓玩家手動修復。不得因解析錯誤而白屏崩潰或丟失資料。

---

### 模組 3：樹狀節點元件 `NodeTree`

#### [NEW] [NodeTree.tsx](file:///c:/Users/wendy/vs臨時檔案/HypnosisAPP5_Moded/src/催眠APP前端/components/CharacterEditor/NodeTree.tsx)

**這是核心遞迴元件，負責所有節點的增刪改操作。**

##### 3.1 節點渲染邏輯

```
NodeTree({ nodes, onUpdate, depth })
  └─ NodeRow({ node, onUpdate, depth })
       ├─ KeyInput（鎖定時 disabled）
       ├─ TypeBadge（顯示 String / List / Object）
       ├─ ValueEditor（type=string 時為 input/textarea）
       ├─ HoverToolbar（懸浮操作面板）
       │    ├─ TypeDropdown（T 按鈕 → 彈出選單選擇轉換類型）
       │    ├─ AddSiblingBtn（+）
       │    ├─ AddChildBtn（+ 子級，僅 Object）
       │    └─ DeleteBtn（✖，isLocked 時隱藏）
       └─ children → 遞迴 <NodeTree />（縮進 + 左邊線）
```

##### 3.2 增刪改操作的 State 管理

使用 `useReducer` 管理整個分區的 `EditorNode[]`：

```ts
type TreeAction =
  | { type: 'ADD_SIBLING';  parentPath: string[]; afterId: string }
  | { type: 'ADD_CHILD';    nodeId: string }
  | { type: 'DELETE_NODE';  nodeId: string }
  | { type: 'UPDATE_KEY';   nodeId: string; newKey: string }
  | { type: 'UPDATE_VALUE'; nodeId: string; newValue: string }
  | { type: 'CHANGE_TYPE';  nodeId: string; newType: NodeType }
  | { type: 'REPLACE_ALL';  nodes: EditorNode[] };
```

##### 3.3 類型轉換邏輯（`CHANGE_TYPE`）

| 原類型 → 新類型 | 轉換規則 |
|----------------|---------|
| String → List  | 原 value 成為列表的第一個「string item」 |
| String → Object | 原 value 成為第一個子節點 `{ key: 'value', value: 原值 }` |
| List → String  | 取第一個 item 的文字值，其餘丟棄（跳 confirm） |
| List → Object  | 各 item 轉為 `{ key: 'item_0', value: ... }` |
| Object → String | 取第一個子節點的 value（跳 confirm） |
| Object → List  | 各子節點的 value 成為列表 items |

> [!WARNING]
> 類型轉換可能有資料遺失風險，需彈出確認對話框讓玩家確認。

---

### 模組 4：提示詞管理元件 `PromptManager`

#### [NEW] [PromptManager.tsx](file:///c:/Users/wendy/vs臨時檔案/HypnosisAPP5_Moded/src/催眠APP前端/components/CharacterEditor/PromptManager.tsx)

##### 4.1 State 結構

```ts
const [promptsDb, setPromptsDb] = useState<Record<PromptContextKey, PromptTemplate[]>>(defaultPrompts);
const [currentContext, setCurrentContext] = useState<PromptContextKey>('sec_social');
const [showPreview, setShowPreview] = useState(false);
```

##### 4.2 拖曳排序實現（React 原生版）

**不使用 SortableJS**，改用純 React HTML5 Drag and Drop API：

```tsx
function DraggableCard({ template, index, onMove }) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(index))}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const fromIdx = Number(e.dataTransfer.getData('text/plain'));
        onMove(fromIdx, index);
      }}
    >
      {/* card content */}
    </div>
  );
}
```

`onMove(from, to)` 直接操作 `promptsDb[currentContext]` 陣列並呼叫 `setPromptsDb`，完全由 React 管理，**不存在 DOM 不同步的問題**。

##### 4.3 CRUD 操作

| 操作 | 實現 |
|------|------|
| 新增 | push 新 `PromptTemplate` 到當前 context 陣列 |
| 刪除 | `filter` 掉指定 ID（isSystem 不可刪除） |
| 修改標題/內容 | 直接更新陣列中對應物件 |
| 插入 Macro | [insertMacro(index, text)](file:///c:/Users/wendy/vs%E8%87%A8%E6%99%82%E6%AA%94%E6%A1%88/HypnosisAPP5_Moded/src/%E8%87%A8%E6%99%82%E4%BB%8B%E9%9D%A2%E8%A8%AD%E8%A8%88%E9%A0%90%E8%A6%BD/CharacterEditorPreview.html#446-452) → 在 content 末尾追加 macro 文字 |

##### 4.4 Macro（世界書引用）

提供兩類巨集按鈕：
- **內建變數**：`{{裝配角色名字}}`, `{{當前狀態與內容}}` → **發送時必須替換為實際內容**（角色名從當前選中角色讀取；狀態內容從當前分區 YAML 序列化取得）
- **世界書條目**：`{{WI:條目名}}` → 發送時由 `characterEditorSend.ts` 解析，呼叫世界書 API 取得對應條目的實際內容並替換

> [!IMPORTANT]
> 所有 `{{...}}` 巨集在 UI 編輯時保持原樣顯示，僅在 **實際發送給 AI 的瞬間** 才進行替換。預覽面板應同時支援「原始模板檢視」和「替換後預覽」兩種模式。

##### 4.5 組合預覽 [generatePreviewString()](file:///c:/Users/wendy/vs%E8%87%A8%E6%99%82%E6%AA%94%E6%A1%88/HypnosisAPP5_Moded/src/%E8%87%A8%E6%99%82%E4%BB%8B%E9%9D%A2%E8%A8%AD%E8%A8%88%E9%A0%90%E8%A6%BD/CharacterEditorPreview.html#453-468)

```
最終發送 = 分區模板（按排序，含已有內容模板）+ 全局輸出規範（底層追加）
```

**分區內容模板自動注入邏輯**：

每個分區的提示詞模板中，需包含一個「當前已有內容」的系統模板，規則如下：
- 若該分區已有使用者編輯的節點資料 → 自動序列化為 YAML 並填入此模板
- 若該分區為空（尚未編輯） → 填入對應區域的 **預設模板**（從範例人設格式中取得）
- 此模板為 `isSystem: true`，玩家不可刪除，但可調整排序位置

---

### 模組 5：編輯器殼層 `CharacterEditorApp`

#### [NEW] [CharacterEditorApp.tsx](file:///c:/Users/wendy/vs臨時檔案/HypnosisAPP5_Moded/src/催眠APP前端/components/CharacterEditor/CharacterEditorApp.tsx)

整體結構：

```
CharacterEditorApp
├── Header（標題 + 角色切換下拉 + ⚙ 提示詞設定切換）
├── Toolbar（AI填寫▾ / 檢查世界書綁定 / 自動排版 / 重置 / Diff切換）
├── TabBar（10 個分區 Tab 橫向滾動）
├── ContentArea
│    ├── showPromptSettings=false → <NodeTree /> (角色資料)
│    └── showPromptSettings=true  → <PromptManager />
├── FloatingActionButton（產生/儲存世界書）
└── AiFillModal（彈出式模態視窗）
```

##### 5.1 AI 填寫流程

1. 玩家點擊「AI 填寫 ▾」→ 選擇「全部/當前分區」
2. 彈出 `AiFillModal`，玩家輸入修改方向（可留空）
3. 點擊送出 → `characterEditorSend.ts` 組合提示詞
4. 調用 `createChatMessages()` + `triggerSlash('/trigger')` 送出
5. 等待 AI 回應後解析結果，更新 `EditorNode[]`

##### 5.2 檢查世界書綁定按鈕（含自動建立）

調用 `worldBookService.checkCharacterEntryExists(characterName)`：

- **已存在** → 顯示 Toast：「✅ 已找到條目 [mvu_plot]${角色名}人设」
- **不存在** → **自動新增**對應條目，參數如下：

| 欄位 | 值 |
|------|----|
| 條目標題 | `[mvu_plot]${角色名}人设` |
| 插入策略 | Conditional（選擇性觸發） |
| 位置 | 角色定義之前 |
| 順序 | 上一個 `[mvu_plot]` 條目的 order + 1；找不到時預設 `75` |
| 主要提示詞 | `${角色名}` |
| 內容 | 從範例人設格式 (`[mvu_plot]範例人设格式.md`) 取得完整的人設與行為指導預設模板 |

建立後顯示 Toast：「📝 已自動建立條目 [mvu_plot]${角色名}人设」

---

### 模組 6：提示詞構建

#### [NEW] [characterEditorSend.ts](file:///c:/Users/wendy/vs臨時檔案/HypnosisAPP5_Moded/src/催眠APP前端/prompts/characterEditorSend.ts)

純函數，不依賴 React：

```ts
export function buildEditorPrompt(params: {
  mode: 'full_fill' | 'section';
  sectionId: string;
  templates: PromptTemplate[];
  globalRules: PromptTemplate[];
  currentData: string;         // 當前分區 YAML
  characterName: string;
  playerDirection: string;     // 玩家自訂方向
}): string
```

- 按排序拼接 `templates`
- 替換所有 `{{...}}` 巨集
- 追加 `globalRules`
- 包裹在 `<角色編輯>...</角色編輯>` tag 中

---

### 模組 7：世界書橋接擴展

#### [MODIFY] [worldBookService.ts](file:///c:/Users/wendy/vs臨時檔案/HypnosisAPP5_Moded/src/催眠APP前端/services/worldBookService.ts)

新增方法：

```ts
export async function checkCharacterEntryExists(characterName: string): Promise<{
  exists: boolean;
  entryUid?: string;
  matchedKeyword?: string;
}>
```

---

## 三、Diff 模式實現策略

- 編輯前先呼叫 `characterDataService.getSnapshot()` 取得原始資料副本
- 任何修改後，使用 `diffSnapshots(original, current)` 比對
- NodeTree 在 `diffMode=true` 時，對有差異的欄位以紅色刪除線 + 綠色新值的方式呈現
- 以**字元級 diff**（使用 `fast-diff` 或類似演算法）渲染行內改動

---

## 四、新增目錄結構預覽

```
src/催眠APP前端/
├── components/
│   ├── CharacterEditor/        [NEW DIR]
│   │   ├── CharacterEditorApp.tsx
│   │   ├── NodeTree.tsx
│   │   ├── PromptManager.tsx
│   │   └── AiFillModal.tsx
│   └── ...existing...
├── services/
│   ├── characterDataService.ts [NEW]
│   └── worldBookService.ts     [MODIFY]
├── prompts/
│   ├── hypnosisSend.ts         (existing)
│   └── characterEditorSend.ts  [NEW]
└── types.ts                    [MODIFY]
```

---

## 五、驗證計劃

### 構建驗證

```bash
# 在仓库根目录执行
pnpm build:dev
```

- 確認無 TypeScript 編譯錯誤
- 確認產物 [dist/催眠APP前端/index.html](file:///c:/Users/wendy/vs%E8%87%A8%E6%99%82%E6%AA%94%E6%A1%88/HypnosisAPP5_Moded/dist/%E5%82%AC%E7%9C%A0APP%E5%89%8D%E7%AB%AF/index.html) 正確生成

### MCP (chrome-devtools) 驗證

使用 chrome-devtools MCP 工具進行自動化驗證：

1. **Console 檢查**：`list_console_messages` 確認無 `[HypnoOS]` 前綴的 error/warn
2. **快照比對**：`take_snapshot` 截取 UI 快照確認元件渲染正確
3. **互動測試**：使用 `click` / `fill` 工具模擬節點增刪改操作，確認 state 同步更新
4. **變數驗證**：`evaluate_script` 呼叫 `getVariables({type: 'chat'})` 檢查世界書條目是否正確寫入
5. **截圖存證**：`take_screenshot` 截取各分區畫面作為視覺回歸基準

### 手動驗證（需使用者在酒馆環境中操作確認的項目）

1. **桌面圖標**：打開 HypnoOS → 確認「角色編輯器」圖標出現且可點擊進入
2. **分區切換**：逐一點擊 10 個分區 Tab，確認畫面正確切換
3. **節點增刪改**：
   - Hover 展開操作面板
   - 點擊 `[+]` 新增兄弟/子級節點
   - 點擊 `[T]` 下拉選單，選擇類型轉換
   - 點擊 `[✖]` 刪除節點（鎖定節點不可刪）
   - 修改 Key 和 Value
4. **提示詞管理**：切換到提示詞面板 → 拖曳排序 → 新增/刪除卡片 → 插入 Macro → 預覽組合結果
5. **AI 填寫**：觸發 AI 填寫 → 確認 Modal 彈出 → 輸入方向後送出
6. **世界書檢查按鈕**：點擊後確認有回饋訊息，若不存在則自動建立條目
7. **解析失敗容錯**：故意破壞某段 YAML → 確認該區域顯示原始文字而非白屏

---

## 六、交叉比對後的補充與修正

以下為對照專案內 [worldBookService.ts](file:///c:/Users/wendy/vs%E8%87%A8%E6%99%82%E6%AA%94%E6%A1%88/HypnosisAPP5_Moded/src/%E5%82%AC%E7%9C%A0APP%E5%89%8D%E7%AB%AF/services/worldBookService.ts)、[dataService.ts](file:///c:/Users/wendy/vs%E8%87%A8%E6%99%82%E6%AA%94%E6%A1%88/HypnosisAPP5_Moded/src/%E5%82%AC%E7%9C%A0APP%E5%89%8D%E7%AB%AF/services/dataService.ts)、`[mvu_plot]範例人设格式.md`、`白鸟爱丽莎` 實際資料後發現的遺漏或模糊點：

### 1. EJS 分支閾值不一致

計劃中行為區的 innerTab 按鈕使用了 `<20, <40, <60, <80, <100, >=100` 共 6 階。但實際範例格式中：

| 屬性 | 實際分支閾值 | 備註 |
|------|-----------|------|
| 發情值 | `<20, <40, <60, <80, <95, >=95` | **注意 95 而非 100** |
| 警戒度 | `<20, <40, <60, <80, <100, else` | 標準 6 階 |
| 好感度 | `<20, <40, <60, <80, else` | **只有 5 階** |
| 服從度 | `<20, <40, <60, <80, else` | **只有 5 階** |

**👉 實現時**：各行為屬性的分支按鈕必須動態生成，由 `characterDataService` 解析 EJS 後提取實際閾值，而非寫死 6 個按鈕。

### 2. 角色世界書的兩段式 XML 結構

每個角色條目實際包含兩個 XML 區塊，**都裹在同一個世界書條目內**：

```
<${角色名}人设>
```yaml
...(純 YAML）
```
</${角色名}人设>

<${角色名}行为指导>
```yaml
...(YAML + EJS 混合）
```
</${角色名}行为指导>
```

**👉 實現時**：`characterDataService.loadCharacter()` 必須先用正規表示式拆出這兩個 XML 區塊，再分別解析。儲存時也須以此格式回寫。

### 3. PersistedStore 擴展需要 Zod 遷移

若要將提示詞模板 (`promptsDb`) 或編輯器設定持久化到 `系統._hypnoos`，需在 [dataService.ts](file:///c:/Users/wendy/vs%E8%87%A8%E6%99%82%E6%AA%94%E6%A1%88/HypnosisAPP5_Moded/src/%E5%82%AC%E7%9C%A0APP%E5%89%8D%E7%AB%AF/services/dataService.ts) 的 [PersistedStore](file:///c:/Users/wendy/vs%E8%87%A8%E6%99%82%E6%AA%94%E6%A1%88/HypnosisAPP5_Moded/src/%E5%82%AC%E7%9C%A0APP%E5%89%8D%E7%AB%AF/services/dataService.ts#455-485) 類型與 `STORE_SCHEMA` 添加可選欄位（附帶 `.default({})`），確保舊存檔讀取時不崩潰。

```ts
// dataService.ts PersistedStore 追加
characterEditorPrompts?: Record<string, PromptTemplate[]>;
```

### 4. 世界書 API 調用模式

現有 [worldBookService.ts](file:///c:/Users/wendy/vs%E8%87%A8%E6%99%82%E6%AA%94%E6%A1%88/HypnosisAPP5_Moded/src/%E5%82%AC%E7%9C%A0APP%E5%89%8D%E7%AB%AF/services/worldBookService.ts) 已示範了完整的調用模式：

```ts
// 讀取世界書名稱
const charWb = getCharWorldbookNames('current');
const wbName = charWb.primary;

// 讀取條目
const entries = await getWorldbook(wbName);

// 建立條目
await createWorldbookEntries(wbName, [{ name, enabled, strategy, position, content, ... }]);
```

新建 `[mvu_plot]` 條目時應沿用此模式。`strategy.type` 應為 `'selective'`（即 conditional），`strategy.keys` 設為 `[角色名]`。

### 5. 角色清單的來源

角色清單來自 **MVU 變量** `stat_data.角色`，透過已有的 `MvuBridge.getRoles()` 取得。返回的物件的 key 即為角色名（如 `西园寺爱丽莎`、`月咏深雪`、`犬塚夏美`、`測試角色`）。

```ts
// 範例：取得角色清單
const roles = await MvuBridge.getRoles();
const characterNames = roles ? Object.keys(roles) : [];
```

世界書條目的命名統一為 `[mvu_plot]${角色名}人设`，解析時需兼容繁簡體（`人设` / `人設`）。

### 6. 構建環境

本專案使用根目錄 [webpack.config.ts](file:///c:/Users/wendy/vs%E8%87%A8%E6%99%82%E6%AA%94%E6%A1%88/HypnosisAPP5_Moded/webpack.config.ts) 打包，**不使用** `src/催眠APP前端/` 下的 Vite 配置。新增的 `components/CharacterEditor/` 目錄下的檔案會被 Webpack 自動掃描，無需額外配置。但若引入新的 npm 套件（如 YAML 解析庫），需在根目錄 `package.json` 添加依賴。

### 7. YAML 解析庫——已可用

`yaml` 套件**已在 webpack externals 中外部化為全域 `YAML`**（`webpack.config.ts` 第 546 行）。因此：
- ✅ **無需安裝新的 npm 套件**
- 直接 `import YAML from 'yaml'` 即可，Webpack 會解析為全域變數
- 使用 `YAML.parse(str)` / `YAML.stringify(obj)` 進行轉換

### 8. Tab 區域名稱校準

從範例格式可提取的實際結構欄位：

| Tab ID | 顯示名稱 | 對應 YAML 根節點 |
|--------|---------|----------------|
| info | 基本資訊 | `title`, `gender`, `age`, `identity` |
| social | 社交網絡 | `social_connection` |
| personality | 性格與興趣 | `personality`, `habit`, `hidden_behavior` |
| appearance | 外觀特點 | `appearance` |
| fetish | 性癖與弱點 | `sexual_preference`, `weakness` |
| arousal | 發情行為 | EJS: `发情状态` |
| alert | 警戒行為 | EJS: `对{{user}}的态度` |
| affection | 好感行為 | EJS: `好感表现` |
| obedience | 服從行為 | EJS: `服从表现` |
| global | 全局行為 | `rules` 陣列 |

### 9. 提示詞純函數參考模式

現有 `prompts/hypnosisSend.ts` 提供了模範：導入 `types`、封裝純函數、用 XML tag 包裹輸出（`<催眠發送>...</催眠發送>`）。新的 `characterEditorSend.ts` 應沿用此模式，用 `<角色編輯>...</角色編輯>` 包裹。

### 10. 讀取世界書條目內容的 API

載入角色資料時，需調用 `getWorldbook(wbName)` 取得條目陣列，再從中找出 `name` 符合 `[mvu_plot]${角色名}人设` 的條目，讀取其 `content` 欄位即為完整的 Markdown 內容。寫入時使用 `updateWorldbookEntries(wbName, [{ uid, content }])` 更新。
