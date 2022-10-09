import { createApp } from 'vue';
import { VuesticPlugin } from 'vuestic-ui';
import App from './App.vue';
import 'vuestic-ui/dist/vuestic-ui.css'
import './styles/main.css'
import { store } from './store';
let { NODE_ENV, STANDALONE } = process.env;
console.log('is standalone?', STANDALONE, NODE_ENV)
if (!STANDALONE) {
  const extenstion = document.createElement('div');
  extenstion.id = 'extensionMount';
  const mainBody = document.getElementsByTagName('body')[0];
  mainBody.appendChild(extenstion);
}

const app = createApp(App);
app.use(store);
app.use(VuesticPlugin);

if (!process.env.STANDALONE) {
  app.mount("#extensionMount");
} else {
  app.mount("#app");
}