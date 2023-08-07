import {EventEmitter} from 'events';

/* eslint-disable no-console, no-unused-vars, spaced-comment */
import type {ModbusServerVector, SerialServerOptions} from 'modbus-serial';
import type {SerialPortOptions} from 'modbus-serial/ModbusRTU';
import {ServerSerial} from 'modbus-serial';

// const HOST = "0.0.0.0"
// const PORT = 8502
const DEBUG = process.env.NODE_ENV !== 'production';

const minAddress = 0;

const maxDiscreteAddress = 0xffff;
const maxCoilAddress = 0xffff;
const maxInputAddress = 0xffff;
const maxHoldingAddress = 0xffff;

const OFFSET = 1; // For displaying modbus register addresses

const numDiscreteInputs = maxDiscreteAddress - minAddress + 1;
const numCoils = maxCoilAddress - minAddress + 1;
const numInputRegisters = maxInputAddress - minAddress + 1;
const numHoldingRegisters = maxHoldingAddress - minAddress + 1;

const NO_ERROR = null;
const ILLEGAL_ADDRESS_ERROR = {
  modbusErrorCode: 0x02, // Illegal address
  msg: 'Invalid address',
};

const log = {
  debug: DEBUG ? console.log : () => null,
  info: console.log,
  error: console.error,
};

const WILDCARD_UNIT_ID = 255;

export class ModbusServer extends EventEmitter {
  serverSerial: ServerSerial | undefined;
  coils: Buffer;
  discreteInputs: Buffer;
  holdingRegisters: Buffer;
  inputRegisters: Buffer;
  constructor(configuration: ModbusRtuServerConfiguration) {
    super();

    log.info('MbServer: Running construcor');
    log.info(configuration);

    log.debug(`MbServer: Allocating ${numCoils} bytes for coils`);
    this.coils = Buffer.alloc(numCoils, 0); // coils inputs

    log.debug(`MbServer: Allocating ${numDiscreteInputs} bytes for discrete inputs`);
    this.discreteInputs = Buffer.alloc(numCoils, 0); // discrete inputs

    log.debug(`MbServer: Allocating ${numHoldingRegisters * 2} bytes for holding registers`);
    this.holdingRegisters = Buffer.alloc(numHoldingRegisters * 2, 0); // holding registers

    log.debug(`MbServer: Allocating ${numInputRegisters * 2} bytes for input registers`);
    this.inputRegisters = Buffer.alloc(numInputRegisters * 2, 0); // input registers

    function castToUInt(x: number) {
      if (x < 0) {
        console.log(`Casting ${x} to ${0xffff + 1 + x}`);
        return 0xffff + 1 + x;
      }

      return x;
    }

    const MHI_SIMULATOR = false;

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
        console.log('MHI: Oil recovery started');
        this.discreteInputs.writeInt8(1, 8);

        setTimeout(() => {
          console.log('MHI: Oil recovery stopped');
          this.discreteInputs.writeInt8(0, 8);
          effectOfLiquidBack = effectOfLiquidBack === 0 ? 1 : 0;
          console.log(`MHI: Setting effect of liquid back to: ${effectOfLiquidBack}`);
          this.inputRegisters.writeUInt16LE(effectOfLiquidBack, EFFECT_OF_LIQUID_BACK_PNU * 2);
        }, 15000);
      };

      setTimeout(() => {
        oilRecovery();
        setInterval(oilRecovery, 30000);
      }, 15000);
    }

    const vector: ModbusServerVector = {
      getCoil: (addr, _unitID, cb) => {
        log.debug(`MbServer: Read single coil. Address: ${addr + OFFSET}`);

        if (this.isIllegalAddress('coil', addr)) {
          log.debug('MbServer: Address out of range');
          return cb(ILLEGAL_ADDRESS_ERROR, null);
        }
        log.debug('MbServer: Value', this.coils.readUInt8(addr));

        return cb(NO_ERROR, this.coils.readUInt8(addr));
      },
      getDiscreteInput: (addr, _unitID, cb) => {
        log.debug(`MbServer: Read single discrete input. Address ${addr + OFFSET}`);

        if (this.isIllegalAddress('discreteInput', addr)) {
          log.debug('MbServer: Address out of range');
          return cb(ILLEGAL_ADDRESS_ERROR, null);
        }
        return cb(NO_ERROR, this.discreteInputs.readUInt8(addr));
      },
      getInputRegister: (addr, _unitID, cb) => {
        log.debug(`MbServer: Read single input register. Address: ${addr + OFFSET}`);

        if (this.isIllegalAddress('inputRegister', addr)) {
          log.debug('MbServer: Address out of range');
          return cb(ILLEGAL_ADDRESS_ERROR, null);
        }
        return cb(null, this.inputRegisters.readUInt16LE(addr * Uint16Array.BYTES_PER_ELEMENT));
      },
      getHoldingRegister: (addr, _unitID, cb) => {
        log.debug(`MbServer: Read single holding register. Address: ${addr + OFFSET}`);

        if (this.isIllegalAddress('holdingRegister', addr)) {
          return cb(ILLEGAL_ADDRESS_ERROR, null);
        }
        const value = this.holdingRegisters.readUInt16LE(addr * Uint16Array.BYTES_PER_ELEMENT);
        return cb(NO_ERROR, value);
      },
      getMultipleHoldingRegisters: (startAddr, length, _unitID, cb) => {
        log.debug(
          `MbServer: Read multiple holding holdingRegisters. Address: ${
            startAddr + OFFSET
          }, count: ${length}`,
        );

        if (this.isIllegalAddress('holdingRegister', startAddr, length)) {
          log.debug('MbServer: Out of range!');
          return cb(ILLEGAL_ADDRESS_ERROR, []);
        }

        const values = new Uint16Array(
          this.holdingRegisters.buffer,
          startAddr * Uint16Array.BYTES_PER_ELEMENT,
          length,
        );

        return cb(NO_ERROR, Array.from(values));
      },
      getMultipleInputRegisters: (startAddr, length, _unitID, cb) => {
        log.debug(
          `MbServer: Read multiple input registers. Address: ${
            startAddr + OFFSET
          }, count: ${length}`,
        );

        if (this.isIllegalAddress('inputRegister', startAddr, length)) {
          log.debug('MbServer: ILLEGAL ADDRESS!');
          return cb(ILLEGAL_ADDRESS_ERROR, []);
        }

        const values = new Uint16Array(
          this.inputRegisters.buffer,
          startAddr * Uint16Array.BYTES_PER_ELEMENT,
          length,
        );

        // log.debug(Array.from(values))
        // log.debug('Calling callback without error')
        return cb(NO_ERROR, Array.from(values));
      },
      setCoil: (addr, value, _unitID, cb) => {
        log.debug(`MbServer: Write single coil. Address: ${addr + OFFSET}, value: ${value}`);

        this.emit('log', 'info', `Write single coil. Address: ${addr + OFFSET}, value: ${value}`);

        if (this.isIllegalAddress('coil', addr)) {
          log.debug('MbServer: Address out of range');
          return cb(ILLEGAL_ADDRESS_ERROR, null);
        }

        this.coils.writeUInt8(value, addr);
        return cb();
      },
      // setCoilArray doesn't not seem to be used, not when writing from Modpoll at least
      setCoilArray: (startAddr, values, _unitID, cb) => {
        // log.debug(`Write multiple coils. Address: ${startAddr + OFFSET}. Values: [${values.join(',')}]`)
        this.emit(
          'log',
          'info',
          `Write multiple coils. Address: ${startAddr + OFFSET}, value: ${values}`,
        );

        if (this.isIllegalAddress('coil', startAddr, values.length)) {
          return cb(ILLEGAL_ADDRESS_ERROR, null);
        }
        // coils.writeUInt8(values, startAddr)
        return cb();
      },
      setRegister: (addr, value, _unitID, cb) => {
        // log.debug(
        //   `Write single holding register. Address: ${addr + OFFSET}, value: ${value}`
        // )
        this.emit(
          'log',
          'info',
          `Write single holding register. Address: ${addr + OFFSET}, value: ${value}`,
        );

        if (this.isIllegalAddress('holdingRegister', addr)) {
          log.debug('MbServer: Address out of range');
          return cb(ILLEGAL_ADDRESS_ERROR, null);
        }
        this.holdingRegisters.writeUInt16LE(value, addr * Uint16Array.BYTES_PER_ELEMENT);
        return cb();
      },
      // setRegisterArray doesn't not seem to be used, not when writing from Modpoll at least
      setRegisterArray: (startAddr, values, _unitID, cb) => {
        // log.debug(`Write multiple holding register. Address: ${startAddr + OFFSET}. Values: ${values.join(',')}`)
        this.emit(
          'log',
          'info',
          `Write multiple holding register. Address: ${startAddr + OFFSET}. Values: ${values.join(
            ',',
          )}`,
        );

        if (this.isIllegalAddress('holdingRegister', startAddr, values.length)) {
          this.emit('log', 'warn', 'Illegal address.');
          return cb(ILLEGAL_ADDRESS_ERROR, null);
        }
        values.forEach((value, index) => {
          this.holdingRegisters.writeUInt16LE(
            value,
            (startAddr + index) * Uint16Array.BYTES_PER_ELEMENT,
          );
        });
        return cb();
      },
    };

    try {
      const options: SerialServerOptions = {
        port: configuration.port,
        unitID: configuration.unitId || WILDCARD_UNIT_ID,
        baudRate: configuration.baudRate,
        interval: 10,
        debug: true,
      };

      const serialOptions: SerialPortOptions = {
        parity: configuration.parity,
        dataBits: configuration.dataBits,
        stopBits: configuration.stopBits,
      };

      this.serverSerial = new ServerSerial(vector, options, serialOptions);

      log.info('MbServer: Created serverSerial');

      this.serverSerial.on('open', () => {
        log.info('MbServer: Opened Serial Server:');
      });

      this.serverSerial.on('close', () => {
        log.info('MbServer: Closed Serial Server:');
      });

      this.serverSerial.on('initialized', () => {
        log.info(
          `MbServer: Modbus Serial listening ${options.port}, baudrate: ${options.baudRate}, Unit ID: ${options.unitID}`,
        );
      });

      this.serverSerial.on('error', (err: Error) => {
        log.error('MbServer: An error occured in Serial Server:');
        log.error(err);
      });

      this.serverSerial.on('socketError', (err: Error) => {
        log.error(err);
        this.serverSerial?.close(() => {
          log.info('MbServer: Serial Server closed');
        });
      });

      this.serverSerial.on('log', (type: 'warn' | 'info', message: string) => {
        if (type === 'warn') {
          log.error(message);
        } else {
          // log.info(message)
        }
      });
    } catch (error) {
      log.error('MbServer: Error in constructor');
      log.error(error);
    }
  }
  async stop() {
    log.info('MbServer: Stopping server');
    if (!this.serverSerial) {
      log.info('MbServer: Server not running');
      return;
    }
    this.serverSerial.close(() => {
      log.info('MbServer: Server stopped');
      return;
    });
  }
  getData(type: string, startAddr: number, length: number) {
    if (type === 'input') {
      const values = new Uint16Array(
        this.inputRegisters.buffer,
        (startAddr - OFFSET) * Uint16Array.BYTES_PER_ELEMENT,
        length,
      );

      return Array.from(values);
    }
    if (type === 'holding') {
      const values = new Uint16Array(
        this.holdingRegisters.buffer,
        (startAddr - OFFSET) * Uint16Array.BYTES_PER_ELEMENT,
        length,
      );

      return Array.from(values);
    }
    if (type === 'coil') {
      const values = this.coils.slice(startAddr - OFFSET, startAddr - OFFSET + length);

      return Array.from(values);
    }
    if (type === 'discreteInput') {
      const values = this.discreteInputs.slice(startAddr - OFFSET, startAddr - OFFSET + length);

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
