## 人物資訊補全APP：EJS 邏輯區塊 CRUD 增改計劃（本次）

> 目標：讓玩家可在 CharacterEditor 直接「新增 / 修改 / 刪除」行為區 EJS 分支（if / else if / else），並可正常儲存回世界書。

### 一、現況與缺口

- 目前可編輯的是分支內 YAML（`nodes`），但分支邏輯本身不可改。
- `BehaviorBranch` 僅保留 `conditionRaw/openTagRaw`，缺少結構化欄位，導致 UI 無法安全做 CRUD。
- `saveCharacter()` 目前偏向「回填既有 openTagRaw」，不利於新建或改條件後的正確序列化。

### 二、實作範圍

#### 1) 資料層（`src/催眠APP前端/services/characterDataService.ts`）

- 擴充 `BehaviorBranch`：
  - `kind: 'if' | 'else_if' | 'else'`
  - `operator?: '<' | '<=' | '>' | '>=' | '=='`
  - `threshold?: number`
  - 保留 `conditionRaw/openTagRaw` 作相容與 fallback
- 強化 `parseEjsBranches()`：
  - 解析出 `kind/operator/threshold`
  - 解析失敗仍保留 raw，避免資料遺失
- 改造 `rebuildBehaviorSection()`：
  - 由結構化條件重建 `<%_ if ... _%> / <%_ } else if ... _%> / <%_ } else { _%>`
  - 保留 fallback 分支原始 YAML
- 新增儲存前驗證：
  - 分支至少 1 條
  - 第一條必為 `if`
  - `else` 最多 1 條且只能在最後
  - `if/else_if` 需有合法 `operator + threshold`

#### 2) UI 層（`src/催眠APP前端/components/CharacterEditor/CharacterEditorApp.tsx`）

- 在行為分區分支列新增控制區：
  - `+分支`：新增 `else if` 或 `else`
  - `編輯條件`：修改當前分支 `operator/threshold`
  - `刪除分支`：刪除當前分支（保護必要條件）
- 分支 label 即時反映（例如 `<20`、`>=95`、`else`）。
- 儲存前先走驗證，不通過時顯示 Toast 並阻止儲存。

#### 3) 非目標（本次不做）

- 分支拖曳排序（避免同次改動過大）
- AI 生成流程重做（另案）
- 提示詞模板系統重做（另案）

### 三、互動流程（玩家視角）

1. 進入發情 / 警戒 / 好感 / 服從任一行為分頁。
2. 在分支列新增一條 `else if`（設定比較符與閾值）或 `else`。
3. 可切換分支並編輯分支內 YAML 樹。
4. 可修改分支條件、刪除分支。
5. 點「產生 / 儲存世界書」後，系統重建合法 EJS 並回寫。

### 四、驗證清單

- [ ] 可新增分支（含 `else if`、`else`）
- [ ] 可修改既有分支條件
- [ ] 可刪除分支且不破壞 EJS 鏈
- [ ] 儲存後重新解析，分支數與條件一致
- [ ] 解析失敗分支仍可 fallback 編輯，儲存不丟資料

### 五、風險與保護

- 複雜條件（非數值比較）可能無法完整結構化：
  - 採 fallback 原始模式保留內容。
- 透過儲存前驗證避免輸出非法 EJS。
- 任何不可恢復錯誤以 Toast + console.error 回報，避免白屏。
