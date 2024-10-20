import {defineStore} from 'pinia';
import useComPorts from '/@/components/useComPorts';

const {comPorts: availableComPorts} = await useComPorts();

export const useSystemStore = defineStore('system', () => {
  const isRefreshingComPorts = ref(false);

  const comPorts: Ref<ComPort[]> = ref(availableComPorts);

  const networkInfo: Ref<NetworkInfo> = ref({
    interface: '',
    ipAddress: '',
    netmask: '',
    gateway: '',
    firstIpOnSubnet: '',
    lastIpOnSubnet: '',
  });

  async function refreshComPorts() {
    isRefreshingComPorts.value = true;
    const result = await useComPorts();
    comPorts.value.splice(0, comPorts.value.length, ...result.comPorts);
    isRefreshingComPorts.value = false;
  }

  return {
    comPorts,
    isRefreshingComPorts,
    refreshComPorts,
    networkInfo,
  };
});
