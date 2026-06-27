# HypnoOS UI兼容性與響應式規範

本規範說明在 HypnoOS 專案中，如何確保前端介面（特別是手機模擬框內部的 UI）能夠在各種螢幕尺寸下（從電腦網頁到平板、A53 甚至更小的手機）平滑且等比例地縮放。

## 1. 核心概念與原理

HypnoOS 運行在一個固定長寬比（`9/19.5`）的「手機模擬框 (Phone Bezel)」中。
過去我們依賴 Tailwind 內建的 `@media` 斷點（如 `sm:`, `md:`）來切換手機與桌機兩種大小（兩個檔位）。但這些斷點是基於**瀏覽器視窗寬度**，而非手機模擬框的實際寬度，導致在中間尺寸或極小尺寸的螢幕上，介面比例會變得不協調或內容被裁切。

因此，我們全面導入 **Tailwind Container Queries (`@container`)** 搭配 **CSS `clamp()` 與 `@cqw` (Container Query Width)** 來實現「流暢縮放 (Fluid Scaling)」。為了保持程式碼的乾淨，我們採用**全局 `@theme` 覆寫**的方式，而不需要在 React 組件中寫死 `clamp` 數值。

## 2. 根容器設置

手機外框必須設定為 `@container`，這樣內部的所有尺寸計算才能基於這個框的實際寬度。
在 `src/催眠APP前端/App.tsx` 中，我們設定了：

```tsx
<div
  className="@container relative w-full max-w-[420px] aspect-9/19.5 bg-black ..."
>
```

這樣外框就會有一個最大寬度限制，並且內部的元素都可以使用 `@cqw` 單位進行縮放。

## 3. 流暢縮放公式與全局覆寫 (Fluid Math & Global Overrides)

我們在 `src/催眠APP前端/index.css` 中透過 Tailwind v4 的 `@theme` 覆寫了預設的間距、文字大小與圓角。

*   **`1cqw`** 等於容器寬度的 1%。當手機框達到最大 420px 時，`1cqw = 4.2px`。
*   我們使用 `clamp(最小值, 流暢值, 最大值)` 來取代固定的 pixel。
    *   **最大值**：原本 Tailwind 預設的尺寸（例如 `spacing-4` 是 16px）。
    *   **流暢值**：`最大值 / 4.2` 得到的 `cqw` 數值。例如 `16 / 4.2 ≈ 3.8cqw`。
    *   **最小值**：為了防止在極小螢幕上文字或間距縮到太小，我們設定了底限（通常是最大值的 75%，但極小文字絕對不低於 9px 或 10px）。

### 範例 (`index.css` 片段)：

```css
@theme {
  /* Fluid Spacing */
  --spacing-4: clamp(12px, 3.81cqw, 16px);
  
  /* Fluid Text Sizes */
  --text-sm: clamp(12px, 3.33cqw, 14px);

  /* Custom Container Breakpoints */
  --breakpoint-sm: 360px;
  --breakpoint-md: 400px;
}

@custom-variant sm (@container (min-width: 360px));
@custom-variant md (@container (min-width: 400px));
```

## 4. 開發新 APP 的注意事項

當你在 `ui/` 下開發新的 APP（如行事曆、角色編輯器等）時，請遵守以下規則：

1.  **直接使用標準 Tailwind 類別**：因為我們已經在全局覆寫了，所以你可以放心地直接使用 `p-4`, `gap-2`, `text-sm`, `w-12`, `rounded-xl` 等標準類別，它們會**自動變成流暢縮放**！
2.  **避免寫死的 Pixel 數值**：盡量避免使用 Arbitrary values (例如 `w-[18px]`, `text-[11px]`)。如果必須使用，請確保它在各種螢幕大小下都合理，或者手動寫成 `clamp()` 格式。
3.  **使用 `md:` 與 `sm:` 斷點**：我們已經將 `md:` 和 `sm:` 覆寫為 Container Queries (`@container (min-width: ...)` )。因此你可以繼續使用 `md:block hidden` 這種寫法來做響應式排版，它會根據「手機模擬框」的寬度來觸發，而不是瀏覽器視窗！
4.  **測試極限尺寸**：開發完成後，請務必在瀏覽器開發者工具中，將視窗高度拉到極短（例如 500px 以下），或寬度拉到極窄（例如 320px），確認 UI 是否平滑縮小且沒有破版。
