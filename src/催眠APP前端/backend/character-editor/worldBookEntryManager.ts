/**
 * Character Editor APP 後端 — 世界書條目管理
 *
 * 從 worldBookService.ts (640行) 遷移。
 * 職責：
 * - 檢查/建立 [mvu_update] 變量條目
 * - 檢查/建立 [mvu_plot] 人設條目
 * - 維護 [mvu_plot]人物列表 條目
 *
 * ⚠ buildDefaultPlotContent() 包含大型模板字串（~230行），
 *   需要手動搬遷，此處標記為 TODO。
 */

import * as WBRepo from '../../shared/worldbook/worldBookRepository';
import { logger } from '../../../催眠APP共用/debug/loggerService';
import { buildDefaultPlotContent } from '../../constants/character-editor/plotTemplate';

// ====== 常數 ======

const DEFAULT_ORDER = 23;
const ENTRY_PREFIX = '[mvu_update]';
const ENTRY_SUFFIX_VARIANTS = ['变量', '變量'];
const PLOT_PREFIX = '[mvu_plot]';
const PLOT_ROLE_LIST_ENTRY_NAME = `${PLOT_PREFIX}人物列表`;
const DEFAULT_PLOT_ORDER = 75;

const ROLE_SUMMARY_HINTS: Record<string, string> = {
  西园寺爱丽莎: '金发巨乳人气阳角时尚大小姐',
  月咏深雪: '黑发清楚系温柔高岭之花',
  犬冢夏美: '短发低马尾元气小只假小子',
};

const RESERVED_ROLE_NAMES = new Set(['任务', '任務', '系统', '系統']);

// ====== 內部工具 ======

function normalizeEntryName(name: unknown): string {
  return String(name ?? '')
    .replace(/\s+/g, '')
    .replace(/　/g, '')
    .trim();
}

function normalizeContent(content: unknown): string {
  return String(content ?? '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function buildEntryName(roleName: string): string {
  return `${ENTRY_PREFIX}${roleName}变量`;
}

function isUpdateEntry(name: string): boolean {
  if (!name.startsWith(ENTRY_PREFIX)) return false;
  return ENTRY_SUFFIX_VARIANTS.some(s => name.endsWith(s));
}

function getRoleNameFromUpdateEntryName(name: unknown): string | null {
  const raw = String(name ?? '').trim();
  const matched = raw.match(/^\[mvu_update\](.+?)(变量|變量)$/);
  return matched?.[1]?.trim() || null;
}

function isReservedRoleName(roleName: unknown): boolean {
  const normalized = String(roleName ?? '').trim();
  if (!normalized) return true;
  return RESERVED_ROLE_NAMES.has(normalized);
}

function buildEntryContent(roleName: string): string {
  return `  ${roleName}:\n    {{format_message_variable::stat_data.角色.${roleName}}}`;
}

function isPlotEntry(name: string): boolean {
  return name.startsWith(PLOT_PREFIX);
}

function isPlotRoleListEntryName(name: unknown): boolean {
  return normalizeEntryName(name) === normalizeEntryName(PLOT_ROLE_LIST_ENTRY_NAME);
}

function buildPlotRoleProfileEntryName(roleName: string): string {
  return `${PLOT_PREFIX}${roleName}人设`;
}

function isPlotRoleProfileEntryName(name: unknown): boolean {
  const normalized = normalizeEntryName(name);
  return (
    normalized.startsWith(normalizeEntryName(PLOT_PREFIX)) &&
    (normalized.endsWith('人设') || normalized.endsWith('人設'))
  );
}

function isPlotRoleProfileEntryForRole(name: unknown, roleName: string): boolean {
  const normalized = normalizeEntryName(name);
  return (
    normalized === normalizeEntryName(`${PLOT_PREFIX}${roleName}人设`) ||
    normalized === normalizeEntryName(`${PLOT_PREFIX}${roleName}人設`)
  );
}

function parsePlotRoleSummaryMap(content: unknown): Map<string, string> {
  const map = new Map<string, string>();
  const text = normalizeContent(content);
  if (!text) return map;
  for (const line of text.split('\n')) {
    const matched = line.match(/^\s{2}([^:：]+)\s*[:：]\s*(.*)$/);
    if (!matched) continue;
    const role = matched[1]?.trim();
    const summary = (matched[2] ?? '').trim();
    if (role) map.set(role, summary);
  }
  return map;
}

function collectRoleNamesFromUpdateEntries(entries: WorldbookEntry[]): string[] {
  const roleSet = new Set<string>();
  for (const entry of entries) {
    const roleName = getRoleNameFromUpdateEntryName(entry.name);
    if (!roleName || isReservedRoleName(roleName)) continue;
    roleSet.add(roleName);
  }
  return Array.from(roleSet).sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function collectRoleNamesFromMvuVariables(): string[] {
  try {
    const chatVars = getVariables({ type: 'chat' });
    const roleObj = chatVars?.stat_data?.角色;
    if (!roleObj || typeof roleObj !== 'object') return [];
    return Array.from(
      new Set(
        Object.keys(roleObj)
          .map(n => String(n ?? '').trim())
          .filter(n => n && !isReservedRoleName(n)),
      ),
    ).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  } catch {
    logger.warn('从 MVU 变量读取角色列表失败，回退到世界书条目来源');
    return [];
  }
}

function buildPlotRoleListContent(roleNames: string[], summaryMap?: Map<string, string>): string {
  const lines = roleNames.map(rn => {
    const summary = summaryMap?.get(rn) ?? ROLE_SUMMARY_HINTS[rn] ?? '';
    return `  ${rn}: ${summary}`.trimEnd();
  });
  return `<人物列表>\n存在以下的主要角色:\n${lines.join('\n')}\n</人物列表>`;
}

async function verifyPlotRoleListContent(wbName: string, expectedContent: string): Promise<void> {
  const latest = await WBRepo.getEntries(wbName);
  const hit = latest.find(e => isPlotRoleListEntryName(e.name));
  if (!hit) throw new Error(`人物列表校验失败：缺少条目 (${PLOT_ROLE_LIST_ENTRY_NAME})`);
  if (normalizeContent(hit.content) !== normalizeContent(expectedContent)) {
    throw new Error(`人物列表校验失败：条目内容未同步 (${PLOT_ROLE_LIST_ENTRY_NAME})`);
  }
}

// ====== 人物列表條目管理 ======

async function ensurePlotRoleListEntry(
  wbName: string,
  roleNameToEnsure: string,
): Promise<'pass' | 'created' | 'updated'> {
  const latestEntries = await WBRepo.getEntries(wbName);
  const existing = latestEntries.find(e => isPlotRoleListEntryName(e.name));

  const roleNamesFromMvu = collectRoleNamesFromMvuVariables();
  const roleNamesFromWorldbook = collectRoleNamesFromUpdateEntries(latestEntries);
  const roleNames = roleNamesFromMvu.length > 0 ? roleNamesFromMvu : roleNamesFromWorldbook;
  if (roleNameToEnsure && !isReservedRoleName(roleNameToEnsure) && !roleNames.includes(roleNameToEnsure)) {
    roleNames.push(roleNameToEnsure);
  }
  roleNames.sort((a, b) => a.localeCompare(b, 'zh-CN'));

  const existingSummaryMap = parsePlotRoleSummaryMap(existing?.content);
  const expectedContent = buildPlotRoleListContent(roleNames, existingSummaryMap);

  if (existing) {
    if (normalizeContent(existing.content) === normalizeContent(expectedContent)) {
      logger.info(`条目「${PLOT_ROLE_LIST_ENTRY_NAME}」已是最新内容`);
      return 'pass';
    }

    const targetUid = existing.uid;
    let updated = false;
    await WBRepo.updateEntries(
      wbName,
      worldbook =>
        worldbook.map(entry => {
          const hit = targetUid != null ? String(entry.uid) === String(targetUid) : isPlotRoleListEntryName(entry.name);
          if (!hit) return entry;
          updated = true;
          return { ...entry, content: expectedContent };
        }),
      { render: 'immediate' },
    );

    if (!updated) throw new Error(`更新人物列表失败：目标条目不存在 (${PLOT_ROLE_LIST_ENTRY_NAME})`);
    await verifyPlotRoleListContent(wbName, expectedContent);
    logger.info(`已更新条目「${PLOT_ROLE_LIST_ENTRY_NAME}」`);
    return 'updated';
  }

  // 建立新條目
  let maxOrder = -1;
  for (const e of latestEntries) {
    if (!isPlotEntry(String(e.name ?? ''))) continue;
    const order = e.position?.order;
    if (typeof order === 'number' && order > maxOrder) maxOrder = order;
  }

  await WBRepo.createEntries(wbName, [
    {
      name: PLOT_ROLE_LIST_ENTRY_NAME,
      enabled: true,
      strategy: { type: 'constant', keys: ['人物列表'] },
      position: { type: 'before_character_definition', order: 70 },
      content: expectedContent,
      probability: 100,
      recursion: { prevent_incoming: true, prevent_outgoing: true },
    },
  ]);

  await verifyPlotRoleListContent(wbName, expectedContent);
  logger.info(`已建立条目「${PLOT_ROLE_LIST_ENTRY_NAME}」`);
  return 'created';
}

// ====== 公開 API ======

export type WbCheckResult = { status: 'pass' } | { status: 'created' } | { status: 'error'; message: string };

/** 檢查並建立 [mvu_update] 變量條目 + [mvu_plot]人物列表 */
export async function checkAndEnsureEntry(roleName: string): Promise<WbCheckResult> {
  try {
    const wbName = WBRepo.getCurrentCharacterWorldbook();
    if (!wbName) return { status: 'error', message: '角色卡未绑定世界书' };

    const entries = await WBRepo.getEntries(wbName);
    const targetName = buildEntryName(roleName);
    const existing = entries.find(e => e.name === targetName || e.name === `${ENTRY_PREFIX}${roleName}變量`);

    let updateEntryStatus: 'pass' | 'created' = 'pass';

    if (!existing) {
      const EXCLUDED_NAMES = ['[mvu_update]任务变量', '[mvu_update]任務變量'];
      let maxOrder = -1;
      for (const e of entries) {
        if (isUpdateEntry(e.name) && !EXCLUDED_NAMES.includes(e.name) && typeof e.position?.order === 'number') {
          if (e.position.order > maxOrder) maxOrder = e.position.order;
        }
      }

      await WBRepo.createEntries(wbName, [
        {
          name: targetName,
          enabled: true,
          strategy: { type: 'selective', keys: [roleName] },
          position: { type: 'before_character_definition', order: maxOrder >= 0 ? maxOrder + 1 : DEFAULT_ORDER },
          content: buildEntryContent(roleName),
          probability: 100,
          recursion: { prevent_incoming: true, prevent_outgoing: true },
        },
      ]);

      logger.info(`已补入世界书条目「${targetName}」`);
      updateEntryStatus = 'created';
    }

    const plotListStatus = await ensurePlotRoleListEntry(wbName, roleName);

    if (updateEntryStatus === 'created' || plotListStatus === 'created' || plotListStatus === 'updated') {
      return { status: 'created' };
    }
    return { status: 'pass' };
  } catch (err) {
    logger.error('世界书检查失败', err);
    return { status: 'error', message: err instanceof Error ? err.message : '未知错误' };
  }
}

/** 檢查並建立 [mvu_plot] 人設條目 */
export async function checkAndEnsurePlotEntry(roleName: string): Promise<WbCheckResult> {
  const entryName = buildPlotRoleProfileEntryName(roleName);
  try {
    const wbName = WBRepo.getCurrentCharacterWorldbook();
    if (!wbName) return { status: 'error', message: '角色卡未绑定世界书' };

    logger.info(`檢查 [mvu_plot] 條目「${entryName}」`);

    const entries = await WBRepo.getEntries(wbName);
    const existing = entries.find(e => isPlotRoleProfileEntryForRole(e.name, roleName));
    if (existing) {
      logger.info(`條目已存在`);
      return { status: 'pass' };
    }

    let maxOrder = -1;
    for (const e of entries) {
      if (isPlotRoleProfileEntryName(e.name ?? '')) {
        const order = e.position?.order;
        if (typeof order === 'number' && order > maxOrder) maxOrder = order;
      }
    }

    await WBRepo.createEntries(wbName, [
      {
        name: entryName,
        enabled: true,
        strategy: { type: 'selective', keys: [roleName] },
        position: { type: 'before_character_definition', order: maxOrder >= 0 ? maxOrder + 1 : DEFAULT_PLOT_ORDER },
        content: buildDefaultPlotContent(roleName),
        probability: 100,
        recursion: { prevent_incoming: true, prevent_outgoing: true },
      },
    ]);

    logger.info(`已建立 [mvu_plot] 條目「${entryName}」`);
    return { status: 'created' };
  } catch (err) {
    logger.error('[mvu_plot] 檢查失敗', err);
    return { status: 'error', message: err instanceof Error ? err.message : '未知错误' };
  }
}
