import {defineStore} from 'pinia';
import useComPorts from '/@/components/useComPorts';

const {comPorts: availableComPorts} = await useComPorts();

export const useSystemStore = defineStore('system', () => {
  const comPorts: Ref<ComPort[]> = ref(availableComPorts);

  const networkInfo: Ref<NetworkInfo> = ref({
    interface: '',
    ipAddress: '',
    netmask: '',
    gateway: '',
    firstIpOnSubnet: '',
    lastIpOnSubnet: '',
  });

  return {
    comPorts,
    networkInfo,
  };
});
