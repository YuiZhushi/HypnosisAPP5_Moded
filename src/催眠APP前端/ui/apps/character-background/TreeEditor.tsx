import React, { useCallback, useEffect, useMemo, useRef, useState, useReducer } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Maximize2,
  Plus,
  CopyPlus,
  Trash2,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  X,
  Copy,
} from 'lucide-react';
import { LongTextEditorModal } from './LongTextEditorModal';

export type NodeType = 'string' | 'list' | 'object';

export interface EditorNode {
  id: string;
  key: string;
  type: NodeType;
  value: string;
  children: EditorNode[];
}

// ========= AST Conversion =========

let _nodeIdCounter = 0;
function nextNodeId(): string {
  return `node_${Date.now()}_${++_nodeIdCounter}`;
}

export function jsToTree(obj: any): EditorNode[] {
  if (obj === null || obj === undefined) return [];

  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return [{ id: nextNodeId(), key: '', type: 'string', value: String(obj), children: [] }];
  }

  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (Array.isArray(item)) {
        return { id: nextNodeId(), key: '', type: 'list', value: '', children: jsToTree(item) };
      }
      if (typeof item === 'object' && item !== null) {
        return { id: nextNodeId(), key: '', type: 'object', value: '', children: jsToTree(item) };
      }
      return { id: nextNodeId(), key: '', type: 'string', value: String(item ?? ''), children: [] };
    });
  }

  if (typeof obj === 'object') {
    return Object.entries(obj).map(([key, val]) => {
      if (Array.isArray(val)) {
        return { id: nextNodeId(), key, type: 'list', value: '', children: jsToTree(val) };
      }
      if (typeof val === 'object' && val !== null) {
        return { id: nextNodeId(), key, type: 'object', value: '', children: jsToTree(val) };
      }
      return { id: nextNodeId(), key, type: 'string', value: String(val ?? ''), children: [] };
    });
  }

  return [];
}

function nodeToJsValue(node: EditorNode): any {
  if (node.type === 'string') return node.value;
  if (node.type === 'list') return node.children.map(nodeToJsValue);

  const result: Record<string, any> = {};
  let unnamedCounter = 0;
  for (const child of node.children) {
    const key = child.key?.trim() || `unnamed_${++unnamedCounter}`;
    result[key] = nodeToJsValue(child);
  }
  return result;
}

export function treeToJs(nodes: EditorNode[], isRootArray = false): any {
  if (isRootArray) return nodes.map(nodeToJsValue);

  const result: Record<string, any> = {};
  let unnamedCounter = 0;
  for (const node of nodes) {
    const key = node.key?.trim() || `unnamed_${++unnamedCounter}`;
    result[key] = nodeToJsValue(node);
  }
  return result;
}

// ========= Tree Reducer =========

export type TreeAction =
  | { type: 'SET_ALL'; nodes: EditorNode[] }
  | { type: 'ADD_SIBLING'; afterId: string; parentType: NodeType | 'root' }
  | { type: 'ADD_CHILD'; nodeId: string }
  | { type: 'DELETE_NODE'; nodeId: string }
  | { type: 'UPDATE_KEY'; nodeId: string; newKey: string }
  | { type: 'UPDATE_VALUE'; nodeId: string; newValue: string }
  | { type: 'CHANGE_TYPE'; nodeId: string; newType: NodeType }
  | { type: 'MOVE_UP'; nodeId: string }
  | { type: 'MOVE_DOWN'; nodeId: string }
  | { type: 'DUPLICATE_NODE'; nodeId: string };

function makeEmptyNode(key = '', type: NodeType = 'string'): EditorNode {
  return { id: nextNodeId(), key, type, value: '', children: [] };
}

function makeNodeForContainer(containerType: NodeType | 'root'): EditorNode {
  if (containerType === 'list') {
    return makeEmptyNode('', 'string');
  }
  return makeEmptyNode('new_key', 'string');
}

function convertNodeType(node: EditorNode, newType: NodeType): EditorNode {
  if (node.type === newType) return node;

  const clone = { ...node, type: newType };

  if (node.type === 'string' && newType === 'list') {
    clone.children = node.value.trim() ? [{ ...makeEmptyNode('', 'string'), value: node.value }] : [];
    clone.value = '';
  } else if (node.type === 'string' && newType === 'object') {
    clone.children = node.value.trim() ? [{ ...makeEmptyNode('value', 'string'), value: node.value }] : [];
    clone.value = '';
  } else if ((node.type === 'list' || node.type === 'object') && newType === 'string') {
    clone.children = [];
    clone.value = node.children.length > 0 && node.children[0].type === 'string' ? node.children[0].value : '';
  } else if (node.type === 'list' && newType === 'object') {
    clone.children = node.children.map((c, i) => ({ ...c, key: c.key?.trim() ? c.key : `item_${i + 1}` }));
  } else if (node.type === 'object' && newType === 'list') {
    clone.children = node.children.map(c => ({ ...c, key: '' }));
  }

  return clone;
}

function applyToTree(nodes: EditorNode[], nodeId: string, fn: (n: EditorNode) => EditorNode | null): EditorNode[] {
  const result: EditorNode[] = [];
  for (const node of nodes) {
    if (node.id === nodeId) {
      const updated = fn(node);
      if (updated) result.push(updated);
    } else {
      result.push({ ...node, children: applyToTree(node.children, nodeId, fn) });
    }
  }
  return result;
}

function addSiblingAfter(
  nodes: EditorNode[],
  afterId: string,
  containerType: NodeType | 'root',
): { nodes: EditorNode[]; changed: boolean } {
  let changed = false;
  const result: EditorNode[] = [];

  for (const node of nodes) {
    result.push(node);

    if (node.id === afterId) {
      result.push(makeNodeForContainer(containerType));
      changed = true;
      continue;
    }

    if (node.children.length > 0) {
      const sub = addSiblingAfter(node.children, afterId, node.type);
      if (sub.changed) {
        result[result.length - 1] = { ...result[result.length - 1], children: sub.nodes };
        changed = true;
      }
    }
  }

  return { nodes: result, changed };
}

function moveNode(
  nodes: EditorNode[],
  nodeId: string,
  direction: 'up' | 'down',
): { nodes: EditorNode[]; changed: boolean } {
  let changed = false;
  const result: EditorNode[] = [];

  const index = nodes.findIndex(n => n.id === nodeId);
  if (index !== -1) {
    if (direction === 'up' && index > 0) {
      const newNodes = [...nodes];
      [newNodes[index - 1], newNodes[index]] = [newNodes[index], newNodes[index - 1]];
      return { nodes: newNodes, changed: true };
    } else if (direction === 'down' && index < nodes.length - 1) {
      const newNodes = [...nodes];
      [newNodes[index], newNodes[index + 1]] = [newNodes[index + 1], newNodes[index]];
      return { nodes: newNodes, changed: true };
    }
    return { nodes: [...nodes], changed: false };
  }

  for (const node of nodes) {
    if (node.children.length > 0) {
      const sub = moveNode(node.children, nodeId, direction);
      if (sub.changed) {
        result.push({ ...node, children: sub.nodes });
        changed = true;
        continue;
      }
    }
    result.push(node);
  }

  return { nodes: result, changed };
}

function cloneNodeWithNewIds(node: EditorNode, siblingKeys: Set<string>): EditorNode {
  let newKey = node.key;
  if (newKey && siblingKeys.has(newKey)) {
    const match = newKey.match(/(.+)_(\d+)$/);
    let base = newKey;
    let suffix = 1;
    if (match) {
      base = match[1];
      suffix = parseInt(match[2], 10) + 1;
    } else {
      base = newKey;
      suffix = 1;
    }
    while (siblingKeys.has(`${base}_${suffix}`)) {
      suffix++;
    }
    newKey = `${base}_${suffix}`;
  }

  const cloneChildren = (children: EditorNode[]): EditorNode[] => {
    return children.map(c => ({
      ...c,
      id: nextNodeId(),
      children: cloneChildren(c.children),
    }));
  };

  return {
    id: nextNodeId(),
    key: newKey,
    type: node.type,
    value: node.value,
    children: cloneChildren(node.children),
  };
}

function duplicateNodeInList(nodes: EditorNode[], nodeId: string): { nodes: EditorNode[]; changed: boolean } {
  const index = nodes.findIndex(n => n.id === nodeId);
  if (index !== -1) {
    const targetNode = nodes[index];
    const siblingKeys = new Set(nodes.map(n => n.key).filter(k => k !== undefined && k !== null));
    const clone = cloneNodeWithNewIds(targetNode, siblingKeys);
    const newNodes = [...nodes];
    newNodes.splice(index + 1, 0, clone);
    return { nodes: newNodes, changed: true };
  }

  const result: EditorNode[] = [];
  let changed = false;
  for (const node of nodes) {
    if (!changed && node.children.length > 0) {
      const sub = duplicateNodeInList(node.children, nodeId);
      if (sub.changed) {
        result.push({ ...node, children: sub.nodes });
        changed = true;
        continue;
      }
    }
    result.push(node);
  }
  return { nodes: result, changed };
}

function treeReducer(state: EditorNode[], action: TreeAction): EditorNode[] {
  switch (action.type) {
    case 'SET_ALL':
      return action.nodes;
    case 'ADD_SIBLING':
      if (action.afterId === '') {
        return [...state, makeNodeForContainer(action.parentType)];
      }
      return addSiblingAfter(state, action.afterId, action.parentType).nodes;
    case 'ADD_CHILD':
      return applyToTree(state, action.nodeId, n => {
        if (n.type === 'string') return n;
        return { ...n, children: [...n.children, makeNodeForContainer(n.type)] };
      });
    case 'DELETE_NODE':
      return applyToTree(state, action.nodeId, () => null);
    case 'UPDATE_KEY':
      return applyToTree(state, action.nodeId, n => ({ ...n, key: action.newKey }));
    case 'UPDATE_VALUE':
      return applyToTree(state, action.nodeId, n => ({ ...n, value: action.newValue }));
    case 'CHANGE_TYPE':
      return applyToTree(state, action.nodeId, n => convertNodeType(n, action.newType));
    case 'MOVE_UP':
      return moveNode(state, action.nodeId, 'up').nodes;
    case 'MOVE_DOWN':
      return moveNode(state, action.nodeId, 'down').nodes;
    case 'DUPLICATE_NODE':
      return duplicateNodeInList(state, action.nodeId).nodes;
    default:
      return state;
  }
}

// ========= UI Components =========

const STRING_TEXTAREA_MIN_HEIGHT = 28;
const STRING_TEXTAREA_MAX_HEIGHT = 200;

function autoResizeTextarea(el: HTMLTextAreaElement): void {
  el.style.height = 'auto';
  const nextHeight = Math.min(Math.max(el.scrollHeight, STRING_TEXTAREA_MIN_HEIGHT), STRING_TEXTAREA_MAX_HEIGHT);
  el.style.height = `${nextHeight}px`;
  el.style.overflowY = el.scrollHeight > STRING_TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
}

function getCharWidth(str: string): number {
  let w = 0;
  for (let i = 0; i < str.length; i++) {
    w += str.charCodeAt(i) > 255 ? 2 : 1;
  }
  return w;
}

const TypeBadge: React.FC<{ type: NodeType }> = ({ type }) => {
  const label = type === 'string' ? 'T 文本' : type === 'list' ? '≡ 列表' : '{} 物件';
  const color =
    type === 'string'
      ? 'text-purple-400 bg-purple-900/30 border-purple-700/50'
      : type === 'list'
        ? 'text-purple-400 bg-purple-900/30 border-purple-700/50'
        : 'text-purple-400 bg-purple-900/30 border-purple-700/50';
  return <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 font-mono ${color}`}>{label}</span>;
};

const TreeNode: React.FC<{
  node: EditorNode;
  dispatch: React.Dispatch<TreeAction>;
  depth: number;
  parentType: NodeType | 'root';
  searchQuery: string;
  forceExpandAll: boolean;
}> = ({ node, dispatch, depth, parentType, searchQuery, forceExpandAll }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [longEditorOpen, setLongEditorOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const valueTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const hasChildren = node.type !== 'string';
  const isListItem = parentType === 'list';

  // Check if node matches search query
  const matchesSearch = useMemo(() => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (node.key.toLowerCase().includes(q)) return true;
    if (node.type === 'string' && node.value.toLowerCase().includes(q)) return true;

    // Check if any children match
    const checkChildren = (children: EditorNode[]): boolean => {
      for (const child of children) {
        if (child.key.toLowerCase().includes(q)) return true;
        if (child.type === 'string' && child.value.toLowerCase().includes(q)) return true;
        if (checkChildren(child.children)) return true;
      }
      return false;
    };
    return checkChildren(node.children);
  }, [node, searchQuery]);

  useEffect(() => {
    if (forceExpandAll) setCollapsed(false);
  }, [forceExpandAll]);

  useEffect(() => {
    if (node.type !== 'string') return;
    if (valueTextareaRef.current) autoResizeTextarea(valueTextareaRef.current);
  }, [node.type, node.value]);

  if (!matchesSearch) return null;

  return (
    <div className="relative font-mono text-sm">
      <div className="group flex flex-col relative py-1.5 hover:bg-white/5 -mx-2 px-2 rounded transition-colors">
        {/* Row 1: Key, Type, Actions */}
        <div className="flex items-center gap-2 w-full relative">
          {/* Collapse toggle */}
          {hasChildren ? (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="mt-1 text-gray-500 hover:text-gray-300 shrink-0"
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}

          {/* Key input (Green) */}
          {isListItem ? (
            <span className="text-gray-500 shrink-0">-</span>
          ) : (
            <div className="flex items-center shrink-0">
              <input
                type="text"
                value={node.key}
                onChange={e => dispatch({ type: 'UPDATE_KEY', nodeId: node.id, newKey: e.target.value })}
                style={{ width: `calc(${Math.max(getCharWidth(node.key), 3)}ch + 8px)`, maxWidth: '40cqw' }}
                className="bg-transparent text-green-300 outline-none border-b border-transparent focus:border-green-500/50 hover:bg-white/5 px-1 py-0.5 rounded transition-colors"
                placeholder="key"
              />
              <span className="text-gray-500 ml-1">:</span>
            </div>
          )}

          {/* Type Badge with Dropdown (Purple) */}
          <div className="relative shrink-0" onMouseLeave={() => setTypeDropdownOpen(false)}>
            <button onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}>
              <TypeBadge type={node.type} />
            </button>
            {typeDropdownOpen && (
              <div className="absolute left-0 top-full pt-1 z-50 w-24">
                <div className="bg-[#1a153a] border border-purple-500/30 shadow-xl rounded py-1 flex flex-col">
                  {['string', 'list', 'object']
                    .filter(t => t !== node.type)
                    .map(t => (
                      <button
                        key={t}
                        onClick={() => {
                          if (t === 'string' && hasChildren) {
                            setConfirmConfig({
                              message: '轉換為 String 可能會遺失子節點資料，確定繼續嗎？',
                              onConfirm: () => {
                                dispatch({ type: 'CHANGE_TYPE', nodeId: node.id, newType: t as NodeType });
                                setConfirmConfig(null);
                              },
                            });
                          } else {
                            dispatch({ type: 'CHANGE_TYPE', nodeId: node.id, newType: t as NodeType });
                          }
                          setTypeDropdownOpen(false);
                        }}
                        className="text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-purple-600/50 hover:text-white transition"
                      >
                        {t === 'string' ? '文本' : t === 'list' ? '列表' : '物件'}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Mobile menu trigger */}
          <button
            onClick={e => {
              e.stopPropagation();
              setShowActions(!showActions);
            }}
            className="p-1 text-gray-400 hover:text-gray-200 md:hidden shrink-0 bg-white/5 hover:bg-white/10 rounded transition-colors"
            title="操作選單"
          >
            <MoreVertical size={12} />
          </button>

          {/* Hover Actions (Yellow) */}
          <div
            className={`absolute right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1 bg-[#1a153a] p-1 rounded-lg border border-yellow-500/30 shadow-lg transition-all duration-200 ${
              showActions
                ? 'opacity-100 pointer-events-auto scale-100'
                : 'opacity-0 pointer-events-none scale-95 md:group-hover:opacity-100 md:group-hover:pointer-events-auto md:group-hover:scale-100'
            }`}
          >
            <button
              onClick={() => {
                dispatch({ type: 'MOVE_UP', nodeId: node.id });
                setShowActions(false);
              }}
              className="p-1 text-yellow-300 hover:bg-yellow-900/50 rounded transition-colors"
              title="上移"
            >
              <ArrowUp size={14} />
            </button>
            <button
              onClick={() => {
                dispatch({ type: 'MOVE_DOWN', nodeId: node.id });
                setShowActions(false);
              }}
              className="p-1 text-yellow-300 hover:bg-yellow-900/50 rounded transition-colors"
              title="下移"
            >
              <ArrowDown size={14} />
            </button>
            {node.type === 'string' && (
              <button
                onClick={() => {
                  setLongEditorOpen(true);
                  setShowActions(false);
                }}
                className="p-1 text-yellow-300 hover:bg-yellow-900/50 rounded transition-colors"
                title="展開大視窗編輯"
              >
                <Maximize2 size={14} />
              </button>
            )}
            <button
              onClick={() => {
                dispatch({ type: 'DUPLICATE_NODE', nodeId: node.id });
                setShowActions(false);
              }}
              className="p-1 text-yellow-300 hover:bg-yellow-900/50 rounded transition-colors"
              title="複製此節點"
            >
              <Copy size={14} />
            </button>
            {hasChildren && (
              <button
                onClick={() => {
                  dispatch({ type: 'ADD_CHILD', nodeId: node.id });
                  setCollapsed(false);
                  setShowActions(false);
                }}
                className="p-1 text-yellow-300 hover:bg-yellow-900/50 rounded transition-colors"
                title="新增子節點"
              >
                <Plus size={14} />
              </button>
            )}
            <button
              onClick={() => {
                dispatch({ type: 'ADD_SIBLING', afterId: node.id, parentType });
                setShowActions(false);
              }}
              className="p-1 text-yellow-300 hover:bg-yellow-900/50 rounded transition-colors"
              title="新增同級節點"
            >
              <CopyPlus size={14} />
            </button>
            <button
              onClick={() => {
                dispatch({ type: 'DELETE_NODE', nodeId: node.id });
                setShowActions(false);
              }}
              className="p-1 text-red-400 hover:bg-red-900/50 rounded transition-colors"
              title="刪除"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={() => setShowActions(false)}
              className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="取消"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Row 2: Value Input (String only) (Red) */}
        {node.type === 'string' && (
          <div className="w-full pl-6 mt-1 flex">
            <textarea
              ref={valueTextareaRef}
              value={node.value}
              onChange={e => {
                autoResizeTextarea(e.currentTarget);
                dispatch({ type: 'UPDATE_VALUE', nodeId: node.id, newValue: e.target.value });
              }}
              onDoubleClick={() => setLongEditorOpen(true)}
              style={{
                width: `calc(${Math.max(...node.value.split('\n').map(l => getCharWidth(l)), 5)}ch + 16px)`,
                maxWidth: '60cqw',
              }}
              className="bg-transparent text-red-300 min-h-[28px] outline-none border border-transparent hover:border-white/10 focus:border-red-500/50 focus:bg-black/20 rounded px-2 py-1 resize-none transition-colors [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-red-500/30 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-red-500/50"
              rows={1}
              placeholder="value"
            />
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && !collapsed && (
        <div className="pl-6 border-l border-white/10 ml-3.5 mt-1 space-y-1 relative">
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              dispatch={dispatch}
              depth={depth + 1}
              parentType={node.type}
              searchQuery={searchQuery}
              forceExpandAll={forceExpandAll}
            />
          ))}
          {node.children.length === 0 && (
            <div className="py-2">
              <button
                onClick={() => dispatch({ type: 'ADD_CHILD', nodeId: node.id })}
                className="text-xs text-gray-500 hover:text-green-400 border border-dashed border-gray-700 hover:border-green-500/50 rounded px-3 py-1.5 transition-colors"
              >
                + 新增內容
              </button>
            </div>
          )}
        </div>
      )}

      {/* Long Text Modal */}
      {node.type === 'string' && (
        <LongTextEditorModal
          open={longEditorOpen}
          title="編輯內容"
          keyName={isListItem ? '(列表項目)' : node.key}
          value={node.value}
          onCancel={() => setLongEditorOpen(false)}
          onSave={nextValue => {
            dispatch({ type: 'UPDATE_VALUE', nodeId: node.id, newValue: nextValue });
            setLongEditorOpen(false);
          }}
        />
      )}

      {/* 自定義確認對話框 */}
      {confirmConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmConfig(null)} />
          <div className="relative w-full max-w-sm bg-[#120e24]/95 border border-purple-500/30 rounded-2xl p-6 shadow-[0_0_25px_rgba(168,85,247,0.15)] animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-4 text-left">
            <div className="flex justify-between items-center pb-2 border-b border-purple-500/10">
              <h3 className="text-base font-semibold text-purple-200">確認操作</h3>
              <button
                onClick={() => setConfirmConfig(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-300">{confirmConfig.message}</p>
            <div className="flex justify-end gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setConfirmConfig(null)}
                className="px-4 py-2 bg-transparent text-gray-400 hover:text-gray-200 text-xs font-medium rounded-xl border border-transparent hover:bg-white/5 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmConfig.onConfirm}
                className="px-4 py-2 bg-purple-600/30 hover:bg-purple-500/50 text-purple-300 hover:text-white text-xs font-semibold rounded-xl border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)] transition-all"
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ========= Main TreeEditor Component =========

interface TreeEditorProps {
  initialData: any;
  onChange?: (data: any) => void;
  isRootArray?: boolean;
}

export const TreeEditor: React.FC<TreeEditorProps> = ({ initialData, onChange, isRootArray = false }) => {
  const [nodes, dispatch] = useReducer(treeReducer, initialData, jsToTree);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterActive, setIsFilterActive] = useState(false);

  // Report changes
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const isInitial = useRef(true);
  useEffect(() => {
    if (isInitial.current) {
      isInitial.current = false;
      return;
    }
    if (onChangeRef.current) {
      const jsData = treeToJs(nodes, isRootArray);
      onChangeRef.current(jsData);
    }
  }, [nodes, isRootArray]);

  return (
    <div className="flex flex-col h-full bg-[#120e24]/40 border border-purple-500/20 rounded-xl overflow-hidden">
      {/* Toolbar / Search */}
      <div className="shrink-0 p-3 border-b border-purple-500/20 bg-black/20 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <button
            onClick={() => {
              setIsFilterActive(!isFilterActive);
              if (isFilterActive) setSearchQuery('');
            }}
            className={`p-1.5 rounded transition-colors ${isFilterActive ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
            title="切換過濾器"
          >
            <Search size={16} />
          </button>
          {isFilterActive && (
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜尋鍵或值..."
              className="flex-1 bg-black/40 border border-purple-500/30 rounded px-3 py-1 text-sm text-gray-200 focus:outline-none focus:border-purple-400"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch({ type: 'ADD_SIBLING', afterId: '', parentType: 'root' })}
            className="text-xs px-3 py-1.5 bg-purple-600/30 text-purple-200 border border-purple-500/30 rounded hover:bg-purple-500/50 hover:text-white transition-colors"
          >
            + 新增根節點
          </button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-purple-500/30 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-500/50">
        {nodes.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">
            無資料，請點擊上方按鈕新增。
          </div>
        ) : (
          <div className="space-y-1">
            {nodes.map(node => (
              <TreeNode
                key={node.id}
                node={node}
                dispatch={dispatch}
                depth={0}
                parentType={isRootArray ? 'list' : 'root'}
                searchQuery={isFilterActive ? searchQuery : ''}
                forceExpandAll={isFilterActive && searchQuery.length > 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
