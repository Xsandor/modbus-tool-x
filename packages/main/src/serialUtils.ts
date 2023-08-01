import { SerialPort } from 'serialport';
import { sortBy } from 'underscore';

export async function getSerialPorts() {
  try {
    const serialPorts = await SerialPort.list();
    let ports = serialPorts.map(p => {
      return {
        path: p.path,
        manufacturer: p.manufacturer,
      };
    });
    ports = sortBy(ports, 'path');
    return ports;
  } catch (error) {
    console.error(error);
    return [];
  }
}