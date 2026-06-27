# MVU 角色卡文件夾結構與開發指引

MVU 角色卡文件夾提供了一種儲存酒館角色卡內容的標準檔案結構。在 HypnoOS 的領域驅動分層架構（Domain-Driven Layered Architecture）下，角色卡的開發必須嚴格遵守前後端分離與資料驗證規範。

## 1. 角色卡目錄結構

* `角色卡/腳本/*/`：角色卡專屬的背景腳本項目（如機制運算、事件監聽）。
* `角色卡/界面/*/`：角色卡專屬的前端介面項目（React + TailwindCSS）。
* `角色卡/世界書/*/`：角色卡的世界書條目（設定提示詞），編寫其他內容時需參考此設定。
* `角色卡/schema.ts`：使用 Zod 4 撰寫的角色卡 MVU 變數結構定義。
  * 提供給腳本、前端介面匯入使用。
  * 在 `pnpm build` 或 `pnpm watch` 時會自動生成 `schema.json`，便於編寫 `initvar.yaml`。

> **注意：** 當玩家要求編寫 MVU 角色卡的腳本或前端介面時，除了參考一般模板外，應優先參考 `初始模板/角色卡/` 中的結構。若僅是編寫獨立腳本/介面（非角色卡專屬），則不適用本文件。

## 2. MVU 變數結構定義 (Zod Schema)

MVU 強制使用 Zod 4 進行資料的驗證與糾錯，對應檔案為 `角色卡/schema.ts`。

### 2.1 結構定義規範與最佳實踐

* **Zod 4 優先**：嚴禁使用 `.passthrough` 或 `.strict`。
* **冪等性 (Idempotent Operation)**：Schema 的設計必須支援增量更新，`Schema.parse(Schema.parse(input))` 必須等同於 `Schema.parse(input)`。
* **數值型別**：優先使用 `z.coerce.number()`，並配合 `z.transform` 進行自動糾錯（例如：`_.clamp(value, 0, 100)`），而不是使用 `.min(0).max(100)` 讓驗證直接失敗。
* **預設值**：優先使用 `z.prefault` 而非 `z.default`。如果一個 `z.object` 足夠複雜，請為其每個欄位設定 `.prefault(...)`。
* **陣列與物件**：優先使用物件（Record/Object）而非陣列，以便於索引與更新。例如使用 `物品栏: z.record(z.string().describe('物品名'), z.object({ 描述: z.string() }))` 而不是 `z.array(...)`。
* **描述說明**：僅當欄位名稱無法自解釋時（如 `z.record` 的 key type）才使用 `z.describe`。如果欄位名稱已經足夠清晰，則不要使用。
* **純粹性**：`schema.ts` 中**只能**包含 `export const Schema = z.object({...})` 的定義，嚴禁放入任何副作用程式碼（如直接呼叫酒館 API 或註冊函數）。

## 3. 前端介面開發 (React UI)

角色卡的專屬介面（如狀態欄）必須使用 **React + TailwindCSS** 進行開發。

### 3.1 嚴禁使用 Vue / Pinia

* **全面廢棄 Vue**：舊版模板中的 Vue 元件 (`.vue`) 與 Pinia 狀態管理已不再適用。
* **改用 React Hooks**：請使用 React 的 Functional Components 與 Hooks (`useState`, `useEffect`) 來管理組件的本地狀態。

### 3.2 資料存取與更新

* **禁止直接存取**：UI 層（`ui/`）**絕對禁止**直接調用酒館助手的底層 API（如 `getVariables`）或直接修改 MVU 狀態。
* **單向資料流**：
  1. UI 透過 `backend/` 提供的 API 發送意圖 (Intent)。
  2. `backend/` 處理邏輯後，透過 `shared/mvu/mvuBridge.ts` 更新 MVU 變數。
  3. MVU 觸發 `VARIABLE_UPDATE_ENDED` 事件。
  4. UI 監聽該事件，並呼叫 API 重新拉取最新資料以觸發 React 重新渲染 (Re-render)。

## 4. 世界書設定

`schema.ts` 所定義的變數結構除了供程式碼使用外，亦用於編寫世界書。

* 編譯後生成的 `schema.json` 描述了支援的輸入資料格式，可用於編寫 `[initvar]變量初始化勿開` 條目。
* 世界書中必須包含 `[mvu_update]變量更新規則`，指導 AI 如何根據劇情發展與 `schema.ts` 的定義，正確地增量更新 MVU 變數。

### 4.1 變量更新規則撰寫指引

* **合併同類規則**：如果多個變數的更新規則相似，應該將它們合併。例如 `主角.能力面板.力量`、`主角.能力面板.敏捷` 可以合併為 `主角.能力面板.${六维}`。
* **動態鍵值**：對於 `z.record(z.string(), ...)` 這種動態鍵值，在規則中應該將 key 部分放入 `type` 的索引簽名中，例如：

    ```yaml
    物品栏:
      type: |-
        {
          [物品名: string]: {
            ...
          }
        }
    ```

* **巢狀結構**：將同一個物件的欄位嵌套在一起以減少 Token 消耗並提高可讀性（例如將 `主角.能力面板` 和 `主角.装备栏` 嵌套在 `主角` 之下）。
* **唯讀欄位**：以 `_` 開頭的欄位名稱（如 `_变量`）是唯讀的，**不要**為它們列出更新規則。
* **省略型別**：如果變數類型是 `string`，請省略 `type` 欄位。
* **自解釋變數**：除非需要指定特殊的更新規則，否則避免為名稱已經自解釋的變數列出更新規則。
