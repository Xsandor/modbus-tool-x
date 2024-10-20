<template>
  <el-tabs
    v-model="tabsStore.activeTabId"
    type="border-card"
    class="main-tabs"
    editable
    @tab-add="tabsStore.openNewTab"
    @tab-remove="tabsStore.closeTab"
  >
    <el-tab-pane
      v-for="tab in tabsStore.tabs"
      :key="tab.id"
      :name="tab.id"
      :label="tab.name"
    >
      <template #label>
        <el-icon style="margin-right: 5px">
          <component :is="iconForTab(tab.component)" />
        </el-icon>
        <span>{{ tab.name }}</span>
      </template>
      <component
        :is="componentForTab(tab.component)"
        :tab-id="tab.id"
      />
    </el-tab-pane>
  </el-tabs>
  <el-button
    style="position: fixed; top: 34px; right: 10px; margin-top: 4px; margin-right: 2px"
    :circle="true"
    size="small"
    @click="toggleDarkMode"
  >
    <el-icon
      :size="18"
      :class="isDark ? 'icon-dark' : 'icon-light'"
    >
      <ElIconMoon v-if="!isDark" />
      <ElIconSunny v-else />
    </el-icon>
  </el-button>
</template>

<script lang="ts" setup>
import {useDark} from '@vueuse/core';
import {network, titleBar} from '#preload';
import {useModbusStore} from '/@/stores/useModbus';
import {useSystemStore} from '/@/stores/useSystem';
import {useTabsStore} from '/@/stores/useTabs';

import ModbusClient from '/@/views/ModbusClient.vue';
import ModbusServer from '/@/views/ModbusServer.vue';
import ModbusLogger from '/@/views/ModbusLogger.vue';
import ModbusScanner from '/@/views/ModbusScanner.vue';
import ModbusAnalyzer from '/@/views/ModbusAnalyzer.vue';
import DanfossExplorer from '/@/views/DanfossExplorer.vue';
import RegisterScanner from '/@/views/RegisterScanner.vue';
import NewTab from '/@/views/NewTab.vue';
// import {TitlebarColor} from 'custom-electron-titlebar';

const isDark = useDark();

function componentForTab(componentName: string) {
  switch (componentName) {
    case 'ModbusClient':
      return ModbusClient;
    case 'ModbusServer':
      return ModbusServer;
    case 'ModbusLogger':
      return ModbusLogger;
    case 'ModbusScanner':
      return ModbusScanner;
    case 'ModbusAnalyzer':
      return ModbusAnalyzer;
    case 'DanfossExplorer':
      return DanfossExplorer;
    case 'RegisterScanner':
      return RegisterScanner;
    default:
      return NewTab;
  }
}

function iconForTab(componentName: string) {
  switch (componentName) {
    case 'ModbusClient':
      return IconEpMouse;
    case 'ModbusServer':
      return IconEpCpu;
    case 'ModbusLogger':
      return IconEpSearch;
    case 'ModbusScanner':
      return IconEpSearch;
    case 'ModbusAnalyzer':
      return IconEpDataAnalysis;
    case 'DanfossExplorer':
      return IconEpDataAnalysis;
    case 'RegisterScanner':
      return IconEpSearch;
    default:
      return IconEpPlus;
  }
}

function toggleDarkMode() {
  // titlebar!.updateBackground(TitlebarColor.fromHex(isDark.value ? '#2c2c2c' : '#ffffff'));
  isDark.value = !isDark.value;
  titleBar.setDark(isDark.value);
}

const loading = ref(true);

const tabsStore = useTabsStore();
const systemStore = useSystemStore();
const modbusStore = useModbusStore();

function setupTabHandling() {
  window.addEventListener('keydown', event => {
    // Filter out events that are not ctrl+T or ctrl+W
    if (!event.ctrlKey) return;

    if (event.code === 'KeyT') {
      return tabsStore.openNewTab();
    }

    if (event.code === 'KeyW') {
      return tabsStore.closeTab();
    }
  });

  document.querySelector('.el-tabs__nav-scroll')?.addEventListener('dblclick', event => {
    // Filter out events that are triggered by clicking something else than the background
    if (event.target !== event.currentTarget) return;
    tabsStore.openNewTab();
  });

  document.querySelector('.el-tabs__nav-scroll')?.addEventListener('mouseup', (event: unknown) => {
    const ev = event as MouseEvent;
    // Filter out events that are not middle-clicks
    if (ev.button !== 1) return;

    // Find parent element with class el-tabs__item
    const targetElement = ev.target as HTMLElement;
    const tabElement = targetElement.closest('.el-tabs__item');
    if (!tabElement) return;

    // Remove leading part of id (tab-)
    const tabId = parseInt(tabElement.id.substring(4));

    // Close tab
    tabsStore.closeTab(tabId);
  });
}

onMounted(() => {
  titleBar.setDark(isDark.value);

  setupTabHandling();
});

network.onInfo((_event, netInfo) => {
  // console.log('Received network info:', netInfo);
  systemStore.networkInfo = netInfo;
  modbusStore.scannerConfiguration.tcp.startIp = netInfo.firstIpOnSubnet;
  modbusStore.scannerConfiguration.tcp.endIp = netInfo.lastIpOnSubnet;
  loading.value = false;
});

network.getInfo();
</script>

<style lang="scss">
@import url('./style/index.scss');
</style>
