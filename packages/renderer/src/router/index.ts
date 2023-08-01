import { createWebHashHistory, createRouter } from 'vue-router';
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

export default router;