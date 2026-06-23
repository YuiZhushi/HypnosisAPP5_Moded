import React, { useState, useEffect } from 'react';
import { Terminal, RefreshCw, X, Database, ShieldAlert, Cpu, Check, Zap } from 'lucide-react';
import { mockMvuVariables, mockChatVariables } from '../../database/mockDatabase';

// ==========================================
// Debug 輔助函數區
// ==========================================
function getTavernRealMvu(): any {
  return (globalThis as any).Mvu || null;
}

function getTavernRealChatVars(): any {
  if (typeof (globalThis as any).getVariables === 'function') {
    try {
      return (globalThis as any).getVariables({ type: 'chat' }) || null;
    } catch {
      return null;
    }
  }
  return null;
}

export const DebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'tavern' | 'mockMvu' | 'mockChat' | 'actions'>('tavern');
  
  // 編輯文字區的 State
  const [mvuText, setMvuText] = useState('');
  const [chatText, setChatText] = useState('');
  
  // 錯誤提示
  const [mvuError, setMvuError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  
  // 提示成功套用
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // tavern 變數讀取
  const [tavernMvu, setTavernMvu] = useState<any>(null);
  const [tavernChat, setTavernChat] = useState<any>(null);

  // ==========================================
  // 初始化及監聽邏輯
  // ==========================================
  useEffect(() => {
    if (isOpen) {
      setMvuText(JSON.stringify(mockMvuVariables, null, 2));
      setChatText(JSON.stringify(mockChatVariables, null, 2));
      setTavernMvu(getTavernRealMvu());
      setTavernChat(getTavernRealChatVars());
    }
  }, [isOpen]);

  // ==========================================
  // 變數套用與重設邏輯
  // ==========================================
  const handleApplyMvu = () => {
    try {
      const parsed = JSON.parse(mvuText);
      sessionStorage.setItem('__debug_mock_mvu', JSON.stringify(parsed));
      setMvuError(null);
      showSuccess('Mvu 模擬變數已套用，即將重新整理...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setMvuError(`JSON 格式錯誤: ${err?.message || err}`);
    }
  };

  const handleApplyChat = () => {
    try {
      const parsed = JSON.parse(chatText);
      sessionStorage.setItem('__debug_mock_chat', JSON.stringify(parsed));
      setChatError(null);
      showSuccess('Chat 模擬變數已套用，即將重新整理...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setChatError(`JSON 格式錯誤: ${err?.message || err}`);
    }
  };

  const handleResetAll = () => {
    if (window.confirm('確定要重置所有調試模擬變數，回復為系統預設值嗎？')) {
      sessionStorage.removeItem('__debug_mock_mvu');
      sessionStorage.removeItem('__debug_mock_chat');
      showSuccess('已清除暫存，即將重置重新整理...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // ==========================================
  // 快捷調試動作邏輯
  // ==========================================
  const handleQuickAction = (actionType: string) => {
    const currentMvu = JSON.parse(JSON.stringify(mockMvuVariables));
    
    if (actionType === 'suspicion_100') {
      currentMvu.user.suspicion = 100;
    } else if (actionType === 'points_1000') {
      currentMvu.user.mcPoints = (currentMvu.user.mcPoints || 0) + 1000;
    } else if (actionType === 'energy_1000') {
      currentMvu.user.mcEnergyMax = 1000;
      currentMvu.user.mcEnergy = 1000;
    } else if (actionType === 'money_99999') {
      currentMvu.user.money = 99999;
    } else if (actionType === 'max_npcs') {
      if (currentMvu.chars) {
        Object.keys(currentMvu.chars).forEach((key) => {
          const char = currentMvu.chars[key];
          char.obedience = 100;
          char.affection = 100;
          char.alertness = 0;
          char.lust = 100;
          char.arousal = 100;
          if (char.sensitivity) {
            char.sensitivity.clitSensitivity = 500;
            char.sensitivity.vaginaSensitivity = 500;
            char.sensitivity.anusSensitivity = 500;
            char.sensitivity.nippleSensitivity = 500;
          }
        });
      }
    }

    sessionStorage.setItem('__debug_mock_mvu', JSON.stringify(currentMvu));
    showSuccess('快捷修改已保存，即將重新整理頁面以套用...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  // ==========================================
  // UI 渲染與元件結構
  // ==========================================
  return (
    <>
      {/* 懸浮調試按鈕 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-[9999] flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-900/80 hover:bg-purple-800 text-purple-100 rounded-full shadow-lg border border-purple-500/30 backdrop-blur-md transition-all active:scale-95 group"
        title="開啟 Debug 控制台"
      >
        <Terminal size={16} className="group-hover:rotate-12 transition-transform duration-300" />
        <span className="text-xs font-semibold tracking-wider">DEBUG</span>
      </button>

      {/* 控制面板 */}
      {isOpen && (
        <div className="fixed inset-4 sm:inset-auto sm:right-4 sm:bottom-16 sm:w-[500px] sm:h-[650px] z-[9998] bg-[#0c091d]/95 border border-purple-500/30 rounded-2xl shadow-2xl backdrop-blur-lg flex flex-col overflow-hidden text-gray-200 font-sans">
          
          {/* 面板標題列 */}
          <div className="shrink-0 p-4 border-b border-purple-500/20 bg-purple-950/40 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Database className="text-purple-400" size={18} />
              <span className="font-bold tracking-wide bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                HypnoOS 調試控制台
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* 分頁選擇列 */}
          <div className="shrink-0 flex border-b border-purple-500/10 bg-black/30 p-1">
            <button
              onClick={() => setActiveTab('tavern')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'tavern'
                  ? 'bg-purple-950/50 text-purple-200 border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              真實 Tavern
            </button>
            <button
              onClick={() => setActiveTab('mockMvu')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'mockMvu'
                  ? 'bg-purple-950/50 text-purple-200 border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              模擬 Mvu
            </button>
            <button
              onClick={() => setActiveTab('mockChat')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'mockChat'
                  ? 'bg-purple-950/50 text-purple-200 border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              模擬 Chat
            </button>
            <button
              onClick={() => setActiveTab('actions')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'actions'
                  ? 'bg-purple-950/50 text-purple-200 border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              快捷動作
            </button>
          </div>

          {/* 訊息狀態列 */}
          {successMsg && (
            <div className="shrink-0 px-4 py-2 bg-emerald-950/80 border-b border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Check size={14} className="animate-bounce" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 分頁內容 */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#0a0717]/50 font-mono text-xs">
            
            {/* Tab: 真實 Tavern */}
            {activeTab === 'tavern' && (
              <div className="space-y-4 h-full flex flex-col">
                <div className="p-3 bg-purple-950/20 border border-purple-500/10 rounded-xl flex items-center gap-3">
                  <Cpu className="text-purple-400" size={20} />
                  <div>
                    <h4 className="font-bold text-gray-200 text-sm">Tavern 執行環境檢測</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {(tavernMvu || tavernChat) ? '🟢 已成功對接酒館宿主變數介面' : '⚪ 未偵測到 Tavern 環境（目前運行於純模擬模式）'}
                    </p>
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-3 min-h-0">
                  <div className="flex-1 flex flex-col min-h-0">
                    <span className="text-[10px] text-purple-400 font-bold mb-1 uppercase tracking-wider">Real Mvu State:</span>
                    <pre className="flex-1 bg-black/40 border border-purple-500/10 p-3 rounded-lg overflow-auto text-[10px] text-gray-300">
                      {tavernMvu ? JSON.stringify(tavernMvu, null, 2) : 'No Mvu Defined (globalThis.Mvu is undefined)'}
                    </pre>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0">
                    <span className="text-[10px] text-purple-400 font-bold mb-1 uppercase tracking-wider">Real Chat Variables:</span>
                    <pre className="flex-1 bg-black/40 border border-purple-500/10 p-3 rounded-lg overflow-auto text-[10px] text-gray-300">
                      {tavernChat ? JSON.stringify(tavernChat, null, 2) : 'No Chat Variables Defined'}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: 模擬 Mvu */}
            {activeTab === 'mockMvu' && (
              <div className="h-full flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                    編輯 mockMvuVariables (JSON)
                  </span>
                  <button
                    onClick={handleApplyMvu}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-semibold transition-colors active:scale-95"
                  >
                    套用並重新載入
                  </button>
                </div>

                <textarea
                  value={mvuText}
                  onChange={(e) => setMvuText(e.target.value)}
                  className="flex-1 w-full bg-black/60 border border-purple-500/20 rounded-xl p-3 focus:outline-none focus:border-purple-500/50 resize-none font-mono text-[10px] text-purple-100"
                  spellCheck={false}
                />

                {mvuError && (
                  <div className="p-2.5 bg-red-950/80 border border-red-500/30 rounded-lg text-red-300 text-[10px] flex items-center gap-1.5">
                    <ShieldAlert size={14} className="shrink-0" />
                    <span className="break-all">{mvuError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Tab: 模擬 Chat */}
            {activeTab === 'mockChat' && (
              <div className="h-full flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                    編輯 mockChatVariables (JSON)
                  </span>
                  <button
                    onClick={handleApplyChat}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-semibold transition-colors active:scale-95"
                  >
                    套用並重新載入
                  </button>
                </div>

                <textarea
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  className="flex-1 w-full bg-black/60 border border-purple-500/20 rounded-xl p-3 focus:outline-none focus:border-purple-500/50 resize-none font-mono text-[10px] text-purple-100"
                  spellCheck={false}
                />

                {chatError && (
                  <div className="p-2.5 bg-red-950/80 border border-red-500/30 rounded-lg text-red-300 text-[10px] flex items-center gap-1.5">
                    <ShieldAlert size={14} className="shrink-0" />
                    <span className="break-all">{chatError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Tab: 快捷與重置 */}
            {activeTab === 'actions' && (
              <div className="space-y-4">
                <div className="p-3 bg-purple-950/10 border border-purple-500/10 rounded-xl">
                  <h4 className="font-bold text-purple-300 mb-2.5 text-xs flex items-center gap-1.5">
                    <Zap size={14} /> 快捷修改 (將寫入並重載)
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleQuickAction('suspicion_100')}
                      className="p-2.5 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/20 rounded-lg text-left transition-all active:scale-95 flex flex-col gap-0.5"
                    >
                      <span className="font-bold text-gray-200 text-[10px]">🚨 可疑度 100%</span>
                      <span className="text-[9px] text-gray-400">將主角可疑度設為最大</span>
                    </button>

                    <button
                      onClick={() => handleQuickAction('points_1000')}
                      className="p-2.5 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/20 rounded-lg text-left transition-all active:scale-95 flex flex-col gap-0.5"
                    >
                      <span className="font-bold text-gray-200 text-[10px]">🪙 MC點數 +1000</span>
                      <span className="text-[9px] text-gray-400">增加當前MC點數</span>
                    </button>

                    <button
                      onClick={() => handleQuickAction('energy_1000')}
                      className="p-2.5 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/20 rounded-lg text-left transition-all active:scale-95 flex flex-col gap-0.5"
                    >
                      <span className="font-bold text-gray-200 text-[10px]">⚡ MC能量 1000/1000</span>
                      <span className="text-[9px] text-gray-400">上限與能量皆設為1000</span>
                    </button>

                    <button
                      onClick={() => handleQuickAction('money_99999')}
                      className="p-2.5 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/20 rounded-lg text-left transition-all active:scale-95 flex flex-col gap-0.5"
                    >
                      <span className="font-bold text-gray-200 text-[10px]">💵 零花錢 $99,999</span>
                      <span className="text-[9px] text-gray-400">將零花錢設為最大</span>
                    </button>

                    <button
                      onClick={() => handleQuickAction('max_npcs')}
                      className="col-span-2 p-2.5 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/20 rounded-lg text-left transition-all active:scale-95 flex flex-col gap-0.5"
                    >
                      <span className="font-bold text-gray-200 text-[10px]">❤️ NPC 屬性與敏感度全滿</span>
                      <span className="text-[9px] text-gray-400">全角色服從、好感、敏感度、性奮全設為 100/500</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-red-950/10 border border-red-500/10 rounded-xl">
                  <h4 className="font-bold text-red-400 mb-2 text-xs flex items-center gap-1.5">
                    <ShieldAlert size={14} /> 危險操作
                  </h4>
                  <p className="text-[10px] text-gray-400 mb-3 leading-relaxed">
                    這將會清除您在調試控制台中所做的所有自訂修改，並恢復到預設的測試輸入。
                  </p>
                  <button
                    onClick={handleResetAll}
                    className="w-full py-2.5 bg-red-950/60 hover:bg-red-900/40 border border-red-500/30 hover:border-red-500/50 text-red-300 hover:text-white rounded-lg text-[10px] font-bold tracking-wide transition-all active:scale-95"
                  >
                    🔄 清除暫存並重置所有模擬資料
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* 底部狀態列 */}
          <div className="shrink-0 p-3 bg-black/40 border-t border-purple-500/10 text-gray-500 text-[9px] flex justify-between items-center">
            <span>Powered by Antigravity Debugger</span>
            <span>V1.0.0</span>
          </div>

        </div>
      )}
    </>
  );
};
