# 身體改造系統 (Body Modification System) 設計提案 V2 (靈感與架構指南)

本提案為應對「文字故事且劇情不確定」的核心難點，設計了一套**雙軌制狀態架構（Dual-Track Framework）**。此架構能無縫橋接「玩家在桌面 OS 的 APP 操作」、「底層數值狀態（MVU Variables）」與「AI 劇情的文字上演繹」。

---

## 1. 雙軌制狀態架構 (Dual-Track Framework)

在開放式的文字故事中，最大的挑戰在於：**如何讓 AI「看懂」角色的改造，並在文字演繹中體現，同時將文字情節的結果「寫回」數值系統？**

我們採用以下雙軌制設計：

```mermaid
flowchart TD
    subgraph UI & DB [1. 機械數據層 (TS/MVU)]
        A[改造 APP 手術台] -->|消耗材料與錢| B[寫入 ownedBodyModifications]
        B -->|動態計算| C[有效敏感度/屬性]
        B -->|條件限制| D[物品與背包交互]
    end

    subgraph Prompt & AI [2. 語意特徵層 (Prompt/LLM)]
        B -->|時間推進與樓層轉換| E[語意標籤與 Prompt 注入]
        E -->|提示詞輸入| F[AI 劇情推進]
        F -->|描寫改造交互故事| G(生成不確定文字故事)
        G -->|特定標籤回寫| H[UpdateVariable YAML patch]
        H -->|指令解析更新| B
    end
```

### 1.1 機械數據層 (Mechanical Data Layer)
*   **職責**：精確控制底層數值、限制條件、物品消耗、負荷上限與適應期。
*   **特點**：這是遊戲程式能直接判斷的硬邏輯（例如：`obedience >= 50` 才能進行某改造，或是部位 `load < maxLoad`）。

### 1.2 語意特徵層 (Semantic Feature Layer)
*   **職責**：向 LLM 傳遞角色的肉體變更細節，並允許 LLM 透過指令修正數據。
*   **特點**：
    *   **Prompt 注入（外觀與感知）**：每個改造方案皆包含 `promptInjection`（例如：`"胸部被安裝了精緻的催眠乳環，隨著走路會發出輕微鈴聲，受到刺激會釋放微弱電流"`）。當角色進行此改造後，外觀或行為描述會動態追加此段落，AI 讀取後便能在故事中自動演繹。
    *   **AI 指令回寫（LLM-Writeback）**：利用專案現有的 `<UpdateVariable>` YAML patch 機制，若 AI 在劇情演繹中寫到某個改造受到劇烈刺激或損壞，可直接透過 YAML 調整其狀態（例如 `isActive: false` 或修改 `customParams` 裡的數值），實現文字情節到數值的無縫橋接。

---

## 2. 部位微觀管理與自訂部位動態擴充 (Dynamic Parts)

根據《用戶思考空間》的靈感，身體部位需要能夠動態新增（如：尾巴、翅膀、額外乳房），且非必要部位在未改造前不應臃腫地存在於資料結構中。

### 2.1 部位屬性微觀分級 (0~100 敏感度/鬆緊度級別)
所有部位屬性（敏感度、鬆緊度）除了數值外，在 UI 顯示上對應為以下評級：
*   **超超差 (F)**：`score < -100`
*   **超差 (E)**：`-100 <= score < -60` (例如：E-, E, E+, E++)
*   **差 (D)**：`-59 <= score < -20` (例如：D-, D, D+, D++)
*   **普通 (C)**：`-19 <= score < 19` (以 `0` 為基準，區分為 C-, C, C+, C++)
*   **好 (B)**：`20 <= score < 59` (例如：B-, B, B+, B++)
*   **超好 (A)**：`60 <= score < 100` (例如：A-, A, A+, A++)
*   **超超好 (S)**：`score >= 100`

### 2.2 自訂部位動態擴充機制
為了防止資料結構臃腫，我們採用**「有改造才存在」**的原則：
1.  **預設部位**：`mouth`, `breastLeft`, `breastRight`, `vagina`, `anus`, `urethra`, `clitoris` 等始終存在於 NPC 資料中。
2.  **自訂/動態部位（如 tail, wings）**：
    *   在靜態的 `chatVariables.bodyParts` 中，定義該部位的基礎資訊（如名稱、是否有敏感度、是否能高潮）。
    *   在 NPC 的 `mvu` 變數中，**只有當 NPC 擁有對應的身體改造（如裝了「惡魔尾巴」），且該部位是可以高潮/有敏感度時**，才會將此部位實體化寫入 `chars[npc].bodyParts` 之中。
    *   一旦拆除此改造，且該部位無其他改造時，從 `mvu` 的 `bodyParts` 中移除該鍵，保持資料乾淨。

---

## 3. 部位負荷度 (Load Capacity) 與互斥條件限制

改造不能無限制堆疊，必須符合角色的生理承受力。

### 3.1 部位負荷度 (Body Load Capacity)
每個部位設有 `Load` (負荷) 限制：
$$\text{部位最大負荷 (Max Load)} = \text{基礎體質} \times k + \lfloor\frac{\text{服從度}}{10}\rfloor$$
*   **改造負荷消耗 (loadCost)**：
    *   *微度 (如耳環/乳環)*：`loadCost: 1 ~ 2`
    *   *中度 (如泌乳化/局部史萊姆化)*：`loadCost: 4 ~ 6`
    *   *重度 (如器官移除/新增額外乳房)*：`loadCost: 8 ~ 10`
*   **判定規則**：當前部位已安裝改造的 `loadCost` 總和不能大於該部位的 `Max Load`。若超載，UI 提示「肉體負荷已達極限，NPC 的精神/身體無法承受更多改造，請先提升服從度或注射體質強化藥劑」。

### 3.2 互斥與衝突條件 (Mutual Exclusion)
*   **插槽互斥 (Slot Mutex)**：若兩個改造佔用同一個 `Slot` (如：`breastLeft` 同時想安裝「機械乳頭」與「史萊姆乳頭」)，系統因 Slots 衝突自動阻擋。
*   **類型互斥 (Group Mutex)**：在 `BodyModificationDef` 中加入 `conflictGroups: string[]` (衝突組)。例如「重度機械化」與「史萊姆化」都屬於 `conflictGroups: ['biological_matrix']`。若已安裝其中一種，同組的另一種在 UI 上會灰色顯示為「與現有肉體材質互斥」。

---

## 4. 物品與角色背包交互機制 (Inventory & Production)

身體改造不是孤立的數值，它必須與物品系統（Inventory）產生深度的物質交互：

### 4.1 手術材料與資源消耗 (Cost & Consumables)
安裝改造時，可配置所需的資源與材料：
```typescript
cost: {
  money?: number;
  pts?: number;
  requiredItems?: Array<{ itemId: string; quantity: number }>;
}
```
*   **執行流程**：點擊「執行手術」時，APP 呼叫 API 檢查玩家背包中的材料是否足夠。若足夠，扣減對應材料並新增改造，否則按鈕灰色。

### 4.2 週期性產出 (Periodic Production)
某些身體改造（如：`breast_milk_mod` 雙乳泌乳化）具備生產道具的能力：
*   **時間計檢算**：每次虛擬時間前進（玩家活動、睡覺、或推進日程時），系統遍歷 NPC 的啟用改造。
*   **產出邏輯**：
    *   如果改造有 `triggerEffect` 且類型為 `daily`（或按照日程流逝比例計算）：
    *   系統呼叫 API，在該 NPC 的背包中（`chars[npc].inventory`）自動新增數量 `+1` 的 `item_milk`（母乳）。
    *   這使得「身體改造」與「產業 APP（如妓院/工廠）」在未來可以完美聯動，透過產出物獲得經濟效益。

### 4.3 物品使用限制與特異觸發 (Item Restriction)
*   **限制使用**：當 NPC 被改造為「子宮切除（`womb_removed`）」時，使用「受孕藥劑」這類道具會直接阻擋，提示「目標角色已無子宮，無法使用此道具」。
*   **效果加成**：當部位裝有金屬穿刺改造（如 `piercing`）時，使用「電擊震動器」道具，其快感值增加速度會變為 1.5 倍，這在物品使用 API 判斷時，透過檢查部位是否含有特定 tag 的改造來實現。

---

## 5. 虛擬時間適應期與排異反應 (Adaptation Period)

為了增加代入感與調教難度，改造並非即時完美運作，而是需要經過「肉體適應期」。

### 5.1 適應期計算方式
適應期不依賴現實時間的 Timer，而是綁定**遊戲的虛擬時間 (Virtual Time)**：
*   **安裝時**：
    *   `installedVirtualTime` 寫入當前虛擬時間。
    *   設定適應期結束時間：`adaptation.endVirtualTime = currentVirtualTime + 48小時` (依改造難易度而定)。
*   **排異反應 (extraModifiers)**：
    *   在適應期內，`isActive: true`，但會額外附加 `extraModifiers`。例如：因排斥不適感，導致 NPC 的「服從度/好感度」每日結算時扣減，或者「警戒度」維持在較高水平。
*   **適應期結束**：
    *   每次虛擬時間前進時，系統會比對：`currentTime >= adaptation.endVirtualTime`。
    *   若成立，系統移除 `adaptation` 欄位，發送通知：「[NPC姓名] 的身體已完全適應了 [改造名稱]，排異反應消失，改造效果已穩定。」

---

## 6. 資料結構定義範例 (TypeScript)

我們將上述設計提煉為以下數據模型，準備擴充至 `models/index.ts` 中：

```typescript
// ==========================================
// 身體改造靜態定義 (staticData / 世界書定義)
// ==========================================
export interface BodyModificationDef {
  id: string;
  name: string;
  description: string;
  scope: 'global' | 'regional' | 'local';
  slots: string[];               // 佔用的部位 IDs (可以是預設或自訂部位)
  conflictGroups?: string[];     // 用於互斥判斷的衝突組 (如 ['biological_matrix'])
  
  // 改造消耗
  cost: {
    money?: number;
    pts?: number;
    mcEnergy?: number;
    requiredItems?: Array<{ itemId: string; quantity: number }>;
  };
  
  // 改造條件
  conditions: {
    minObedience?: number;
    minLust?: number;
    requiredLocationId?: string; // 限制特定地圖節點才能執行 (如：science_lab)
  };
  
  loadCost: number;              // 負荷值
  modifiers: AttrModifier[];     // 對屬性的常駐影響
  
  // 週期性產出或觸發效果
  triggerEffect?: {
    triggerType: 'daily' | 'hourly' | 'on_orgasm';
    effectTag: 'lactate' | 'spawn_egg' | 'estrus'; // 生產/觸發標籤
    producedItemId?: string;                       // 生產的物品 ID
    quantity?: number;
  };
  
  promptInjection?: string;      // 注入 AI Prompt 的故事描述文本
}

// ==========================================
// NPC 身上裝配的身體改造狀態 (Runtime)
// ==========================================
export interface NPCBodyModState {
  id: string;                    // 對應 BodyModificationDef.id
  installedVirtualTime: string;  // 安裝時的虛擬時間 ("YYYY-MM-DD HH:mm")
  isActive: boolean;             // 當前是否啟用
  selectedTraits: string[];      // 產生的副作用或隨機特徵
  
  // 適應期
  adaptation?: {
    endVirtualTime: string;      // 適應期結束的虛擬時間
    extraModifiers: AttrModifier[]; // 適應期內額外的排異數值影響
  };
  
  // 自訂參數（提供極高擴充度，例如設定頻率、注入刻字等）
  customParams?: Record<string, {
    label: string;
    type: 'string' | 'number' | 'boolean';
    value: any;
  }>;
}

// 屬性修改器結構
export interface AttrModifier {
  targetPath: string;            // 例如 'obedience', 'lust', 'bodyParts.breastLeft.sensitivity'
  operator: '+' | '-' | '*';
  value: number;
}
```

---

## 7. 設計靈感總結：如何在各樓層劇情中落地？

1.  **世界書 Prompt 動態生成**：
    *   在推進樓層的 AI Prompt 組裝階段，系統收集 NPC 當前所有 `ownedBodyModifications` 中 `isActive: true` 的 `promptInjection` 欄位。
    *   將其整合成一段文字例如：「**【肉體變更現狀】**：[NPC姓名]的身體已進行了以下改造：[描述1]、[描述2]。」
    *   這樣，不管樓層劇情如何發展，AI 始終能讀到這段設定，並且在故事中進行不確定的即興演繹。
2.  **不確定劇情結果的回寫**：
    *   在文字對話中，如果玩家說「我要用 APP 激活妳的乳環電流」，AI 判斷後寫出「...林楓點擊了按鈕，愛麗莎的乳環釋放出電流，使她發出嬌喘... 」。
    *   此時，AI 回覆結尾的 `<UpdateVariable>` YAML 能夠對 `chars.西园寺爱丽莎.arousal` (快感) 加上 `30`，甚至在乳環改造的 `customParams.voltage` 上做修改。
    *   如此一來，文字故事的不確定性，被簡化成了「AI 在文字中進行語意演繹 ➔ AI 在標籤中依照規則回寫數值變更」的優雅閉環。
