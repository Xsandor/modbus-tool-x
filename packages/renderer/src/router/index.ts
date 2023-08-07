import {createWebHashHistory, createRouter} from 'vue-router';
import ModbusClient from '/@/views/ModbusClient.vue';
import ModbusServer from '/@/views/ModbusServer.vue';
import ModbusLogger from '/@/views/ModbusLogger.vue';
import ModbusScanner from '/@/views/ModbusScanner.vue';
import ModbusAnalyzer from '/@/views/ModbusAnalyzer.vue';
import Settings from '/@/views/Settings.vue';

const routes = [
  {
    path: '/',
    name: 'ModbusClient',
    component: ModbusClient,
  },
  {
    path: '/server',
    name: 'ModbusServer',
    component: ModbusServer,
  },
  {
    path: '/scanner',
    name: 'ModbusScanner',
    component: ModbusScanner,
  },
  {
    path: '/logger',
    name: 'ModbusLogger',
    component: ModbusLogger,
  },
  {
    path: '/analyzer',
    name: 'ModbusAnalyzer',
    component: ModbusAnalyzer,
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

router.afterEach(to => {
  console.log('afterEach => ', to.name);
  localStorage.setItem(LS_ROUTE_KEY, to.name?.toString() || HOME_ROUTE_NAME);
});

let isFirstTransition = true;

router.beforeEach((to, _from, next) => {
  const lastRouteName = localStorage.getItem(LS_ROUTE_KEY);

  const shouldRedirect = to.name === HOME_ROUTE_NAME && lastRouteName && isFirstTransition;

  if (shouldRedirect) next({name: lastRouteName});
  else next();

  isFirstTransition = false;
});

export default router;
