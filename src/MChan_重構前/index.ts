import App from './ui/App.vue';
import './index.scss';
import { installConsoleBridge, logRuntime } from '../util/logger';

function init() {
  createApp(App).mount('#app');
}

$(() => {
  // 初始化統一分級 logger（硬編碼等級由 logger.ts 管理）
  installConsoleBridge({ source: 'MChan' });
  logRuntime('MChan 入口初始化', [], { source: 'MChan', key: true });

  errorCatched(init)();
});
