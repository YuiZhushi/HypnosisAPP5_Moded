/**
 * Character Editor APP 後端 — AI 請求提示詞構造器
 *
 * 從 prompts/characterEditorSend.ts 遷移。
 * 負責篩選提示詞模塊、組裝 placeholder map、生成 moduleOrder。
 * 不做任何拼接/替換（那是 shared/llm/aiRequestPipeline 的職責）。
 */

import type { EditorPromptModule } from '../../constants/interfaces';
import type { ComposePromptParams } from '../../shared/llm/aiRequestPipeline';

// ====== 公開 API ======

/**
 * 組裝 AI 請求管道所需的參數。
 * 篩選 fixed + 當前分區的 section_content / section_format / section_instruction 模塊，
 * 按 order 排序後生成 moduleOrder。
 */
export function buildEditorPipelineParams(params: {
  modules: EditorPromptModule[];
  currentSectionId: string;
  characterName: string;
  userInput: string;
  currentSectionName: string;
  currentSectionYaml: string;
  allSectionsContent: string;
  worldbookEntry: string;
}): ComposePromptParams {
  const {
    modules,
    currentSectionId,
    characterName,
    userInput,
    currentSectionName,
    currentSectionYaml,
    allSectionsContent,
    worldbookEntry,
  } = params;

  // 篩選：fixed + 當前分區的 content/format/instruction
  const fixedModules = modules.filter(m => m.type === 'fixed');
  const sectionContentModule = modules.find(
    m => m.type === 'section_content' && m.sectionId === currentSectionId,
  );
  const sectionFormatModule = modules.find(
    m => m.type === 'section_format' && m.sectionId === currentSectionId,
  );
  const sectionInstructionModule = modules.find(
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
    escapeEjs: true, // 啟用 EJS 逃避機制
  };
}
