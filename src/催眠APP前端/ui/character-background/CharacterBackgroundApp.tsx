import React, { useState, useEffect, useRef } from 'react';
import { CharacterMockApi } from '../mock/character-mock-api';
import { CharacterBackgroundData, PromptTemplate, EJSnode } from '../mock/character-mock-data';
import {
  Users,
  Edit3,
  Settings as SettingsIcon,
  UserPlus,
  ChevronLeft,
  TerminalSquare,
  Save,
  Code,
  LayoutList,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { TreeEditor } from './TreeEditor';

// ==========================================
// 預設角色人設範本
// ==========================================
const INITIAL_CHARACTER_TEMPLATE = (newName: string): CharacterBackgroundData => ({
  basic: {
    [newName]: {
      title: '新角色',
      gender: '女',
      age: 18,
      identity: {
        public: '公開身份',
        hidden: '隱藏身份',
      },
      social_connection: {
        人物: '關係',
      },
      personality: {
        core: {
          人格特質: '特質描述',
        },
        conditional: {
          特定條件下的態度: '態度描述',
        },
        hidden: {
          '隱藏的特質，本人自己都不太清楚': '特質描述',
        },
      },
      habit: ['習慣'],
      hidden_behavior: ['私下的習慣'],
      appearance: {
        height: '160cm',
        weight: '48kg',
        measurement: 'B80 W58 H82',
        style: '外觀風格',
        overview: '長相與外貌總覽',
        attire: {
          school: '制服穿著方式',
          casual: '便服裝束',
        },
        feature: ['外觀特點'],
      },
      sexual_preference: {
        masturbation_frequency: '自慰頻率',
        orgasm_response: '高潮時的反應',
        sensitive_spot: {
          位置: '敏感的表現',
        },
        hidden_fetish: {
          隱藏的癖好: '表現',
        },
        special_trait: ['性愛特點'],
      },
      weakness: ['弱點'],
    },
  },
  behavior: {
    arousal: [
      { logic: { operator: '<', value: 20 }, contant: { 发情状态: { 表现: ['表现描述'] } } },
      { logic: { operator: '<', value: 40 }, contant: { 发情状态: { 表现: ['表现描述'] } } },
      {
        logic: { operator: '<', value: 60 },
        contant: { 发情状态: { 表现: ['表现描述'], 生理反应: ['生理反应描述'] } },
      },
      {
        logic: { operator: '<', value: 80 },
        contant: { 发情状态: { 表现: ['表现描述'], 生理反应: ['生理反应描述'], 理智残存: '理智残存描述' } },
      },
      {
        logic: { operator: '<', value: 95 },
        contant: {
          发情状态: {
            表现: ['表现描述'],
            生理反应: ['生理反应描述'],
            理智残存: '理智残存描述',
            渴望程度: '渴望程度描述',
          },
        },
      },
      {
        logic: { operator: 'else' },
        contant: { 发情状态: { 表现: ['表现描述'], 生理反应: ['生理反应描述'], 出格行为: ['出格行为描述'] } },
      },
    ],
    alert: [
      {
        logic: { operator: '<', value: 20 },
        contant: { 对user的态度: { 状态: '状态描述', 行为指导: ['行为指导描述'] } },
      },
      {
        logic: { operator: '<', value: 40 },
        contant: { 对user的态度: { 状态: '状态描述', 行为指导: ['行为指导描述'] } },
      },
      {
        logic: { operator: '<', value: 60 },
        contant: { 对user的态度: { 状态: '状态描述', 行为指导: ['行为指导描述'], 敌意表现: ['敌意表现描述'] } },
      },
      {
        logic: { operator: '<', value: 80 },
        contant: {
          对user的态度: {
            状态: '状态描述',
            行为指导: ['行为指导描述'],
            敌意表现: ['敌意表现描述'],
            接触禁忌: ['接触禁忌描述'],
          },
        },
      },
      {
        logic: { operator: '<', value: 100 },
        contant: {
          对user的态度: {
            状态: '状态描述',
            行为指导: ['行为指导描述'],
            敌意表现: ['敌意表现描述'],
            接触禁忌: ['接触禁忌描述'],
            敵意行為: ['行為描述'],
          },
        },
      },
      {
        logic: { operator: 'else' },
        contant: {
          对user的态度: {
            状态: '状态描述',
            行为指导: ['行为指导描述'],
            敌意表现: ['敌意表现描述'],
            接触禁忌: ['接触禁忌描述'],
            敵意行為: ['行為描述'],
          },
        },
      },
    ],
    affection: [
      { logic: { operator: '<', value: 20 }, contant: { 好感表现: { 状态: '状态描述', 行为指导: ['行为指导描述'] } } },
      {
        logic: { operator: '<', value: 40 },
        contant: { 好感表现: { 状态: '状态描述', 行为指导: ['行为指导描述'], 变化倾向: ['变化倾向描述'] } },
      },
      {
        logic: { operator: '<', value: 60 },
        contant: { 好感表现: { 状态: '状态描述', 行为指导: ['行为指导描述'], 变化倾向: ['变化倾向描述'] } },
      },
      {
        logic: { operator: '<', value: 80 },
        contant: {
          好感表现: {
            状态: '状态描述',
            行为指导: ['行为指导描述'],
            特殊互动: ['特殊互动描述'],
            心理依赖: '心理依赖描述',
          },
        },
      },
      {
        logic: { operator: 'else' },
        contant: {
          好感表现: {
            状态: '状态描述',
            行为指导: ['行为指导描述'],
            特殊互动: ['特殊互动描述'],
            心理依赖: '心理依赖描述',
            允许越界: ['允许越界描述'],
          },
        },
      },
    ],
    obedience: [
      { logic: { operator: '<', value: 20 }, contant: { 服从表现: { 状态: '状态描述', 行为指导: ['行为指导描述'] } } },
      {
        logic: { operator: '<', value: 40 },
        contant: { 服从表现: { 状态: '状态描述', 行为指导: ['行为指导描述'], 变化倾向: ['变化倾向描述'] } },
      },
      {
        logic: { operator: '<', value: 60 },
        contant: { 服从表现: { 状态: '状态描述', 行为指导: ['行为指导描述'], 变化倾向: ['变化倾向描述'] } },
      },
      {
        logic: { operator: '<', value: 80 },
        contant: {
          服从表现: {
            状态: '状态描述',
            行为指导: ['行为指导描述'],
            变化倾向: ['变化倾向描述'],
            忠诚表现: ['忠诚表现描述'],
            羞耻承受极限: ['羞耻承受极限描述'],
          },
        },
      },
      {
        logic: { operator: 'else' },
        contant: {
          服从表现: {
            状态: '状态描述',
            行为指导: ['行为指导描述'],
            忠诚表现: ['忠诚表现描述'],
            自我认知: '自我认知描述',
          },
        },
      },
    ],
    global: [
      {
        logic: { operator: 'else' },
        contant: {
          rules: [
            '行为指导优先于作为背景的`角色关键信息`和`角色详情`',
            '好感度和服从度行为可以混合',
            '角色的好感與服從度要優先於警戒度, 只要好感度或服從度大於警戒度, 就不會觸發警戒',
          ],
        },
      },
    ],
  },
});

// ==========================================
// 子組件: 新增角色 Modal 彈窗
// ==========================================
interface CreateCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  existingNames: string[];
}

const CreateCharacterModal: React.FC<CreateCharacterModalProps> = ({ isOpen, onClose, onConfirm, existingNames }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim().replace(/\s+/g, '');
    if (!trimmed) {
      setError('角色名稱不能為空');
      return;
    }
    if (existingNames.includes(trimmed)) {
      setError('該角色名稱已存在');
      return;
    }
    const RESERVED_NAMES = ['系統', '系统', '任務', '任务'];
    if (RESERVED_NAMES.includes(trimmed)) {
      setError('此名稱為系統保留字，請使用其他名稱');
      return;
    }

    onConfirm(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
      {/* 遮罩背景 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal 主體 */}
      <div className="relative w-full max-w-sm bg-[#120e24]/95 border border-purple-500/30 rounded-2xl p-6 shadow-[0_0_25px_rgba(168,85,247,0.15)] animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-4 text-left">
        <div className="flex justify-between items-center pb-2 border-b border-purple-500/10">
          <h3 className="text-base font-semibold text-purple-200">新增角色人設</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400 font-medium">角色名稱</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="請輸入中文名稱（例如：白鳥百合子）"
              className="bg-black/40 border border-purple-500/30 rounded-xl px-3.5 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-400 focus:shadow-[0_0_10px_rgba(168,85,247,0.2)] transition-all"
            />
            {error && <span className="text-xs text-red-400 mt-1">{error}</span>}
          </div>

          <div className="flex justify-end gap-2.5 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-transparent text-gray-400 hover:text-gray-200 text-xs font-medium rounded-xl border border-transparent hover:bg-white/5 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600/30 hover:bg-purple-500/50 text-purple-300 hover:text-white text-xs font-semibold rounded-xl border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)] transition-all"
            >
              確認建立
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 子組件: 自定義通用對話框 (Alert / Confirm / Prompt)
// ==========================================
interface CustomDialogModalProps {
  isOpen: boolean;
  type: 'alert' | 'confirm' | 'prompt';
  title: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  onClose: () => void;
  onConfirm: (val?: string) => void;
}

const CustomDialogModal: React.FC<CustomDialogModalProps> = ({
  isOpen,
  type,
  title,
  message,
  placeholder,
  defaultValue = '',
  onClose,
  onConfirm,
}) => {
  const [inputVal, setInputVal] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputVal(defaultValue);
      if (type === 'prompt') {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [isOpen, defaultValue, type]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(type === 'prompt' ? inputVal : undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
      {/* 遮罩背景 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal 主體 */}
      <div className="relative w-full max-w-sm bg-[#120e24]/95 border border-purple-500/30 rounded-2xl p-6 shadow-[0_0_25px_rgba(168,85,247,0.15)] animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-4 text-left">
        <div className="flex justify-between items-center pb-2 border-b border-purple-500/10">
          <h3 className="text-base font-semibold text-purple-200">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{message}</p>
            {type === 'prompt' && (
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder={placeholder}
                className="bg-black/40 border border-purple-500/30 rounded-xl px-3.5 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-400 focus:shadow-[0_0_10px_rgba(168,85,247,0.2)] transition-all mt-1"
              />
            )}
          </div>

          <div className="flex justify-end gap-2.5 mt-2">
            {type !== 'alert' && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-transparent text-gray-400 hover:text-gray-200 text-xs font-medium rounded-xl border border-transparent hover:bg-white/5 transition-colors"
              >
                取消
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600/30 hover:bg-purple-500/50 text-purple-300 hover:text-white text-xs font-semibold rounded-xl border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)] transition-all"
            >
              確認
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export type AppTab = 'list' | 'editor' | 'settings';

// ==========================================
// 子組件: 底部導覽列
// ==========================================
const MainNavigation: React.FC<{ activeTab: AppTab; onChangeTab: (tab: AppTab) => void }> = ({
  activeTab,
  onChangeTab,
}) => {
  const tabs: { id: AppTab; label: string; icon: React.ReactNode }[] = [
    { id: 'list', label: '角色列表', icon: <Users size={20} /> },
    { id: 'editor', label: '編輯區', icon: <Edit3 size={20} /> },
    { id: 'settings', label: '設定', icon: <SettingsIcon size={20} /> },
  ];

  return (
    <div className="shrink-0 bg-[#16122b]/80 backdrop-blur-md border-t border-purple-500/20 px-2 py-2 flex justify-around items-center pb-safe">
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChangeTab(tab.id)}
            className={`flex flex-col items-center justify-center w-16 p-2 rounded-xl transition-all duration-300 ${
              isActive
                ? 'text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.3)] bg-purple-500/10'
                : 'text-gray-400 hover:text-purple-200'
            }`}
          >
            <div className={`mb-1 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>{tab.icon}</div>
            <span className="text-[10px] sm:text-xs font-medium">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// ==========================================
// 子組件: 角色列表視圖
// ==========================================
const CharacterListView: React.FC<{
  characters: CharacterBackgroundData[];
  onSelectCharacter: (name: string) => void;
  onCreateCharacter: () => void;
}> = ({ characters, onSelectCharacter, onCreateCharacter }) => {
  return (
    <div className="flex flex-col h-full p-4">
      {/* 頂部操作區 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold text-purple-200">選擇角色</h2>
        </div>
        <button
          onClick={onCreateCharacter}
          className="p-2 bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/40 hover:shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-all"
          title="新增角色人設"
        >
          <UserPlus size={20} />
        </button>
      </div>

      {/* 角色列表區 */}
      <div className="grid grid-cols-1 gap-4">
        {characters.map(char => {
          const name = Object.keys(char.basic)[0];
          const basicData = char.basic[name] || {};
          const summary = basicData.identity?.public || basicData.title || '';

          return (
            <button
              key={name}
              onClick={() => onSelectCharacter(name)}
              className="flex items-center p-4 bg-[#1a153a]/50 border border-purple-500/20 rounded-2xl text-left hover:bg-[#231b4e]/80 hover:border-purple-400/50 hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-purple-900/50 flex items-center justify-center text-purple-300 text-lg font-bold border border-purple-500/30 group-hover:border-purple-400">
                {name.charAt(0)}
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-gray-100 group-hover:text-purple-200 transition-colors">
                  {name}
                </h3>
                <p className="text-sm text-gray-400 line-clamp-1">{summary}</p>
              </div>
            </button>
          );
        })}
        {characters.length === 0 && <div className="text-center text-gray-500 mt-10">尚無角色資料</div>}
      </div>
    </div>
  );
};

// ==========================================
// 子組件: Yaml 編輯器
// ==========================================
const YamlEditor: React.FC<{
  character: CharacterBackgroundData;
  mode: 'parsed' | 'raw';
  onChange: (newData: any) => void;
}> = ({ character, mode, onChange }) => {
  const name = Object.keys(character.basic)[0];
  const basicData = character.basic[name] || {};

  if (mode === 'raw') {
    // 原始碼編輯區
    return (
      <div className="h-full flex flex-col">
        <textarea
          className="flex-1 w-full bg-[#0a0814] text-purple-100 font-mono text-xs p-4 rounded-xl border border-purple-500/20 focus:outline-none focus:border-purple-500/50 focus:shadow-[0_0_15px_rgba(168,85,247,0.2)] resize-none transition-all"
          defaultValue={JSON.stringify(basicData, null, 2)}
          onBlur={e => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange(parsed);
            } catch (err) {
              // Ignore
            }
          }}
          spellCheck={false}
        />
      </div>
    );
  }

  // Parsed Mode (Visual Tree)
  return (
    <div className="h-full">
      <TreeEditor initialData={basicData} onChange={onChange} />
    </div>
  );
};

// ==========================================
// 子組件: Ejs 編輯器
// ==========================================
const CATEGORIES = [
  { key: 'arousal', label: '發情狀態指導', subject: '發情值' },
  { key: 'alert', label: '警戒度指導', subject: '警戒度' },
  { key: 'affection', label: '好感度指導', subject: '好感度' },
  { key: 'obedience', label: '服從度指導', subject: '服從度' },
  { key: 'global', label: '全局行為', subject: '全局' },
] as const;

const EjsEditor: React.FC<{
  character: CharacterBackgroundData;
  mode: 'parsed' | 'raw';
  onChange: (newBehavior: any) => void;
}> = ({ character, mode, onChange }) => {
  if (mode === 'raw') {
    // 原始碼編輯區
    return (
      <div className="h-full flex flex-col">
        <textarea
          className="flex-1 w-full bg-[#0a0814] text-[#a8c7fa] font-mono text-xs p-4 rounded-xl border border-purple-500/20 focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(34,211,238,0.2)] resize-none transition-all"
          defaultValue={JSON.stringify(character.behavior, null, 2)}
          onBlur={e => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange(parsed);
            } catch (err) {
              // Ignore
            }
          }}
          spellCheck={false}
        />
      </div>
    );
  }

  // Parsed Mode (Visual Tree)
  const behavior = character.behavior || {};

  // 1. 狀態追蹤
  const [activeCategory, setActiveCategory] = useState<string>('arousal');
  const [activeBranchIndex, setActiveBranchIndex] = useState<number>(0);

  // 當切換大分類時，重設分支索引為 0
  useEffect(() => {
    setActiveBranchIndex(0);
  }, [activeCategory]);

  const branches: EJSnode[] = behavior[activeCategory] || [];
  const activeBranch = branches[activeBranchIndex];

  const [dialog, setDialog] = useState<{
    type: 'alert' | 'confirm' | 'prompt';
    title?: string;
    message: string;
    placeholder?: string;
    defaultValue?: string;
    onConfirm: (val?: string) => void;
    onCancel?: () => void;
  } | null>(null);

  // 2. 自動排序與規格化函數
  const sortAndNormalizeBranches = (list: EJSnode[]): EJSnode[] => {
    // 複製一份，避免對原陣列造成直接修改的副作用
    const clonedList = list.map(b => JSON.parse(JSON.stringify(b)));

    let numeric = clonedList.filter(b => b.logic.operator !== 'else');
    let elseBranch = clonedList.find(b => b.logic.operator === 'else');

    // 如果沒有 else 分支，且有數值分支，我們把最大的數值分支轉為 else 分支
    if (!elseBranch && numeric.length > 0) {
      // 先對數值分支進行排序，找出最大的一個
      numeric.sort((a, b) => (a.logic.value ?? 0) - (b.logic.value ?? 0));
      const maxNumericBranch = numeric[numeric.length - 1];

      // 將最大數值分支改為 else
      maxNumericBranch.logic = {
        operator: 'else' as const,
      };

      // 重新指定劃分
      elseBranch = maxNumericBranch;
      numeric = numeric.slice(0, -1);
    }

    // 升序排序剩餘的數值分支
    numeric.sort((a, b) => (a.logic.value ?? 0) - (b.logic.value ?? 0));

    // 自動分配運算子為 '<'
    const normalizedNumeric = numeric.map(b => ({
      ...b,
      logic: {
        ...b.logic,
        operator: '<' as const,
      },
    }));

    const result = [...normalizedNumeric];
    if (elseBranch) {
      result.push({
        ...elseBranch,
        logic: {
          ...elseBranch.logic,
          operator: 'else' as const,
        },
      });
    }
    return result;
  };

  const handleUpdateBranches = (newBranches: EJSnode[], targetVal?: number, targetOp?: 'else', forceIndex?: number) => {
    const sorted = sortAndNormalizeBranches(newBranches);

    let nextIndex = 0;
    if (forceIndex !== undefined) {
      nextIndex = forceIndex;
    } else if (targetOp === 'else') {
      const foundIndex = sorted.findIndex(b => b.logic.operator === 'else');
      if (foundIndex !== -1) nextIndex = foundIndex;
    } else if (targetVal !== undefined) {
      const foundIndex = sorted.findIndex(b => b.logic.operator !== 'else' && b.logic.value === targetVal);
      if (foundIndex !== -1) nextIndex = foundIndex;
    } else {
      // 藉由物件引用比對，追蹤變更前的選中分支在排序後的新 index
      const selectedBranchObj = branches[activeBranchIndex];
      if (selectedBranchObj) {
        const foundIndex = sorted.findIndex(b => b === selectedBranchObj);
        if (foundIndex !== -1) {
          nextIndex = foundIndex;
        }
      }
    }

    const newBehavior = {
      ...behavior,
      [activeCategory]: sorted,
    };
    onChange(newBehavior);
    setActiveBranchIndex(nextIndex);
  };

  // 3. 渲染分類與分支 UI
  const isElse = activeBranch?.logic?.operator === 'else';
  const stageNum = activeBranchIndex + 1;
  const totalStages = branches.length;
  const subjectName = CATEGORIES.find(cat => cat.key === activeCategory)?.subject || '';
  const conditionText = isElse ? `其他情況 (else)` : `當 ${subjectName} 小於 ${activeBranch?.logic?.value ?? 0} 時`;

  const headingText = isElse
    ? `最後階段 / 共 ${totalStages} 階段：${conditionText}`
    : `第 ${stageNum} 階段 / 共 ${totalStages} 階段：${conditionText}`;

  return (
    <div className="flex flex-col gap-4 pb-6 font-sans">
      {/* A. 頂部大分類 Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 border-b border-purple-500/10 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-purple-500/30 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-500/50">
        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.key;
          const count = (behavior[cat.key] || []).length;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shrink-0 border ${
                isActive
                  ? 'text-purple-300 border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.2)] bg-purple-500/10'
                  : 'text-gray-400 border-transparent hover:text-purple-200 bg-black/20'
              }`}
            >
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-purple-500/30 text-purple-200' : 'bg-white/5 text-gray-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* B. 分支快選 Chips 控制列 */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-[#1a153a]/30 border border-purple-500/10 rounded-xl">
        <span className="text-xs text-gray-400 mr-2 shrink-0 font-medium">分支階段：</span>
        {branches.map((b, idx) => {
          const isActive = activeBranchIndex === idx;
          const isBranchElse = b.logic.operator === 'else';
          const label = isBranchElse ? 'else' : `${b.logic.value}`;
          return (
            <button
              key={idx}
              onClick={() => setActiveBranchIndex(idx)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all border ${
                isActive
                  ? 'border-cyan-500/50 shadow-[0_0_8px_rgba(34,211,238,0.2)] bg-cyan-500/10 text-cyan-300'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          );
        })}

        {/* 新增數值分支按鈕 */}
        <button
          onClick={() => {
            setDialog({
              type: 'prompt',
              title: '新增數值分支',
              message: '請輸入新分支的上限臨界值 (數字，例如 30)：',
              defaultValue: '',
              placeholder: '例如 30',
              onConfirm: input => {
                if (input === undefined || input === null) return;
                const trimmed = input.trim();
                if (!trimmed) return;
                const val = Number(trimmed);
                if (Number.isNaN(val)) {
                  setDialog({
                    type: 'alert',
                    title: '錯誤',
                    message: '請輸入有效的數字！',
                    onConfirm: () => setDialog(null),
                  });
                  return;
                }
                if (branches.some(b => b.logic.operator !== 'else' && b.logic.value === val)) {
                  setDialog({
                    type: 'alert',
                    title: '錯誤',
                    message: '該數值分支已存在！',
                    onConfirm: () => setDialog(null),
                  });
                  return;
                }
                const newBranch: EJSnode = {
                  logic: { operator: '<', value: val },
                  contant: {},
                };
                const sorted = sortAndNormalizeBranches([...branches, newBranch]);
                const nextIdx = sorted.findIndex(b => b.logic.operator !== 'else' && b.logic.value === val);
                onChange({ ...behavior, [activeCategory]: sorted });
                if (nextIdx !== -1) setActiveBranchIndex(nextIdx);
                setDialog(null);
              },
            });
          }}
          className="px-2.5 py-1 rounded-lg text-xs font-medium text-purple-300 hover:text-purple-200 hover:bg-purple-500/10 border border-dashed border-purple-500/30 transition-colors flex items-center gap-1 ml-auto"
        >
          <Plus size={12} />
          <span>新增數值分支</span>
        </button>

        {/* 新增 Else 分支按鈕 */}
        {!branches.some(b => b.logic.operator === 'else') && (
          <button
            onClick={() => {
              const newBranch: EJSnode = {
                logic: { operator: 'else' },
                contant: {},
              };
              const sorted = sortAndNormalizeBranches([...branches, newBranch]);
              onChange({ ...behavior, [activeCategory]: sorted });
              setActiveBranchIndex(sorted.length - 1);
            }}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/10 border border-dashed border-cyan-500/30 transition-colors flex items-center gap-1"
          >
            <Plus size={12} />
            <span>新增 Else</span>
          </button>
        )}
      </div>

      {/* C. 無分支時的 Empty State */}
      {branches.length === 0 && (
        <div className="flex flex-col items-center justify-center p-8 bg-[#1a153a]/20 border border-dashed border-purple-500/20 rounded-2xl text-center">
          <p className="text-sm text-gray-500 mb-4">此分類目前沒有設定任何分支</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const newBranch: EJSnode = {
                  logic: { operator: 'else' },
                  contant: {},
                };
                onChange({ ...behavior, [activeCategory]: [newBranch] });
                setActiveBranchIndex(0);
              }}
              className="px-4 py-2 bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs hover:bg-purple-600/50 hover:text-white transition"
            >
              快速建立單一 Else 分支
            </button>
          </div>
        </div>
      )}

      {/* D. 當前選中分支編輯區 */}
      {activeBranch && (
        <div className="bg-[#120e24]/40 border border-purple-500/20 rounded-2xl p-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-500/10">
            <div>
              <h4 className="text-sm font-semibold text-cyan-300">{headingText}</h4>
            </div>

            <div className="flex items-center gap-3">
              {/* 數值直接編輯輸入框 */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{isElse ? '轉為數值分支：' : '修改數值：'}</span>
                <input
                  type="number"
                  placeholder={isElse ? '輸入數值...' : ''}
                  value={isElse ? '' : (activeBranch.logic.value ?? '')}
                  onChange={e => {
                    const valStr = e.target.value;
                    if (valStr === '') {
                      const isOriginalElse = activeBranchIndex === branches.length - 1;
                      const updatedList = branches.map((b, idx) => {
                        if (idx === activeBranchIndex) {
                          return {
                            ...b,
                            logic: {
                              ...b.logic,
                              operator: isOriginalElse ? ('else' as const) : ('<' as const),
                              value: undefined,
                            },
                          };
                        }
                        return b;
                      });
                      handleUpdateBranches(
                        updatedList,
                        undefined,
                        isOriginalElse ? 'else' : undefined,
                        activeBranchIndex,
                      );
                      return;
                    }
                    const nextVal = Number(valStr);
                    if (Number.isNaN(nextVal)) return;

                    // 檢查是否存在重複的數值分支
                    if (
                      branches.some(
                        (b, idx) =>
                          idx !== activeBranchIndex && b.logic.operator !== 'else' && b.logic.value === nextVal,
                      )
                    ) {
                      setDialog({
                        type: 'alert',
                        title: '錯誤',
                        message: '該數值分支已存在！',
                        onConfirm: () => setDialog(null),
                      });
                      return;
                    }

                    const updatedList = branches.map((b, idx) => {
                      if (idx === activeBranchIndex) {
                        return {
                          ...b,
                          logic: {
                            operator: '<' as const,
                            value: nextVal,
                          },
                        };
                      }
                      return b;
                    });
                    handleUpdateBranches(updatedList, nextVal);
                  }}
                  onBlur={() => {
                    const isOriginalElse = activeBranchIndex === branches.length - 1;
                    if (isOriginalElse) {
                      const updatedList = branches.map((b, idx) => {
                        if (idx === activeBranchIndex) {
                          return {
                            ...b,
                            logic: {
                              operator: 'else' as const,
                              value: undefined,
                            },
                          };
                        }
                        return b;
                      });
                      handleUpdateBranches(updatedList, undefined, 'else', activeBranchIndex);
                      return;
                    }

                    if (activeBranch.logic.value === undefined) {
                      let finalVal = 0;
                      const existingVals = branches
                        .filter((_, idx) => idx !== activeBranchIndex)
                        .map(b => b.logic.value)
                        .filter((v): v is number => v !== undefined);

                      while (existingVals.includes(finalVal)) {
                        finalVal += 1;
                      }

                      const updatedList = branches.map((b, idx) => {
                        if (idx === activeBranchIndex) {
                          return {
                            ...b,
                            logic: {
                              ...b.logic,
                              operator: '<' as const,
                              value: finalVal,
                            },
                          };
                        }
                        return b;
                      });
                      handleUpdateBranches(updatedList, finalVal);
                    }
                  }}
                  className="w-20 bg-black/40 border border-purple-500/30 rounded-lg px-2.5 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-purple-400"
                />
              </div>

              {/* 刪除分支按鈕 */}
              <button
                onClick={() => {
                  setDialog({
                    type: 'confirm',
                    title: '確認刪除',
                    message: '確定刪除此分支階段？這將會刪除該階段底下的所有編輯內容。',
                    onConfirm: () => {
                      const updatedList = branches.filter((_, idx) => idx !== activeBranchIndex);
                      const sorted = sortAndNormalizeBranches(updatedList);
                      onChange({
                        ...behavior,
                        [activeCategory]: sorted,
                      });
                      setActiveBranchIndex(Math.max(0, activeBranchIndex - 1));
                      setDialog(null);
                    },
                  });
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-400 hover:text-white bg-red-900/20 hover:bg-red-900/50 border border-red-500/30 rounded-lg transition-all"
                title="刪除此階段"
              >
                <Trash2 size={13} />
                <span>刪除分支</span>
              </button>
            </div>
          </div>

          {/* 全寬度單一 TreeEditor */}
          <div className="flex-1 min-h-[350px]">
            <TreeEditor
              key={`${activeCategory}_${activeBranchIndex}`}
              initialData={activeBranch.contant}
              onChange={newContant => {
                const newBehavior = JSON.parse(JSON.stringify(behavior));
                newBehavior[activeCategory][activeBranchIndex].contant = newContant;
                onChange(newBehavior);
              }}
            />
          </div>
        </div>
      )}

      {dialog && (
        <CustomDialogModal
          isOpen={true}
          type={dialog.type}
          title={dialog.title || '系統提示'}
          message={dialog.message}
          placeholder={dialog.placeholder}
          defaultValue={dialog.defaultValue}
          onClose={() => {
            if (dialog.onCancel) dialog.onCancel();
            setDialog(null);
          }}
          onConfirm={val => {
            dialog.onConfirm(val);
          }}
        />
      )}
    </div>
  );
};

// ==========================================
// 主視圖: 編輯器頁面
// ==========================================
type EditorTab = 'yaml' | 'ejs';
type EditorMode = 'parsed' | 'raw';

const EditorView: React.FC<{
  character: CharacterBackgroundData | null;
  onSave: (char: CharacterBackgroundData) => Promise<void>;
  onBack: () => void;
}> = ({ character, onSave, onBack }) => {
  const [activeTab, setActiveTab] = useState<EditorTab>('yaml');
  const [mode, setMode] = useState<EditorMode>('parsed');
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<CharacterBackgroundData | null>(null);

  useEffect(() => {
    setDraft(character ? JSON.parse(JSON.stringify(character)) : null);
  }, [character]);

  if (!draft) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4">
        <div className="text-gray-400 text-center">
          <p className="mb-4">請先從角色列表選擇一個角色</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-purple-600/30 text-purple-300 rounded-lg hover:bg-purple-600/50 transition-colors"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const name = Object.keys(draft.basic)[0];

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(draft);
    setIsSaving(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 頂部標題與操作區 */}
      <div className="shrink-0 p-4 border-b border-purple-500/20 bg-[#120e24]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold text-gray-100 flex items-center">
            <span className="w-2 h-2 rounded-full bg-purple-400 mr-2 shadow-[0_0_8px_rgba(168,85,247,0.8)]"></span>
            {name}
          </h2>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              isSaving
                ? 'bg-purple-500/50 text-white shadow-[0_0_15px_rgba(168,85,247,0.6)] animate-pulse'
                : 'bg-purple-600/30 text-purple-200 hover:bg-purple-500/50 hover:text-white hover:shadow-[0_0_10px_rgba(168,85,247,0.4)]'
            }`}
          >
            <Save size={16} className="mr-1.5" />
            {isSaving ? '儲存中...' : '儲存'}
          </button>
        </div>

        {/* 子導覽與模式切換區 */}
        <div className="flex justify-between items-center">
          <div className="flex space-x-1 bg-black/40 p-1 rounded-lg border border-purple-500/10">
            <button
              onClick={() => setActiveTab('yaml')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                activeTab === 'yaml'
                  ? 'bg-purple-500/40 text-white shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              基本人設
            </button>
            <button
              onClick={() => setActiveTab('ejs')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                activeTab === 'ejs'
                  ? 'bg-purple-500/40 text-white shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              行為邏輯
            </button>
          </div>

          <button
            onClick={() => setMode(m => (m === 'parsed' ? 'raw' : 'parsed'))}
            className="flex items-center px-2 py-1 text-xs bg-[#1a153a] border border-purple-500/30 text-purple-300 rounded hover:bg-purple-500/20 transition-colors"
            title="切換編輯模式"
          >
            {mode === 'parsed' ? <Code size={14} className="mr-1" /> : <LayoutList size={14} className="mr-1" />}
            {mode === 'parsed' ? '原始碼' : '視覺化'}
          </button>
        </div>
      </div>

      {/* 編輯器內容區 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-purple-500/30 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-500/50">
        {activeTab === 'yaml' ? (
          <YamlEditor
            character={draft}
            mode={mode}
            onChange={newData => setDraft({ ...draft, basic: { [name]: newData } })}
          />
        ) : (
          <EjsEditor
            character={draft}
            mode={mode}
            onChange={newBehavior => setDraft({ ...draft, behavior: newBehavior })}
          />
        )}
      </div>
    </div>
  );
};

// ==========================================
// 主視圖: 設定視圖
// ==========================================
const SettingsView: React.FC = () => {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPrompts = async () => {
      setLoading(true);
      try {
        const data = await CharacterMockApi.getPrompts();
        setPrompts(data);
      } finally {
        setLoading(false);
      }
    };
    loadPrompts();
  }, []);

  return (
    <div className="flex flex-col h-full p-4">
      {/* 頂部標題區 */}
      <div className="flex items-center mb-6 border-b border-purple-500/20 pb-4">
        <SettingsIcon className="text-purple-400 mr-2" size={24} />
        <h2 className="text-xl font-bold text-gray-100">設定</h2>
      </div>

      {/* 設定內容區 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-purple-500/30 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-500/50">
        <h3 className="text-lg font-semibold text-purple-300 mb-4 flex items-center">
          <TerminalSquare size={18} className="mr-2" />
          提示詞管理
        </h3>

        {loading ? (
          <div className="text-gray-500 text-sm">載入提示詞中...</div>
        ) : (
          <div className="space-y-4">
            {/* 提示詞列表區 */}
            {prompts.map(prompt => (
              <div key={prompt.id} className="bg-[#1a153a]/60 border border-purple-500/20 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-200">{prompt.name}</h4>
                  {prompt.isSystem && (
                    <span className="text-[10px] bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
                      系統內建
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 line-clamp-2 bg-black/30 p-2 rounded-lg font-mono text-[11px]">
                  {prompt.content}
                </p>
                <div className="mt-3 flex justify-end">
                  <button className="text-xs text-purple-400 hover:text-purple-200 transition-colors">編輯</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 主視圖: 應用程式入口
// ==========================================
export const CharacterBackgroundApp: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<AppTab>('list');
  const [selectedCharacterName, setSelectedCharacterName] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CharacterBackgroundData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await CharacterMockApi.getCharacters();
        setCharacters(data);
      } catch (e) {
        console.error('Failed to load characters', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSelectCharacter = (name: string) => {
    setSelectedCharacterName(name);
    setActiveTab('editor');
  };

  const handleSaveCharacter = async (updatedChar: CharacterBackgroundData) => {
    try {
      const saved = await CharacterMockApi.saveCharacter(updatedChar);
      const name = Object.keys(saved.basic)[0];
      setCharacters(prev => prev.map(c => (Object.keys(c.basic)[0] === name ? saved : c)));
    } catch (e) {
      console.error('Failed to save character', e);
    }
  };

  const handleCreateCharacter = async (name: string) => {
    const newChar = INITIAL_CHARACTER_TEMPLATE(name);
    try {
      const saved = await CharacterMockApi.saveCharacter(newChar);
      setCharacters(prev => [...prev, saved]);
      handleSelectCharacter(name);
    } catch (e) {
      console.error('Failed to create character', e);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0d0a1a] text-white overflow-hidden relative">
      {/* 頂部標題列 */}
      <div className="shrink-0 px-4 py-3 bg-[#130f26] border-b border-purple-500/20 shadow-md z-10 flex items-center justify-between relative">
        {onBack && (
          <button
            onClick={onBack}
            className="absolute left-4 p-1.5 bg-purple-500/10 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors z-20"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <h1 className="text-xl font-bold text-transparent bg-clip-text bg-linear-to-r from-purple-400 to-pink-300 text-center w-full">
          角色編輯器
        </h1>
      </div>

      {/* 主內容區域 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-purple-500/30 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-500/50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-purple-400 animate-pulse text-lg">載入中...</div>
          </div>
        ) : (
          <>
            {activeTab === 'list' && (
              <CharacterListView
                characters={characters}
                onSelectCharacter={handleSelectCharacter}
                onCreateCharacter={() => setIsCreateModalOpen(true)}
              />
            )}
            {activeTab === 'editor' && (
              <EditorView
                key={selectedCharacterName}
                character={characters.find(c => Object.keys(c.basic)[0] === selectedCharacterName) || null}
                onSave={handleSaveCharacter}
                onBack={() => setActiveTab('list')}
              />
            )}
            {activeTab === 'settings' && <SettingsView />}
          </>
        )}
      </div>

      {/* 底部導覽列 */}
      <MainNavigation activeTab={activeTab} onChangeTab={setActiveTab} />

      {/* 新增角色彈窗 */}
      <CreateCharacterModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onConfirm={handleCreateCharacter}
        existingNames={characters.map(c => Object.keys(c.basic)[0])}
      />
    </div>
  );
};
