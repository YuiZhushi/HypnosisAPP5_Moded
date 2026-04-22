import type { EditorPromptModule } from '../../types';

type PersistedEditorPromptModule = {
  id?: string;
  title?: string;
  content?: string;
  type?: string;
  sectionId?: string;
  order?: number;
};

export function normalizeEditorPromptModules(
  raw: Record<string, PersistedEditorPromptModule> | undefined,
  defaults: EditorPromptModule[],
): EditorPromptModule[] {
  // 以預設模塊為基底，覆蓋已保存的內容
  const defaultMap = new Map(defaults.map(m => [m.id, m]));
  if (raw) {
    for (const [id, persisted] of Object.entries(raw)) {
      if (!persisted?.id) continue;
      const base = defaultMap.get(id);
      defaultMap.set(id, {
        id: persisted.id,
        title: persisted.title ?? base?.title ?? id,
        content: persisted.content ?? base?.content ?? '',
        type: (['fixed', 'section_content', 'section_format', 'section_instruction'].includes(persisted.type as string)
          ? persisted.type
          : (base?.type ?? 'fixed')) as 'fixed' | 'section_content' | 'section_format' | 'section_instruction',
        sectionId: persisted.sectionId ?? base?.sectionId,
        order: persisted.order ?? base?.order ?? 99,
      });
    }
  }
  return Array.from(defaultMap.values()).sort((a, b) => a.order - b.order);
}
