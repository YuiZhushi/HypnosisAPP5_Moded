/**
 * Hypnosis APP 後端 — 提示詞構造器
 *
 * 純函式，無副作用。
 * 負責構造催眠發送消息的文本格式。
 */

import type { HypnosisFeature } from '../../constants/interfaces';

function normalizeText(text: string | undefined): string {
  return (text ?? '').replaceAll('\r\n', '\n').trimEnd();
}

function indentLines(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return normalizeText(text)
    .split('\n')
    .map(line => (line.length ? `${pad}${line}` : pad))
    .join('\n');
}

/**
 * 構造催眠發送消息
 *
 * @param features - 所有功能列表（會自動過濾出已啟用的）
 * @param durationMinutes - 催眠持續時間（分鐘）
 * @param globalNote - 全局備註
 */
export function buildHypnosisSendMessage({
  features,
  durationMinutes,
  globalNote,
}: {
  features: HypnosisFeature[];
  durationMinutes: number;
  globalNote: string;
}): string {
  const selected = features.filter(f => f.isEnabled);
  const names = selected.map(f => f.title).filter(Boolean);

  const getNumericLabel = (f: HypnosisFeature): string | null => {
    switch (f.id) {
      case 'vip1_temp_sensitivity':
        return '敏感度增加';
      case 'vip1_estrus':
        return '发情增加';
      case 'vip1_memory_erase':
        return '记忆消除时长（分钟）';
      case 'vip2_pleasure':
        return '快感强度';
      default:
        return null;
    }
  };

  const lines: string[] = [];
  lines.push('<催眠发送>');
  lines.push(`开启的功能名列表: ${names.length ? names.join('、') : ''}`);
  lines.push('本次的催眠效果:');

  for (const f of selected) {
    lines.push(`  ${f.title}:`);
    lines.push('    描述:');
    lines.push(indentLines(f.description ?? '', 6));

    const numericLabel = getNumericLabel(f);
    if (numericLabel && typeof f.userNumber === 'number' && Number.isFinite(f.userNumber)) {
      lines.push(`    ${numericLabel}: ${f.userNumber}`);
    }

    lines.push('    备注:');
    lines.push(indentLines(f.userNote ?? '', 6));
  }

  lines.push(`本次催眠的持续时间: ${durationMinutes}分钟`);
  lines.push('备注:');
  lines.push(indentLines(globalNote ?? '', 2));
  lines.push('');
  lines.push('</催眠发送>');
  return lines.join('\n');
}
