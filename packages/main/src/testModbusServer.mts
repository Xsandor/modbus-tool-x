/* eslint-disable @typescript-eslint/no-unused-vars */
import { ModbusServer } from './modbusServer';

const server = new ModbusServer({
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  port: 'COM3',
  unitId: 1,
});