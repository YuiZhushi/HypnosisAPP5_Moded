import { AiAppId } from '../types';
import { DataService } from './dataService';

type ResolveContext = {
  appId: AiAppId;
  characterName?: string;
  currentData?: string;
  playerDirection?: string;
  sectionName?: string;
  appName?: string;
};

export type PlaceholderResolveRecord = {
  raw: string;
  key: string;
  resolved: boolean;
  source?: 'built_in' | 'user' | 'worldbook';
  replacementPreview?: string;
};

export type PlaceholderResolveDebug = {
  records: PlaceholderResolveRecord[];
  unresolvedKeys: string[];
};

const PLACEHOLDER_REGEX = /\{\{\s*([^{}]+?)\s*\}\}/g;

async function resolveWorldbookEntry(name: string): Promise<string | null> {
  try {
    const charWb = getCharWorldbookNames('current');
    const wbName = charWb?.primary;
    if (!wbName) return null;
    const entries = await getWorldbook(wbName);
    const target = entries.find(e => (e?.name ?? '').trim() === name.trim());
    return target?.content ?? null;
  } catch (err) {
    console.warn('[HypnoOS] AiPlaceholderService: 讀取世界書條目失敗', err);
    return null;
  }
}

function getBuiltInValue(rawKey: string, context: ResolveContext): string | null {
  const key = rawKey.trim();
  if (key === '裝配角色名字') return context.characterName ?? '(未選擇角色)';
  if (key === '當前狀態與內容') return context.currentData || '(此分區尚無資料)';
  if (key === '玩家輸入' || key === '玩家特殊指示') return context.playerDirection || '(無特殊要求)';
  if (key === '分區名稱') return context.sectionName ?? '(未知分區)';
  if (key === 'APP名稱') return context.appName ?? context.appId;
  return null;
}

export const AiPlaceholderService = {
  async resolveTextWithDebug(input: string, context: ResolveContext): Promise<{ output: string; debug: PlaceholderResolveDebug }> {
    const globalDefs = DataService.getAiUserPlaceholders('global').filter(v => v.enabled);
    const appDefs = DataService.getAiUserPlaceholders(context.appId).filter(v => v.enabled);
    const userMap = new Map<string, string>();
    [...globalDefs, ...appDefs].forEach(def => {
      if (def.resolverType === 'static' && def.value) userMap.set(def.key.trim(), def.value);
    });

    const matches = [...input.matchAll(PLACEHOLDER_REGEX)];
    if (matches.length === 0) {
      return {
        output: input,
        debug: {
          records: [],
          unresolvedKeys: [],
        },
      };
    }

    let output = input;
    const records: PlaceholderResolveRecord[] = [];
    for (const m of matches) {
      const raw = m[0];
      const key = m[1]?.trim() ?? '';
      if (!key) continue;

      let replacement: string | null = null;
      let source: PlaceholderResolveRecord['source'] | undefined;
      if (key.startsWith('WI:')) {
        replacement = await resolveWorldbookEntry(key.slice(3).trim());
        if (replacement !== null) source = 'worldbook';
      } else {
        replacement = getBuiltInValue(key, context);
        if (replacement !== null) source = 'built_in';
        if (replacement === null && userMap.has(key)) {
          replacement = userMap.get(key) ?? null;
          if (replacement !== null) source = 'user';
        }
      }

      if (replacement !== null) {
        output = output.replace(raw, replacement);
        records.push({
          raw,
          key,
          resolved: true,
          source,
          replacementPreview: replacement.length > 120 ? `${replacement.slice(0, 120)}...` : replacement,
        });
      } else {
        records.push({
          raw,
          key,
          resolved: false,
        });
      }
    }

    return {
      output,
      debug: {
        records,
        unresolvedKeys: records.filter(r => !r.resolved).map(r => r.key),
      },
    };
  },

  async resolveText(input: string, context: ResolveContext): Promise<string> {
    const result = await AiPlaceholderService.resolveTextWithDebug(input, context);
    return result.output;
  },
};
