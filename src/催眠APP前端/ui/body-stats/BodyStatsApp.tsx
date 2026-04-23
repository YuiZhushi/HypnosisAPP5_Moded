import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Lock,
  Search,
  User,
} from 'lucide-react';

import { getRoleSnapshot, getOrderedStatEntries, STAT_ORDER, BAR_STATS, type RoleMap } from '../../backend/body-stats';
import { getUnlocks } from '../../backend/hypnosis';
import { checkAndEnsureEntry } from '../../backend/character-editor';
import { waitForMvuReady } from '../../shared/mvu/mvuBridge';

function extractScalar(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(extractScalar).join(', ');
  if (typeof value === 'object') {
    const record = value as Record<string, any>;
    const scalarCandidates = [record.value, record.current, record.amount, record.描述, record.description];
    for (const candidate of scalarCandidates) {
      if (typeof candidate === 'number' || typeof candidate === 'string' || typeof candidate === 'boolean')
        return String(candidate);
    }
    try {
      return JSON.stringify(record);
    } catch {
      return '[object]';
    }
  }
  return String(value);
}

function isScalarValue(value: unknown): value is string | number | boolean | null | undefined {
  return value === null || value === undefined || ['string', 'number', 'boolean'].includes(typeof value);
}

function clampPercent(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

export const BodyStatsApp: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [vipUnlocked, setVipUnlocked] = useState(false);
  const [roles, setRoles] = useState<RoleMap>({});
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // World book check state
  const [wbStatus, setWbStatus] = useState<'idle' | 'checking' | 'pass' | 'created' | 'error'>('idle');
  const [wbMessage, setWbMessage] = useState('');

  const refreshRef = useRef<() => void>(() => {});
  const selectorRef = useRef<HTMLDivElement | null>(null);

  const roleNames = useMemo(
    () =>
      Object.keys(roles)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [roles],
  );
  const filteredRoleNames = useMemo(() => {
    const q = search.trim();
    if (!q) return roleNames;
    return roleNames.filter(name => name.includes(q));
  }, [roleNames, search]);

  const roleData = useMemo(() => {
    if (!selectedRole) return null;
    return roles[selectedRole] ?? null;
  }, [roles, selectedRole]);

  const orderedStatEntries = useMemo(() => {
    if (!roleData || typeof roleData !== 'object') return [];
    return getOrderedStatEntries(roleData as Record<string, unknown>);
  }, [roleData]);

  const nonBarEntries = useMemo(() => orderedStatEntries.filter(([k]) => !BAR_STATS.has(k)), [orderedStatEntries]);

  const sensitivityEntries = useMemo(
    () => nonBarEntries.filter(([k, v]) => k.includes('敏感度') && isScalarValue(v)),
    [nonBarEntries],
  );

  const orgasmCountEntries = useMemo(
    () => nonBarEntries.filter(([k, v]) => k.includes('高潮次数') && isScalarValue(v)),
    [nonBarEntries],
  );

  const otherScalarEntries = useMemo(
    () => nonBarEntries.filter(([k, v]) => isScalarValue(v) && !k.includes('敏感度') && !k.includes('高潮次数')),
    [nonBarEntries],
  );

  const complexEntries = useMemo(() => nonBarEntries.filter(([, v]) => !isScalarValue(v)), [nonBarEntries]);

  const refresh = async () => {
    setError(null);
    setLoading(true);

    try {
      const snapshot = await getRoleSnapshot();
      if (!snapshot) {
        setRoles({});
        setSelectedRole(null);
        setError('未连接到酒馆变量（MVU 未初始化或不在酒馆环境中）');
        return;
      }

      setRoles(snapshot.roles);
      const nextNames = snapshot.roleNames;
      setSelectedRole(prev => {
        if (prev && nextNames.includes(prev)) return prev;
        return nextNames[0] ?? null;
      });
    } catch (err) {
      console.warn('[HypnoOS] 身体检测读取失败', err);
      setError('读取失败：请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // Reset wb check when role changes
  useEffect(() => {
    setWbStatus('idle');
    setWbMessage('');
  }, [selectedRole]);

  const handleCheckWorldBook = async () => {
    if (!selectedRole) return;
    setWbStatus('checking');
    setWbMessage('');
    const result = await checkAndEnsureEntry(selectedRole);
    setWbStatus(result.status);
    if (result.status === 'error') {
      setWbMessage(result.message);
    }
  };

  refreshRef.current = refresh;

  useEffect(() => {
    let stopped = false;
    void (async () => {
      try {
        const unlocks = await getUnlocks();
        if (stopped) return;
        setVipUnlocked(unlocks.bodyStatsUnlocked);
      } catch (err) {
        console.warn('[HypnoOS] 读取功能解锁状态失败', err);
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);

  useEffect(() => {
    if (!selectorOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (selectorRef.current && !selectorRef.current.contains(target)) {
        setSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [selectorOpen]);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    let stops: Array<{ stop: () => void }> = [];
    void (async () => {
      try {
        const ready = await waitForMvuReady({ timeoutMs: 5000, pollMs: 150 });
        if (!ready) return;
        stops = [
          eventOn(Mvu.events.VARIABLE_INITIALIZED, () => refreshRef.current()),
          eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, () => refreshRef.current()),
        ];
      } catch {
        // ignore: not in tavern env
      }
    })();
    return () => {
      stops.forEach(s => s.stop());
    };
  }, []);

  return (
    <div className="h-full relative flex flex-col bg-linear-to-b from-slate-950 via-slate-950 to-black text-white overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center justify-between border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft size={18} className="text-white/80" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-cyan-300" />
              <h1 className="text-sm font-bold tracking-wide">身体检测</h1>
              {!vipUnlocked && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-white/70 flex items-center gap-1">
                  <Lock size={10} /> 受限
                </span>
              )}
            </div>
          </div>
        </div>

        <div ref={selectorRef} className="relative shrink-0">
          <button
            onClick={() => {
              setSearch('');
              setSelectorOpen(v => !v);
            }}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/85 flex items-center gap-2 transition-colors"
          >
            <User size={14} className="text-white/60" />
            <span className="max-w-[120px] truncate">{selectedRole ?? '选择目标'}</span>
            <ChevronDown size={14} className="text-white/30" />
          </button>

          {selectorOpen && (
            <div className="absolute right-0 top-full mt-2 w-[260px] max-w-[80vw] z-50 rounded-2xl border border-white/10 bg-slate-950 shadow-[0_10px_40px_rgba(0,0,0,0.6)] overflow-hidden">
              <div className="p-3 border-b border-white/10 bg-black/20">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <Search size={14} className="text-white/40" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="搜索角色..."
                    className="w-full bg-transparent text-xs text-white/80 placeholder:text-white/30 focus:outline-none"
                  />
                </div>
              </div>

              <div className="max-h-[45vh] overflow-y-auto no-scrollbar p-2 space-y-1">
                {filteredRoleNames.length === 0 ? (
                  <div className="py-6 text-center text-xs text-white/40">未找到匹配角色</div>
                ) : (
                  filteredRoleNames.map(name => {
                    const active = name === selectedRole;
                    return (
                      <button
                        key={name}
                        onClick={() => {
                          setSelectedRole(name);
                          setSelectorOpen(false);
                        }}
                        className={[
                          'w-full text-left px-3 py-2 rounded-xl border transition-colors flex items-center justify-between gap-3',
                          active
                            ? 'bg-white/10 border-cyan-400/30'
                            : 'bg-white/0 border-white/5 hover:bg-white/5 hover:border-white/10',
                        ].join(' ')}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white/90 truncate">{name}</div>
                          <div className="text-[10px] text-white/40 truncate">
                            {roles[name] && typeof roles[name] === 'object'
                              ? `${Object.keys(roles[name]).filter(k => !k.startsWith('_')).length} 项`
                              : '—'}
                          </div>
                        </div>
                        <div
                          className={[
                            'w-9 h-9 rounded-2xl flex items-center justify-center',
                            active ? 'bg-cyan-500/20' : 'bg-white/5',
                          ].join(' ')}
                        >
                          <User size={18} className={active ? 'text-cyan-300' : 'text-white/40'} />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 border-b border-white/5 bg-black/30">
          <div className="flex items-start gap-2 text-[11px] text-amber-200/90">
            <AlertTriangle size={14} className="mt-0.5 text-amber-300" />
            <div className="leading-snug">{error}</div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-14 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
            <div className="h-28 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
            <div className="h-28 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
          </div>
        ) : roleNames.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/50 text-sm">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
              <Activity className="text-cyan-300" />
            </div>
            暂无角色数据
          </div>
        ) : !selectedRole ? (
          <div className="h-full flex flex-col items-center justify-center text-white/50 text-sm">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
              <User className="text-white/60" />
            </div>
            请选择检测目标
          </div>
        ) : !roleData ? (
          <div className="h-full flex flex-col items-center justify-center text-white/50 text-sm">暂无该角色数据</div>
        ) : !vipUnlocked ? (
          <div className="p-5 rounded-2xl border border-white/10 bg-linear-to-b from-white/5 to-black/30">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Lock size={18} className="text-white/60" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">检测模块未授权</div>
                <div className="text-xs text-white/60 mt-1 leading-relaxed">
                  该模块属于 VIP1「角色状态可视化」。解锁后可查看警戒度、服从度、性欲、快感值等量化数据与明细项。
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 rounded-2xl border border-white/10 bg-white/5">
              <div className="text-xs text-white/50 mb-2">目标</div>
              <div className="text-base font-bold truncate">{selectedRole}</div>
            </div>

            {/* World Book Check */}
            <div className="p-3 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen size={16} className="text-cyan-300 shrink-0" />
                <div className="text-xs text-white/70 truncate">
                  世界书变量条目
                  {wbStatus === 'pass' && <span className="ml-2 text-emerald-400">✔ 已存在</span>}
                  {wbStatus === 'created' && <span className="ml-2 text-amber-300">✔ 已补入</span>}
                  {wbStatus === 'error' && <span className="ml-2 text-red-400">✖ {wbMessage}</span>}
                  {wbStatus === 'checking' && <span className="ml-2 text-white/50">检查中…</span>}
                </div>
              </div>
              <button
                onClick={() => void handleCheckWorldBook()}
                disabled={wbStatus === 'checking'}
                className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-cyan-500/15 border border-cyan-500/25 text-cyan-200 hover:bg-cyan-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {wbStatus === 'checking' ? '检查中' : '检查'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {orderedStatEntries
                .filter(([k]) => BAR_STATS.has(k))
                .map(([k, v]) => (
                  <StatRow key={k} label={k} value={v} />
                ))}
            </div>

            {sensitivityEntries.length > 0 && <StatGroupCard title="敏感度" entries={sensitivityEntries} />}

            {orgasmCountEntries.length > 0 && <StatGroupCard title="高潮次数" entries={orgasmCountEntries} />}

            {otherScalarEntries.length > 0 && <StatGroupCard title="其他数值" entries={otherScalarEntries} />}

            {complexEntries.length > 0 && (
              <div className="space-y-2">
                {complexEntries.map(([k, v]) => (
                  <KeyValueRow key={k} k={k} v={v} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const StatGroupCard: React.FC<{ title: string; entries: Array<[string, any]> }> = ({ title, entries }) => (
  <div className="p-4 rounded-2xl border border-white/10 bg-white/5">
    <div className="flex items-center justify-between mb-3">
      <div className="text-xs font-bold text-white/80">{title}</div>
      <div className="text-[10px] text-white/40">{entries.length}</div>
    </div>
    <div className="grid grid-cols-3 gap-2">
      {entries.map(([k, v]) => (
        <MiniStat key={k} label={k} value={v} />
      ))}
    </div>
  </div>
);

const MiniStat: React.FC<{ label: string; value: unknown }> = ({ label, value }) => (
  <div className="px-3 py-2 rounded-xl border border-white/10 bg-black/20">
    <div className="text-[10px] text-white/55 truncate">{label}</div>
    <div className="mt-0.5 text-sm font-bold text-white/90 tabular-nums truncate">{extractScalar(value)}</div>
  </div>
);

const StatRow: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  const percent = clampPercent(Number.isFinite(numeric) ? numeric : 0) ?? 0;
  const color =
    label === '警戒度'
      ? 'from-red-500 to-amber-400'
      : label === '服从度'
        ? 'from-emerald-400 to-cyan-400'
        : label === '好感度'
          ? 'from-pink-400 to-rose-400'
        : label === '性欲'
          ? 'from-fuchsia-400 to-cyan-400'
          : 'from-cyan-400 to-violet-400';

  return (
    <div className="p-3 rounded-xl border border-white/10 bg-black/20">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-white/80">{label}</div>
        <div className="text-xs font-bold text-white/90 tabular-nums">
          {Number.isFinite(numeric) ? numeric : extractScalar(value)}
        </div>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full bg-linear-to-r ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

const KeyValueRow: React.FC<{ k: string; v: unknown }> = ({ k, v }) => {
  const [open, setOpen] = useState(false);
  const isExpandable = v !== null && typeof v === 'object';

  if (!isExpandable) {
    return (
      <div className="flex items-start justify-between gap-3 p-3 rounded-xl border border-white/10 bg-black/20">
        <div className="text-[11px] text-white/70 font-semibold min-w-[80px]">{k}</div>
        <div className="text-[11px] text-white/85 text-right wrap-break-word">{extractScalar(v)}</div>
      </div>
    );
  }

  let preview = '[object]';
  if (Array.isArray(v)) preview = `Array(${v.length})`;
  else preview = `Object(${Object.keys(v as any).length})`;

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 p-3 hover:bg-white/5 transition-colors"
      >
        <div className="text-[11px] text-white/70 font-semibold">{k}</div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-white/40">{preview}</div>
          {open ? (
            <ChevronUp size={14} className="text-white/30" />
          ) : (
            <ChevronDown size={14} className="text-white/30" />
          )}
        </div>
      </button>
      {open && (
        <pre className="text-[10px] leading-relaxed text-white/80 p-3 border-t border-white/10 bg-black/30 overflow-x-auto">
          {safeJson(v)}
        </pre>
      )}
    </div>
  );
};

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
