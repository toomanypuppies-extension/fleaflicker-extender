import './styles/main.css'
import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router'
import {
  createVuesticEssential,
  VaButton,
  VaCard,
  VaCheckbox,
  VaIcon,
  VaInnerLoading,
  VaInput,
  VaSelect,
} from 'vuestic-ui';
// Only vuestic's CSS variables, each component brings its own styles. Its reset and body styles
// would restyle the fleaflicker page the extension runs on, the standalone site loads them in index.html.
import 'vuestic-ui/dist/styles/css-variables.css'
import Main from './shared/components/Main.vue';
import Extension from './Extension.vue';
import Site from './Site.vue';
import Router from './Router.vue'
import { store } from './store';
let { STANDALONE } = process.env;

globalThis.__VUE_OPTIONS_API__ = true;
globalThis.__VUE_PROD_DEVTOOLS__ = false;
globalThis.__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false;

const vuestic = () => createVuesticEssential({
  components: { VaButton, VaCard, VaCheckbox, VaIcon, VaInnerLoading, VaInput, VaSelect },
});

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
  app.use(vuestic());
  app.mount("#extensionMount");
} else {
  /**
   * Standalone site initialization
   */
  const app = createApp(Router);
  app.use(store);
  app.use(vuestic());

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