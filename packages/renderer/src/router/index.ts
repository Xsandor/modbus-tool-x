import {createWebHashHistory, createRouter} from 'vue-router';
import ModbusClient from '/@/views/ModbusClient.vue';
import ModbusServer from '/@/views/ModbusServer.vue';
import ModbusLogger from '/@/views/ModbusLogger.vue';
import ModbusScanner from '/@/views/ModbusScanner.vue';
import ModbusAnalyzer from '/@/views/ModbusAnalyzer.vue';
import DanfossExplorer from '/@/views/DanfossExplorer.vue';
import RegisterScanner from '/@/views/RegisterScanner.vue';
import Settings from '/@/views/Settings.vue';

const routes = [
  {
    path: '/',
    alias: '/modbusClient',
    name: 'ModbusClient',
    component: ModbusClient,
  },
  {
    path: '/modbusServer',
    name: 'ModbusServer',
    component: ModbusServer,
  },
  {
    path: '/modbusScanner',
    name: 'ModbusScanner',
    component: ModbusScanner,
  },
  {
    path: '/modbusLogger',
    name: 'ModbusLogger',
    component: ModbusLogger,
  },
  {
    path: '/modbusAnalyzer',
    name: 'ModbusAnalyzer',
    component: ModbusAnalyzer,
  },
  {
    path: '/registerScanner',
    name: 'RegisterScanner',
    component: RegisterScanner,
  },
  {
    path: '/danfossExplorer',
    name: 'DanfossExplorer',
    component: DanfossExplorer,
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings,
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

const LS_ROUTE_KEY = 'lastRoute';
const HOME_ROUTE_NAME = 'ModbusClient';

// Save last route to local storage after each navigation
router.afterEach(to => {
  // console.log('afterEach => ', to.name);
  localStorage.setItem(LS_ROUTE_KEY, to.name?.toString() || HOME_ROUTE_NAME);
});

let isFirstTransition = true;

// On first transition to home route, redirect to last saved route
router.beforeEach((to, _from, next) => {
  const lastRouteName = localStorage.getItem(LS_ROUTE_KEY);

  const shouldRedirect = to.name === HOME_ROUTE_NAME && lastRouteName && isFirstTransition;

  if (shouldRedirect) next({name: lastRouteName});
  else next();

  isFirstTransition = false;
});

export default router;
