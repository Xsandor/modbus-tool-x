import { serial } from '#preload';

function sortComPort(a: ComPort, b: ComPort) {
  const portA = parseInt(a.path.split('COM')[1]);
  const portB = parseInt(b.path.split('COM')[1]);
  if (portB < portA) return 1;
  if (portB > portA) return -1;
  return 0;
}

export default async function useComPorts(){
  const comPorts: Ref<ComPort[]> = ref([]);

  comPorts.value = await serial.getComPorts();
  comPorts.value = comPorts.value.sort(sortComPort);
  console.log(comPorts.value);

  return {
    comPorts,
  };
}