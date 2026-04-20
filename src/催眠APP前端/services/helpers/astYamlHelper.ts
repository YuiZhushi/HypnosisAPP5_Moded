import YAML from 'yaml';
import type { EditorNode, NodeType } from '../../types';
import { SECTION_LOCKED_KEYS } from '../constants/characterDefaults';

let _counter = 0;
function nextId(): string {
  return `cdn_${Date.now()}_${++_counter}`;
}

export function yamlToTree(obj: unknown, lockedKeys?: Set<string>): EditorNode[] {
  if (obj === null || obj === undefined) return [];

  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return [{ id: nextId(), key: '', type: 'string', value: String(obj), children: [], isLocked: false }];
  }

  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (Array.isArray(item)) {
        return {
          id: nextId(),
          key: '',
          type: 'list' as NodeType,
          value: '',
          children: yamlToTree(item),
          isLocked: false,
        };
      }
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        return {
          id: nextId(),
          key: '',
          type: 'object' as NodeType,
          value: '',
          children: yamlToTree(item),
          isLocked: false,
        };
      }
      return {
        id: nextId(),
        key: '',
        type: 'string' as NodeType,
        value: String(item ?? ''),
        children: [],
        isLocked: false,
      };
    });
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    return entries.map(([key, val]) => {
      const isLocked = lockedKeys?.has(key) ?? false;
      if (Array.isArray(val)) {
        return {
          id: nextId(),
          key,
          type: 'list' as NodeType,
          value: '',
          children: yamlToTree(val),
          isLocked,
        };
      }
      if (typeof val === 'object' && val !== null) {
        return {
          id: nextId(),
          key,
          type: 'object' as NodeType,
          value: '',
          children: yamlToTree(val),
          isLocked,
        };
      }
      return {
        id: nextId(),
        key,
        type: 'string' as NodeType,
        value: String(val ?? ''),
        children: [],
        isLocked,
      };
    });
  }

  return [];
}

export function treeToYaml(nodes: EditorNode[]): unknown {
  const rootLooksLikeArray = nodes.length > 0 && nodes.every(n => n.key.trim() === '');
  if (rootLooksLikeArray) {
    return nodes.map(nodeToYamlValue);
  }

  const result: Record<string, unknown> = {};
  let unnamedCounter = 0;

  for (const node of nodes) {
    const rawKey = node.key?.trim() ?? '';
    const key = rawKey || `unnamed_${++unnamedCounter}`;
    result[key] = nodeToYamlValue(node);
  }

  return result;
}

function nodeToYamlValue(node: EditorNode): unknown {
  if (node.type === 'string') {
    return node.value;
  }

  if (node.type === 'list') {
    return node.children.map(nodeToYamlValue);
  }

  const result: Record<string, unknown> = {};
  let unnamedCounter = 0;

  for (const child of node.children) {
    const rawKey = child.key?.trim() ?? '';
    const key = rawKey || `unnamed_${++unnamedCounter}`;
    result[key] = nodeToYamlValue(child);
  }

  return result;
}

export function parseSectionYamlToNodes(sectionId: string, raw: string): EditorNode[] {
  const text = raw.trim();
  if (!text) return [];
  const parsed = YAML.parse(text);
  const lockKeys = new Set(SECTION_LOCKED_KEYS[sectionId] ?? []);
  return yamlToTree(parsed, lockKeys);
}

export function serializeSectionNodesToYaml(nodes: EditorNode[]): string {
  if (!nodes.length) return '';
  return YAML.stringify(treeToYaml(nodes), { lineWidth: 0 }).trimEnd();
}
