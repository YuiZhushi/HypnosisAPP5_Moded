import { CharacterBackgroundData, PromptTemplate } from '../../models';
import { mockDevRuntimeVariables } from '../../database/mockDatabase';

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const CharacterMockApi = {
  async getCharacters(): Promise<CharacterBackgroundData[]> {
    await delay(500);
    return Object.values(mockDevRuntimeVariables.charBackgrounds);
  },

  async getCharacter(name: string): Promise<CharacterBackgroundData | undefined> {
    await delay(300);
    return mockDevRuntimeVariables.charBackgrounds[name];
  },

  async saveCharacter(character: CharacterBackgroundData): Promise<CharacterBackgroundData> {
    await delay(800);
    const name = Object.keys(character.basic)[0];
    if (name) {
      mockDevRuntimeVariables.charBackgrounds[name] = { ...character };
    }
    return character;
  },

  async getPrompts(): Promise<PromptTemplate[]> {
    await delay(400);
    return [...mockDevRuntimeVariables.prompts];
  },

  async savePrompt(prompt: PromptTemplate): Promise<PromptTemplate> {
    await delay(500);
    const index = mockDevRuntimeVariables.prompts.findIndex(p => p.id === prompt.id);
    if (index !== -1) {
      mockDevRuntimeVariables.prompts[index] = { ...prompt };
    } else {
      mockDevRuntimeVariables.prompts.push(prompt);
    }
    return prompt;
  },
};
