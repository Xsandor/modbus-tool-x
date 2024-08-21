import {EventEmitter} from 'events';

/* eslint-disable no-console, no-unused-vars, spaced-comment */
import type {
  FCallbackVal,
  IServerOptions,
  ModbusServerVector,
  SerialServerOptions,
} from 'modbus-serial';
import type {SerialPortOptions} from 'modbus-serial/ModbusRTU';
import {ServerSerial, ServerTCP} from 'modbus-serial';
import {formatTimestamp, logger} from './utilities';
import {REGISTER_OFFSET} from './modbusCommon';

import {
  // DANFOSS_MODEL_FILE_NUMBER,
  // DANFOSS_MODEL_RECORD_LENGTH,
  // DANFOSS_MODEL_RECORD_NUMBER,
  // DANFOSS_MODEL_REF_TYPE,
  // DANFOSS_READ_COMPRESSED_MAX_PNUS,
  // DANFOSS_READ_GROUP_RECORD_LENGTH,
  // DANFOSS_READ_GROUP_RECORD_NUMBER,
  // DANFOSS_READ_GROUP_REF_TYPE,
  // DANFOSS_READ_PARAMETER_RECORD_LENGTH,
  // DANFOSS_READ_PARAMETER_RECORD_NUMBER,
  // DANFOSS_READ_PARAMETER_REF_TYPE,
  DANFOSS_VERSION_PNU,
  // parseDanfossGroup,
  // parseDanfossOrderNumber,
  // parseDanfossParameter,
  // parseDanfossVersion,
} from './danfoss';

const log = logger.createLogger('Modbus Server');

// const HOST = "0.0.0.0"
// const PORT = 8502

const TYPE_EKC = false;
const MHI_SIMULATOR = false;
const DEBUG_VALUES = true;

// const ekc_model = '084B8014';
// const ekc_family = '';
const ekc_version = 326; // v1.0

const minAddress = 0;

const maxDiscreteAddress = 0xffff;
const maxCoilAddress = 0xffff;
const maxInputAddress = 0xffff;
const maxHoldingAddress = 0xffff;

const numDiscreteInputs = maxDiscreteAddress - minAddress + 1;
const numCoils = maxCoilAddress - minAddress + 1;
const numInputRegisters = maxInputAddress - minAddress + 1;
const numHoldingRegisters = maxHoldingAddress - minAddress + 1;

const NO_ERROR = null;

const ILLEGAL_ADDRESS_ERROR = {
  name: 'ILLEGAL_ADDRESS_ERROR', // Illegal address
  modbusErrorCode: 0x02, // Illegal address
  message: 'Invalid address',
  msg: 'Invalid address',
};

const ILLEGAL_VALUE_ERROR = {
  name: 'ILLEGAL_VALUE_ERROR', // Illegal value
  modbusErrorCode: 0x03, // Illegal value
  message: 'Invalid value',
  msg: 'Invalid value',
};

const WILDCARD_UNIT_ID = 255;

function castToUInt(x: number) {
  if (x < 0) {
    // log.debug(`Casting ${x} to ${0xffff + 1 + x}`);
    return 0xffff + 1 + x;
  }

  return x;
}

type RegisterType = 'coils' | 'discreteInputs' | 'inputRegisters' | 'holdingRegisters';

class ModbusServer extends EventEmitter {
  server!: ServerSerial | ServerTCP;
  vector: ModbusServerVector;
  coils!: Buffer;
  discreteInputs!: Buffer;
  holdingRegisters!: Buffer;
  inputRegisters!: Buffer;
  logReads = true;
  logWrites = true;
  constructor() {
    super();

    log.debug('Running construcor');
    // log.debug(configuration);

    this.allocateMemoryForRegisters();

    if (MHI_SIMULATOR) {
      this.coils.writeInt8(1, 232);
      this.coils.writeInt8(1, 233);
      this.coils.writeInt8(1, 236);
      this.coils.writeInt8(1, 237);
      this.coils.writeInt8(1, 238);
      this.coils.writeInt8(1, 999);
      this.coils.writeInt8(1, 202);
      this.coils.writeInt8(1, 203);
      this.coils.writeInt8(1, 1000);
      this.coils.writeInt8(1, 1001);

      this.holdingRegisters.writeUInt16LE(castToUInt(100), 100 * 2);
      this.holdingRegisters.writeUInt16LE(castToUInt(101), 101 * 2);

      const mhiInputRegisters: [string, number][] = [
        ['High Pressure', 567],
        ['Low Pressure', 277],
        ['Medium Pressure', 412],
        ['Discharge temp 1', 71],
        ['Discharge temp 2', 72],
        ['Gas cooler outlet', 26],
        ['Under dome temp 1', 11],
        ['Under dome temp 2', 12],
        ['Liquid feed pipe', 6],
        ['Suction temp', -2],
        ['Ambient', 29],
        ['Comp current 1', 21],
        ['Comp current 2', 22],
        ['Fan speed 1', 27],
        ['Fan speed 2', 28],
        ['Comp speed 1', 30],
        ['Comp speed 2', 40],
      ];

      mhiInputRegisters.forEach(([_name, value], offset) => {
        this.inputRegisters.writeUInt16LE(castToUInt(value), offset * 2);
      });

      const OIL_RECOVERY_TIME_PNU = 31;
      const EFFECT_OF_LIQUID_BACK_PNU = 33;

      this.inputRegisters.writeUInt16LE(castToUInt(5), OIL_RECOVERY_TIME_PNU * 2);
      this.discreteInputs.writeInt8(1, 0);

      let effectOfLiquidBack = 0;

      // eslint-disable-next-line no-inner-declarations
      const oilRecovery = () => {
        logger.debug('MHI', 'Oil recovery started');
        this.discreteInputs.writeInt8(1, 8);

        setTimeout(() => {
          logger.debug('MHI', 'Oil recovery stopped');
          this.discreteInputs.writeInt8(0, 8);
          effectOfLiquidBack = effectOfLiquidBack === 0 ? 1 : 0;
          logger.debug('MHI', `Setting effect of liquid back to: ${effectOfLiquidBack}`);
          this.inputRegisters.writeUInt16LE(effectOfLiquidBack, EFFECT_OF_LIQUID_BACK_PNU * 2);
        }, 15000);
      };

      setTimeout(() => {
        oilRecovery();
        setInterval(oilRecovery, 30000);
      }, 15000);
    }

    this.vector = {
      getCoil: (addr, unitId, cb) => {
        this.emitLog(
          'info',
          `Unit ${unitId}: Read single coil. Address: ${addr - REGISTER_OFFSET}`,
          'read',
        );
        return this.readRegisterAndHandleErrors('coils', addr, null, cb);
      },
      getDiscreteInput: (addr, unitId, cb) => {
        this.emitLog(
          'info',
          `Unit ${unitId}: Read single discrete input. Address: ${addr - REGISTER_OFFSET}`,
          'read',
        );
        return this.readRegisterAndHandleErrors('discreteInputs', addr, null, cb);
      },
      getInputRegister: (addr, unitId, cb) => {
        this.emitLog(
          'info',
          `Unit ${unitId}: Read single input register. Address: ${addr - REGISTER_OFFSET}`,
          'read',
        );

        if (TYPE_EKC && addr - REGISTER_OFFSET === DANFOSS_VERSION_PNU) {
          return cb(NO_ERROR, ekc_version);
        }

        if (TYPE_EKC && [35, 53265, 15].includes(addr - REGISTER_OFFSET)) {
          return cb(ILLEGAL_ADDRESS_ERROR, 0);
        }

        return this.readRegisterAndHandleErrors('inputRegisters', addr, null, cb);
      },
      getHoldingRegister: (addr, unitId, cb) => {
        // console.log('getHoldingRegisters', addr);
        this.emitLog(
          'info',
          `Unit ${unitId}: Read single holding register. Address: ${addr - REGISTER_OFFSET}`,
          'read',
        );

        if (
          TYPE_EKC &&
          [2060, 2061, 5002, 70, 1707, 12, 258, 264, 1025, 115, 21].includes(addr - REGISTER_OFFSET)
        ) {
          return cb(ILLEGAL_ADDRESS_ERROR, 0);
        }

        return this.readRegisterAndHandleErrors('holdingRegisters', addr, null, cb);
      },
      getMultipleHoldingRegisters: (startAddr, length, unitId, cb) => {
        // console.log('getMultipleHoldingRegisters', startAddr, length);
        this.emitLog(
          'info',
          `Unit ${unitId}: Read multiple holding registers. Address: ${
            startAddr - REGISTER_OFFSET
          }. Count: ${length}`,
          'read',
        );

        if (
          TYPE_EKC &&
          [2060, 2061, 5002, 1707, 12, 258, 264, 1025, 115, 21].includes(
            startAddr - REGISTER_OFFSET,
          )
        ) {
          return cb(ILLEGAL_ADDRESS_ERROR, [0]);
        }

        if (TYPE_EKC && [70].includes(startAddr - REGISTER_OFFSET)) {
          return cb(ILLEGAL_VALUE_ERROR, [0]);
        }

        return this.readRegistersAndHandleErrors('holdingRegisters', startAddr, length, cb);
      },
      getMultipleInputRegisters: (startAddr, length, unitId, cb) => {
        this.emitLog(
          'info',
          `Unit ${unitId}: Read multiple input registers. Address: ${
            startAddr - REGISTER_OFFSET
          }. Count: ${length}`,
          'read',
        );

        if (TYPE_EKC && [35, 53265, 15].includes(startAddr - REGISTER_OFFSET)) {
          return cb(ILLEGAL_ADDRESS_ERROR, [0]);
        }

        return this.readRegistersAndHandleErrors('inputRegisters', startAddr, length, cb);
      },
      setCoil: (addr, value, unitId, cb) => {
        log.debug(`Write single coil. Address: ${addr - REGISTER_OFFSET}, value: ${value}`);
        this.emitLog(
          'info',
          `Unit ${unitId}: Write single coil. Address: ${addr - REGISTER_OFFSET}, value: ${value}`,
          'write',
        );

        if (this.isIllegalAddress('coil', addr)) {
          log.debug('Address out of range');
          return cb(ILLEGAL_ADDRESS_ERROR);
        }

        this.coils.writeUInt8(value, addr);
        return cb(NO_ERROR);
      },
      // setCoilArray doesn't not seem to be used, not when writing from Modpoll at least
      // setCoilArray: (startAddr, values, _unitID, cb) => {
      //   // log.debug(`Write multiple coils. Address: ${startAddr - REGISTER_OFFSET}. Values: [${values.join(',')}]`)
      //   this.emit(
      //     'log',
      //     'info',
      //     `Write multiple coils. Address: ${startAddr - REGISTER_OFFSET}, value: ${values}`,
      //   );

      //   if (this.isIllegalAddress('coil', startAddr, values.length)) {
      //     return cb(ILLEGAL_ADDRESS_ERROR, null);
      //   }
      //   // coils.writeUInt8(values, startAddr)
      //   return cb();
      // },
      setRegister: (addr, value, unitId, cb) => {
        // log.debug(
        //   `Write single holding register. Address: ${addr - REGISTER_OFFSET}, value: ${value}`
        // )
        this.emitLog(
          'info',
          `Unit ${unitId}: Write single holding register. Address: ${
            addr - REGISTER_OFFSET
          }, value: ${value}`,
          'write',
        );

        if (this.isIllegalAddress('holdingRegister', addr)) {
          log.debug('Address out of range');
          return cb(ILLEGAL_ADDRESS_ERROR);
        }
        this.holdingRegisters.writeUInt16LE(value, addr * Uint16Array.BYTES_PER_ELEMENT);
        return cb(NO_ERROR);
      },
      // setRegisterArray doesn't not seem to be used, not when writing from Modpoll at least
      // setRegisterArray: (startAddr, values, _unitID, cb) => {
      //   // log.debug(`Write multiple holding register. Address: ${startAddr - REGISTER_OFFSET}. Values: ${values.join(',')}`)
      //   this.emit(
      //     'log',
      //     'info',
      //     `Write multiple holding register. Address: ${startAddr - REGISTER_OFFSET}. Values: ${values.join(
      //       ',',
      //     )}`,
      //   );

      //   if (this.isIllegalAddress('holdingRegister', startAddr, values.length)) {
      //     this.emit('log', 'warn', 'Illegal address.');
      //     return cb(ILLEGAL_ADDRESS_ERROR, null);
      //   }
      //   values.forEach((value, index) => {
      //     this.holdingRegisters.writeUInt16LE(
      //       value,
      //       (startAddr + index) * Uint16Array.BYTES_PER_ELEMENT,
      //     );
      //   });
      //   return cb();
      // },
      getExceptionStatus: (unitId, cb) => {
        this.emitLog('info', `Unit ${unitId}: Get exception status`, 'read');
        cb(NO_ERROR, 0);
      },
    };
  }

  protected emitLog(type: 'info' | 'warn' | 'error', text: string, action?: 'read' | 'write') {
    if (!action) {
      this.emit('log', type, formatTimestamp(new Date()) + ': ' + text);
      return;
    }

    if (action === 'read' && this.logReads) {
      this.emit('log', type, formatTimestamp(new Date()) + ': ' + text);
      return;
    }

    if (action === 'write' && this.logWrites) {
      this.emit('log', type, formatTimestamp(new Date()) + ': ' + text);
      return;
    }
  }

  private allocateMemoryForRegisters() {
    log.debug(`Allocating ${numCoils} bytes for coils`);
    this.coils = Buffer.alloc(numCoils, 0); // coils inputs

    log.debug(`Allocating ${numDiscreteInputs} bytes for discrete inputs`);
    this.discreteInputs = Buffer.alloc(numCoils, 0); // discrete inputs

    log.debug(`Allocating ${numHoldingRegisters * 2} bytes for holding registers`);
    this.holdingRegisters = Buffer.alloc(numHoldingRegisters * 2, 0); // holding registers

    log.debug(`Allocating ${numInputRegisters * 2} bytes for input registers`);
    this.inputRegisters = Buffer.alloc(numInputRegisters * 2, 0);

    if (DEBUG_VALUES) {
      // Set the register address as the value
      for (let i = 0; i < numHoldingRegisters; i++) {
        this.holdingRegisters.writeUInt16LE(i, i * 2);
      }
      for (let i = 0; i < numInputRegisters; i++) {
        this.inputRegisters.writeUInt16LE(i, i * 2);
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readRegisterAndHandleErrors(
    type: RegisterType,
    addr: number,
    length: null | number,
    cb: FCallbackVal<number>,
  ): void {
    const readMultiple = length !== null;
    // log.debug(
    //   `Read ${readMultiple ? 'multiple' : 'single'} ${type}. Address: ${addr - REGISTER_OFFSET}`,
    // );

    if (this.isIllegalAddress(type, addr, readMultiple ? length : 1)) {
      log.debug('Address out of range');
      return cb(ILLEGAL_ADDRESS_ERROR, 0);
    }

    const value = this.getRegisterData(type, readMultiple, addr, length) as number;

    return cb(NO_ERROR, value);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readRegistersAndHandleErrors(
    type: RegisterType,
    addr: number,
    length: null | number,
    cb: FCallbackVal<number[]>,
  ): void {
    const readMultiple = length !== null;
    // log.debug(
    //   `Read ${readMultiple ? 'multiple' : 'single'} ${type}. Address: ${addr - REGISTER_OFFSET}`,
    // );

    if (this.isIllegalAddress(type, addr, readMultiple ? length : 1)) {
      log.debug('Address out of range');
      return cb(ILLEGAL_ADDRESS_ERROR, [0]);
    }

    const value = this.getRegisterData(type, readMultiple, addr, length) as number[];

    return cb(NO_ERROR, value);
  }

  private getRegisterData(
    type: RegisterType,
    readMultiple: boolean,
    addr: number,
    length: null | number,
  ): number | number[] {
    let value;

    if (type === 'inputRegisters' || type === 'holdingRegisters') {
      if (readMultiple) {
        value = new Uint16Array(this[type].buffer, addr * Uint16Array.BYTES_PER_ELEMENT, length!);

        return Array.from(value);
      }
      return this[type].readUInt16LE(addr * Uint16Array.BYTES_PER_ELEMENT);
    } else {
      return this[type].readUInt8(addr);
    }
  }

  async stop() {
    log.debug('Stopping ServerSerial:');
    this.emitLog('info', 'Stopping Modbus Server');
    if (!this.server) {
      log.debug('ServerSerial not running');
      this.emitLog('info', 'Modbus Server not running!');
      return;
    }
    this.server.close(() => {
      log.debug('ServerSerial stopped');
      this.emitLog('info', 'Modbus Server stopped!');
      return;
    });
  }
  getData(type: string, startAddr: number, length: number) {
    if (type === 'input') {
      const values = new Uint16Array(
        this.inputRegisters.buffer,
        (startAddr + REGISTER_OFFSET) * Uint16Array.BYTES_PER_ELEMENT,
        length,
      );

      return Array.from(values);
    }
    if (type === 'holding') {
      const values = new Uint16Array(
        this.holdingRegisters.buffer,
        (startAddr + REGISTER_OFFSET) * Uint16Array.BYTES_PER_ELEMENT,
        length,
      );

      return Array.from(values);
    }
    if (type === 'coil') {
      const values = this.coils.subarray(
        startAddr + REGISTER_OFFSET,
        startAddr + REGISTER_OFFSET + length,
      );

      return Array.from(values);
    }
    if (type === 'discreteInput') {
      const values = this.discreteInputs.subarray(
        startAddr + REGISTER_OFFSET,
        startAddr + REGISTER_OFFSET + length,
      );

      return Array.from(values);
    }

    return [];
  }
  isIllegalAddress(type = 'holdingRegister', address = 1, count = 1) {
    let maxAddress = maxInputAddress;

    switch (type) {
      case 'coil':
        maxAddress = maxCoilAddress;
        break;
      case 'discreteInput':
        maxAddress = maxDiscreteAddress;
        break;
      case 'inputRegister':
        maxAddress = maxInputAddress;
        break;
      case 'holdingRegister':
        maxAddress = maxHoldingAddress;
        break;
      default:
        maxAddress = maxHoldingAddress;
        break;
    }

    return address < minAddress || address + count - 1 > maxAddress;
  }
}

// Extend class with a ModbusRTU server
export class ModbusRtuServer extends ModbusServer {
  constructor(configuration: ModbusRtuServerConfiguration) {
    super();

    try {
      const options: SerialServerOptions = {
        port: configuration.port,
        unitID: configuration.unitId || WILDCARD_UNIT_ID,
        baudRate: configuration.baudRate,
        interval: 20,
        debug: true,
      };

      const serialOptions: SerialPortOptions = {
        parity: configuration.parity,
        dataBits: configuration.dataBits,
        stopBits: configuration.stopBits,
      };

      this.server = new ServerSerial(this.vector, options, serialOptions);

      log.debug('Created serverSerial');

      this.server.on('open', () => {
        log.debug('Opened ServerSerial:');
      });

      this.server.on('close', () => {
        log.debug('Closed ServerSerial:');
      });

      this.server.on('initialized', () => {
        const message = `Listening ${options.port}, baudrate: ${options.baudRate}, Unit ID: ${options.unitID}`;

        log.debug(message);
        this.emitLog('info', message);
      });

      this.server.on('error', (err: Error | null) => {
        log.debug('An error occured in ServerSerial:');
        console.error(err);
        this.emitLog('error', 'An error occured in Modbus RTU Server');
      });

      this.server.on('socketError', (err: Error | null) => {
        log.debug('Socket error in ServerSerial:');
        console.error(err);
        this.emitLog('error', 'Socket error in Modbus RTU Server');
        this.server?.close(() => {
          log.debug('Closed ServerSerial:');
        });
      });

      this.server.on('log', (type, message) => {
        if (type === 'warn') {
          console.error(message);
        } else {
          // log.info(message)
        }
      });
    } catch (error) {
      log.debug('Error in constructor');
      throw error;
    }
  }
}

export class ModbusTcpServer extends ModbusServer {
  constructor(configuration: ModbusTcpServerConfiguration) {
    super();

    try {
      const options: IServerOptions = {
        host: configuration.host,
        port: configuration.port,
        unitID: configuration.unitId || WILDCARD_UNIT_ID,
        debug: true,
      };

      this.server = new ServerTCP(this.vector, options);

      log.debug('Created ServerTCP');

      this.server.on('initialized', () => {
        log.debug(`Listening on ${options.host}:${options.port}, Unit ID: ${options.unitID}`);
        this.emitLog(
          'info',
          `Listening on ${options.host}:${options.port}, Unit ID: ${options.unitID}`,
        );
      });

      this.server.on('error', (err: Error | null) => {
        log.debug('An error occured in ServerTCP:');
        console.error(err);
        this.emitLog('error', 'An error occured in Modbus TCP Server');
      });

      this.server.on('clientConnected', ip => {
        log.debug(`${ip} connected`);
        this.emitLog('info', `${ip} connected`);
      });

      this.server.on('clientDisconnected', ip => {
        log.debug(`${ip} disconnected`);
        this.emitLog('info', `${ip} disconnected`);
      });
    } catch (error) {
      log.debug('Error in constructor');
      throw error;
    }
  }
}

// function gracefulShutdown(cb) {
//   log.info("Shutting down server gracefully..")
//   serverSerial.close(() => {
//     log.info("Done.")
//     cb()
//   })
//   // serverTCP.close(() => {

//   // })
// }

// process.on("SIGINT", () => {
//   log.info("\nProcess interrupted, will exit..")
//   gracefulShutdown(() => {
//     process.exit()
//   })
// })

// process.once("SIGUSR2", () => {
//   log.info("Process stopped by nodemon, will exit..")
//   gracefulShutdown(() => {
//     process.kill(process.pid, "SIGUSR2")
//   })
// })
