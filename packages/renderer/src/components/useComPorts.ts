import {serial} from '#preload';

function sortComPort(a: ComPort, b: ComPort) {
  const portA = parseInt(a.path.split('COM')[1]);
  const portB = parseInt(b.path.split('COM')[1]);
  if (portB < portA) return 1;
  if (portB > portA) return -1;
  return 0;
}

export default async function useComPorts() {
  let comPorts: ComPort[] = [];

  comPorts = await serial.getComPorts();
  comPorts = comPorts.sort(sortComPort);
  console.log(comPorts);

  return {
    comPorts,
  };
}
