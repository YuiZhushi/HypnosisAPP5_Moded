# HypnoOS UI 兼容性與響應式規範

> **排版限制提醒**：HypnoOS 運行在一個固定長寬比（`9/19.5`）的手機模擬框中。所有排版縮放應基於該外框寬度，而非瀏覽器視窗寬度。

---

## 1. 核心概念與原理

為了確保 UI 在各種螢幕尺寸（從電腦網頁到平板、小螢幕手機）下都能等比例縮放且不被裁切，本專案棄用了傳統基於視窗寬度的 `@media` 斷點。

我們全面導入 **Tailwind Container Queries (`@container`)** 搭配 **CSS `clamp()` 與 `cqw` (Container Query Width)** 單位來實現「流暢縮放 (Fluid Scaling)」。為了保持組件代碼乾淨，這套數學公式已在 `index.css` 的全局中進行覆寫，開發者不需要在 React 組件中寫死 `clamp` 數值。

---

## 2. 根容器與模擬框設置

手機外框必須設定為 `@container`，使內部的所有尺寸計算基於此框的實際寬度：

```tsx
// 在 App.tsx 中設定外框：
<div className="@container relative w-full max-w-[420px] aspect-9/19.5 bg-black ...">
```

當外框達到最大設定寬度 420px 時，內部單位的關係為：
`1cqw = 4.2px` (即容器寬度的 1%)。

---

## 3. 全局流暢縮放覆寫 (index.css)

我們在 `src/催眠APP前端/index.css` 中透過 Tailwind v4 的 `@theme` 覆寫了預設的間距、文字大小與圓角，採用 `clamp(最小值, 流暢值, 最大值)` 公式：
* **最大值**：Tailwind 預設的尺寸（例如 `spacing-4 = 16px`）。
* **流暢值**：`最大值 / 4.2` 得到的 `cqw` 數值（例如 `16 / 4.2 ≈ 3.81cqw`）。
* **最小值**：為了防止在極小螢幕上縮到太小，我們設定了底限（通常是最大值的 75%，但極小文字絕不低於 9px 或 10px）。

### 覆寫範例：
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

---

## 4. 開發新 APP 與組件的注意事項

當在 `ui/` 底下開發新的 APP（如行事曆、角色編輯器等）時，請遵守以下規則：

1. **直接使用標準 Tailwind 類別**：因為預設尺寸已被覆寫，您可以直接使用 `p-4`、`gap-2`、`text-sm`、`rounded-xl` 等，它們會**自動變成流暢縮放**！
2. **避免寫死的 Pixel 數值**：盡量避免使用 Arbitrary values (例如 `w-[18px]`、`text-[11px]`)。如果必須使用，請確保它在各種螢幕大小下都合理，或者手動寫成 `clamp()` 格式。
3. **使用 `@container` 斷點**：`md:` 和 `sm:` 已被覆寫為 Container Queries。因此你可以繼續使用 `md:block hidden` 這種寫法，它會根據「手機模擬框」的寬度而非瀏覽器寬度來觸發！
4. **適配 Iframe 限制**：
   * **絕對禁止使用 `vh` / `vw` 單位**：會受宿主容器高度影響導致排版崩潰。請使用 `width` + `aspect-ratio` 或 Tailwind 的 `h-full w-full` 控制。
   * **避免撐高容器**：避免使用 `min-height`、`overflow: auto` 等會撐高外層容器的屬性。
5. **測試極限尺寸**：開發後，在瀏覽器開發者工具中，將視窗高度拉到極短（如 500px 以下）或寬度拉到極窄（如 320px），確認 UI 是否能平滑縮小且無任何破版。
