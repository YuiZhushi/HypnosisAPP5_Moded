/**
 * WorldBookService — 世界書條目檢查與建立
 *
 * 用於在身體檢測APP中檢查角色的 MVU 變量更新世界書條目是否存在，
 * 如果缺失則自動補入。
 */

const DEFAULT_ORDER = 23;
const ENTRY_PREFIX = '[mvu_update]';
const ENTRY_SUFFIX_VARIANTS = ['变量', '變量'];

function buildEntryName(roleName: string): string {
  return `${ENTRY_PREFIX}${roleName}变量`;
}

function isUpdateEntry(name: string): boolean {
  if (!name.startsWith(ENTRY_PREFIX)) return false;
  return ENTRY_SUFFIX_VARIANTS.some(s => name.endsWith(s));
}

function buildEntryContent(roleName: string): string {
  return `  ${roleName}:\n    {{format_message_variable::stat_data.角色.${roleName}}}`;
}

export type WbCheckResult =
  | { status: 'pass' }
  | { status: 'created' }
  | { status: 'error'; message: string };

export const WorldBookService = {
  /**
   * 檢查指定角色的世界書條目，缺失則自動補入
   */
  checkAndEnsureEntry: async (roleName: string): Promise<WbCheckResult> => {
    try {
      // 1. 取得角色卡的 primary 世界書
      const charWb = getCharWorldbookNames('current');
      const wbName = charWb.primary;
      if (!wbName) {
        return { status: 'error', message: '角色卡未绑定世界书' };
      }

      // 2. 讀取世界書
      const entries = await getWorldbook(wbName);

      // 3. 搜尋是否已存在對應條目（繁簡體相容）
      const targetName = buildEntryName(roleName);
      const existing = entries.find(
        e => e.name === targetName || e.name === `${ENTRY_PREFIX}${roleName}變量`,
      );

      if (existing) {
        return { status: 'pass' };
      }

      // 4. 計算插入順序：取現有 [mvu_update]xxx变量/變量 中最大 order + 1
      //    排除 [mvu_update]任务变量 / 任務變量
      const EXCLUDED_NAMES = ['[mvu_update]任务变量', '[mvu_update]任務變量'];
      let maxOrder = -1;
      for (const e of entries) {
        if (isUpdateEntry(e.name) && !EXCLUDED_NAMES.includes(e.name) && e.position && typeof e.position.order === 'number') {
          if (e.position.order > maxOrder) maxOrder = e.position.order;
        }
      }
      const order = maxOrder >= 0 ? maxOrder + 1 : DEFAULT_ORDER;

      // 5. 建立條目
      await createWorldbookEntries(wbName, [
        {
          name: targetName,
          enabled: true,
          strategy: {
            type: 'selective',
            keys: [roleName],
          },
          position: {
            type: 'before_character_definition',
            order,
          },
          content: buildEntryContent(roleName),
          probability: 100,
          recursion: {
            prevent_incoming: true,
            prevent_outgoing: true,
          },
        },
      ]);

      console.info(`[HypnoOS] 已补入世界书条目「${targetName}」(order=${order})`);
      return { status: 'created' };
    } catch (err) {
      console.error('[HypnoOS] 世界书检查失败', err);
      return {
        status: 'error',
        message: err instanceof Error ? err.message : '未知错误',
      };
    }
  },

  /**
   * 檢查角色的 [mvu_plot] 人設條目，缺失則自動補入
   */
  checkAndEnsurePlotEntry: async (roleName: string): Promise<WbCheckResult> => {
    const PLOT_PREFIX = '[mvu_plot]';
    const entryName = `${PLOT_PREFIX}${roleName}人设`;
    const DEFAULT_PLOT_ORDER = 75;

    try {
      const charWb = getCharWorldbookNames('current');
      const wbName = charWb.primary;
      if (!wbName) {
        return { status: 'error', message: '角色卡未绑定世界书' };
      }

      console.info(`[HypnoOS] WorldBookService: 檢查 [mvu_plot] 條目「${entryName}」`);

      const entries = await getWorldbook(wbName);

      // 繁簡體相容搜尋
      const existing = entries.find(
        (e: any) => e.name === entryName || e.name === `${PLOT_PREFIX}${roleName}人設`,
      );

      if (existing) {
        console.info(`[HypnoOS] WorldBookService: 條目已存在`);
        return { status: 'pass' };
      }

      // 計算 order：找上一個 [mvu_plot]xxx人设 的最大 order + 1
      let maxOrder = -1;
      for (const e of entries) {
        const name = (e as any).name ?? '';
        if (name.startsWith(PLOT_PREFIX) && (name.endsWith('人设') || name.endsWith('人設'))) {
          const order = (e as any).position?.order;
          if (typeof order === 'number' && order > maxOrder) maxOrder = order;
        }
      }
      const order = maxOrder >= 0 ? maxOrder + 1 : DEFAULT_PLOT_ORDER;

      // 建立預設模板內容
      const defaultContent = buildDefaultPlotContent(roleName);

      await createWorldbookEntries(wbName, [
        {
          name: entryName,
          enabled: true,
          strategy: {
            type: 'selective',
            keys: [roleName],
          },
          position: {
            type: 'before_character_definition',
            order,
          },
          content: defaultContent,
          probability: 100,
          recursion: {
            prevent_incoming: true,
            prevent_outgoing: true,
          },
        },
      ]);

      console.info(`[HypnoOS] WorldBookService: 已建立 [mvu_plot] 條目「${entryName}」(order=${order})`);
      return { status: 'created' };
    } catch (err) {
      console.error('[HypnoOS] WorldBookService: [mvu_plot] 檢查失敗', err);
      return {
        status: 'error',
        message: err instanceof Error ? err.message : '未知错误',
      };
    }
  },
};

/**
 * 建立角色人設的預設模板內容
 */
function buildDefaultPlotContent(name: string): string {
  return `<${name}人设>
\`\`\`yaml
${name}:
  title: ""
  gender: ""
  age: 0
  identity:
    public: ""
    hidden: ""
  social_connection: {}
  personality:
    core: {}
    conditional: {}
    hidden: {}
  habit:
    - ""
    - ""
  hidden_behavior:
    - ""
    - ""
  appearance:
    height: ""
    weight: ""
    measurement: ""
    style: ""
    overview: ""
    attire:
      school: ""
      casual: ""
    feature:
      - ""
      - ""
  sexual_preference:
    masturbation_frequency: ""
    orgasm_response: ""
    sensitive_spot: {}
    hidden_fetish: {}
    special_trait:
      - ""
      - ""
  weakness:
    - ""
    - ""
\`\`\`
</${name}人设>

<${name}行为指导>
\`\`\`yaml
### 当前状态
Variables:
  性欲: {{get_message_variable::stat_data.角色.${name}.发情值}}
  警戒度: {{get_message_variable::stat_data.角色.${name}.警戒度}}
  好感度: {{get_message_variable::stat_data.角色.${name}.好感度}}
  服从度: {{get_message_variable::stat_data.角色.${name}.服从度}}

### 发情状态指导
<%_ if (getvar('stat_data.角色.${name}.发情值') < 20) { _%>
发情状态:
  表现:
    - ""
<%_ } else if (getvar('stat_data.角色.${name}.发情值') < 40) { _%>
发情状态:
  表现:
    - ""
<%_ } else if (getvar('stat_data.角色.${name}.发情值') < 60) { _%>
发情状态:
  表现:
    - ""
<%_ } else if (getvar('stat_data.角色.${name}.发情值') < 80) { _%>
发情状态:
  表现:
    - ""
  理智残存: ""
<%_ } else if (getvar('stat_data.角色.${name}.发情值') < 95) { _%>
发情状态:
  表现:
    - ""
  生理反应:
    - ""
  理智残存: ""
  渴望程度: ""
<%_ } else if (getvar('stat_data.角色.${name}.发情值') < 100) { _%>
发情状态:
  表现:
    - ""
  生理反应:
    - ""
  出格行为:
    - ""
<%_ } else { _%>
发情状态:
  表现:
    - ""
  生理反应:
    - ""
  出格行为:
    - ""
<%_ } _%>

### 警戒度指导
<%_ if (getvar('stat_data.角色.${name}.警戒度') < 20) { _%>
对{{user}}的态度:
  状态: "無警戒"
  行为指导:
    - ""
<%_ } else if (getvar('stat_data.角色.${name}.警戒度') < 40) { _%>
对{{user}}的态度:
  状态: "微弱的違和感"
  行为指导:
    - ""
<%_ } else if (getvar('stat_data.角色.${name}.警戒度') < 60) { _%>
对{{user}}的态度:
  状态: "低警戒"
  行为指导:
    - ""
<%_ } else if (getvar('stat_data.角色.${name}.警戒度') < 80) { _%>
对{{user}}的态度:
  状态: "普通警戒"
  行为指导:
    - ""
<%_ } else if (getvar('stat_data.角色.${name}.警戒度') < 100) { _%>
对{{user}}的态度:
  状态: "高警戒"
  行为指导:
    - ""
    - ""
  敌意表现:
    - ""
<%_ } else { _%>
对{{user}}的态度:
  状态: "極高警戒"
  行为指导:
    - ""
    - ""
  敌意表现:
    - ""
  接触禁忌:
    - ""
<%_ } _%>

### 好感度指导
<%_ if (getvar('stat_data.角色.${name}.好感度') < 20) { _%>
好感表现:
  状态: "低好感度"
  行为指导:
    - ""
<%_ } else if (getvar('stat_data.角色.${name}.好感度') < 40) { _%>
好感表现:
  状态: "中低好感度"
  行为指导:
    - ""
  变化倾向:
    - ""
<%_ } else if (getvar('stat_data.角色.${name}.好感度') < 60) { _%>
好感表现:
  状态: "普通好感度"
  行为指导:
    - ""
  变化倾向:
    - ""
<%_ } else if (getvar('stat_data.角色.${name}.好感度') < 80) { _%>
好感表现:
  状态: "高好感度"
  行为指导:
    - ""
  特殊互动:
    - ""
  心理依赖: ""
<%_ } else { _%>
好感表现:
  状态: "極高好感度"
  行为指导:
    - ""
  特殊互动:
    - ""
  心理依赖: ""
  允许越界:
    - ""
<%_ } _%>

### 服从度指导
<%_ if (getvar('stat_data.角色.${name}.服从度') < 20) { _%>
服从表现:
  状态: "低服從度"
  行为指导:
    - ""
<%_ } else if (getvar('stat_data.角色.${name}.服从度') < 40) { _%>
服从表现:
  状态: "較低服從度"
  行为指导:
    - ""
<%_ } else if (getvar('stat_data.角色.${name}.服从度') < 60) { _%>
服从表现:
  状态: "普通服從度"
  行为指导:
    - ""
  变化倾向:
    - ""
<%_ } else if (getvar('stat_data.角色.${name}.服从度') < 80) { _%>
服从表现:
  状态: "高服從度"
  行为指导:
    - ""
  变化倾向:
    - ""
  忠诚表现:
    - ""
<%_ } else { _%>
服从表现:
  状态: "極高服從度"
  行为指导:
    - ""
  忠诚表现:
    - ""
  自我认知: ""
  羞耻承受极限:
    - ""
<%_ } _%>

### 全局行为规则
rules:
  - "行为指导优先于作为背景的\`角色关键信息\`和\`角色详情\`"
  - "好感度和服从度行为可以混合"
  - "角色的好感与服从度要优先于警戒度, 只要好感度或服从度大于警戒度, 就不会触发警戒"
\`\`\`
</${name}行为指导>`;
}
