/**
 * Character Editor APP 後端 — AI 請求提示詞構造器
 *
 * 負責：
 * - 從 editorPromptDefaults 載入預設提示詞模塊
 * - 合併用戶在 store 中的自定義覆蓋
 * - 根據當前分區篩選 fixed + 動態模塊
 * - 組裝 placeholder map
 * - 生成完整的 ComposePromptParams 供 aiRequestPipeline 消費
 *
 * 此模塊獨立於 Settings APP，不依賴 settings backend 載入模塊。
 * 不做任何拼接/替換（那是 shared/llm/aiRequestPipeline 的職責）。
 */

import type { EditorPromptModule, ComposePromptParams } from '../../constants/interfaces';
import type { PersistedEditorPromptRecord } from '../../constants/schemas/storeSchema';
import { DEFAULT_EDITOR_PROMPT_MODULES } from '../../constants/character-editor/editorPromptDefaults';
import { readStoreSnapshot, updateStoreWith } from '../../shared/store/storeGateway';

// ====== 內部工具 ======

/**
 * 載入角色編輯器的提示詞模塊列表：
 * 預設模塊 + store 中的用戶覆蓋。
 */
function loadEditorModules(): EditorPromptModule[] {
  const store = readStoreSnapshot();
  const raw: PersistedEditorPromptRecord | undefined = store.editorPromptModules;
  const defaultMap = new Map(DEFAULT_EDITOR_PROMPT_MODULES.map(m => [m.id, m]));

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
          : (base?.type ?? 'fixed')) as EditorPromptModule['type'],
        sectionId: persisted.sectionId ?? base?.sectionId,
        order: persisted.order ?? base?.order ?? 99,
      });
    }
  }

  return Array.from(defaultMap.values()).sort((a, b) => a.order - b.order);
}

// ====== 公開 API ======

/**
 * 儲存角色編輯器提示詞模塊。
 * 供 UI 層編輯後儲存使用。
 */
export async function saveEditorModules(modules: EditorPromptModule[]): Promise<void> {
  await updateStoreWith(store => {
    const record: PersistedEditorPromptRecord = {};
    for (const m of modules) {
      record[m.id] = {
        id: m.id,
        title: m.title,
        content: m.content,
        type: m.type,
        sectionId: m.sectionId,
        order: m.order,
      };
    }
    return { ...store, editorPromptModules: record };
  });
}

/**
 * 取得角色編輯器的完整提示詞模塊列表（預設 + 用戶覆蓋）。
 * 供 UI 層顯示/編輯使用。
 */
export function getEditorModules(): EditorPromptModule[] {
  return loadEditorModules();
}

/**
 * 取得預設提示詞模塊列表（不含用戶覆蓋）。
 * 供 UI 的「重置為預設」功能使用。
 */
export function getDefaultEditorModules(): EditorPromptModule[] {
  return DEFAULT_EDITOR_PROMPT_MODULES.map(m => ({ ...m }));
}

/**
 * 組裝 AI 請求管道所需的參數。
 *
 * 自動載入提示詞模塊（預設 + 用戶覆蓋），
 * 篩選 fixed + 當前分區的 section_content / section_format / section_instruction，
 * 按 order 排序後生成完整的 ComposePromptParams。
 *
 * 模塊組裝順序（按 order 排列）：
 * 1. 系統提示詞 (fixed, order=1)
 * 2. 附加設定 (fixed, order=2)
 * 3. 分區內容：${當前分區名} (section_content, order=3)
 * 4. 生成要求：${當前分區名} (section_instruction, order=4)
 * 5. 用戶輸入 (fixed, order=5)
 * 6. 輸出格式：${當前分區名} (section_format, order=6)
 * 7. 喚起任務 (fixed, order=7)
 * 8. 消除思考 (fixed, order=8)
 */
export function buildEditorPipelineParams(params: {
  currentSectionId: string;
  characterName: string;
  userInput: string;
  currentSectionName: string;
  currentSectionYaml: string;
  allSectionsContent: string;
  worldbookEntry: string;
}): ComposePromptParams {
  const {
    currentSectionId,
    characterName,
    userInput,
    currentSectionName,
    currentSectionYaml,
    allSectionsContent,
    worldbookEntry,
  } = params;

  // 載入完整模塊列表（預設 + 用戶覆蓋）
  const allModules = loadEditorModules();

  // 篩選：fixed + 當前分區的 content/format/instruction
  const fixedModules = allModules.filter(m => m.type === 'fixed');
  const sectionContentModule = allModules.find(
    m => m.type === 'section_content' && m.sectionId === currentSectionId,
  );
  const sectionFormatModule = allModules.find(
    m => m.type === 'section_format' && m.sectionId === currentSectionId,
  );
  const sectionInstructionModule = allModules.find(
    m => m.type === 'section_instruction' && m.sectionId === currentSectionId,
  );

  const selectedModules = [...fixedModules];
  if (sectionContentModule) selectedModules.push(sectionContentModule);
  if (sectionFormatModule) selectedModules.push(sectionFormatModule);
  if (sectionInstructionModule) selectedModules.push(sectionInstructionModule);

  // 按 order 排序
  selectedModules.sort((a, b) => a.order - b.order);

  // 生成 moduleOrder + 轉為 pipeline 格式
  const moduleOrder = selectedModules.map(m => m.id);
  const pipelineModules = selectedModules.map(m => ({ id: m.id, content: m.content }));

  // 組裝 placeholders
  const placeholders: Record<string, string> = {
    '角色名': characterName,
    '角色世界書條目': worldbookEntry,
    '當前的分區名稱': currentSectionName,
    '當前分區的yaml內容': currentSectionYaml,
    '所有分區的yaml與ESJ內容': allSectionsContent,
    '用戶的輸入': userInput,
  };

  return {
    modules: pipelineModules,
    moduleOrder,
    placeholders,
    escapeEjs: true,
  };
}
