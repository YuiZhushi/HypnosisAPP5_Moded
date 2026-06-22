/**
 * 角色編輯器分區定義
 *
 * 定義編輯器的 Tab 分區和提示詞佔位符。
 */

import type { EditorSection } from '../interfaces';

/** 編輯器 Tab 分區 */
export const EDITOR_SECTIONS: EditorSection[] = [
  { id: 'info', name: '基本資訊', category: 'data' },
  { id: 'social', name: '社交網絡', category: 'data' },
  { id: 'personality', name: '性格與興趣', category: 'data' },
  { id: 'appearance', name: '外觀特點', category: 'data' },
  { id: 'fetish', name: '性癖與弱點', category: 'data' },
  { id: 'arousal', name: '發情行為', category: 'behavior' },
  { id: 'alert', name: '警戒行為', category: 'behavior' },
  { id: 'affection', name: '好感行為', category: 'behavior' },
  { id: 'obedience', name: '服從行為', category: 'behavior' },
  { id: 'global', name: '全局行為', category: 'behavior' },
];

/** 分區提示詞的所有分區 ID（10 個編輯分區 + 'all'） */
export const EDITOR_PROMPT_SECTION_IDS = [
  ...EDITOR_SECTIONS.map(s => s.id),
  'all',
] as const;

export type EditorPromptSectionId = typeof EDITOR_PROMPT_SECTION_IDS[number];

/** 預設佔位符鍵 */
export const EDITOR_PROMPT_PLACEHOLDERS = [
  { key: '角色名', description: '當前選中角色名' },
  { key: '角色世界書條目', description: '角色完整世界書內容' },
  { key: '當前的分區名稱', description: '用戶正在編輯的分區名稱' },
  { key: '當前分區的yaml內容', description: '該分區的 yaml/EJS 原始碼' },
  { key: '所有分區的yaml與ESJ內容', description: '所有分區合併的完整內容' },
  { key: '用戶的輸入', description: '用戶本次輸入要求文本' },
] as const;
