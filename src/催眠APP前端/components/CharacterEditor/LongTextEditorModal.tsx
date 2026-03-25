import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Save, X } from 'lucide-react';

interface LongTextEditorModalProps {
  open: boolean;
  title: string;
  keyName?: string;
  value: string;
  onCancel: () => void;
  onSave: (nextValue: string) => void;
}

export const LongTextEditorModal: React.FC<LongTextEditorModalProps> = ({
  open,
  title,
  keyName,
  value,
  onCancel,
  onSave,
}) => {
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
  }, [open, value]);

  useEffect(() => {
    if (!open || !textareaRef.current) return;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
  }, [open]);

  const stats = useMemo(() => {
    const charCount = draft.length;
    const lineCount = draft.length === 0 ? 1 : draft.split('\n').length;
    return { charCount, lineCount };
  }, [draft]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-4xl h-[85%] bg-[#121216] border border-neutral-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Maximize2 size={14} className="text-cyan-400 shrink-0" />
            <h3 className="text-sm text-neutral-100 font-semibold truncate">{title}</h3>
            {keyName && (
              <span className="text-[10px] text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded font-mono truncate">
                {keyName}
              </span>
            )}
          </div>
          <button onClick={onCancel} className="text-neutral-400 hover:text-white transition" title="關閉 (Esc)">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-neutral-800 text-[11px] text-neutral-400 flex items-center gap-4">
          <span>字元：{stats.charCount}</span>
          <span>行數：{stats.lineCount}</span>
          <span className="text-neutral-500">Ctrl/Cmd + Enter 儲存，Esc 取消</span>
        </div>

        <div className="flex-1 p-4 overflow-hidden">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                onSave(draft);
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
              }
            }}
            className="w-full h-full bg-neutral-900 border border-neutral-700 rounded-xl p-3 text-xs font-mono leading-5 text-neutral-200 outline-none focus:border-cyan-500 resize-none dark-scrollbar select-text"
            spellCheck={false}
          />
        </div>

        <div className="px-4 py-3 border-t border-neutral-800 bg-neutral-900/60 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded-lg text-neutral-300 bg-neutral-800 hover:bg-neutral-700 transition"
          >
            取消
          </button>
          <button
            onClick={() => onSave(draft)}
            className="px-3 py-1.5 text-xs rounded-lg text-white bg-cyan-600 hover:bg-cyan-500 transition flex items-center gap-1"
          >
            <Save size={13} /> 套用
          </button>
        </div>
      </div>
    </div>
  );
};
