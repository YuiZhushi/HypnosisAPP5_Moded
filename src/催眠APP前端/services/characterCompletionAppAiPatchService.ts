import { CharacterCompletionAppAiPatchResult } from '../types';

export const CharacterCompletionAppAiPatchService = {
  /**
   * Parses the AI's raw text response to extract the YAML or EJS patches within expected tags.
   * Tolerant of misspelt tags and cleans up stray markdown headers from YAML.
   */
  characterCompletionAppParseAiResponse(
    rawText: string,
    expectedType: 'yaml' | 'ejs' | 'mixed'
  ): CharacterCompletionAppAiPatchResult {
    const result: CharacterCompletionAppAiPatchResult = {
      yamlRaw: '',
      ejsRaw: '',
      warnings: [],
      rawText,
    };

    if (!rawText) {
      result.warnings.push('AI 傳回了空內容。');
      return result;
    }

    // Match tags exactly or with slight deviations (e.g. esj_patch)
    // <yaml_patch>...</yaml_patch>
    const yamlRegex = /<yaml_patch>([\s\S]*?)<\/yaml_patch>/gi;
    // <ejs_patch> or <esj_patch> 
    const ejsRegex = /<(?:ejs_patch|esj_patch)>([\s\S]*?)<\/(?:ejs_patch|esj_patch)>/gi;

    let yamlMatch;
    const yamlContents: string[] = [];
    while ((yamlMatch = yamlRegex.exec(rawText)) !== null) {
      yamlContents.push(yamlMatch[1].trim());
    }

    let ejsMatch;
    const ejsContents: string[] = [];
    while ((ejsMatch = ejsRegex.exec(rawText)) !== null) {
      ejsContents.push(ejsMatch[1].trim());
    }

    if (yamlContents.length > 0) {
      result.yamlRaw = yamlContents.join('\n\n');
    }

    if (ejsContents.length > 0) {
      result.ejsRaw = ejsContents.join('\n\n');
    }

    // Validation against expectedType
    if (expectedType === 'yaml') {
      if (ejsContents.length > 0 && yamlContents.length === 0) {
        result.warnings.push('預期收到 YAML 補全，但 AI 給出了 EJS。');
      }
      result.ejsRaw = ''; // Reset invalid output
    } else if (expectedType === 'ejs') {
      if (yamlContents.length > 0 && ejsContents.length === 0) {
        result.warnings.push('預期收到 EJS 補全，但 AI 給出了 YAML。');
      }
      result.yamlRaw = ''; // Reset invalid output
    }

    if (!result.yamlRaw && !result.ejsRaw) {
      // If no valid tags found, maybe AI forgot tags. We could try full text fallback,
      // but to be safe and conservative, we just warn the user.
      result.warnings.push('無法從 AI 回應中解析出有效的 <yaml_patch> 或 <ejs_patch> 標籤！');
    } else {
      // Cleanup typical AI markdown artifacts in YAML
      if (result.yamlRaw) {
        result.yamlRaw = result.yamlRaw
          .split('\n')
          .filter(line => !/^\s*#+\s+/.test(line)) // Remove lines starting with markdown headers ## (but keep comments #, wait AI might use # as yaml comment)
          // Wait! YAML comments start with `#`. Markdown headers are `# Header` or `## Header`.
          // We only want to remove lines if they are clearly markdown headers like `## something` not `# something` which might be a valid YAML comment.
          // Let's refine filter: remove lines that start with `##` or `###`.
          .filter(line => !/^\s*#{2,}\s+/.test(line))
          .join('\n');
      }
    }

    return result;
  }
};
