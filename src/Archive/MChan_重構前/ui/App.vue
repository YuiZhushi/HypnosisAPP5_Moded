<template>
  <div class="bbs">
    <header class="bbs__header">
      <div class="bbs__brand">
        <span class="bbs__logo">MChan</span>
        <span class="bbs__sep">/</span>
        <span class="bbs__tagline">anonymous board</span>
      </div>
      <div class="bbs__status" v-if="syncStatus">{{ syncStatus }}</div>
      <div class="bbs__actions">
        <button class="bbs__link" type="button" @click="toggleTools()">{{ toolsOpen ? '关闭工具' : '工具' }}</button>
      </div>
    </header>

    <nav class="bbs__nav" aria-label="boards">
      <button
        v-for="b in BOARD_NAMES"
        :key="b"
        type="button"
        class="bbs__navItem"
        :class="{ 'bbs__navItem--active': selectedBoard === b }"
        @click="selectBoard(b)"
      >
        <span class="bbs__navText">{{ b }}</span>
        <span class="bbs__navCount">({{ state.boards[b].posts.length }})</span>
      </button>
    </nav>

    <section v-if="toolsOpen" class="bbs__tools">
      <details>
        <summary>导入/导出（localStorage）</summary>
        <div class="bbs__toolsBody">
          <div class="bbs__field">
            <div class="bbs__label">导出</div>
            <textarea class="bbs__textarea" rows="6" readonly :value="exportJson"></textarea>
          </div>
          <div class="bbs__field">
            <div class="bbs__label">导入（会覆盖当前数据）</div>
            <textarea v-model="importJson" class="bbs__textarea" rows="5"></textarea>
            <div class="bbs__row">
              <button class="bbs__btn bbs__btn--danger" type="button" @click="doImport()">导入并覆盖</button>
              <button class="bbs__btn" type="button" @click="importJson = ''">清空</button>
            </div>
          </div>
        </div>
      </details>
    </section>

    <main class="bbs__main" aria-label="content">
      <section v-if="view.mode === 'board'" class="bbs__board">
        <div class="bbs__boardTop">
          <div class="bbs__boardTitle">{{ selectedBoard }}</div>
          <button class="bbs__btn bbs__btn--primary" type="button" @click="requestAiNewThread()">刷新</button>
          <button class="bbs__btn" type="button" @click="view = { mode: 'newThread' }">发新串</button>
        </div>

        <div class="bbs__listHead">
          <span class="bbs__colNo">No</span>
          <span class="bbs__colSubj">Subject</span>
          <span class="bbs__colR">R</span>
          <span class="bbs__colUpd">Updated</span>
        </div>

        <div v-if="posts.length === 0" class="bbs__empty">暂无帖子（预制帖子会在代码层面提供；此板块当前为空）。</div>

        <button
          v-for="p in posts"
          :key="postKey(p)"
          type="button"
          class="bbs__rowItem"
          @click="openThread(p.board, p.postNo)"
        >
          <span class="bbs__colNo">#{{ p.postNo }}</span>
          <span class="bbs__colSubj">
            <span class="bbs__subject">{{ p.title }}</span>
            <span v-if="p.body" class="bbs__snippet">{{ p.body }}</span>
          </span>
          <span class="bbs__colR">{{ p.floors.length }}</span>
          <span class="bbs__colUpd">{{ formatTime(p.updatedAtMs) }}</span>
        </button>
      </section>

      <section v-else-if="view.mode === 'thread'" class="bbs__thread">
        <div class="bbs__threadTop">
          <button class="bbs__link" type="button" @click="view = { mode: 'board' }">← 返回</button>
          <div class="bbs__crumb">
            <span class="bbs__crumbBoard">{{ view.board }}</span>
            <span class="bbs__sep">/</span>
            <span class="bbs__mono">{{ view.board }}帖子{{ view.postNo }}</span>
          </div>
        </div>

        <div v-if="thread" class="bbs__op">
          <div class="bbs__opHead">
            <span class="bbs__subject">{{ thread.title }}</span>
            <span class="bbs__meta">
              No.{{ thread.postNo }} · {{ formatTime(thread.createdAtMs) }} · replies {{ thread.floors.length }}
            </span>
          </div>
          <div v-if="thread.body" class="bbs__opBody">{{ thread.body }}</div>
        </div>

        <div v-if="thread" class="bbs__replies">
          <div v-if="thread.floors.length === 0" class="bbs__empty">暂无回复</div>
          <article v-for="f in thread.floors" :key="f.floorNo" class="bbs__reply">
            <header class="bbs__replyHead">
              <span class="bbs__replyNo">No.{{ f.floorNo }}</span>
              <span class="bbs__replyMeta">{{ formatTime(f.createdAtMs) }}</span>
              <button class="bbs__replyBtn" type="button" @click="beginReplyTo(f.floorNo)">回复</button>
            </header>
            <div class="bbs__replyBody">{{ f.content }}</div>
          </article>
        </div>

        <div v-if="thread" class="bbs__composer">
          <div class="bbs__composerTitle">Reply</div>
          <div v-if="replyToFloorNo !== null" class="bbs__hint">
            replying to <span class="bbs__mono">No.{{ replyToFloorNo }}</span>
            <button class="bbs__link" type="button" @click="clearReplyTo()">取消引用</button>
          </div>
          <div class="bbs__field">
            <div class="bbs__label">你的回帖内容（将作为新楼层直接发布）</div>
            <textarea ref="replyTextareaEl" v-model="replyText" class="bbs__textarea" rows="4"></textarea>
          </div>
          <div class="bbs__field">
            <div class="bbs__label">跟帖要求（可留空）</div>
            <textarea v-model="replyAiHint" class="bbs__textarea" rows="3"></textarea>
          </div>
          <div class="bbs__row">
            <button class="bbs__btn bbs__btn--primary" type="button" @click="sendReplyAndLetAiFollow(thread)">
              回帖
            </button>
            <button class="bbs__btn" type="button" @click="replyText = ''">清空</button>
          </div>
        </div>
      </section>

      <section v-else-if="view.mode === 'newThread'" class="bbs__newThread">
        <div class="bbs__threadTop">
          <button class="bbs__link" type="button" @click="view = { mode: 'board' }">← 返回</button>
          <div class="bbs__crumb">
            <span class="bbs__crumbBoard">{{ selectedBoard }}</span>
            <span class="bbs__sep">/</span>
            <span>发新串</span>
          </div>
        </div>

        <div class="bbs__composer">
          <div class="bbs__composerTitle">New Thread</div>
          <div class="bbs__field">
            <div class="bbs__label">标题（Subject）</div>
            <input v-model="newThreadTitle" class="bbs__input" type="text" />
          </div>
          <div class="bbs__field">
            <div class="bbs__label">正文（OP）</div>
            <textarea v-model="newThreadBody" class="bbs__textarea" rows="7"></textarea>
          </div>
          <div class="bbs__row">
            <button class="bbs__btn bbs__btn--primary" type="button" @click="sendNewThreadPrompt()">发布</button>
            <button class="bbs__btn" type="button" @click="clearNewThread()">清空</button>
          </div>
        </div>
      </section>
    </main>

    <footer class="bbs__footer">
      <span class="bbs__mono">storage: localStorage</span>
      <span class="bbs__sep">·</span>
      <span class="bbs__mono">scope: chat</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import {
  BOARD_NAMES,
  DEFAULT_PRESET,
  applyParsedBlocks,
  appendFloor,
  buildAiFollowupPrompt,
  buildNewPostPrompt,
  getBoardPosts,
  getNextFloorNo,
  getNextPostNo,
  loadState,
  parseTaggedBlocks,
  saveState,
  sendPromptToTavern,
  type BoardName,
  type Post,
} from '../core/mchan';

type ViewState =
  | { mode: 'board' }
  | { mode: 'newThread' }
  | { mode: 'thread'; board: BoardName; postNo: number };

const selectedBoard = ref<BoardName>('综合讨论区');
const view = ref<ViewState>({ mode: 'board' });

const state = ref(loadState());

const toolsOpen = ref(false);
const syncStatus = ref('');

const posts = computed(() => getBoardPosts(state.value, selectedBoard.value));

const thread = computed(() => {
  if (view.value.mode !== 'thread') return undefined;
  return state.value.boards[view.value.board].posts.find(p => p.postNo === view.value.postNo);
});

function postKey(p: Post): string {
  return `${p.board}:${p.postNo}`;
}

function selectBoard(b: BoardName) {
  selectedBoard.value = b;
  view.value = { mode: 'board' };
}

function openThread(board: BoardName, postNo: number) {
  view.value = { mode: 'thread', board, postNo };
}

function toggleTools() {
  toolsOpen.value = !toolsOpen.value;
}

let saveTimer: number | undefined;
function scheduleSave() {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveState(state.value);
  }, 200);
}
watch(state, scheduleSave, { deep: true });

function ensurePresetPostsExist() {
  let added = 0;
  for (const board of BOARD_NAMES) {
    for (const p of DEFAULT_PRESET[board]) {
      if (state.value.boards[board].posts.some(x => x.postNo === p.postNo)) continue;
      const now = Date.now();
      state.value.boards[board].posts.push({
        board,
        postNo: p.postNo,
        title: p.title,
        body: p.body,
        createdAtMs: now,
        updatedAtMs: now,
        floors: (p.floors ?? []).map((content, idx) => ({
          floorNo: idx + 1,
          content,
          createdAtMs: now,
          source: 'local',
        })),
      });
      added += 1;
    }
    state.value.boards[board].posts.sort((a, b) => a.postNo - b.postNo);
  }
  if (added > 0) scheduleSave();
}

function parseThisFloorTags() {
  const messageId = getCurrentMessageId();
  const msg = getChatMessages(messageId)[0];
  if (!msg) return;

  const blocks = parseTaggedBlocks(msg.message);
  if (blocks.length === 0) return;

  const { createdPosts, appendedFloors } = applyParsedBlocks(state.value, blocks, 'ai', messageId);
  if (createdPosts > 0 || appendedFloors > 0) {
    scheduleSave();
    syncStatus.value = `synced +${createdPosts} threads, +${appendedFloors} replies`;
  }
}

function parseAssistantMessage(messageId: number) {
  const msg = getChatMessages(messageId)[0];
  if (!msg || msg.role !== 'assistant') return;
  const blocks = parseTaggedBlocks(msg.message);
  if (blocks.length === 0) return;
  const { createdPosts, appendedFloors } = applyParsedBlocks(state.value, blocks, 'ai', messageId);
  if (createdPosts > 0 || appendedFloors > 0) {
    scheduleSave();
    syncStatus.value = `synced +${createdPosts} threads, +${appendedFloors} replies`;
  }
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

const replyText = ref('');
const replyAiHint = ref('');
const replyToFloorNo = ref<number | null>(null);
const replyTextareaEl = ref<HTMLTextAreaElement | null>(null);

function beginReplyTo(floorNo: number) {
  replyToFloorNo.value = floorNo;
  const prefix = `>>No.${floorNo}\n`;
  if (!replyText.value.startsWith(prefix)) replyText.value = prefix + replyText.value;
  nextTick(() => {
    replyTextareaEl.value?.focus();
  });
}

function clearReplyTo() {
  replyToFloorNo.value = null;
}

async function sendReplyAndLetAiFollow(p: Post) {
  let content = replyText.value.trim();
  if (!content) {
    toastr.warning('请先输入你的回帖内容');
    return;
  }

  if (replyToFloorNo.value !== null && !content.includes(`>>No.${replyToFloorNo.value}`)) {
    content = `>>No.${replyToFloorNo.value}\n${content}`;
  }

  appendFloor(p, {
    content,
    createdAtMs: Date.now(),
    source: 'user',
    originKey: `user:${Date.now()}`,
  });
  scheduleSave();

  const lastFloorNo = getNextFloorNo(p) - 1;
  const prompt = buildAiFollowupPrompt({
    post: {
      board: p.board,
      postNo: p.postNo,
      title: p.title,
      body: p.body,
      floors: p.floors.map(f => ({ floorNo: f.floorNo, content: f.content })),
    },
    lastFloorNo,
    aiFloorsToGenerate: 1,
    aiStyleHint: replyAiHint.value,
  });
  await sendPromptToTavern(prompt);
  replyText.value = '';
  replyToFloorNo.value = null;
}

const newThreadTitle = ref('');
const newThreadBody = ref('');

async function requestAiNewThread() {
  const board = selectedBoard.value;
  const postNo = getNextPostNo(state.value, board);
  const prompt = buildNewPostPrompt({
    board,
    postNo,
    userInstruction: `请在该板块生成一个新的真实匿名版帖子（口吻像 2ch/4chan），标题要像用户自拟的主题，正文与首楼要有具体内容。`,
  });
  await sendPromptToTavern(prompt);
}

async function sendNewThreadPrompt() {
  const board = selectedBoard.value;
  const postNo = getNextPostNo(state.value, board);
  const title = newThreadTitle.value.trim();
  const body = newThreadBody.value.trim();
  if (!title) {
    toastr.warning('请先输入标题');
    return;
  }

  const now = Date.now();
  const post: Post = { board, postNo, title, body, createdAtMs: now, updatedAtMs: now, floors: [] };
  state.value.boards[board].posts.push(post);
  state.value.boards[board].posts.sort((a, b) => a.postNo - b.postNo);
  scheduleSave();
  view.value = { mode: 'thread', board, postNo };

  const prompt = buildAiFollowupPrompt({
    post: { board, postNo, title, body, floors: [] },
    lastFloorNo: 0,
    aiFloorsToGenerate: 1,
    aiStyleHint: '请直接回应OP正文内容，不要生成新帖。',
  });
  await sendPromptToTavern(prompt);

  clearNewThread();
}

function clearNewThread() {
  newThreadTitle.value = '';
  newThreadBody.value = '';
}

const exportJson = computed(() => JSON.stringify(state.value, null, 2));
const importJson = ref('');

function doImport() {
  const ok = window.confirm('确定导入并覆盖当前匿名版数据？');
  if (!ok) return;
  try {
    const next = JSON.parse(importJson.value);
    if (!next || typeof next !== 'object' || (next as any).version !== 1) {
      toastr.error('导入失败：JSON格式不正确或版本不匹配');
      return;
    }
    state.value = next as any;
    scheduleSave();
    toastr.success('导入成功');
  } catch {
    toastr.error('导入失败：无法解析JSON');
  }
}

onMounted(() => {
  ensurePresetPostsExist();
  parseThisFloorTags();

  const myId = getCurrentMessageId();
  eventOn(tavern_events.MESSAGE_UPDATED, messageId => {
    if (Number(messageId) !== myId) return;
    parseThisFloorTags();
  });
  eventOn(tavern_events.MESSAGE_SWIPED, messageId => {
    if (Number(messageId) !== myId) return;
    parseThisFloorTags();
  });

  eventOn(tavern_events.GENERATION_ENDED, messageId => {
    parseAssistantMessage(Number(messageId));
  });

  eventOn(tavern_events.CHAT_CHANGED, () => {
    window.location.reload();
  });
});
</script>

<style lang="scss" scoped>
.bbs {
  border: 1px solid rgba(230, 215, 255, 0.12);
  border-radius: 10px;
  background: rgba(18, 6, 31, 0.98);
  padding: 10px;
}

.bbs__header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(230, 215, 255, 0.10);
}

.bbs__brand {
  font-family: var(--mchan-font-mono);
  font-size: 12px;
  color: rgba(244, 238, 255, 0.86);
}

.bbs__logo {
  font-weight: 700;
  letter-spacing: 0.06em;
}

.bbs__tagline {
  color: rgba(244, 238, 255, 0.60);
}

.bbs__sep {
  opacity: 0.7;
  padding: 0 4px;
}

.bbs__status {
  font-family: var(--mchan-font-mono);
  font-size: 11px;
  color: rgba(182, 108, 255, 0.92);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bbs__actions {
  margin-left: auto;
}

.bbs__link {
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  color: rgba(244, 238, 255, 0.70);
  font-family: var(--mchan-font-mono);
  font-size: 12px;
  text-decoration: underline;
}

.bbs__nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 0;
}

.bbs__navItem {
  border: 1px solid rgba(230, 215, 255, 0.10);
  background: rgba(0, 0, 0, 0.14);
  color: rgba(244, 238, 255, 0.75);
  font-family: var(--mchan-font-mono);
  font-size: 12px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
}

.bbs__navItem--active {
  border-color: rgba(182, 108, 255, 0.45);
  color: rgba(244, 238, 255, 0.92);
}

.bbs__navCount {
  opacity: 0.75;
  margin-left: 4px;
}

.bbs__tools {
  border: 1px solid rgba(230, 215, 255, 0.10);
  border-radius: 8px;
  padding: 8px;
  margin: 2px 0 10px;
  background: rgba(0, 0, 0, 0.16);
  font-size: 12px;
  color: rgba(244, 238, 255, 0.78);
}

.bbs__toolsBody {
  margin-top: 8px;
}

.bbs__main {
  font-size: 13px;
}

.bbs__boardTop,
.bbs__threadTop {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0 10px;
}

.bbs__boardTitle {
  font-family: var(--mchan-font-display);
  font-size: 16px;
}

.bbs__crumb {
  color: rgba(244, 238, 255, 0.70);
  font-family: var(--mchan-font-mono);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bbs__crumbBoard {
  color: rgba(244, 238, 255, 0.88);
}

.bbs__mono {
  font-family: var(--mchan-font-mono);
}

.bbs__listHead {
  display: grid;
  grid-template-columns: 64px 1fr 48px 120px;
  gap: 8px;
  padding: 6px 8px;
  border-top: 1px solid rgba(230, 215, 255, 0.10);
  border-bottom: 1px solid rgba(230, 215, 255, 0.10);
  background: rgba(0, 0, 0, 0.16);
  font-family: var(--mchan-font-mono);
  font-size: 12px;
  color: rgba(244, 238, 255, 0.70);
}

.bbs__rowItem {
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: grid;
  grid-template-columns: 64px 1fr 48px 120px;
  gap: 8px;
  padding: 8px 8px;
  border-bottom: 1px solid rgba(230, 215, 255, 0.08);
}

.bbs__rowItem:hover {
  background: rgba(182, 108, 255, 0.07);
}

.bbs__colNo,
.bbs__colR,
.bbs__colUpd {
  font-family: var(--mchan-font-mono);
  font-size: 12px;
  color: rgba(244, 238, 255, 0.70);
}

.bbs__colSubj {
  min-width: 0;
}

.bbs__subject {
  display: block;
  color: rgba(244, 238, 255, 0.92);
  font-weight: 650;
}

.bbs__snippet {
  display: block;
  margin-top: 4px;
  color: rgba(244, 238, 255, 0.62);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bbs__empty {
  padding: 12px 8px;
  color: rgba(244, 238, 255, 0.60);
  border-bottom: 1px solid rgba(230, 215, 255, 0.08);
}

.bbs__op {
  border: 1px solid rgba(230, 215, 255, 0.10);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.16);
  padding: 10px;
}

.bbs__opHead {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bbs__meta {
  font-family: var(--mchan-font-mono);
  font-size: 11px;
  color: rgba(244, 238, 255, 0.62);
}

.bbs__opBody {
  margin-top: 10px;
  white-space: pre-wrap;
  line-height: 1.55;
  color: rgba(244, 238, 255, 0.84);
  overflow-wrap: anywhere;
}

.bbs__replies {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bbs__reply {
  border: 1px solid rgba(230, 215, 255, 0.08);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.12);
  padding: 10px;
}

.bbs__replyHead {
  display: flex;
  justify-content: flex-start;
  gap: 10px;
  font-family: var(--mchan-font-mono);
  font-size: 11px;
  color: rgba(244, 238, 255, 0.62);
  align-items: baseline;
}

.bbs__replyNo {
  color: rgba(182, 108, 255, 0.90);
}

.bbs__replyMeta {
  margin-left: auto;
}

.bbs__replyBtn {
  border: 1px solid rgba(230, 215, 255, 0.10);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.16);
  color: rgba(244, 238, 255, 0.72);
  font-family: var(--mchan-font-mono);
  font-size: 11px;
  padding: 4px 8px;
  cursor: pointer;
}

.bbs__replyBtn:hover {
  background: rgba(182, 108, 255, 0.08);
  border-color: rgba(182, 108, 255, 0.25);
}

.bbs__replyBody {
  margin-top: 8px;
  white-space: pre-wrap;
  line-height: 1.55;
  color: rgba(244, 238, 255, 0.86);
  overflow-wrap: anywhere;
}

.bbs__composer {
  margin-top: 12px;
  border: 1px solid rgba(230, 215, 255, 0.10);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.16);
  padding: 10px;
}

.bbs__composerTitle {
  font-family: var(--mchan-font-display);
  font-size: 14px;
  margin-bottom: 10px;
}

.bbs__field {
  margin-bottom: 10px;
}

.bbs__label {
  font-family: var(--mchan-font-mono);
  font-size: 11px;
  color: rgba(244, 238, 255, 0.65);
  margin-bottom: 6px;
}

.bbs__input,
.bbs__textarea {
  width: 100%;
  border: 1px solid rgba(230, 215, 255, 0.14);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.16);
  color: rgba(244, 238, 255, 0.90);
  padding: 8px;
  font-family: var(--mchan-font-ui);
  font-size: 13px;
}

.bbs__textarea {
  resize: vertical;
}

.bbs__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.bbs__btn {
  border: 1px solid rgba(230, 215, 255, 0.12);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.16);
  color: rgba(244, 238, 255, 0.85);
  font-family: var(--mchan-font-mono);
  font-size: 12px;
  padding: 8px 10px;
  cursor: pointer;
}

.bbs__btn--primary {
  border-color: rgba(182, 108, 255, 0.45);
  background: rgba(182, 108, 255, 0.10);
}

.bbs__btn--danger {
  border-color: rgba(255, 91, 200, 0.40);
  background: rgba(255, 91, 200, 0.08);
}

.bbs__hint {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(244, 238, 255, 0.60);
}

.bbs__footer {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(230, 215, 255, 0.10);
  font-size: 11px;
  color: rgba(244, 238, 255, 0.55);
}

@media (max-width: 520px) {
  .bbs__listHead,
  .bbs__rowItem {
    grid-template-columns: 56px 1fr 40px 0px;
  }

  .bbs__colUpd {
    display: none;
  }
}
</style>
  const lastFloorNo = getNextFloorNo(p) - 1;
