import './styles/main.css'
import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router'
import { VuesticPlugin } from 'vuestic-ui';
import 'vuestic-ui/dist/vuestic-ui.css'
import Main from './shared/components/Main.vue';
import Extension from './Extension.vue';
import Site from './Site.vue';
import Router from './Router.vue'
import { store } from './store';
let { STANDALONE } = process.env;

globalThis.__VUE_OPTIONS_API__ = true;
globalThis.__VUE_PROD_DEVTOOLS__ = false;

if (!STANDALONE) {
  /**
   * Extension initialization
   */
  const extenstion = document.createElement('div');
  extenstion.id = 'extensionMount';
  const mainBody = document.getElementsByTagName('body')[0];
  mainBody.appendChild(extenstion);

  const app = createApp(Extension);
  app.use(store);
  app.use(VuesticPlugin);
  app.mount("#extensionMount");
} else {
  /**
   * Standalone site initialization
   */
  const app = createApp(Router);
  app.use(store);
  app.use(VuesticPlugin);

  // use vueistic font family for everything
  document.body.style.fontFamily = 'var(--va-font-family)';

  // Setup routing
  const routes = [
    { path: '/', component: Site },
    { path: '/:data(.*)', component: Main },
  ]

  const router = createRouter({
    history: createWebHashHistory(),
    routes, // short for `routes: routes`
  })

  app.use(router);

  app.mount("#app");
}