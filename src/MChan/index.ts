import App from './ui/App.vue';
import './index.scss';

function init() {
  createApp(App).mount('#app');
}

$(() => {
  errorCatched(init)();
});
