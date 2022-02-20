import { createApp } from 'vue';
import { VuesticPlugin } from 'vuestic-ui';
import App from './App.vue';
import './main.css'
import 'vuestic-ui/dist/vuestic-ui.css'

const extenstion = document.createElement('div');
extenstion.id = 'extensionMount';
const mainBody = document.getElementsByTagName('body')[0];
mainBody.appendChild(extenstion);

const app = createApp(App);
app.use(VuesticPlugin);
app.mount("#extensionMount");