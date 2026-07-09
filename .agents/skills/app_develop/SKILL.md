---
name: app_develop
description: 當需要規劃或開發新的前端 APP 功能時，必須參考的注意事項與架構設計指南。
---

# app_develop 技能指引

在開發 HypnoOS 的新桌面應用（APP）或功能模組時，為了保證代碼的健壯性與可維護性，請遵守以下「數據與合約優先 (Model & Contract First)」開發流程。

---

## 1. 數據與合約優先的 6 步開發流程

在進行 APP 設計時，**嚴禁先寫 UI 再拼湊邏輯**。請嚴格按照以下 6 步流程推進：

```
1. 需求與定位 ➔ 2. 資料模型與狀態設計 ➔ 3. MockAPI 接口合約 ➔ 4. UI 佈局考察 ➔ 5. 數據串接 ➔ 6. 極限測試
   (Scope)          (Model & State)        (API Contract)       (UI & Layout)       (Wiring)         (Validation)
```

### 1.1 第一步：需求與定位 (Scope)
* 釐清玩法、催眠情境與使用者故事（User Stories）。
* 評估 APP 是否涉及運行時狀態變更（MC 能量、好感度、背包物品等）或與 AI 對話（Pipeline 模式）。
* **檢查是否有可複用的通用機制**（如背包物品、地圖節點），避免重複實作。

### 1.2 第二步：資料模型與狀態設計 (Model & State)
* **先於 UI 設計**。在 `models/index.ts` 中定義 APP 專屬的型別與數據結構，並在 `AppMode` 中添加新 App 的 mode 識別碼。
* 區分靜態常數與靜態字典（放入 `staticData/index.ts` 內）與運行時狀態變數（放入 `database/mvuVariables.ts` 或 `chatVariables.ts` 內）。
* 在 `database/mockDatabase.ts` 中新增該 APP 狀態的初始 Mock 數據。

### 1.3 第三步：接口與 API 設計 (API Contract)
* 在 MockAPI 中實作該 APP 的 Endpoint 與動作處理邏輯（如購買、接取、更新），定下 UI 與邏輯的通訊合約。
* 遵守**預設不 fallback 規則**（資料結構有異動時，預設不 fallback，直接使用新資料，以快速暴露 bug）。

### 1.4 第四步：UI 佈局與適配 (UI & Layout)
* 依據模擬手機 `9/19.5` 比例，在 `ui/` 下建立對應的 APP 組件資料夾。
* 使用 Tailwind 標準原子類，依靠 `cqw` / `clamp` 全局流暢縮放與 Iframe 限制（**絕對禁用 vh/vw**，使用百分比控制與 `overflow-y-auto`）。

### 1.5 第五步：數據串接與交互 (Wiring)
* 讓 UI 組件調用 MockAPI 接口來獲取與修改數據。
* 處理生命週期：在 jQuery `$(() => {})` 中執行初始化，在 `pagehide` 事件中卸載事件監聽。

### 1.6 第六步：極限測試與驗證 (Validation)
* 執行 `pnpm build:dev` 確認編譯成功且無型別錯誤。
* 拉動瀏覽器視窗至極限尺寸（高度 <500px, 寬度 <320px）驗證響應式排版。
* 測試防呆邊界情況（如 MC 不足時購買、背包滿時獲得物品）。

---

## 2. 開發期數據流隔離提醒

* **UI 隔離**：**UI 層不直接觸碰任何靜態資料或變數，而是統一通過 MockAPI 接口來存取數據。**
* 依賴方向必須嚴格遵守：`ui` -> `MockAPI (Models / Database)`。

---

## ✅ 開發前審查清單 (Checklist)

- [ ] **數據模型優先**：是否已在 `models/index.ts` 中完成型別宣告，且已在 `staticData/` 或 `database/` 中註冊好初始資料？
- [ ] **不 fallback 預設**：若資料結構有異動，是否預設不進行 fallback 載入？
- [ ] **UI 適配與 Iframe 限制**：確認排版中**沒有使用**任何 `vh`/`vw` 單位？
- [ ] **生命週期**：初始化與清理是否正確使用 `$(() => {})` 與 `pagehide`？
