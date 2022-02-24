import { createApp } from 'vue';
import { VuesticPlugin } from 'vuestic-ui';
import App from './App.vue';
import 'vuestic-ui/dist/vuestic-ui.css'
import './styles/main.css'

const extenstion = document.createElement('div');
extenstion.id = 'extensionMount';
const mainBody = document.getElementsByTagName('body')[0];
mainBody.appendChild(extenstion);

const app = createApp(App);
app.use(VuesticPlugin);
app.mount("#extensionMount");