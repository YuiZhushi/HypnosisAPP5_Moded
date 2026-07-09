# 催眠 App 開發說明

本文件專注於「催眠 App」內部專屬功能的開發與修改流程。

## 1. 新增/修改"催眠功能"（Feature）

**注意：此處指的「催眠功能」是指在「催眠 App」內部專屬的催眠指令或特色功能，並非全系統通用的 OS 功能。**

開發步驟如下：

1. **釐清範圍**：確認該功能僅作用於催眠 App 的生命週期內，不應影響到其他桌面應用。
2. **`types.ts`**（或對應常數層）：如需新欄位，擴充 `HypnosisFeature` 介面。
3. **`backend/` 業務邏輯**：在對應的資料庫或結構中添加/修改功能定義（設定 `id`, `title`, `tier`, `costType` 等），並實作其內部狀態變化，確保能與 App 內其他的催眠階段銜接。
4. **`ui/` 前端組件**：功能會按 `tier` 自動分組渲染。如需特殊 UI（視覺效果、動畫或操作按鈕），在對應位置添加條件渲染。
5. **持久化**：透過後端 API 寫入 `系统._hypnoos.features`（例如透過 `DataService.updateFeature()` 或 `MvuBridge.syncPersistedStore()`）。
6. **重置保留**：如功能在重置後需保留狀態，將 id 加入 `PERSISTENT_FEATURE_IDS`。
