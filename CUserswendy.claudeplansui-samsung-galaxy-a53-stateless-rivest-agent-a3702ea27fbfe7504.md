# 催眠APP前端/App.tsx 響應式介面實作計畫

這個計畫旨在解決手機版 UI 在不同螢幕尺寸（特別是高度較短的螢幕）下的溢出問題，並確保它在各種裝置（大於或小於 Samsung Galaxy A53）上都能完美呈現。

## 步驟一：修改外層容器樣式
1. 開啟 `src/催眠APP前端/App.tsx` 檔案。
2. 找到目前的 App 根容器 `<div className="w-full flex items-center justify-center p-2">`。
3. 將其修改為強制填滿整個視窗並防止捲動溢出的樣式：
   ```tsx
   <div className="fixed inset-0 w-full h-full flex items-center justify-center p-2 sm:p-4 bg-black/90">
   ```
   *註：加入 `fixed inset-0` 可以確保它始終綁定在視口上，避免被其他元素推擠。*

## 步驟二：更新手機外框 (Phone Bezel) 的尺寸限制
1. 找到手機外框的 `div`：
   ```tsx
   <div className="relative w-full max-w-[420px] aspect-9/19.5 bg-black rounded-[3rem] border-8 border-gray-800 overflow-hidden shadow-2xl ring-2 ring-black/20">
   ```
2. 將固定的 `max-w-[420px]` 移除，改用內聯樣式 (inline style) 動態計算最大寬度，使其同時受限於「最大寬度」與「螢幕高度」。
3. 套用 `calc()` 函數，根據 `100vh` 減去上下 padding (例如 `2rem` 或 `32px`) 後，依照 `9/19.5` 的長寬比計算出最大寬度限制：
   ```tsx
   <div 
     className="relative w-full bg-black rounded-[3rem] border-8 border-gray-800 overflow-hidden shadow-2xl ring-2 ring-black/20"
     style={{
       maxWidth: 'min(420px, calc((100vh - 2rem) * 9 / 19.5))',
       aspectRatio: '9 / 19.5'
     }}
   >
   ```
   *原理解釋：*
   - `w-full` 確保在極窄的螢幕上（例如寬度小於 350px），寬度會自適應螢幕。
   - `maxWidth: 'min(420px, calc((100vh - 2rem) * 9 / 19.5))'` 確保寬度不會超過 `420px`，**同時**也確保當螢幕很矮時，寬度會按比例縮小，進而讓高度不超過螢幕範圍 (`100vh - 2rem`)。
   - `aspectRatio: '9 / 19.5'` 鎖定比例，讓高度由寬度自動決定。

## 步驟三：確保內部內容適應新尺寸
1. 檢查外框內部的螢幕內容：
   ```tsx
   <div className="w-full h-full bg-black overflow-hidden relative">{renderCurrentApp()}</div>
   ```
   由於我們已經在父層設定了 `aspect-ratio` 並且寬高皆會按比例縮放，內部內容使用 `w-full h-full` 即可完美貼合新的外框尺寸，無需額外改動。

## 步驟四：檢查並優化 Home Screen（可選）
1. 若外框按比例縮小後，發現 Home Screen 上的圖示或文字變得過於擁擠，可考慮在 `HomeScreen` 的 grid 或文字上使用基於百分比的 `rem`、`em` 或是 Tailwind 的 `@container` 查詢來微調。不過由於使用了 `w-full`，原本依賴寬度的 `sm:` 斷點也能在一定程度上保持良好的顯示效果。

## 總結
透過這個計畫，我們可以僅憑純 CSS (`min()` 與 `calc()`) 就實現完美鎖定比例的響應式設計，既不會在寬螢幕上無限放大，也不會在矮螢幕上超出視窗底部。
