import React, { useState } from 'react';
import { MockUserData, AchievementOrQuestDef, ConditionOnProgram } from '../../../models';
import { MockApi } from '../../../shared/api/mockApi';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { RewardIcon } from './AchievementTab';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface QuestCraftTabProps {
  userData: MockUserData;
  onCraftComplete: () => void;
  charNames: string[];
}

export const QuestCraftTab: React.FC<QuestCraftTabProps> = ({ userData, onCraftComplete, charNames }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [conditionType, setConditionType] = useState<'program' | 'ai'>('program');
  const [aiCondition, setAiCondition] = useState('');

  const [programConditions, setProgramConditions] = useState<(ConditionOnProgram & { charName: string })[]>([
    {
      target: 'pts',
      operator: '>=',
      value: 10,
      charName: '',
    },
  ]);

  const [totalAllocPoints, setTotalAllocPoints] = useState<number>(10);
  const [allocations, setAllocations] = useState<Record<string, number>>({
    money: 0,
    mcEnergy: 0,
    mcEnergyMax: 0,
    pts: 0,
    suspicion: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const REWARD_TYPES = [
    { id: 'money', label: '金錢', icon: 'money', conversionRate: 1000 },
    { id: 'mcEnergy', label: 'MC 能量', icon: 'mcEnergy', conversionRate: 10 },
    { id: 'mcEnergyMax', label: 'MC 能量最大值', icon: 'mcEnergyMax', conversionRate: 1 },
    { id: 'pts', label: 'MC 點', icon: 'pts', conversionRate: 1 },
    { id: 'suspicion', label: '可疑度', icon: 'suspicion', conversionRate: -0.2 },
  ] as const;

  const totalCostMoney = totalAllocPoints * 1000;
  const currentAllocatedPoints = Object.values(allocations).reduce((sum, val) => sum + (val || 0), 0);
  const remainingPoints = totalAllocPoints - currentAllocatedPoints;
  const actualCostMoney = currentAllocatedPoints * 1000;

  const canAfford = userData.money >= actualCostMoney;

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) {
      setError('請填寫任務名稱與描述');
      return;
    }
    if (conditionType === 'ai' && !aiCondition.trim()) {
      setError('請填寫 AI 判定的完成條件');
      return;
    }
    if (totalAllocPoints <= 0) {
      setError('總分配值必須大於 0');
      return;
    }
    if (actualCostMoney > userData.money) {
      setError('餘額不足');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const newQuestId = `custom_quest_${Date.now()}`;

    const reward: Record<string, number> = {};
    for (const type of REWARD_TYPES) {
      const allocated = allocations[type.id] || 0;
      const calculated = Math.trunc(allocated * type.conversionRate);
      if (calculated !== 0) {
        reward[type.id] = calculated;
      }
    }

    // Fallback if everything is 0
    if (Object.keys(reward).length === 0) {
      reward.pts = 1;
    }

    const def: AchievementOrQuestDef = {
      name,
      dataType: 'quest',
      description,
      isCustom: true,
      completionCondition: {
        type: conditionType,
        condition:
          conditionType === 'ai'
            ? aiCondition
            : programConditions.map(c => ({
                target: c.target,
                operator: c.operator,
                value: c.value,
                ...(c.charName ? { charName: c.charName } : {}),
              })),
      },
      reward: reward as any,
    };

    await MockApi.updateUserResource({ money: userData.money - actualCostMoney });
    await MockApi.saveNewQuest(newQuestId, def);

    setIsSubmitting(false);
    onCraftComplete();
  };

  const isMissingInfo = !name.trim() || !description.trim() || (conditionType === 'ai' && !aiCondition.trim());
  let isDisabled = isSubmitting || isMissingInfo;
  let buttonText = '';
  let buttonClass = 'w-full py-2.5 text-sm font-bold rounded-lg transition-colors mt-4 text-white ';

  if (isMissingInfo) {
    isDisabled = true;
    buttonText = '請填寫完整的任務資訊';
    buttonClass += 'bg-gray-700 text-gray-500 cursor-not-allowed';
  } else if (!canAfford) {
    isDisabled = true;
    if (remainingPoints < 0) {
      buttonText = `餘額不足以補足缺少的 ${Math.abs(remainingPoints)} 點 (需 ¥${actualCostMoney.toLocaleString()})`;
    } else {
      buttonText = `餘額不足 (需 ¥${actualCostMoney.toLocaleString()})`;
    }
    buttonClass += 'bg-gray-700 text-gray-500 cursor-not-allowed';
  } else if (remainingPoints > 0) {
    buttonText = `支付 ¥${actualCostMoney.toLocaleString()} 並發布 (已將多餘分配值換成 ¥${(remainingPoints * 1000).toLocaleString()} 返還)`;
    buttonClass += 'bg-blue-600 hover:bg-blue-500';
  } else if (remainingPoints < 0) {
    buttonText = `支付 ¥${actualCostMoney.toLocaleString()} 並發布 (已自動使用金錢補足缺少的 ${Math.abs(remainingPoints)} 點)`;
    buttonClass += 'bg-yellow-600 hover:bg-yellow-500 text-yellow-50';
  } else {
    buttonText = `支付 ¥${actualCostMoney.toLocaleString()} 並發布任務`;
    buttonClass += 'bg-purple-600 hover:bg-purple-500';
  }

  if (isSubmitting) {
    buttonText = '發布中...';
    buttonClass =
      'w-full py-2.5 text-sm font-bold rounded-lg transition-colors mt-4 text-white bg-gray-700 text-gray-500 cursor-not-allowed';
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="bg-[#13102a] rounded-xl border border-purple-800/30 p-4">
        <h2 className="text-lg font-bold text-white mb-4">發布自訂任務</h2>

        {error && (
          <div className="bg-red-900/30 border border-red-500/50 text-red-400 px-3 py-2 rounded-lg text-xs mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* 基本資訊 */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">任務名稱</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              placeholder="例如：讓愛麗莎變得更敏感"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">任務描述</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 h-20 resize-none"
              placeholder="描述這個任務的背景與目的..."
            />
          </div>

          {/* 完成條件設定 */}
          <div className="pt-2 border-t border-purple-900/30">
            <label className="block text-xs font-semibold text-purple-300 mb-2">完成條件設定</label>

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setConditionType('program')}
                className={cn(
                  'flex-1 py-1.5 text-xs rounded-md border',
                  conditionType === 'program'
                    ? 'bg-purple-900/50 border-purple-500 text-white'
                    : 'bg-[#0c0a1e] border-purple-900/30 text-gray-400',
                )}
              >
                程式精確判定
              </button>
              <button
                onClick={() => setConditionType('ai')}
                className={cn(
                  'flex-1 py-1.5 text-xs rounded-md border',
                  conditionType === 'ai'
                    ? 'bg-purple-900/50 border-purple-500 text-white'
                    : 'bg-[#0c0a1e] border-purple-900/30 text-gray-400',
                )}
              >
                AI 語意判定
              </button>
            </div>

            {conditionType === 'ai' ? (
              <textarea
                value={aiCondition}
                onChange={e => setAiCondition(e.target.value)}
                className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 h-16 resize-none"
                placeholder="例如：讓目標在全班面前承認自己是母狗..."
              />
            ) : (
              <div className="space-y-3">
                {programConditions.map((cond, index) => (
                  <div
                    key={index}
                    className="relative space-y-2 bg-[#0c0a1e] p-3 rounded-lg border border-purple-900/30"
                  >
                    {programConditions.length > 1 && (
                      <button
                        onClick={() => setProgramConditions(prev => prev.filter((_, i) => i !== index))}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-900/80 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-xs border border-red-500/50"
                      >
                        ×
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">目標屬性</label>
                        <select
                          value={cond.target}
                          onChange={e =>
                            setProgramConditions(prev =>
                              prev.map((c, i) => (i === index ? { ...c, target: e.target.value as any } : c)),
                            )
                          }
                          className="w-full bg-[#13102a] border border-purple-900/50 rounded px-2 py-1.5 text-xs text-white"
                        >
                          <optgroup label="全域資源">
                            <option value="pts">催眠點 (PT)</option>
                            <option value="money">金幣</option>
                            <option value="suspicion">可疑度</option>
                            <option value="totalConsumedMc">累計消耗MC</option>
                            <option value="mcEnergy">MC 能量</option>
                            <option value="mcEnergyMax">MC 能量上限</option>
                            <option value="vipTier">VIP 等級</option>
                          </optgroup>
                          <optgroup label="角色狀態">
                            <option value="totalSensitivity">總敏感度</option>
                            <option value="totalOrgasms">總高潮次數</option>
                            
                            <option value="mouthSensitivity">口腔敏感度</option>
                            <option value="mouthTightness">口腔鬆緊度</option>
                            <option value="mouthProficiency">口腔熟練度</option>
                            <option value="mouthOrgasms">口腔高潮次數</option>

                            <option value="breastLeftSensitivity">左乳敏感度</option>
                            <option value="breastLeftProficiency">左乳熟練度</option>
                            <option value="breastLeftOrgasms">左乳高潮次數</option>

                            <option value="breastRightSensitivity">右乳敏感度</option>
                            <option value="breastRightProficiency">右乳熟練度</option>
                            <option value="breastRightOrgasms">右乳高潮次數</option>

                            <option value="vaginaSensitivity">陰道敏感度</option>
                            <option value="vaginaTightness">陰道鬆緊度</option>
                            <option value="vaginaProficiency">陰道熟練度</option>
                            <option value="vaginaOrgasms">陰道高潮次數</option>

                            <option value="anusSensitivity">後庭敏感度</option>
                            <option value="anusTightness">後庭鬆緊度</option>
                            <option value="anusProficiency">後庭熟練度</option>
                            <option value="anusOrgasms">後庭高潮次數</option>

                            <option value="urethraSensitivity">尿道敏感度</option>
                            <option value="urethraTightness">尿道鬆緊度</option>
                            <option value="urethraProficiency">尿道熟練度</option>
                            <option value="urethraOrgasms">尿道高潮次數</option>

                            <option value="clitorisSensitivity">陰蒂敏感度</option>
                            <option value="clitorisProficiency">陰蒂熟練度</option>
                            <option value="clitorisOrgasms">陰蒂高潮次數</option>

                            <option value="obedience">服從度</option>
                            <option value="alertness">警戒度</option>
                            <option value="lust">淫亂度</option>
                            <option value="affection">好感度</option>
                            <option value="arousal">快感值</option>
                          </optgroup>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">指定角色 (選填)</label>
                        <select
                          value={cond.charName}
                          onChange={e =>
                            setProgramConditions(prev =>
                              prev.map((c, i) => (i === index ? { ...c, charName: e.target.value } : c)),
                            )
                          }
                          className="w-full bg-[#13102a] border border-purple-900/50 rounded px-2 py-1.5 text-xs text-white"
                        >
                          <option value="">(不指定，任意角色)</option>
                          {charNames.map(name => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">比較方式</label>
                        <select
                          value={cond.operator}
                          onChange={e =>
                            setProgramConditions(prev =>
                              prev.map((c, i) => (i === index ? { ...c, operator: e.target.value as any } : c)),
                            )
                          }
                          className="w-full bg-[#13102a] border border-purple-900/50 rounded px-2 py-1.5 text-xs text-white"
                        >
                          <option value=">=">大於等於 (&gt;=)</option>
                          <option value="==">等於 (==)</option>
                          <option value="<=">小於等於 (&lt;=)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">目標數值</label>
                        <input
                          type="number"
                          value={cond.value}
                          onChange={e =>
                            setProgramConditions(prev =>
                              prev.map((c, i) => (i === index ? { ...c, value: Number(e.target.value) } : c)),
                            )
                          }
                          className="w-full bg-[#13102a] border border-purple-900/50 rounded px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() =>
                    setProgramConditions(prev => [...prev, { target: 'pts', operator: '>=', value: 10, charName: '' }])
                  }
                  className="w-full py-1.5 border border-dashed border-purple-900/50 rounded-lg text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-900/20 transition-colors"
                >
                  + 新增條件
                </button>
              </div>
            )}
          </div>

          {/* 獎勵投資設定 */}
          <div className="pt-2 border-t border-purple-900/30">
            <label className="block text-xs font-semibold text-yellow-500 mb-2">任務獎勵投資</label>
            <p className="text-[10px] text-gray-400 mb-3">
              發布自訂任務需要投入金幣作為懸賞。完成後，這些金幣將轉換為你選擇的獎勵類型。
            </p>

            <div className="bg-[#0c0a1e] p-3 rounded-lg border border-purple-900/30 space-y-3">
              <div>
                <label className="flex justify-between text-xs text-gray-300 mb-1">
                  <span>總分配值</span>
                  <span className="text-yellow-500 font-mono">消耗 ¥{totalCostMoney.toLocaleString()}</span>
                </label>
                <div className="flex items-center">
                  <button
                    onClick={() => setTotalAllocPoints(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 bg-purple-900/50 rounded-l-lg border border-purple-900/50 text-white hover:bg-purple-700 transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={totalAllocPoints}
                    onChange={e => setTotalAllocPoints(Math.max(1, Number(e.target.value)))}
                    className="flex-1 text-center bg-[#13102a] border-y border-purple-900/50 py-1.5 text-xs text-white focus:outline-none"
                    style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                  />
                  <button
                    onClick={() => setTotalAllocPoints(p => p + 1)}
                    className="px-3 py-1.5 bg-purple-900/50 rounded-r-lg border border-purple-900/50 text-white hover:bg-purple-700 transition-colors"
                  >
                    +
                  </button>
                </div>
                <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                  <span>餘額: ¥{userData.money.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="flex justify-between text-xs text-gray-300 mb-2">
                  <span>獎勵分配</span>
                  <span
                    className={cn('font-mono text-[10px]', remainingPoints === 0 ? 'text-green-400' : 'text-red-400')}
                  >
                    剩餘分配值: {remainingPoints}
                  </span>
                </label>

                <div className="space-y-2">
                  {REWARD_TYPES.map(type => {
                    const allocated = allocations[type.id] || 0;
                    const calculated = Math.trunc(allocated * type.conversionRate);
                    return (
                      <div
                        key={type.id}
                        className="flex items-center justify-between bg-[#13102a] border border-purple-900/30 p-2 rounded-lg"
                      >
                        <div className="flex flex-col">
                          <div className="text-[11px] text-gray-200 flex items-center gap-1">
                            <RewardIcon type={type.icon as any} /> {type.label}
                          </div>
                          {type.id === 'suspicion' && (
                            <div className="text-[9px] text-gray-500 mt-0.5">每 5 點分配值 = -1 可疑度</div>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-[10px] text-gray-400 text-right w-16">
                            預計:{' '}
                            <span className={cn('font-medium', calculated !== 0 ? 'text-white' : 'text-gray-500')}>
                              {calculated}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <button
                              onClick={() =>
                                setAllocations(prev => ({ ...prev, [type.id]: Math.max(0, (prev[type.id] || 0) - 1) }))
                              }
                              className="w-7 h-7 flex items-center justify-center bg-purple-900/50 rounded-l border border-purple-900/50 text-white hover:bg-purple-700 transition-colors"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={totalAllocPoints}
                              step="1"
                              value={allocated}
                              onChange={e => {
                                const val = Math.max(0, Number(e.target.value));
                                setAllocations(prev => ({ ...prev, [type.id]: val }));
                              }}
                              className="w-10 text-center bg-[#0c0a1e] border-y border-purple-900/50 py-1 text-xs text-white focus:outline-none"
                              style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                            />
                            <button
                              onClick={() =>
                                setAllocations(prev => ({ ...prev, [type.id]: Math.max(0, (prev[type.id] || 0) + 1) }))
                              }
                              className="w-7 h-7 flex items-center justify-center bg-purple-900/50 rounded-r border border-purple-900/50 text-white hover:bg-purple-700 transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 mt-2 border-t border-purple-900/30">
                <div className="text-[10px] text-gray-400 mb-2">任務完成後預計可獲得：</div>
                <div className="flex gap-2 flex-wrap">
                  {REWARD_TYPES.map(type => {
                    const allocated = allocations[type.id] || 0;
                    const calculated = Math.trunc(allocated * type.conversionRate);
                    if (calculated === 0) return null;
                    return (
                      <div
                        key={type.id}
                        className="flex items-center gap-1.5 text-[11px] font-medium bg-[#13102a] border border-purple-900/30 px-2.5 py-1.5 rounded-md shadow-sm"
                      >
                        <RewardIcon type={type.icon as any} />
                        <span className={type.id === 'suspicion' && calculated < 0 ? 'text-green-400' : 'text-white'}>
                          {calculated > 0 ? `+${calculated}` : calculated} {type.label}
                        </span>
                      </div>
                    );
                  })}
                  {Object.values(allocations).every(val => !val) && (
                    <div className="text-[10px] text-gray-600 italic">尚未分配任何獎勵</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button onClick={handleSubmit} disabled={isDisabled} className={buttonClass}>
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};
