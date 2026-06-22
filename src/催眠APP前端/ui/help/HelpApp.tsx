import React, { useMemo, useState } from 'react';
import { PageLayout } from '../shared/PageLayout';

export const HelpApp = ({ onBack }: { onBack: () => void }) => <HelpAppInner onBack={onBack} />;

type HelpTopic = {
  id: string;
  title: string;
  content: React.ReactNode;
};

const HelpCard = ({ title, onClick }: { title: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full bg-white p-4 rounded-xl shadow-sm flex justify-between items-center cursor-pointer active:scale-[0.99] transition-transform"
  >
    <span className="text-sm font-medium text-gray-700">{title}</span>
    <span className="text-gray-300">→</span>
  </button>
);

const HelpSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm">
    <div className="text-sm font-bold text-gray-800">{title}</div>
    <div className="mt-2 text-sm text-gray-600 leading-6">{children}</div>
  </div>
);

const HelpAppInner: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const helpTopics: HelpTopic[] = useMemo(
    () => [
      {
        id: 'core-stats',
        title: '核心数值说明（MC/警戒/服从/可疑）',
        content: (
          <div className="space-y-3">
            <HelpSection title="MC 能量">
              使用催眠 APP 会消耗能量，不同功能消耗不同。每天自然恢复至上限的 50%。
            </HelpSection>
            <HelpSection title="MC 点">用来解锁功能，以及提高 MC 能量上限。</HelpSection>
            <HelpSection title="金钱">用来购买物品，也可购买 MC 能量与 MC 点。</HelpSection>
            <HelpSection title="警戒度">
              <div className="space-y-2">
                <div>
                  角色对主角的怀疑程度。到 100 时，角色会知道主角有催眠 APP，会极力回避主角，并全力让主角被惩罚或定罪。
                </div>
                <div>
                  增加来源：
                  <ul className="mt-1 list-disc pl-5 space-y-1">
                    <li>催眠结束时，对方眼前是主角且身体感觉不对劲</li>
                    <li>催眠过程被其他人看见</li>
                    <li>让对方进入催眠的时机太不自然</li>
                  </ul>
                </div>
                <div>每增加 5 点警戒度，会让「主角可疑度」每天自然增加 1 点。</div>
              </div>
            </HelpSection>
            <HelpSection title="服从度">在非催眠状态下调教会增加，表示角色在意识清醒时对主角的服从程度。</HelpSection>
            <HelpSection title="主角可疑度">
              在社会看来主角有多可疑。肆无忌惮使用催眠 APP 会增加（例如被多人目击，或直接用催眠获取金钱）。每天自然减少
              10 点。
            </HelpSection>
            <HelpSection title="金钱来源">
              金钱可以来自打工，也可以直接催眠拿钱；更鼓励用更有创意的玩法去利用催眠 APP 的各种功能。
            </HelpSection>
          </div>
        ),
      },
      {
        id: 'mc-points',
        title: '如何获取 MC 点数？',
        content: <div className="text-sm text-gray-600">通过完成成就, 任务, 氪金, 或让角色高潮.</div>,
      },
    ],
    [],
  );

  const [active, setActive] = useState<HelpTopic | null>(null);

  if (active) {
    return (
      <PageLayout title={active.title} onBack={() => setActive(null)} color="bg-gray-50">
        {active.content}
      </PageLayout>
    );
  }

  return (
    <PageLayout title="帮助中心" onBack={onBack} color="bg-gray-50">
      <div className="space-y-3">
        {helpTopics.map(topic => (
          <HelpCard key={topic.id} title={topic.title} onClick={() => setActive(topic)} />
        ))}
      </div>
      <div className="mt-8 text-center text-xs text-gray-400">
        Version 1.0.0 <br />
        Internal Build
      </div>
    </PageLayout>
  );
};
