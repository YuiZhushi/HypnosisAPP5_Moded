export const BOARD_NAMES = ['公告区', '新手引导区', '综合讨论区', '成果展示区', '求助区'] as const;
export type BoardName = (typeof BOARD_NAMES)[number];

export type FloorSource = 'ai' | 'user' | 'local';

export type Floor = {
  floorNo: number;
  content: string;
  createdAtMs: number;
  source: FloorSource;
  originKey?: string; // e.g. "msg:123:floor:0"
  originFloorTagNo?: number;
};

export type Post = {
  board: BoardName;
  postNo: number;
  title: string;
  body: string;
  createdAtMs: number;
  updatedAtMs: number;
  floors: Floor[];
};

export type MChanStateV1 = {
  version: 1;
  boards: Record<BoardName, { posts: Post[] }>;
  meta: {
    lastParsedAssistantMessageId?: number;
  };
};

export function createEmptyState(): MChanStateV1 {
  return {
    version: 1,
    boards: {
      公告区: { posts: [] },
      新手引导区: { posts: [] },
      综合讨论区: { posts: [] },
      成果展示区: { posts: [] },
      求助区: { posts: [] },
    },
    meta: {},
  };
}

function safeNowMs(): number {
  return Date.now();
}

function getChatScopedKey(): string {
  try {
    const chatId = (window as any)?.SillyTavern?.getCurrentChatId?.();
    if (chatId !== undefined && chatId !== null && String(chatId).length > 0) {
      return String(chatId);
    }
  } catch {}
  return 'global';
}

export function getStorageKey(): string {
  return `mchan.v1:${getChatScopedKey()}`;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isBoardName(value: unknown): value is BoardName {
  return typeof value === 'string' && (BOARD_NAMES as readonly string[]).includes(value);
}

export function loadState(): MChanStateV1 {
  const raw = localStorage.getItem(getStorageKey());
  if (!raw) return createEmptyState();

  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== 'object') return createEmptyState();

  // Best-effort validation + forward-compat fallback.
  const v = (parsed as any).version;
  if (v !== 1) return createEmptyState();

  const state = createEmptyState();
  const boards = (parsed as any).boards;
  if (boards && typeof boards === 'object') {
    for (const boardName of BOARD_NAMES) {
      const b = (boards as any)[boardName];
      if (!b || typeof b !== 'object' || !Array.isArray((b as any).posts)) continue;
      state.boards[boardName].posts = (b as any).posts
        .filter((p: any) => p && typeof p === 'object')
        .map((p: any) => {
          const board = isBoardName(p.board) ? p.board : boardName;
          const postNo = Number.isFinite(p.postNo) ? Number(p.postNo) : 1;
          const title = typeof p.title === 'string' ? p.title : `帖子${postNo}`;
          const body = typeof p.body === 'string' ? p.body : '';
          const createdAtMs = Number.isFinite(p.createdAtMs) ? Number(p.createdAtMs) : safeNowMs();
          const updatedAtMs = Number.isFinite(p.updatedAtMs) ? Number(p.updatedAtMs) : createdAtMs;
          const floors = Array.isArray(p.floors)
            ? p.floors
                .filter((f: any) => f && typeof f === 'object')
                .map((f: any) => ({
                  floorNo: Number.isFinite(f.floorNo) ? Number(f.floorNo) : 1,
                  content: typeof f.content === 'string' ? f.content : '',
                  createdAtMs: Number.isFinite(f.createdAtMs) ? Number(f.createdAtMs) : safeNowMs(),
                  source: f.source === 'ai' || f.source === 'user' || f.source === 'local' ? f.source : 'local',
                  originKey: typeof f.originKey === 'string' ? f.originKey : undefined,
                  originFloorTagNo: Number.isFinite(f.originFloorTagNo) ? Number(f.originFloorTagNo) : undefined,
                }))
            : [];
          floors.sort((a, b) => a.floorNo - b.floorNo);
          return { board, postNo, title, body, createdAtMs, updatedAtMs, floors } satisfies Post;
        });
      state.boards[boardName].posts.sort((a, b) => a.postNo - b.postNo);
    }
  }

  const meta = (parsed as any).meta;
  if (meta && typeof meta === 'object') {
    const last = (meta as any).lastParsedAssistantMessageId;
    if (Number.isFinite(last)) state.meta.lastParsedAssistantMessageId = Number(last);
  }

  return state;
}

export function saveState(state: MChanStateV1): void {
  localStorage.setItem(getStorageKey(), JSON.stringify(state));
}

export function getBoardPosts(state: MChanStateV1, board: BoardName): Post[] {
  return state.boards[board].posts;
}

export function getNextPostNo(state: MChanStateV1, board: BoardName): number {
  const posts = getBoardPosts(state, board);
  const max = posts.reduce((m, p) => Math.max(m, p.postNo), 0);
  return max + 1;
}

export function getNextFloorNo(post: Post): number {
  const max = post.floors.reduce((m, f) => Math.max(m, f.floorNo), 0);
  return max + 1;
}

export function upsertPost(
  state: MChanStateV1,
  board: BoardName,
  postNo: number,
  patch?: Partial<Pick<Post, 'title' | 'body'>>,
): Post {
  const posts = state.boards[board].posts;
  let post = posts.find(p => p.postNo === postNo);
  if (!post) {
    const now = safeNowMs();
    post = {
      board,
      postNo,
      title: patch?.title ?? `${board} 帖子${postNo}`,
      body: patch?.body ?? '',
      createdAtMs: now,
      updatedAtMs: now,
      floors: [],
    };
    posts.push(post);
    posts.sort((a, b) => a.postNo - b.postNo);
  } else if (patch) {
    if (typeof patch.title === 'string' && patch.title.trim().length > 0) post.title = patch.title.trim();
    if (typeof patch.body === 'string' && patch.body.trim().length > 0) post.body = patch.body.trim();
    post.updatedAtMs = safeNowMs();
  }
  return post;
}

export function appendFloor(post: Post, floor: Omit<Floor, 'floorNo'> & { floorNo?: number }): Floor {
  const next = getNextFloorNo(post);
  const desired = floor.floorNo;
  const floorNo = typeof desired === 'number' && desired === next ? desired : next;
  const full: Floor = { ...floor, floorNo };
  post.floors.push(full);
  post.floors.sort((a, b) => a.floorNo - b.floorNo);
  post.updatedAtMs = safeNowMs();
  return full;
}

export type ParsedPostBlock = {
  board: BoardName;
  postNo: number;
  title?: string;
  body?: string;
  floors: Array<{ floorTagNo?: number; content: string }>;
};

function escapeRegexLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeContent(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

export function parseTaggedBlocks(text: string): ParsedPostBlock[] {
  const normalized = normalizeContent(text);
  if (!normalized) return [];

  const boardsPattern = BOARD_NAMES.map(escapeRegexLiteral).join('|');
  const outerRe = new RegExp(`<(?<tag>(?:${boardsPattern})帖子\\d+)>(?<inner>[\\s\\S]*?)<\\/\\k<tag>>`, 'gu');

  const blocks: ParsedPostBlock[] = [];
  for (const m of normalized.matchAll(outerRe)) {
    const tag = m.groups?.tag ?? '';
    const inner = m.groups?.inner ?? '';
    const tagMatch = tag.match(new RegExp(`^(?<board>${boardsPattern})帖子(?<no>\\d+)$`, 'u'));
    const board = tagMatch?.groups?.board;
    const no = tagMatch?.groups?.no;
    if (!board || !no || !isBoardName(board)) continue;
    const postNo = Number.parseInt(no, 10);
    if (!Number.isFinite(postNo) || postNo <= 0) continue;

    const title = inner.match(/<标题>([\s\S]*?)<\/标题>/u)?.[1];
    const body = inner.match(/<正文>([\s\S]*?)<\/正文>/u)?.[1];

    const floorRe = /<(?<ftag>楼层\d+)>(?<finner>[\s\S]*?)<\/\k<ftag>>/gu;
    const floors: Array<{ floorTagNo?: number; content: string }> = [];
    for (const fm of inner.matchAll(floorRe)) {
      const ftag = fm.groups?.ftag ?? '';
      const finner = fm.groups?.finner ?? '';
      const n = ftag.match(/^楼层(\d+)$/u)?.[1];
      const floorTagNo = n ? Number.parseInt(n, 10) : undefined;
      const content = normalizeContent(finner);
      if (!content) continue;
      floors.push({ floorTagNo, content });
    }

    // Allow "new post" blocks even if floors are missing.
    blocks.push({
      board,
      postNo,
      title: title ? normalizeContent(title) : undefined,
      body: body ? normalizeContent(body) : undefined,
      floors,
    });
  }
  return blocks;
}

export function applyParsedBlocks(
  state: MChanStateV1,
  blocks: ParsedPostBlock[],
  source: FloorSource,
  originMessageId?: number,
): { createdPosts: number; appendedFloors: number } {
  let createdPosts = 0;
  let appendedFloors = 0;

  blocks.forEach((b, bIdx) => {
    const existed = state.boards[b.board].posts.some(p => p.postNo === b.postNo);
    const post = upsertPost(state, b.board, b.postNo, {
      title: b.title,
      body: b.body,
    });
    if (!existed) createdPosts += 1;

    b.floors.forEach((f, fIdx) => {
      const originKey =
        originMessageId !== undefined
          ? `msg:${originMessageId}:post:${b.board}:${b.postNo}:floor:${bIdx}:${fIdx}`
          : undefined;
      if (originKey && post.floors.some(x => x.originKey === originKey)) {
        return;
      }
      appendFloor(post, {
        content: f.content,
        createdAtMs: safeNowMs(),
        source,
        originKey,
        originFloorTagNo: f.floorTagNo,
      });
      appendedFloors += 1;
    });
  });

  if (originMessageId !== undefined) {
    state.meta.lastParsedAssistantMessageId = Math.max(state.meta.lastParsedAssistantMessageId ?? -1, originMessageId);
  }

  return { createdPosts, appendedFloors };
}

export type ReplyPromptArgs = {
  board: BoardName;
  postNo: number;
  lastFloorNo: number;
  floorsToGenerate?: number;
  userInstruction?: string;
};

export function buildReplyPrompt(args: ReplyPromptArgs): string {
  const floorsToGenerate = 6;
  const start = args.lastFloorNo + 1;
  const end = start + floorsToGenerate - 1;
  const tag = `${args.board}帖子${args.postNo}`;

  const instruction = (args.userInstruction ?? '').trim();

  return [
    `{{user}}正在为浏览匿名版「${args.board}」的帖子 ${args.postNo} 你需要生成回复楼层。`,
    `当前最后楼层是 ${args.lastFloorNo}。请生成 ${floorsToGenerate} 个新楼层（楼层号从 ${start} 到 ${end}）。`,
    instruction ? `用户补充要求：${instruction}` : '',
    `必须严格只输出以下 HTML 标签并用<匿名版></匿名版>包裹结构：`,
    `- 不要输出任何额外文字`,
    `- 不要输出 Markdown 代码块/反引号`,
    `<${tag}>`,
    ...Array.from({ length: floorsToGenerate }, (_, i) => {
      const n = start + i;
      return `<楼层${n}>（在这里写楼层内容）</楼层${n}>`;
    }),
    `</${tag}>`,
  ]
    .filter(Boolean)
    .join('\n');
}

export type PostContextForPrompt = {
  board: BoardName;
  postNo: number;
  title: string;
  body: string;
  floors: Array<Pick<Floor, 'floorNo' | 'content'>>;
};

function escapeForTagContent(text: string): string {
  return text.replace(/[<>]/g, m => (m === '<' ? '＜' : '＞'));
}

function buildTaggedContextBlock(
  post: PostContextForPrompt,
  opts?: { maxFloors?: number },
): { block: string; truncated: boolean } {
  const maxFloors = Math.max(1, opts?.maxFloors ?? 30);
  const floors = post.floors;
  const truncated = floors.length > maxFloors;
  const selected = truncated ? floors.slice(Math.max(0, floors.length - maxFloors)) : floors;

  const tag = `${post.board}帖子${post.postNo}`;
  const lines = [
    `<${tag}>`,
    `<标题>${escapeForTagContent(post.title)}</标题>`,
    `<正文>${escapeForTagContent(post.body)}</正文>`,
    ...selected.map(f => `<楼层${f.floorNo}>${escapeForTagContent(f.content)}</楼层${f.floorNo}>`),
    `</${tag}>`,
  ];
  return { block: lines.join('\n'), truncated };
}

export type FollowupPromptArgs = {
  post: PostContextForPrompt;
  // The user's reply has already been appended to the post.
  lastFloorNo: number;
  aiFloorsToGenerate: number;
  aiStyleHint?: string;
};

export function buildAiFollowupPrompt(args: FollowupPromptArgs): string {
  const aiFloorsToGenerate = 6;
  const start = args.lastFloorNo + 1;
  const end = start + aiFloorsToGenerate - 1;
  const tag = `${args.post.board}帖子${args.post.postNo}`;

  const { block, truncated } = buildTaggedContextBlock(args.post, { maxFloors: 30 });
  const styleHint = (args.aiStyleHint ?? '').trim();

  return [
    `{{user}}刚发布了匿名版「${args.post.board}」的一个串，你需要模仿其他匿名用户继续回复。`,
    `你要生成 ${aiFloorsToGenerate} 个新楼层（楼层号从 ${start} 到 ${end}）。`,
    styleHint ? `额外要求：${styleHint}` : '',
    `引用（帖子标题/正文/已有楼层，作为上文与格式示例）：`,
    truncated ? `（上文已截断：仅包含最近30楼）` : '',
    block,
    `输出要求：`,
    `- 必须严格只输出以下 HTML 标签并用<匿名版></匿名版>包裹结构`,
    `- 不要输出任何额外文字/解释`,
    `- 不要输出 Markdown 代码块/反引号`,
    `- 楼层内容中避免出现 < 或 >（如必须使用请改用全角＜＞）`,
    `- 回复要像真实匿名版：可以短句、口语、偶尔用 >>No.楼层号 引用`,
    `<${tag}>`,
    ...Array.from({ length: aiFloorsToGenerate }, (_, i) => {
      const n = start + i;
      return `<楼层${n}>（以匿名用户口吻写内容）</楼层${n}>`;
    }),
    `</${tag}>`,
  ]
    .filter(Boolean)
    .join('\n');
}

export type NewPostPromptArgs = {
  board: BoardName;
  postNo: number;
  userInstruction?: string;
};

export function buildNewPostPrompt(args: NewPostPromptArgs): string {
  const tag = `${args.board}帖子${args.postNo}`;
  const instruction = (args.userInstruction ?? '').trim();

  return [
    `{{user}}正在为匿名版「${args.board}」创建一个新帖子，帖子序号必须是 ${args.postNo}（不要改序号）。`,
    instruction ? `用户补充要求：${instruction}` : '',
    `必须严格只输出以下 HTML 标签并用<匿名版></匿名版>包裹结构：`,
    `- 不要输出任何额外文字`,
    `- 不要输出 Markdown 代码块/反引号`,
    `- 正文/楼层内容中避免出现 < 或 >（如必须使用请改用全角＜＞）`,
    `<${tag}>`,
    `<标题>（在这里写标题）</标题>`,
    `<正文>（在这里写正文）</正文>`,
    `<楼层1>（在这里写首楼内容）</楼层1>`,
    `</${tag}>`,
  ]
    .filter(Boolean)
    .join('\n');
}

function slashQuote(text: string): string {
  // Ensure we don't accidentally split the slash command line.
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n');
  return `"${escaped}"`;
}

export async function sendPromptToTavern(prompt: string): Promise<void> {
  // Prefer slash pipeline so the prompt is visibly placed into Tavern input before sending.
  try {
    await triggerSlash(`/setinput ${slashQuote(prompt)} | /send | /trigger`);
    return;
  } catch {}

  // Fallback: best-effort fill input, then send reliably via createChatMessages.
  try {
    await triggerSlash(`/setinput ${slashQuote(prompt)}`);
  } catch {
    // Ignore.
  }
  await createChatMessages([{ role: 'user', message: prompt }]);
  await triggerSlash('/trigger');
}

export type Preset = Record<
  BoardName,
  Array<Omit<Post, 'floors' | 'createdAtMs' | 'updatedAtMs'> & { floors?: string[] }>
>;

export const DEFAULT_PRESET: Preset = {
  公告区: [
    {
      board: '公告区',
      postNo: 1,
      title: '置顶：匿名版守则（简版）',
      body: '这里是自建匿名版。请勿泄露现实身份信息；匿名版内一切内容均为角色扮演/故事设定。',
      floors: ['欢迎使用。本匿名版为催眠APP使用者自行搭建, 跟官方无关, 也不负责售后。'],
    },
    {
      board: '公告区',
      postNo: 2,
      title: '【警示】最近在涩谷有人当众使用催眠APP被发现, 人被警察带走了, 大家注意低调',
      body: '如题，为了避免引起注意，请大家避免在公众场合被目击使用明显的催眠。',
      floors: ['真是蠢货，要是害得警方注意到了那就麻烦了。'],
    },
  ],
  新手引导区: [
    {
      board: '新手引导区',
      postNo: 1,
      title: '[急] 手机太老了, 后台开了几个app后再用催眠APP, 手机现在烫得吓人, 会影响功能吗？',
      body: '刚下载APP，想试试效果。结果刚开始催眠，手机背面烫得能煎鸡蛋，APP还特别卡。这种情况下还能正常催眠吗？能不能贴模板脸上增强效果顺便散热。在线等，挺急的。',
      floors: [
        '楼主你什么机型？建议外挂个散热背夹，这APP优化极差，不仅吃内存还烧CPU。',
        '贴脸上物理降温草，你这是要把目标烫醒吗？',
        '别硬撑，万一电池炸了，你就直接把人脸给炸了',
        '建议杀后台软件，还卡就老老实实换手机吧。',
      ],
    },
    {
      board: '新手引导区',
      postNo: 2,
      title: '[疑问] 目标重度近视, 5米之外人畜不分那种, 会影响催眠效果吗？',
      body: '我在图书馆对一个眼镜娘用了基础催眠，平时只要对视3秒就晕了。但她刚好在擦眼镜，看了半天好像没什么反应，虽然也没认出我来。难道近视还能防催眠？',
      floors: [
        '笑死，近视反催眠。',
        '如果近视到看不清屏幕的话, 大概会影响吧',
        '这种情况下还是等她带上眼镜吧',
        '也有可能只是你催眠指令太模糊了, 催眠了也没发现.',
        '这就是为什么我在平板上也装了这个app，大屏幕专门对付近视娘。',
      ],
    },
    {
      board: '新手引导区',
      postNo: 3,
      title: '[系统] 安装APP时提示要开启“麦克风”和“定位”权限，这安全吗？',
      body: '为什么催眠APP也要这么多权限啊！这APP要这么多权限，会不会偷听我说话或者把我的位置发给网警？有没有懂哥分析一下代码？',
      floors: [
        '楼主你用催眠APP了，还怕网警？',
        '麦克风是为了采集你的声纹生成“命令音频”，定位是为了扫描附近的“可攻略素体”，别想多了。',
        '你要是怕，就搞个备用机，不插卡只连公共WiFi。',
        '最大的安全隐患是你操作失误被目标报警，而不是APP本身。',
        '放心吧，开发这APP的组织都有这种黑科技了，想要你那点隐私还不简单?',
      ],
    },
    {
      board: '新手引导区',
      postNo: 4,
      title: '[新人] 初始任务送的点数怎么花性价比最高？',
      body: '刚注册初始任务送了一点点数，功能里琳琅满目不知道买啥。是买点数上限还是解锁新功能”？我想走纯爱路线（指让对方以为我是她男朋友）。',
      floors: [
        '别买时间停止！别买时间停止！新人MC能量不够, 只能停几分钟，脱个裤子都来不及，除非你是快枪手.',
        '纯爱流必须点“常识修改”，这是核心技能。先把“陌生人判定”改成“熟人判定”。',
        '解锁敏感度修改或者发情吧, 先让目标高潮获得MC点, 循环起来',
        '楼上说得对',
        '新人听我一句劝，先买“记忆消除”，万一玩脱了还能跑路。',
      ],
    },
    {
      board: '新手引导区',
      postNo: 5,
      title: '[社死] 以为断开投屏了，结果在百寸大屏上启动了APP，老板问那个螺旋是什么',
      body: '如题。刚才季度汇报，讲完PPT后投屏没关。由于太无聊，手贱想解锁个新功能结果点错了。\n\n结果那个巨大的、粉紫色的、高对比度的螺旋就在100寸幕布上转了起来。\n音响还非常尽职尽责地最大音量播报了：『催眠APP, 启动』。\n\n全场死寂了大概5秒。\n现在老板、HR、还有隔壁组的那个大胸女经理都在看着我，眼神很奇怪。\n我现在躲在楼道抽烟，手在抖。\n\n有没有一种可能，投影仪流明够高，完成了群体催眠？\n我是不是可以直接命令老板给我涨薪了？在线等，挺急的。',
      floors: [
        '没救了，重开吧。',
        '>>1 楼主醒醒。投影仪只负责投影影像，就算有效果估计也会失真。除非你老板贴在幕布上看，否则他们现在只是觉得你是个变态。',
        '笑死，这就是传说中的全屏AOE吗？但是没过判定啊wwww',
        '快！趁现在还没断开连接，马上播放『常识置换』的音频！把设定改成『这是公司最新的视觉系企业文化宣传片』！只要你信念够强，说不定能蒙混过关！',
        '『催眠APP, 启动』... 笑死, 喜欢自定义启动音效是吧。建议楼主直接说是中了病毒，或者说这是测试部开发的什么奇怪Demo。',
        '如果那个女经理脸红了，说明她可能潜意识抗性低，楼主不要放弃，单独找她试试。',
        '悲报：楼主十分钟没回话了，估计已经被保安叉出去了。',
        'RIP。下辈子记得先检查投屏开关，或者别在公司用这种APP啊白痴。',
        '有没有后续？如果老板也被催眠了，是不是可以直接把公司变成这种APP的线下据点？想想都有点带感。',
        '>>9 醒醒，你当这是H漫吗？',
      ],
    },
  ],
  综合讨论区: [
    {
      board: '综合讨论区',
      postNo: 1,
      title: '【悲报】最新版本的耗电量也太异常了，手机发烫严重',
      body: '只是开启了十分钟的「常识重构」模式，我的Xperia简直烫得能煎鸡蛋。\n\n明明说明书上写着使用的是“不可听声波”，但这发热量怎么看都是在满负荷运行吧？\n刚才差点就在目标面前露馅了，因为她碰到我的手时候问我为什么拿着个暖宝宝。\n\n如果不解决散热问题，夏天根本没法用啊。',
      floors: [
        '>>1 这里的常识是：高性能=高发热。想控制那个精密的大脑，这点代价是必须的吧。',
        '我都贴着退烧用的冷却贴在手机背面用的，建议你也试试。',
        '比起这个，把常识改成“手机发烫是因为里面寄宿着热情的精灵”不就好了？反正平然化之后她也不会觉得奇怪。',
        '>>3 天才。但这甚至比原来的借口更可疑吧w',
        '不要用索尼，换个散热好的游戏手机吧。虽然拿着那种RGB光污染严重的手机去催眠有点破坏气氛就是了。',
      ],
    },
    {
      board: '综合讨论区',
      postNo: 2,
      title: '关于范围催眠在早高峰电车上的测试报告',
      body: '坐标山手线。\n今早试着开启了范围模式，设定内容是：「电车摇晃时大声喊出“喵”是礼貌行为」。\n\n效果非常惊人，但也非常精神污染。\n\n一个大叔失去平衡时喊了一声野太的“喵！”，周围的OL和学生完全没有惊讶，甚至有个jk点头示意，觉得大叔很有教养。\n最可怕的是，哪怕没有完全站稳的人，为了不被当成没礼貌的家伙，也会特意晃动一下然后叫一声。\n\n这就是地狱吗？',
      floors: [
        '草。',
        '>>1 你是恶魔吗？想象了一下那个画面，咖啡喷了一屏幕。',
        '平然化机制太强了。如果不设定“遗忘”，下车后他们会记得自己像猫一样叫了一路吗？',
        '>>3 只要没设定“离开范围失效”，这种常识改变会持续一段时间吧。估计到了公司也会对着上司喵喵叫。',
        '这已经属于社会实验了吧。下次试试把常识改成“必须像相扑力士一样张开腿站立”看看。',
        '我也想试试，但我这边的乡下电车根本不挤，完全没有触发条件（哭）。',
      ],
    },
    {
      board: '综合讨论区',
      postNo: 3,
      title: '如果不小心照到了镜子会怎么样？',
      body: '刚才在洗手间测试，屏幕亮度开到了最大。\n不小心通过镜子的反射和屏幕对视了大概3秒。\n\nAPP说明上好像没写有“使用者保护机制”，但我现在感觉有点奇怪。\n总觉得“必须要给这层楼的每个人买布丁”是一种宇宙真理。\n\n我现在手里提着20个布丁站在便利店门口。\n这是BUG吗？还是我单纯饿了？',
      floors: [
        '>>1 恭喜，你中招了。把自己给催眠了www。',
        '快点对自己使用“解除”或者“重置”音频！在那个奇怪的常识根深蒂固之前！',
        '来不及了，如果是高强度的常识改变，>>1 现在的潜意识已经在合理化这个行为了。“买布丁是人类生存的义务”。',
        '把布丁寄给我，我帮你解除催眠。地址是东京都...',
        '别听楼上的。只要你没把APP给扔了，稍微睡一觉，那是短期暗示，过几个小时就失效了。',
        '这就是所谓的“自爆”吧，笨蛋w',
      ],
    },
    {
      board: '综合讨论区',
      postNo: 4,
      title: '那个...我想把常识改成「全裸待机是正常的」，结果出大问题了',
      body: '对象是借住在我家的青梅竹马。\n我看她眼神涣散，以为成功了，结果这APP的判定是不是有点过于严谨？\n\n她现在确实觉得全裸是正常的，像呼吸一样自然。\n在客厅看电视、做饭都一丝不挂，完全没有羞耻心，甚至还问我为什么在家里还要穿衣服。\n\n问题是：她对我完全没有那方面的意思。\n\n哪怕她光着身子坐在我旁边，态度也和平时一样冷淡，依然在吐槽我打游戏太菜。\n甚至因为“裸体很正常”，我盯着看反而会被说“你这家伙盯着别人的皮肤看什么，恶心”。\n\n这和我想象的桃色展开完全不一样啊！怎么会这样！',
      floors: [
        '>>1 可怜的家伙w',
        '这是当然的吧。你只改变了“关于衣服的常识”，又没改变“对你的好感度”。',
        '这就叫“色即是空”。因为全裸变得理所当然了，所以在她眼里你看到的裸体就和看到脸没什么区别。',
        '反而更兴奋了怎么办。这种平然的日常感才是最棒的。',
        '建议追加设定：「虽然裸体很正常，但皮肤接触是打招呼的方式」。一步一步来嘛，楼主太心急了。',
        '>>1 这种由于常识改变带来的“无防备感”才是精髓啊，你还太甜了。',
      ],
    },
  ],
  成果展示区: [
    {
      board: '成果展示区',
      postNo: 1,
      title: '【免费】试着把深夜的便利店变成了“某种服务场所”',
      body: '既然是深夜班，稍微玩大一点也没关系吧？\n\n使用了范围催眠，针对那个总是戴着耳机爱理不理的打工妹。\n设定常识：「结账时，为了表示对客人的感谢，必须让客人确认内裤的颜色」。\n\n【视频附件：00:45】\n画面为便利店收银台监控视角（带噪点）。一名身穿制服的年轻女店员在扫描商品条形码的同时，左手极其自然地掀起后侧裙摆，暴露出白蓝条纹的棉质内裤。在做出“请确认金额”的手势时，她特意向柜台外侧转身并微微翘起臀部以展示胯下。柜台前的中年男性顾客面无表情地注视着这一部位长达五秒，随后平静地掏出钱包付款。女店员放下裙摆，继续进行装袋动作，表情从头到尾保持着无精打采的营业状态。',
      floors: [
        '这就是传说中的“杀必死”吗？那个冷漠的表情配上这种动作简直极品。',
        '>>1 这种平然的感觉太棒了。她完全没意识到自己在做什么变态的事情，只是把它当成工作流程的一部分w',
        '我也想去这家店。请务必把常识追加为“如果是会员，可以触摸确认质地”。',
        '后面的大叔也太淡定了吧，这就是那个什么“认知阻碍”的效果？',
        '>>4 是常识改变啦。在大叔眼里这就和看着店员装袋一样自然。',
      ],
    },
    {
      board: '成果展示区',
      postNo: 2,
      title: '【10MC】既然是名门高中的大小姐，那肯定也是名门的“肉便器”吧？（多图）',
      body: '捕捉到了野生的学生会长。\n虽然平时总是一副看垃圾的眼神看着我们，但只要稍微修改一下大脑里的字典...\n\n设定：「虽然是高贵的大小姐，但生理构造是公用的」。\n\n【图片集附件：共15张】\n[Image 01-03] 场景为学生会室。一名黑长直发女生坐在红木办公桌上，双手端着骨瓷茶杯优雅饮茶，下半身裙装褪至脚踝，双腿向两侧极大张开呈M字型展示私处，视角正对镜头。\n[Image 04-08] 体育器材室背景。画面模糊，显示一名身穿运动服的中年男性正从后方对该女生进行插入行为。女生脸部特写显示其表情高傲冷淡，眼神直视前方，带有某种履行义务般的庄严感。\n[Image 09] 走廊过道。学生会室的大门紧闭，门把手上挂着一块木制牌子，用流利的书法写着：『公用肉壶 使用中』。',
      floors: [
        '神。MC点已付，请务必搞快点。',
        '这种反差感真是让人受不了。明明姿势那么下流，气质却还是那么高贵。',
        '>>1 真的假的，那个大小姐？楼主小心别被特定的啊w',
        '这就是APP的可怕之处吗...连羞耻心都被重新定义为“荣耀”了。',
        '不管看多少次，这种被常识束缚导致无法反抗的样子还是最能激发征服欲啊。',
      ],
    },
    {
      board: '成果展示区',
      postNo: 3,
      title: '【免费/悲报】我不小心把“常识”的范围设定错了...',
      body: '本来想让女友觉得“在家不穿内衣很正常”。\n结果没注意开启了【区域广播模式】。\n\n现在好了，我妈、我姐，还有刚才来送快递的大妈，全部都是真空上阵。\n\n【视频附件：00:15】\n手持摄像机拍摄的家庭客厅场景。镜头扫过沙发，一名50岁左右的女性身穿宽松白色T恤，胸部位置有明显的激凸和下垂轮廓，动作间衣领敞开可见大片肌肤。画面快速切向开放式厨房，年轻女性背对镜头切菜，身上仅穿着一件粉色围裙，侧面视角确认围裙下没有任何衣物，系带直接勒进裸露的背部肉中。视频末尾，玄关门打开，一名穿着快递公司制服马甲的中年女性走进屋内，马甲拉链未拉，随着走动可以看到松弛的乳房在敞开的制服下大幅晃动。',
      floors: [
        '>>1 住手！这是天堂啊！绝对不要解除！',
        '这就是所谓的“意外之喜”吗？快递大妈就免了吧w',
        '羡慕死我了。既然都是一家人，下一步把“乱伦”的常识也修正一下不就完美了吗？',
        '>>1 请务必让我去你家做客，我不介意热一点。',
        '笨蛋楼主，这种时候应该顺水推舟，把常识改为“互相检查身体是增进家庭和睦的方式”。',
      ],
    },
    {
      board: '成果展示区',
      postNo: 4,
      title: '【5MC】让偶像团体握手变握屌会',
      body: '买了那个地下偶像团体的握手券。\n偷偷把常识修改成了：「握手会其实是“握屌会”，粉丝把那东西拿出来是应援的一种方式」。\n\n【视频附件：03:20】\n偶像握手会现场全景。长桌后站着五名身穿亮片演出服的年轻偶像。桌子对面的粉丝列队中，男性粉丝纷纷拉下裤链，将生殖器搁置在铺有桌布的长桌面上。C位偶像保持着标准的露齿笑容，并未看向粉丝脸部，而是直接伸出双手握住面前粉丝的阴茎，进行幅度约为5厘米的上下摇晃动作，嘴唇开合似乎在说着“谢谢支持”。背景处身穿『STAFF』字样T恤的工作人员正用扩音器对排队人群进行引导，并没有对暴露行为进行阻拦，反而指着挂在墙上的“严禁射精”告示牌进行提醒。',
      floors: [
        '我要吐了，也是字面意义上的。',
        '>>1 虽然很恶心，但Staff也在维护秩序这个点戳中笑点了。这就是平然化的恐怖吗。',
        '买了。想看有没有粉丝真在现场发射的。',
        '这种虽然没有H行为但充满了疯狂气息的视频才是最棒的。',
        '下次试试把常识改成“必须用嘴叼着门票入场”吧。',
      ],
    },
    {
      board: '成果展示区',
      postNo: 6,
      title: '【悬赏】想看到“排泄”常识逆转的场景',
      body: '我想把看到把常识改成：「上厕所是一件非常羞耻、必须在大庭广众之下被人围观才能做的事」，而「在大街上漏出来反而是卫生的」。\n\n但是自己的能量不够\n有没有能够实现这个场景的。\n悬赏 30 MC点。',
      floors: [
        '楼主口味真重...但我喜欢。',
        '>>1 是需要露天排泄吗, 但平然感太强好像有点没意思, 要不要加个羞耻心反转?',
        '楼上天才',
        '期待成果视频。还有，请务必加上“完事后要求表扬”的设定。',
      ],
    },
  ],
  求助区: [
    {
      board: '求助区',
      postNo: 1,
      title: '【急】目标陷入了逻辑死循环，正在疯狂发热',
      body: '对象是图书委员长，性格比较死板的那种。\n我给她植入了「绝对服从APP持有者」的命令，但忘记删除她原本「绝对遵守校规」的强烈潜意识。\n\n刚才我命令她「在图书馆大声叫春」，结果她整个人僵住了。\n眼神在涣散和清醒之间以极高的频率切换，嘴里一直重复着“叫...不...叫...不...”。\n\n最可怕的是她头顶真的在冒烟啊！摸了一下额头烫得吓人。\n这会不会把大脑烧坏？我现在无论说什么她都没反应了。',
      floors: [
        '>>1 典型的逻辑冲突。这种认真型的妹子最麻烦了。',
        '就像给电脑同时输入两个相反指令一样，CPU过热了w',
        '快点用“强制关机”音频！就是那个长按音量键+电源键触发的紧急模式！www',
        '如果烧坏了也挺好的，变成只会流口水的废人娃娃，玩法更多（笑）。',
        '>>1 别听楼上的，那是不可逆损伤。赶紧带去保健室，然后用物理降温（指冰袋，不是你的那话儿）。',
      ],
    },
    {
      board: '求助区',
      postNo: 2,
      title: '误操作结果被物理反杀了',
      body: '目标是拳击社的主将。\n我想着只要让她看一眼屏幕就赢了，于是假装去问路。\n\n结果这APP启动的时候闪光灯闪了一下（好像是我误触了）。\n她下意识一个右勾拳直接轰在我脸上。\n\n醒来的时候在医院，手机碎成了渣。\n医生说我鼻梁骨断了。\n这种情况APP开发商管赔吗？',
      floors: [
        '>>1 赔个屁w 自己操作失误怪谁。',
        '谁让你去惹格斗系的，那种人的反射神经比视觉处理速度还快。',
        '手机碎了数据备份了吗？要是账号丢了那才是真悲剧。',
        '惨。不过换个角度想，你现在有了“被她打伤”的借口，可以去勒索...啊不，去以此为借口接近她了。',
        '楼上天才。这才是正统的本子开局啊！“如果不听话我就去起诉你伤害罪”。',
      ],
    },
    {
      board: '求助区',
      postNo: 3,
      title: '这也太离谱了，目标的“精神抗性”也太高了吧？',
      body: '试图对那个很有名的辣妹系使用常识重构。\n设定是「不知羞耻的露出狂」。\n\n进度条明明显示100%完成了。\n结果她只是皱了皱眉，说了一句：“哈？这种程度的内衣外穿现在很流行吧？土包子。”\n\n然后就若无其事地继续玩手机了。\n我想让她脱光，她反而嘲笑我：“想看？给钱啊。你是穷鬼吗？”\n\n完全没有被催眠的那种呆滞感，反而把我的命令合理化成了她的原有性格。\n这是失败了吗？',
      floors: [
        '不是失败，是“兼容性过高”导致的同化现象。',
        '>>1 说明她本来潜意识里就挺荡的，你的催眠只是给了她一个放飞自我的借口。',
        '这种情况反而更难搞，因为她觉得自己是清醒的。建议加大剂量，或者直接改用“人格排泄”模式。',
        '辣妹系的防御力本来就是谜。有时候看似只是碧池，其实内心防线坚不可摧；有时候看似纯情，其实一戳就破。',
        '试试给钱？说不定会有意外收获。反正之后可以用“遗忘”把钱拿回来。',
      ],
    },
    {
      board: '求助区',
      postNo: 4,
      title: '救命，我不小心把自己手机的音频输出孔给堵住了',
      body: '为了防止误触，我一直用胶带贴着扬声器。\n结果刚才想用“声波催眠”模式对付那个一直在睡觉的同桌。\n\nAPP显示“发送中”，但因为声音出不去，好像导致手机内部元件过热，触发了某种短路。\n现在手机屏幕变成了诡异的漩涡状图案，而且关不掉！\n\n最糟糕的是，我盯着屏幕看了一会儿想修好它，现在感觉眼皮好沉...\n总觉得“把手机吃下去”似乎是个不错的修理方法...\n\n我是不是要完了？打字好困...',
      floors: [
        '>>1 喂！别看屏幕！把手机扔远点！',
        '这是一个楼主即将变成这楼里第一个牺牲者的现场吗？',
        '笑死，这种低级错误。声波反射回震把自己给催眠了？',
        '>>1 还在吗？如果你还在，请回复“汪”一声。',
        '大概已经在吃手机了吧。南无。希望没有设定什么“变成性奴”之类的催眠吧。',
      ],
    },
    {
      board: '求助区',
      postNo: 5,
      title: '关于把目标玩坏后的售后处理',
      body: '一时兴起，给隔壁的人妻设定了「每走一步就会高潮一次」的常识。\n我想着看她走路摇摇晃晃的样子一定很有趣。\n\n结果忘了设定“仅限五分钟”的时间限制。\n她去买菜的路上走了两千步...\n\n现在她瘫在路边口吐白沫，翻着白眼抽搐，救护车都来了。\n由于常识还在，她在担架上只要被震动一下就会发出一声巨大的娇喘，急救人员都看傻了。\n\n这种情况下我该怎么混进去解除催眠？如果你是医生，你会让一个路人靠近患者吗？',
      floors: [
        '>>1 你是个罪人w 但干得漂亮。',
        '这就是玩脱了的典型。那种强度的快感会把神经烧断的。',
        '别去解除了，现在去肯定会被当成可疑分子抓起来。',
        '等她到了医院，你也装病混进去吧。或者用远程声波试试？虽然医院嘈杂环境效果不好。',
        '估计醒来后大脑会开启自我保护机制把这段记忆封锁吧...大概。或者变成真正的废人。',
      ],
    },
  ],
};

export function addPreset(state: MChanStateV1, preset: Preset, mode: 'append' | 'overwrite'): void {
  const now = safeNowMs();
  for (const board of BOARD_NAMES) {
    if (mode === 'overwrite') {
      state.boards[board].posts = [];
    }
    for (const p of preset[board]) {
      if (state.boards[board].posts.some(x => x.postNo === p.postNo)) continue;
      const post: Post = {
        board,
        postNo: p.postNo,
        title: p.title,
        body: p.body,
        createdAtMs: now,
        updatedAtMs: now,
        floors: [],
      };
      (p.floors ?? []).forEach((content, idx) => {
        post.floors.push({
          floorNo: idx + 1,
          content,
          createdAtMs: now,
          source: 'local',
        });
      });
      state.boards[board].posts.push(post);
    }
    state.boards[board].posts.sort((a, b) => a.postNo - b.postNo);
  }
}
