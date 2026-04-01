---
name: app_develop
description: 當需要規劃或開發新的前端 APP 功能時，必須參考的注意事項與架構設計指南。
---

# app_or_function_develop

在開發 HypnoOS 的新桌面應用（APP）或新的功能模組時，為了保證代碼的健壯性和可維護性，請嚴格遵守以下開發架構與注意事項。確保你在動手寫代碼前，已經從下述六個維度完成了大綱設計與思考。

## 1. 分層架構處理 (Layered Architecture)

HypnoOS 採用嚴格的分層架構，各司其職，**嚴禁跨層調用或在 UI 組件內寫死複雜的數據流邏輯**。

- **類型層 (`types.ts`)**：統一維護所有的狀態結構、枚舉、功能設定（如 `AppMode`, `HypnosisFeature` 等）。
- **數據層 (`services/dataService.ts`)**：負責核心數據的初始化、讀取與更新（結合 Zod 校驗與酒館變量映射）。所有對持久化數據的修改，**必須**透過此層的方法（如 `DataService.updateStoreWith`）。
- **權限與業務層 (`services/access.ts`)**：封裝是否解鎖、金額扣除、訂閱等級檢查等純邏輯，不能依賴具體的 UI 實現。
- **組件層 (`components/`)**：僅負責渲染和事件綁定。讀取數據並展示，用戶操作時調用 DataService 或 MvuBridge 的方法，**組件層應保持無狀態或僅有 UI 視覺狀態**。
- **Prompt 層 (`prompts/`)**：構造「發送到聊天」的指令訊息字串，保持為純函數。

## 2. 數據處理邏輯 (Data Processing Logic)

在規劃新 APP 前，必須明確數據的讀寫來源與存儲方式：

- **存儲落點明確**：數據是依賴酒館原生數值變量（如 `系統.當前MC點`），還是屬於 HypnoOS 特有的功能配置（如 `系統._hypnoos`）？新增功能的設置、解鎖進度應統一掛載到 `PersistedStore` 的 `appData` 或 `features` 中。
- **響應與同步**：修改持久化記錄後，必須調用同步機制（如 `MvuBridge.syncPersistedStore(store)`），確保整體流程和組件能感知到變化並重新渲染。
- **向後兼容與校驗**：使用 Zod 校驗所有本地數據，這能確保玩家讀取舊存檔（缺乏新加入欄位）時，系統能自動補齊默認值而不會導致白屏崩潰。

## 3. MVU 交互 (Model-View-Update)

如新 APP 需要頻繁的狀態流轉或是需要與世界書、後端腳本互動：

- **Model**：統一通過 `MvuState` 或 `PersistedStore` 維護狀態模型。
- **View**：View 只做純 UI 的映射，基於 Model 的最新狀態渲染介面，**絕不主動偷改狀態**。
- **Update 機制**：透過 Dispatch 行為和 `MvuBridge.ts` 註冊與腳本通訊的事件（如 `Mvu.events.on(...)`）來觸發變更。
- **跨端觸發 UI**：若要從酒館對話框或其他腳本觸發前端介面的刷新，應通過觸發 Mvu Event 來處理，而不是直接操縱 iframe 內的 DOM。

## 4. UI 布局 (UI Layout & Styling)

HypnoOS 是一個**嵌套在 iframe 中的偽手機系統**，UI 設計必須符合移動端直覺並遵守硬性限制：

- **絕對禁止使用 `vh` / `vw` 單位**：這會導致在 iframe 下高度溢出與滾動條崩潰。全屏組件應使用 `w-full h-full`，依賴父級的 `aspect-ratio` 與最大寬度來限制自身。
- **純 TailwindCSS 優先**：拋棄散落的 CSS 文件，全面使用 Tailwind 原生 utility classes。保持設計的一致性（毛玻璃 `backdrop-blur`、圓角 `rounded-xl`、暗黑設計等）。
- **內聯滾動設計**：對於有長列表內容的 APP，外層鎖定高度，內部具體內容區塊使用 `overflow-y-auto`，確保只在 App 的內部出現滾動條，不會撐破整個作業系統介面。
- **z-index 管理**：盡量避免使用會覆蓋全局的 `fixed` 或雜亂的 `absolute`，以免遮擋 Status Bar、Home Indicator 等 OS 級原生元素。

## 5. 使用到的接口調用 (API & Interfaces)

明確新 APP 將如何透過酒館助理的 API 完成交互：

- **變量讀寫**：使用封裝的 `getVariables` / `updateVariablesWith`，禁止組件內直接 hardcode 呼叫變量 API，需通過 DataService 中轉。
- **發送指令/對話片段**：利用 `createChatMessages(text)` + `triggerSlash('/trigger')` 的組合，將操作行為打包成指令丟進聊天流，推動 AI 推進劇情。
- **避免越權操作**：嚴禁嘗試讀取酒館頂層窗口或破壞 iframe 環境的隔離性。

## 6. 與其他 APP 的交互 (Inter-App Communication)

若你的新 APP 需要與系統內別的功能模組聯動：

- **路由導航**：透過更新 `AppMode` 並調用全局路由跳轉函數（如 `setAppMode(...)`）從一個 APP 平滑切換到另一個 APP。
- **數據互通共享**：透過讀取同一份 `PersistedStore`，一個 APP 的行為（例如：在「任務 APP」達成了某個成就）能讓另一個 APP（例如：解鎖了「催眠 APP」裡的某個新選項）在下一次打開時立刻生效。
- **統一通知反饋**：涉及重要提示或錯誤攔截時，不要私自在新 APP 裡寫 `window.alert` 或獨立的 Toast，請復用系統級別的 Notification 提示或狀態列更新功能。

## 7. 跨 APP 共用設計與擴展性 (Extensibility & Common Settings)

當你在開發一個具有「基礎設施」性質的 APP（例如：集中管理的**設置 APP**）時：

- **預留擴展空間**：此類 APP 必須留下足夠的擴展接口（例如註冊表或動態加載的 Tabs），讓後續開發的新 APP 能將自己的專屬設置項注入其中，避免修改核心代碼。
- **統一管理通用配置**：跨 APP 共用的設定（如 AI 生成時需要的 API 配置：金鑰、端點網址、模型名稱、溫度、最大 Token 數、各種 Penalty 等）應**統一收攏**在設置 APP 中進行狀態管理。

## 8. AI 生成與 API 整合 (AI Generation & API Integration)

若新 APP 的功能包含利用 AI 進行內容生成：

- **共享 API 資源**：生成功能應去讀取設置 APP 中保存的全局 API 參數，不應各自為戰。模型名稱等資訊能自動從端點獲取時盡量做自動獲取。
- **提供玩家介入空間**：設計 AI 生成介面時，**必須**包含讓玩家輸入「修改建議」或「生成指引」的輸入框（Prompt Override），確保玩家有能力操控生成走向。
- **背景解析 (MVU 解析)**：如果 AI 生成的行為是在背景執行且不產生新的可見聊天樓層，應利用 Mvu 機制（如 `Mvu.parseMessage`）自行解析 AI 回傳的更新文本，並透過 `Mvu.replaceMvuData` 將狀態寫回樓層。

## 9. 新增功能前的「通用 / APP 專屬」判定（必做）

在新增功能前，必須先做一次功能歸類，避免後續重複實作與命名衝突。

- **判定為通用功能（多 APP 共用）**：符合以下任一條件時，優先抽為通用組件或通用服務。
  - 兩個以上 APP 會使用到同一能力。
  - 與單一 APP 的畫面與資料結構無強耦合。
  - 可以透過統一輸入/輸出介面被重複呼叫。
- **判定為 APP 專屬功能**：若邏輯明顯綁定某 APP 業務語義、欄位結構、交互流程，則必須實作在該 APP 內部。

> 原則：**可共用就抽通用，不可共用才留 APP 內**。

## 10. 命名規範（避免與其他 APP/服務混淆）

### 10.1 通用組件 / 通用服務命名

- 建議使用 `shared` / `common` / `os` 前綴與語義化名稱。
- 範例：`sharedAiRequestAssembler`、`commonPromptModuleEditor`、`osAiRequestPipeline`。
- 禁止使用無作用域且語意模糊的名稱，如：`promptTuning`、`moduleManager`。

### 10.2 APP 專屬命名

- 方法、狀態、型別需標明 APP 歸屬（建議 `<appId>` 前綴）。
- 範例：`settingsAppPromptTuningState`、`characterEditorAppPlaceholderMap`、`settingsAppUpdatePromptModules()`。
- 禁止在 APP 專屬程式碼中使用看似通用的名稱，以免被其他 APP 誤用。

## 11. 持久化命名規範（避免鍵值與方法衝突）

- APP 專屬持久化資料需放在清楚的 APP 命名空間下（例如 `appData.settingsApp.*`、`appData.characterEditorApp.*`）。
- 寫入方法需與資料命名空間一致，名稱需可直接看出歸屬。
- 若為通用服務持久化，鍵名需標明 `shared`/`common`，不可偽裝為單一 APP 資料。

## 12. 注釋規範（避免後續維護困難）

- 進行任何修改或新增功能時，必須在程式碼內加入完整的注釋，說明修改的原因、目的、影響範圍等。

---

## ✅ 開發前審查清單 (Checklist)

1. [ ] **類型對齊**：是否已在 `types.ts` 定義了新 APP 專用的數據介面和路由 Enum？
2. [ ] **持久化設計**：數據存儲放在底層 Tavern 變量還是 `_hypnoos`？同步回寫機制（Zod 校驗）是否完善？
3. [ ] **關注點分離**：組件只負責渲染 UI 和接收點擊，金額扣除/判斷的業務邏輯有抽離到 `access.ts` 或 `dataService.ts` 中嗎？
4. [ ] **適配 iframe 布局**：UI 是否限制在了父容器內？確認**沒有使用** `vh` 來處理高度？
5. [ ] **發送提示管理**：給 AI 的 `發送消息` 字串構造，有獨立提取到 `prompts/` 資料夾做成純函數嗎？
6. [ ] **擴展與共用性**：新加入的設置是否應放入共用的「設置 APP」中？代碼設計是否留有讓後續模組注入的插槽？
7. [ ] **AI 整合完整度**：涉及到 AI 生成的功能，是否已引用全局 API 參數？是否包含了供玩家自定義指引的輸入框？
8. [ ] **通用或APP專屬**：這個功能是通用還是 APP 專屬？判定依據是否明確。
9. [ ] **命名規範**：方法名 / 型別名 / state 名是否有清楚作用域，避免跨 APP 混淆。
10. [ ] **持久化命名規範**：若需持久化，鍵名與寫入方法是否可辨識來源 APP（或 shared/common）。
