/**
 * 角色編輯器常數
 *
 * YAML key → section id 映射、分區鎖定 key 定義
 */

/** 人設區段的 YAML key → section id 映射 */
export const DATA_KEY_TO_SECTION: Record<string, string> = {
  title: 'info',
  gender: 'info',
  age: 'info',
  identity: 'info',
  social_connection: 'social',
  personality: 'personality',
  habit: 'personality',
  hidden_behavior: 'personality',
  appearance: 'appearance',
  sexual_preference: 'fetish',
  weakness: 'fetish',
};

/** 每個分區內預設鎖定的 key（頂層不可刪除/改名） */
export const SECTION_LOCKED_KEYS: Record<string, string[]> = {
  info: ['title', 'gender', 'age', 'identity'],
  social: ['social_connection'],
  personality: ['personality', 'habit', 'hidden_behavior'],
  appearance: ['appearance'],
  fetish: ['sexual_preference', 'weakness'],
};
