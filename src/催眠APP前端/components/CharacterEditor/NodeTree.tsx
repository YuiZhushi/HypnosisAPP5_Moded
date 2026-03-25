import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EditorNode, NodeType } from '../../types';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { LongTextEditorModal } from './LongTextEditorModal';

const STRING_TEXTAREA_MIN_HEIGHT = 36;
const STRING_TEXTAREA_MAX_HEIGHT = 220;
const LONG_TEXT_SUGGEST_THRESHOLD = 2000;

function autoResizeTextarea(el: HTMLTextAreaElement): void {
  el.style.height = 'auto';
  const nextHeight = Math.min(Math.max(el.scrollHeight, STRING_TEXTAREA_MIN_HEIGHT), STRING_TEXTAREA_MAX_HEIGHT);
  el.style.height = `${nextHeight}px`;
  el.style.overflowY = el.scrollHeight > STRING_TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
}

// ========= Tree Reducer =========

export type TreeAction =
  | { type: 'ADD_SIBLING'; afterId: string }
  | { type: 'ADD_CHILD'; nodeId: string }
  | { type: 'DELETE_NODE'; nodeId: string }
  | { type: 'UPDATE_KEY'; nodeId: string; newKey: string }
  | { type: 'UPDATE_VALUE'; nodeId: string; newValue: string }
  | { type: 'CHANGE_TYPE'; nodeId: string; newType: NodeType }
  | { type: 'REPLACE_ALL'; nodes: EditorNode[] };

let _nodeIdCounter = 0;
function nextNodeId(): string {
  return `node_${Date.now()}_${++_nodeIdCounter}`;
}

function makeEmptyNode(key = '', type: NodeType = 'string'): EditorNode {
  return { id: nextNodeId(), key, type, value: '', children: [], isLocked: false };
}

type ContainerType = 'root' | 'object' | 'list';

function makeNodeForContainer(containerType: ContainerType): EditorNode {
  if (containerType === 'list') {
    return makeEmptyNode('', 'string');
  }
  return makeEmptyNode('new_key', 'string');
}

function cloneNodeWith(node: EditorNode, patch: Partial<EditorNode>): EditorNode {
  return {
    id: patch.id ?? node.id,
    key: patch.key ?? node.key,
    type: patch.type ?? node.type,
    value: patch.value ?? node.value,
    children: patch.children ?? node.children,
    isLocked: patch.isLocked ?? node.isLocked,
  };
}

function stringifyNodePreview(node: EditorNode): string {
  if (node.type === 'string') return node.value ?? '';
  if (node.children.length === 0) return '';
  return stringifyNodePreview(node.children[0]);
}

function convertNodeType(node: EditorNode, newType: NodeType): EditorNode {
  if (node.type === newType) return node;

  if (node.type === 'string' && newType === 'list') {
    const children = node.value.trim().length > 0
      ? [makeEmptyNode('', 'string')]
      : [];
    if (children[0]) {
      children[0] = cloneNodeWith(children[0], { value: node.value });
    }
    return cloneNodeWith(node, { type: 'list', value: '', children });
  }

  if (node.type === 'string' && newType === 'object') {
    const children = node.value.trim().length > 0
      ? [makeEmptyNode('value', 'string')]
      : [];
    if (children[0]) {
      children[0] = cloneNodeWith(children[0], { value: node.value });
    }
    return cloneNodeWith(node, { type: 'object', value: '', children });
  }

  if (node.type === 'list' && newType === 'string') {
    return cloneNodeWith(node, {
      type: 'string',
      value: stringifyNodePreview(node),
      children: [],
    });
  }

  if (node.type === 'object' && newType === 'string') {
    return cloneNodeWith(node, {
      type: 'string',
      value: stringifyNodePreview(node),
      children: [],
    });
  }

  if (node.type === 'list' && newType === 'object') {
    const children = node.children.map((c, i) => cloneNodeWith(c, { key: c.key?.trim() ? c.key : `item_${i + 1}` }));
    return cloneNodeWith(node, { type: 'object', value: '', children });
  }

  if (node.type === 'object' && newType === 'list') {
    const children = node.children.map(c => cloneNodeWith(c, { key: '' }));
    return cloneNodeWith(node, { type: 'list', value: '', children });
  }

  return cloneNodeWith(node, { type: newType });
}

function applyToTree(nodes: EditorNode[], nodeId: string, fn: (n: EditorNode) => EditorNode | null): EditorNode[] {
  const result: EditorNode[] = [];
  for (const node of nodes) {
    if (node.id === nodeId) {
      const updated = fn(node);
      if (updated) result.push(updated);
      // null means delete
    } else {
      result.push({ ...node, children: applyToTree(node.children, nodeId, fn) });
    }
  }
  return result;
}

function addSiblingAfter(
  nodes: EditorNode[],
  afterId: string,
  containerType: ContainerType = 'root',
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

export function treeReducer(state: EditorNode[], action: TreeAction): EditorNode[] {
  switch (action.type) {
    case 'REPLACE_ALL':
      return action.nodes;

    case 'ADD_SIBLING':
      return addSiblingAfter(state, action.afterId).nodes;

    case 'ADD_CHILD':
      return applyToTree(state, action.nodeId, n => {
        if (n.type === 'string') return n;
        const child = makeNodeForContainer(n.type);
        return {
          ...n,
          children: [...n.children, child],
        };
      });

    case 'DELETE_NODE':
      return applyToTree(state, action.nodeId, n => (n.isLocked ? n : null));

    case 'UPDATE_KEY':
      return applyToTree(state, action.nodeId, n =>
        n.isLocked ? n : { ...n, key: action.newKey },
      );

    case 'UPDATE_VALUE':
      return applyToTree(state, action.nodeId, n => ({ ...n, value: action.newValue }));

    case 'CHANGE_TYPE':
      return applyToTree(state, action.nodeId, n => convertNodeType(n, action.newType));

    default:
      return state;
  }
}

// ========= UI Components =========

const TYPE_OPTIONS: { value: NodeType; label: string }[] = [
  { value: 'string', label: '⇋ 轉換為 String' },
  { value: 'list', label: '⇋ 轉換為 List' },
  { value: 'object', label: '⇋ 轉換為 Object' },
];

const TypeBadge: React.FC<{ type: NodeType }> = ({ type }) => (
  <span className="text-[9px] bg-neutral-700 text-neutral-400 px-1 rounded shrink-0">
    {type === 'string' ? 'String' : type === 'list' ? 'List' : 'Object'}
  </span>
);

const NodeRow: React.FC<{
  node: EditorNode;
  dispatch: (action: TreeAction) => void;
  depth: number;
  parentType?: NodeType | 'root';
}> = ({ node, dispatch, depth, parentType = 'root' }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [longEditorOpen, setLongEditorOpen] = useState(false);
  const valueTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasChildren = node.type !== 'string';
  const isListItem = parentType === 'list';

  const resizeValueTextarea = useCallback(() => {
    if (!valueTextareaRef.current) return;
    autoResizeTextarea(valueTextareaRef.current);
  }, []);

  useEffect(() => {
    if (node.type !== 'string') return;
    resizeValueTextarea();
  }, [node.type, node.value, resizeValueTextarea]);

  return (
    <div className="relative">
      <div className="group flex items-start gap-2 relative py-1 rounded hover:bg-neutral-800/50 -mx-1 px-1 transition-colors">
        {/* Collapse toggle for non-string */}
        {hasChildren ? (
          <button onClick={() => setCollapsed(!collapsed)} className="mt-1 text-neutral-500 hover:text-white shrink-0">
            {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Key input */}
        {isListItem ? (
          <span className="text-neutral-500 text-xs mt-1 shrink-0">-</span>
        ) : (
          <>
            {node.isLocked && <span className="text-indigo-400 text-xs mt-1 shrink-0">🔒</span>}
            <input
              type="text"
              value={node.key}
              disabled={node.isLocked}
              onChange={e => dispatch({ type: 'UPDATE_KEY', nodeId: node.id, newKey: e.target.value })}
              className="bg-neutral-800 text-pink-300 text-[11px] px-2 py-1 rounded w-20 font-mono border border-neutral-700 focus:border-indigo-500 outline-none placeholder-neutral-600 shrink-0 disabled:opacity-60 select-text"
              placeholder="key"
            />
            <span className="text-neutral-500 text-xs mt-1 shrink-0">:</span>
          </>
        )}

        <TypeBadge type={node.type} />

        {/* Value (string only) */}
        {node.type === 'string' && (
          <textarea
            ref={valueTextareaRef}
            value={node.value}
            onDoubleClick={() => setLongEditorOpen(true)}
            onChange={e => {
              autoResizeTextarea(e.currentTarget);
              dispatch({ type: 'UPDATE_VALUE', nodeId: node.id, newValue: e.target.value });
            }}
            className="bg-neutral-900 border border-neutral-700 rounded text-[11px] px-2 py-1 text-neutral-300 flex-1 min-h-[36px] focus:border-indigo-500 outline-none resize-none select-text leading-4"
            rows={1}
            title={node.value.length >= LONG_TEXT_SUGGEST_THRESHOLD ? '內容較長，建議使用右側展開編輯（⤢）' : undefined}
          />
        )}

        {/* Hover toolbar */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 absolute right-1 top-1 bg-neutral-800 p-0.5 border border-neutral-700 shadow-xl rounded z-10 transition-opacity">
          {/* Type dropdown */}
          <div className="relative">
            <button
              onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
              className="text-[10px] w-5 h-5 flex items-center justify-center text-neutral-400 hover:text-white bg-neutral-700 hover:bg-neutral-600 rounded"
              title="修改類型"
            >T</button>
            {typeDropdownOpen && (
              <div className="absolute right-0 top-6 bg-neutral-800 border border-neutral-700 shadow-2xl rounded py-1 z-50 w-24 flex flex-col">
                {TYPE_OPTIONS.filter(o => o.value !== node.type).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      if (opt.value === 'string' && (node.type === 'list' || node.type === 'object')) {
                        const ok = window.confirm('轉換為 String 會只保留第一個子項內容，其餘資料可能遺失。確定繼續嗎？');
                        if (!ok) {
                          setTypeDropdownOpen(false);
                          return;
                        }
                      }
                      dispatch({ type: 'CHANGE_TYPE', nodeId: node.id, newType: opt.value });
                      setTypeDropdownOpen(false);
                    }}
                    className="text-left px-2 py-1.5 text-[10px] text-neutral-300 hover:bg-indigo-600 hover:text-white transition"
                  >{opt.label}</button>
                ))}
              </div>
            )}
          </div>

          {/* Add sibling */}
          <button
            onClick={() => dispatch({ type: 'ADD_SIBLING', afterId: node.id })}
            className="text-[10px] w-5 h-5 flex items-center justify-center text-neutral-400 hover:text-white bg-neutral-700 hover:bg-neutral-600 rounded"
            title="新增兄弟欄位"
          >+</button>

          {/* Expand editor (string only) */}
          {node.type === 'string' && (
            <button
              onClick={() => setLongEditorOpen(true)}
              className="text-[10px] w-5 h-5 flex items-center justify-center text-cyan-300 hover:text-white bg-neutral-700 hover:bg-cyan-700/70 rounded"
              title={node.value.length >= LONG_TEXT_SUGGEST_THRESHOLD ? '長文本建議使用展開編輯' : '展開編輯'}
            >⤢</button>
          )}

          {/* Add child (only for object/list) */}
          {hasChildren && (
            <button
              onClick={() => dispatch({ type: 'ADD_CHILD', nodeId: node.id })}
              className="text-[10px] px-1.5 h-5 flex items-center justify-center text-neutral-300 hover:text-white bg-indigo-600 hover:bg-indigo-500 rounded shadow"
              title="新增子級"
            >+ Sub</button>
          )}

          {/* Delete */}
          {!node.isLocked && (
            <button
              onClick={() => dispatch({ type: 'DELETE_NODE', nodeId: node.id })}
              className="text-[10px] w-5 h-5 flex items-center justify-center text-red-400 hover:text-white hover:bg-red-600 bg-neutral-700 rounded"
              title="刪除本欄目"
            >✖</button>
          )}
        </div>
      </div>

      {/* Children (recursive) */}
      {hasChildren && !collapsed && node.children.length > 0 && (
        <div className="pl-4 border-l border-neutral-700/50 ml-3 mt-1 space-y-1">
          {node.children.map(child => (
            <NodeRow key={child.id} node={child} dispatch={dispatch} depth={depth + 1} parentType={node.type} />
          ))}
        </div>
      )}

      {node.type === 'string' && (
        <LongTextEditorModal
          open={longEditorOpen}
          title="長文本編輯"
          keyName={isListItem ? '(list item)' : node.key}
          value={node.value}
          onCancel={() => setLongEditorOpen(false)}
          onSave={nextValue => {
            dispatch({ type: 'UPDATE_VALUE', nodeId: node.id, newValue: nextValue });
            setLongEditorOpen(false);
          }}
        />
      )}
    </div>
  );
};

// ========= Exported NodeTree =========

export const NodeTree: React.FC<{
  nodes: EditorNode[];
  dispatch: (action: TreeAction) => void;
  depth: number;
}> = ({ nodes, dispatch, depth }) => {
  if (nodes.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-neutral-500 text-xs mb-2">此分區尚無任何資料</p>
        <button
          onClick={() => dispatch({ type: 'REPLACE_ALL', nodes: [makeEmptyNode('新欄位')] })}
          className="text-xs text-indigo-400 hover:text-indigo-300 px-3 py-1 border border-indigo-700/50 rounded-lg hover:bg-indigo-900/20 transition"
        >
          + 新增第一個欄位
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {nodes.map(node => (
        <NodeRow key={node.id} node={node} dispatch={dispatch} depth={depth} parentType="root" />
      ))}
    </div>
  );
};
