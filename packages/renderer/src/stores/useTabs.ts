import {defineStore} from 'pinia';

interface Tab {
  id: number;
  name: string;
  component: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export const useTabsStore = defineStore(
  'tabs',
  () => {
    const components: GenericObject = {
      NewTab: {name: 'New Tab'},
      ModbusClient: {name: 'Modbus Client'},
      ModbusServer: {name: 'Modbus Server'},
      ModbusScanner: {name: 'Modbus Scanner'},
      RegisterScanner: {name: 'Register Scanner'},
      ModbusLogger: {name: 'Modbus Logger'},
      ModbusAnalyzer: {name: 'Modbus Analyzer'},
      DanfossExplorer: {name: 'Danfoss Explorer'},
    };

    const tabs: Ref<Tab[]> = ref([
      {id: 1, name: components['NewTab'].name, data: null, component: 'NewTab'},
    ]);

    const activeTabId = ref<number>(tabs.value[0].id);

    const activeTab = computed(() => {
      return tabs.value.find(i => i.id === activeTabId.value);
    });

    function changeTabComponent(component: string) {
      // console.log('changeTabComponent => ', component);
      if (!component || !(component in components)) {
        // console.log('Unknown component');
        return;
      }

      const tab = activeTab.value;

      if (!tab) {
        return;
      }

      tab.component = component;
      tab.name = components[component].name;
    }

    function highestTabId() {
      if (tabs.value.length === 0) {
        return 0;
      }
      return tabs.value.map(i => i.id).reduce((a, b) => Math.max(a, b));
    }

    function openNewTab() {
      const id = highestTabId() + 1;
      // console.log('openNewTab with ID:', id);

      tabs.value.push({id, name: `New Tab`, data: null, component: 'NewTab'});
      // console.log(tabs.value);
      activeTabId.value = id;
      return id;
    }

    function closeTab(tabId?: string | number) {
      // TODO: Explain this
      if (!tabId) {
        tabId = activeTabId.value;
      }

      const index = tabs.value.findIndex(i => i.id === tabId);

      // If tab not found, return
      if (index < 0) {
        return;
      }
      tabs.value.splice(index, 1);

      // If no tabs left, open a new one
      if (tabs.value.length === 0) {
        openNewTab();
        return;
      }

      const isActiveTab = tabId === activeTabId.value;

      // If closed tab is not the active one, return
      if (!isActiveTab) {
        return;
      }

      // Make another tab active
      if (index > 0) {
        activeTabId.value = tabs.value[index - 1].id;
      } else {
        activeTabId.value = tabs.value[index].id;
      }
    }

    function getTabDataById(tabId: number) {
      const tab = tabs.value.find(i => i.id === tabId);

      if (!tab) {
        return null;
      }

      return tab.data;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function setTabDataById(tabId: number, data: any) {
      const tab = tabs.value.find(i => i.id === tabId);

      if (!tab) {
        return null;
      }

      tab.data = data;

      return tab.data;
    }

    return {
      tabs,
      activeTabId,
      activeTab,
      changeTabComponent,
      openNewTab,
      closeTab,
      getTabDataById,
      setTabDataById,
    };
  },
  {
    persist: true,
  },
);
