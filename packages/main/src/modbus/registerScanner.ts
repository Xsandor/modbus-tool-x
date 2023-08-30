import EventEmitter from 'events';
import ModbusRTU from 'modbus-serial';
import {
  MAX_COILS,
  MAX_DISCRETE_INPUTS,
  MAX_HOLDING_REGISTERS,
  MAX_INPUT_REGISTERS,
  REGISTER_OFFSET,
} from './modbusCommon';
import {logger, sleep} from './utilities';

const log = logger.createLogger('Register Scanner');

const DELAY_BETWEEN_REQUESTS = 5;

interface FoundRegister {
  type: string;
  address: number;
  value: number;
}

enum LOG_TEXTS {
  DEVICE_DOES_NOT_SUPPORT_FUNCTION = 'Device does not support this function, skipping',
}

// TODO: Make TCP version of this class

export class RegisterScanner extends EventEmitter {
  progress = {
    coils: 0,
    discreteInputs: 0,
    holdingRegisters: 0,
    inputRegisters: 0,
  };
  foundRegisters: FoundRegister[] = [];

  client: ModbusRTU; // ModbusRTU instance
  serialPortConfiguration: SerialPortConfiguration;
  unitId: number;

  constructor(serialPortConfiguration: SerialPortConfiguration, unitId: number) {
    super();
    this.unitId = unitId;
    this.client = new ModbusRTU();
    this.client.setID(unitId);
    this.client.setTimeout(200);
    this.serialPortConfiguration = serialPortConfiguration;
  }

  addFoundRegister(register: FoundRegister) {
    this.foundRegisters.push(register);
    this.emit('foundRegisters', this.foundRegisters);
  }

  setProgress(
    type: 'coils' | 'discreteInputs' | 'holdingRegisters' | 'inputRegisters',
    value: number,
  ) {
    this.progress[type] = value;
    this.emit('progress', this.progress);
  }

  async connect() {
    const {port, baudRate, parity, dataBits, stopBits} = this.serialPortConfiguration;

    await this.client.connectRTUBuffered(port, {baudRate, parity, dataBits, stopBits});
  }

  async close() {
    this.client.close(() => {
      return;
    });
  }

  async start() {
    await this.connect();

    log.info('Starting register scan for coils');
    for (let i = 1; i <= MAX_COILS; i++) {
      try {
        const result = await this.client.readCoils(i + REGISTER_OFFSET, 1);
        if (result) {
          this.addFoundRegister({
            type: 'coil',
            address: i,
            value: result.data[0] ? 1 : 0,
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        // log.info(error);
        if (error.modbusCode === 1) {
          log.info(LOG_TEXTS.DEVICE_DOES_NOT_SUPPORT_FUNCTION);
          this.setProgress('coils', MAX_COILS);
          await sleep(DELAY_BETWEEN_REQUESTS);
          break;
        }
      }
      this.setProgress('coils', i);
      await sleep(DELAY_BETWEEN_REQUESTS);
    }

    log.info('Starting register scan for discrete inputs');
    for (let i = 1; i <= MAX_DISCRETE_INPUTS; i++) {
      try {
        const result = await this.client.readDiscreteInputs(i + REGISTER_OFFSET, 1);
        if (result) {
          this.addFoundRegister({
            type: 'discreteInput',
            address: i,
            value: result.data[0] ? 1 : 0,
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        // log.info(error);
        if (error.modbusCode === 1) {
          log.info(LOG_TEXTS.DEVICE_DOES_NOT_SUPPORT_FUNCTION);
          this.setProgress('discreteInputs', MAX_DISCRETE_INPUTS);
          await sleep(DELAY_BETWEEN_REQUESTS);
          break;
        }
      }
      this.setProgress('discreteInputs', i);
      await sleep(DELAY_BETWEEN_REQUESTS);
    }

    log.info('Starting register scan for holding registers');
    for (let i = 1; i <= MAX_HOLDING_REGISTERS; i++) {
      try {
        const result = await this.client.readHoldingRegisters(i + REGISTER_OFFSET, 1);
        if (result) {
          this.addFoundRegister({
            type: 'holdingRegister',
            address: i,
            value: result.data[0],
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        // log.info(error);
        if (error.modbusCode === 1) {
          log.info(LOG_TEXTS.DEVICE_DOES_NOT_SUPPORT_FUNCTION);
          this.setProgress('holdingRegisters', MAX_HOLDING_REGISTERS);
          await sleep(DELAY_BETWEEN_REQUESTS);
          break;
        }
      }
      this.setProgress('holdingRegisters', i);
      await sleep(DELAY_BETWEEN_REQUESTS);
    }

    log.info('Starting register scan for input registers');
    for (let i = 1; i <= MAX_INPUT_REGISTERS; i++) {
      try {
        const result = await this.client.readInputRegisters(i + REGISTER_OFFSET, 1);
        if (result) {
          this.addFoundRegister({
            type: 'inputRegisters',
            address: i,
            value: result.data[0],
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        // log.info(error);
        if (error.modbusCode === 1) {
          log.info(LOG_TEXTS.DEVICE_DOES_NOT_SUPPORT_FUNCTION);
          this.setProgress('inputRegisters', MAX_INPUT_REGISTERS);
          break;
        }
      }
      this.setProgress('inputRegisters', i);
      await sleep(DELAY_BETWEEN_REQUESTS);
    }

    return this.foundRegisters;
  }
}
