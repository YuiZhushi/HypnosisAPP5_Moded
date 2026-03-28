import type { EditorPromptModule } from '../types';

type PromptModule = { id: string; content: string };

type ComposePromptParams = {
  modules: PromptModule[];
  moduleOrder: string[];
  placeholders: Record<string, string | number | boolean | null | undefined>;
  escapeEjs?: boolean;
};

/**
 * 組裝 AiRequestPipelineService 所需的參數。
 * 僅負責篩選模塊 + 構建 placeholder map + 生成 moduleOrder，
 * 不做任何拼接/替換。
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

  // 篩選 5 個 fixed + 1 個當前分區內容 + 1 個當前分區格式 + 1 個當前分區生成要求
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
  if (sectionContentModule) {
    selectedModules.push(sectionContentModule);
  }
  if (sectionFormatModule) {
    selectedModules.push(sectionFormatModule);
  }
  if (sectionInstructionModule) {
    selectedModules.push(sectionInstructionModule);
  }

  // 按 order 排序
  selectedModules.sort((a, b) => a.order - b.order);

  // 生成 moduleOrder
  const moduleOrder = selectedModules.map(m => m.id);

  // 轉為 pipeline 所需的 PromptModule 格式
  const pipelineModules: PromptModule[] = selectedModules.map(m => ({
    id: m.id,
    content: m.content,
  }));

  // 組裝 placeholders map
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
