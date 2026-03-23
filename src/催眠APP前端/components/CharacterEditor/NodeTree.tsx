import React, { useState } from 'react';
import { EditorNode, NodeType } from '../../types';
import { ChevronDown, ChevronRight } from 'lucide-react';

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

function convertNodeType(node: EditorNode, newType: NodeType): EditorNode {
  if (node.type === newType) return node;

  const next: EditorNode = { ...node, type: newType };

  if (node.type === 'string' && newType === 'list') {
    next.children = node.value
      ? [{ id: nextNodeId(), key: '', type: 'string', value: node.value, children: [], isLocked: false }]
      : [];
    next.value = '';
  } else if (node.type === 'string' && newType === 'object') {
    next.children = node.value
      ? [{ id: nextNodeId(), key: '', type: 'string', value: node.value, children: [], isLocked: false }]
      : [];
    next.value = '';
  } else if (node.type === 'list' && newType === 'string') {
    next.value = node.children[0]?.value ?? '';
    next.children = [];
  } else if (node.type === 'list' && newType === 'object') {
    next.children = node.children.map((c, i) => ({ ...c, key: c.key || `item_${i}` }));
    next.value = '';
  } else if (node.type === 'object' && newType === 'string') {
    next.value = node.children[0]?.value ?? '';
    next.children = [];
  } else if (node.type === 'object' && newType === 'list') {
    next.children = node.children.map(c => ({ ...c, key: '' }));
    next.value = '';
  }

  return next;
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

function addSiblingAfter(nodes: EditorNode[], afterId: string): EditorNode[] {
  const result: EditorNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.id === afterId) {
      result.push(makeEmptyNode());
    }
    // recurse into children
    if (node.children.length > 0) {
      const updated = addSiblingAfter(node.children, afterId);
      if (updated !== node.children) {
        result[result.length - 1] = { ...result[result.length - 1], children: updated };
      }
    }
  }
  return result;
}

export function treeReducer(state: EditorNode[], action: TreeAction): EditorNode[] {
  switch (action.type) {
    case 'REPLACE_ALL':
      return action.nodes;

    case 'ADD_SIBLING':
      return addSiblingAfter(state, action.afterId);

    case 'ADD_CHILD':
      return applyToTree(state, action.nodeId, n => ({
        ...n,
        children: [...n.children, makeEmptyNode()],
      }));

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
}> = ({ node, dispatch, depth }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const hasChildren = node.type !== 'string';
  const isListItem = node.key === '' && depth > 0;

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
              className="bg-neutral-800 text-pink-300 text-[11px] px-2 py-1 rounded w-20 font-mono border border-neutral-700 focus:border-indigo-500 outline-none placeholder-neutral-600 shrink-0 disabled:opacity-60"
              placeholder="key"
            />
            <span className="text-neutral-500 text-xs mt-1 shrink-0">:</span>
          </>
        )}

        <TypeBadge type={node.type} />

        {/* Value (string only) */}
        {node.type === 'string' && (
          <textarea
            value={node.value}
            onChange={e => dispatch({ type: 'UPDATE_VALUE', nodeId: node.id, newValue: e.target.value })}
            className="bg-neutral-900 border border-neutral-700 rounded text-[11px] px-2 py-1 text-neutral-300 flex-1 min-h-[28px] max-h-[120px] focus:border-indigo-500 outline-none resize-y"
            rows={1}
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
            <NodeRow key={child.id} node={child} dispatch={dispatch} depth={depth + 1} />
          ))}
        </div>
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
        <NodeRow key={node.id} node={node} dispatch={dispatch} depth={depth} />
      ))}
    </div>
  );
};
