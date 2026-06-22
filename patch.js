const fs = require('fs');

let content = fs.readFileSync('src/催眠APP前端/ui/character-background/CharacterBackgroundApp.tsx', 'utf8');

const yamlEditorRegex = /\/\/ ==========================================\n\/\/ 子組件: Yaml 編輯器\n\/\/ ==========================================\nconst YamlEditor: React\.FC<\{ character: CharacterBackgroundData; mode: 'parsed' \| 'raw' \}> = \(\{ character, mode \}\) => \{[\s\S]*?\n\};\n/g;

const ejsEditorRegex = /\/\/ ==========================================\n\/\/ 子組件: Ejs 編輯器\n\/\/ ==========================================\nconst EjsEditor: React\.FC<\{ character: CharacterBackgroundData; mode: 'parsed' \| 'raw' \}> = \(\{ character, mode \}\) => \{[\s\S]*?\n\};\n/g;

const editorViewRegex = /\/\/ ==========================================\n\/\/ 主視圖: 編輯器頁面\n\/\/ ==========================================\ntype EditorTab = 'yaml' \| 'ejs';\ntype EditorMode = 'parsed' \| 'raw';\n\nconst EditorView: React\.FC<\{ character: CharacterBackgroundData \| null; onSave: \(char: CharacterBackgroundData\) => Promise<void>; onBack: \(\) => void \}> = \(\{ character, onSave, onBack \}\) => \{[\s\S]*?\n\};\n/g;

const newYamlEditor = `// ==========================================
// 子組件: Yaml 編輯器
// ==========================================
const YamlEditor: React.FC<{ character: CharacterBackgroundData; mode: 'parsed' | 'raw'; onChange: (newData: any) => void }> = ({ character, mode, onChange }) => {
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
`;

const newEjsEditor = `// ==========================================
// 子組件: Ejs 編輯器
// ==========================================
const EjsEditor: React.FC<{ character: CharacterBackgroundData; mode: 'parsed' | 'raw'; onChange: (newBehavior: any) => void }> = ({ character, mode, onChange }) => {
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

  const renderNode = (node: EJSnode, index: number, category: string) => {
    return (
      <div key={index} className="mb-4 bg-cyan-950/20 border border-cyan-500/30 rounded-lg p-3 relative group">
        <div className="text-xs text-cyan-400 font-mono mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-cyan-900/50 px-1.5 py-0.5 rounded">IF</span>
            <select
              value={node.logic.operator}
              onChange={e => {
                const newBehavior = JSON.parse(JSON.stringify(behavior));
                newBehavior[category][index].logic.operator = e.target.value;
                onChange(newBehavior);
              }}
              className="bg-black/40 border border-cyan-500/30 rounded px-1 py-0.5 outline-none"
            >
              <option value="<">&lt;</option>
              <option value="<=">&lt;=</option>
              <option value="==">==</option>
              <option value=">=">&gt;=</option>
              <option value=">">&gt;</option>
              <option value="else">ELSE</option>
            </select>
            {node.logic.operator !== 'else' && (
              <input
                type="number"
                value={node.logic.value ?? 0}
                onChange={e => {
                  const newBehavior = JSON.parse(JSON.stringify(behavior));
                  newBehavior[category][index].logic.value = Number(e.target.value);
                  onChange(newBehavior);
                }}
                className="w-16 bg-black/40 border border-cyan-500/30 rounded px-1 py-0.5 outline-none"
              />
            )}
          </div>
          <button
            onClick={() => {
              if (!window.confirm('確定刪除此分支？')) return;
              const newBehavior = JSON.parse(JSON.stringify(behavior));
              newBehavior[category].splice(index, 1);
              onChange(newBehavior);
            }}
            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1 bg-red-900/30 rounded transition-opacity"
            title="刪除分支"
          >
            <Trash2 size={14} />
          </button>
        </div>
        <div className="border-l border-cyan-500/20 pl-3 ml-1">
          <div className="min-h-[200px] mt-2">
            <TreeEditor
              initialData={node.contant}
              onChange={newContant => {
                const newBehavior = JSON.parse(JSON.stringify(behavior));
                newBehavior[category][index].contant = newContant;
                onChange(newBehavior);
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  // 邏輯分支樹顯示區
  return (
    <div className="space-y-4 pb-6 font-sans">
      {Object.entries(behavior).map(([key, nodes]) => (
        <div key={key} className="bg-[#1a153a]/20 border border-purple-500/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-cyan-300 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-2 shadow-[0_0_8px_rgba(34,211,238,0.8)]"></span>
              {key}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const newName = window.prompt('請輸入新分類名稱', key);
                  if (newName && newName !== key) {
                    const newBehavior = JSON.parse(JSON.stringify(behavior));
                    newBehavior[newName] = newBehavior[key];
                    delete newBehavior[key];
                    onChange(newBehavior);
                  }
                }}
                className="text-xs text-purple-300 hover:text-white px-2 py-1 bg-purple-900/30 rounded transition"
              >
                重新命名
              </button>
              <button
                onClick={() => {
                  if (!window.confirm('確定刪除此分類及其所有分支？')) return;
                  const newBehavior = JSON.parse(JSON.stringify(behavior));
                  delete newBehavior[key];
                  onChange(newBehavior);
                }}
                className="text-xs text-red-400 hover:text-white px-2 py-1 bg-red-900/30 rounded transition"
              >
                刪除分類
              </button>
            </div>
          </div>
          <div className="border-l border-purple-500/20 pl-3 ml-1">
            {nodes.map((node, i) => renderNode(node, i, key))}
            <button
              onClick={() => {
                const newBehavior = JSON.parse(JSON.stringify(behavior));
                newBehavior[key].push({ logic: { operator: '<', value: 50 }, contant: {} });
                onChange(newBehavior);
              }}
              className="mt-2 text-xs flex items-center gap-1 text-cyan-400 hover:text-cyan-300 px-3 py-1.5 border border-dashed border-cyan-500/50 rounded hover:bg-cyan-900/20 transition"
            >
              <Plus size={14} /> 新增條件分支
            </button>
          </div>
        </div>
      ))}
      <div className="pt-4">
        <button
          onClick={() => {
            const newName = window.prompt('請輸入新分類名稱');
            if (newName && !behavior[newName]) {
              const newBehavior = JSON.parse(JSON.stringify(behavior));
              newBehavior[newName] = [];
              onChange(newBehavior);
            }
          }}
          className="text-sm flex items-center gap-1 text-purple-300 hover:text-purple-200 px-4 py-2 border border-dashed border-purple-500/50 rounded-lg hover:bg-purple-900/20 transition w-full justify-center"
        >
          <Plus size={16} /> 新增行為分類
        </button>
      </div>
    </div>
  );
};
`;

const newEditorView = \`// ==========================================
// 主視圖: 編輯器頁面
// ==========================================
type EditorTab = 'yaml' | 'ejs';
type EditorMode = 'parsed' | 'raw';

const EditorView: React.FC<{ character: CharacterBackgroundData | null; onSave: (char: CharacterBackgroundData) => Promise<void>; onBack: () => void }> = ({ character, onSave, onBack }) => {
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
            className={\\\`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-all \${
              isSaving
                ? 'bg-purple-500/50 text-white shadow-[0_0_15px_rgba(168,85,247,0.6)] animate-pulse'
                : 'bg-purple-600/30 text-purple-200 hover:bg-purple-500/50 hover:text-white hover:shadow-[0_0_10px_rgba(168,85,247,0.4)]'
            }\\\`}
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
              className={\\\`px-3 py-1 text-sm rounded-md transition-colors \${
                activeTab === 'yaml' ? 'bg-purple-500/40 text-white shadow-[0_0_8px_rgba(168,85,247,0.3)]' : 'text-gray-400 hover:text-gray-200'
              }\\\`}
            >
              基本人設
            </button>
            <button
              onClick={() => setActiveTab('ejs')}
              className={\\\`px-3 py-1 text-sm rounded-md transition-colors \${
                activeTab === 'ejs' ? 'bg-purple-500/40 text-white shadow-[0_0_8px_rgba(168,85,247,0.3)]' : 'text-gray-400 hover:text-gray-200'
              }\\\`}
            >
              行為邏輯
            </button>
          </div>

          <button
            onClick={() => setMode(m => m === 'parsed' ? 'raw' : 'parsed')}
            className="flex items-center px-2 py-1 text-xs bg-[#1a153a] border border-purple-500/30 text-purple-300 rounded hover:bg-purple-500/20 transition-colors"
            title="切換編輯模式"
          >
            {mode === 'parsed' ? <Code size={14} className="mr-1" /> : <LayoutList size={14} className="mr-1" />}
            {mode === 'parsed' ? '原始碼' : '視覺化'}
          </button>
        </div>
      </div>

      {/* 編輯器內容區 */}
      <div className="flex-1 overflow-y-auto p-4">
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
};\`;

content = content.replace(yamlEditorRegex, newYamlEditor);
content = content.replace(ejsEditorRegex, newEjsEditor);
content = content.replace(editorViewRegex, newEditorView);

fs.writeFileSync('src/催眠APP前端/ui/character-background/CharacterBackgroundApp.tsx', content, 'utf8');
console.log('patched');
