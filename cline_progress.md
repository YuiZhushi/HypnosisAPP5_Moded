# 任務進度暫存

## 任務
- 名稱：盤點並更新 rules / skills
- 目標：修正過時與不一致內容，刪除冗餘項目並完成歸檔
- 開始時間：2026-04-02 23:42

## 待辦清單(重要細節不可缺失，可能遇見的問題要附上，步驟避免過於簡略)
- [x] 步驟 1：完成進度檔初始化與盤點範圍確認
  - [x] 詳細步驟 1-1：清空舊 cline_progress.md
  - [x] 詳細步驟 1-2：建立本次任務新進度框架
  - [x] 詳細步驟 1-3：確認本次更新目標檔案（rules / skills / archive）
- [x] 步驟 2：更新 rules 文件以符合當前專案結構
  - [x] 詳細步驟 2-1：更新 `.clinerules/项目说明.md`
  - [x] 詳細步驟 2-2：更新 `.clinerules/HypnosisOS接口大纲.md`
  - [x] 詳細步驟 2-3：必要時同步調整 `.agents/rules` 對應文件
- [x] 步驟 3：更新 skills 文件並移除冗餘項目
  - [x] 詳細步驟 3-1：修正 `.agents/skills/app_repair/SKILL.md` 的過時工具與流程描述
  - [x] 詳細步驟 3-2：修正 `.agents/skills/mvu_interaction_reference/SKILL.md` 與現況不一致內容
  - [x] 詳細步驟 3-3：處理重疊 skill（frontend-design）
- [x] 步驟 4：建立歸檔並寫入刪除原因
  - [x] 詳細步驟 4-1：建立 `.acrhive_skills-rules/rules_archive.md`
  - [x] 詳細步驟 4-2：建立 `.acrhive_skills-rules/skill_archive.md`
  - [x] 詳細步驟 4-3：寫入刪除內容與刪除原因
- [x] 步驟 5：最終核對與回報
  - [x] 詳細步驟 5-1：檢查所有待辦是否完成
  - [x] 詳細步驟 5-2：整理變更摘要與影響說明
- [x] 步驟 6：依用戶回饋深化 MVU 交互規範
  - [x] 詳細步驟 6-1：重新核對 mvuBridge / dataService / components 中的 MVU 流程
  - [x] 詳細步驟 6-2：重寫 `.agents/skills/mvu_interaction_reference/SKILL.md`（架構、方法、規則、映射、交互、雙寫）
  - [x] 詳細步驟 6-3：完成回報與請用戶確認

## 進行中
- 目前處理：全部變更完成，準備回報摘要

## 已完成
- 已刪除舊版 `cline_progress.md` 並重新初始化任務進度框架。
- 已更新 `.clinerules/` 與 `.agents/rules/` 的 HypnoOS 說明與接口大綱。
- 已修正 `.agents/skills/app_repair/SKILL.md` 的過時工具描述。
- 已重寫 `.agents/skills/mvu_interaction_reference/SKILL.md` 為精簡且可維護版本。
- 已刪除重疊規範 `.agents/skills/frontend-design/SKILL.md` 與 `.agents/rules/frontend-design.md`。
- 已建立 `.acrhive_skills-rules/rules_archive.md`、`.acrhive_skills-rules/skill_archive.md`，並寫入刪除內容與原因。

## 變更紀錄
- 2026-04-02 23:42 清空舊進度檔
- 2026-04-02 23:43 建立新進度框架與待辦清單
- 2026-04-02 23:45 修正 app_repair skill 過時工具描述
- 2026-04-02 23:55 更新 HypnosisOS 規則說明與接口大綱
- 2026-04-03 00:00 建立 rules/skills archive 並寫入刪除內容
- 2026-04-03 00:01 刪除 frontend-design 規則與技能檔案
- 2026-04-03 00:13 依用戶回饋，追加 MVU 規範深化任務
- 2026-04-03 00:16 完成 MVU 規範深度版重寫（架構/方法/規則/映射/交互/雙寫）

## 風險與阻塞
- 需避免與現有 `.agents/rules`、`.clinerules` 產生互相矛盾描述。

## 用戶需要進行的檢查與確認
- 請確認目前保留的 `front_interface` / `前端界面` 是否已足夠覆蓋你的前端設計需求。
- 請確認新版 `mvu_interaction_reference` 是否符合你要求的詳細度與維護方式。

=== 全部完成 ===