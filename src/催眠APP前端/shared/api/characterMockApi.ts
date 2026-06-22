import { CharacterBackgroundData, mockCharacters, mockPrompts, PromptTemplate } from '../../database/characterMockData';

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const CharacterMockApi = {
  async getCharacters(): Promise<CharacterBackgroundData[]> {
    await delay(500);
    return [...mockCharacters];
  },

  async getCharacter(name: string): Promise<CharacterBackgroundData | undefined> {
    await delay(300);
    return mockCharacters.find(c => Object.keys(c.basic)[0] === name);
  },

  async saveCharacter(character: CharacterBackgroundData): Promise<CharacterBackgroundData> {
    await delay(800);
    const name = Object.keys(character.basic)[0];
    const index = mockCharacters.findIndex(c => Object.keys(c.basic)[0] === name);
    if (index !== -1) {
      mockCharacters[index] = { ...character };
    } else {
      mockCharacters.push(character);
    }
    return character;
  },

  async getPrompts(): Promise<PromptTemplate[]> {
    await delay(400);
    return [...mockPrompts];
  },

  async savePrompt(prompt: PromptTemplate): Promise<PromptTemplate> {
    await delay(500);
    const index = mockPrompts.findIndex(p => p.id === prompt.id);
    if (index !== -1) {
      mockPrompts[index] = { ...prompt };
    } else {
      mockPrompts.push(prompt);
    }
    return prompt;
  },
};
