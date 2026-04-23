// ====== 大型模板（TODO: 日後手動搬遷到 constants/character-editor/plotTemplate.ts） ======

/**
 * ⚠ 此函數包含 ~230 行的模板字串。
 *   重構完成後，請將此函數搬遷到 constants/character-editor/plotTemplate.ts。
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
