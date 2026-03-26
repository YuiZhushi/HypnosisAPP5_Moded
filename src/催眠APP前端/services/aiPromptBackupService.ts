import YAML from 'yaml';
import type { AiAppId, PlaceholderDefinition, PromptTemplate } from '../types';
import { DataService } from './dataService';

type BackupPayload = {
  version: number;
  updatedAt: number;
  apps: Record<string, { contexts: Record<string, PromptTemplate[]> }>;
  placeholders: Record<string, PlaceholderDefinition[]>;
};

const BACKUP_ENTRY_NAME = '[hypnoos_backup]AI提示詞模板';

async function getPrimaryWorldbookName(): Promise<string | null> {
  const wb = getCharWorldbookNames('current');
  return wb?.primary ?? null;
}

async function findBackupEntry(wbName: string): Promise<any | null> {
  const entries = await getWorldbook(wbName);
  return entries.find((e: any) => e?.name === BACKUP_ENTRY_NAME) ?? null;
}

function buildPayload(): BackupPayload {
  const profiles = DataService.getAiPromptProfiles() ?? {};
  const apps: BackupPayload['apps'] = {};
  for (const [appId, profile] of Object.entries(profiles)) {
    apps[appId] = {
      contexts: Object.fromEntries(
        Object.entries(profile ?? {}).map(([ctx, templates]) => [
          ctx,
          (templates ?? []).map(t => ({ id: t.id, title: t.title, content: t.content, isSystem: t.isSystem })),
        ]),
      ),
    };
  }

  const placeholders: BackupPayload['placeholders'] = {
    global: DataService.getAiUserPlaceholders('global'),
  };
  for (const appId of Object.keys(apps)) {
    placeholders[appId] = DataService.getAiUserPlaceholders(appId as AiAppId);
  }

  return {
    version: 1,
    updatedAt: Date.now(),
    apps,
    placeholders,
  };
}

export const AiPromptBackupService = {
  BACKUP_ENTRY_NAME,

  async backupToWorldbook(): Promise<{ ok: boolean; message: string }> {
    try {
      const wbName = await getPrimaryWorldbookName();
      if (!wbName) return { ok: false, message: '角色卡未綁定世界書' };

      const payload = buildPayload();
      const content = YAML.stringify(payload);
      const existing = await findBackupEntry(wbName);

      if (existing?.uid) {
        await updateWorldbookEntries(wbName, [
          {
            uid: existing.uid,
            enabled: false,
            strategy: { type: 'selective', keys: [] },
            content,
          },
        ]);
      } else {
        await createWorldbookEntries(wbName, [
          {
            name: BACKUP_ENTRY_NAME,
            enabled: false,
            strategy: { type: 'selective', keys: [] },
            position: { type: 'before_character_definition', order: 6 },
            content,
            probability: 0,
            recursion: { prevent_incoming: true, prevent_outgoing: true },
          },
        ]);
      }

      return { ok: true, message: '已備份到世界書（不發送條目）' };
    } catch (err) {
      console.error('[HypnoOS] AiPromptBackupService.backupToWorldbook 失敗', err);
      return { ok: false, message: err instanceof Error ? err.message : '備份失敗' };
    }
  },

  async restoreFromWorldbook(): Promise<{ ok: boolean; message: string }> {
    try {
      const wbName = await getPrimaryWorldbookName();
      if (!wbName) return { ok: false, message: '角色卡未綁定世界書' };

      const existing = await findBackupEntry(wbName);
      if (!existing?.content) return { ok: false, message: '找不到備份條目內容' };

      const parsed = YAML.parse(String(existing.content)) as BackupPayload;
      if (!parsed || typeof parsed !== 'object' || !parsed.apps) {
        return { ok: false, message: '備份資料格式錯誤' };
      }

      for (const [appId, appData] of Object.entries(parsed.apps)) {
        const contexts = appData?.contexts ?? {};
        await DataService.saveAiPromptProfile(appId as AiAppId, contexts);
      }

      for (const [scopeKey, defs] of Object.entries(parsed.placeholders ?? {})) {
        if (scopeKey === 'global') {
          await DataService.saveAiUserPlaceholders('global', defs ?? []);
        } else {
          await DataService.saveAiUserPlaceholders(scopeKey as AiAppId, defs ?? []);
        }
      }

      return { ok: true, message: '已從世界書還原提示詞與 placeholder' };
    } catch (err) {
      console.error('[HypnoOS] AiPromptBackupService.restoreFromWorldbook 失敗', err);
      return { ok: false, message: err instanceof Error ? err.message : '還原失敗' };
    }
  },
};
