import {createApp} from 'vue';
import {createPinia} from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
// import ElementPlus from 'element-plus'
// import 'element-plus/dist/index.css'
import router from './router';
import App from '/@/App.vue';

const app = createApp(App);

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

// app.use(ElementPlus)
app.use(pinia);
app.use(router);
app.mount('#app');
