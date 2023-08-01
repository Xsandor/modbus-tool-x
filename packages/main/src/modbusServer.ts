import { EventEmitter } from 'events';

/* eslint-disable no-console, no-unused-vars, spaced-comment */
// const ModbusRTU = require("modbus-serial")
import type { ModbusServerVector} from 'modbus-serial';
import { ServerSerial } from 'modbus-serial';

// const HOST = "0.0.0.0"
// const PORT = 8502
const DEBUG = process.env.NODE_ENV !== 'production';

const minAddress = 0;

const maxDiscreteAddress = 0xFFFF;
const maxCoilAddress = 0xFFFF;
const maxInputAddress = 0xFFFF;
const maxHoldingAddress = 0xFFFF;

const numDiscreteInputs = maxDiscreteAddress - minAddress + 1;
const numCoils = maxCoilAddress - minAddress + 1;
const numInputRegisters = maxInputAddress - minAddress + 1;
const numHoldingRegisters = maxHoldingAddress - minAddress + 1;

const OFFSET = 1; // For displaying modbus register addresses

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

log.debug(`Allocating ${numCoils} bytes for coils`);
const coils = Buffer.alloc(numCoils, 0); // coils inputs

coils.writeInt8(1, 232);
coils.writeInt8(1, 233);
coils.writeInt8(1, 236);
coils.writeInt8(1, 237);
coils.writeInt8(1, 238);
coils.writeInt8(1, 999);
coils.writeInt8(1, 202);
coils.writeInt8(1, 203);
coils.writeInt8(1, 1000);
coils.writeInt8(1, 1001);

log.debug(`Allocating ${numDiscreteInputs} bytes for discrete inputs`);
const discreteInputs = Buffer.alloc(numCoils, 0); // discrete inputs

log.debug(`Allocating ${numHoldingRegisters * 2} bytes for holding registers`);
const holdingRegisters = Buffer.alloc(numHoldingRegisters * 2, 0); // holding registers

holdingRegisters.writeUInt16LE(castToUInt(100), 100 * 2);
holdingRegisters.writeUInt16LE(castToUInt(101), 101 * 2);

log.debug(`Allocating ${numInputRegisters * 2} bytes for input registers`);
const inputRegisters = Buffer.alloc(numInputRegisters * 2, 0); // input registers

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

function castToUInt(x: number) {
  if (x < 0) {
    console.log(`Casting ${x} to ${0xFFFF + 1 + x}`);
    return 0xFFFF + 1 + x;
  }

  return x;
}

mhiInputRegisters.forEach(([_name, value], offset) => {
  inputRegisters.writeUInt16LE(castToUInt(value), offset * 2);
});

const OIL_RECOVERY_TIME_PNU = 31;
const EFFECT_OF_LIQUID_BACK_PNU = 33;
inputRegisters.writeUInt16LE(castToUInt(5), OIL_RECOVERY_TIME_PNU * 2);
discreteInputs.writeInt8(1, 0);

let effectOfLiquidBack = 0;

function oilRecovery () {
  console.log('Oil recovery started');
  discreteInputs.writeInt8(1, 8);
  
  setTimeout(() => {
    console.log('Oil recovery stopped');
    discreteInputs.writeInt8(0, 8);
    effectOfLiquidBack = effectOfLiquidBack === 0 ? 1 : 0;
    console.log(`Setting effect of liquid back to: ${effectOfLiquidBack}`	);
    inputRegisters.writeUInt16LE(effectOfLiquidBack, EFFECT_OF_LIQUID_BACK_PNU * 2);
  }, 15000);
}

setTimeout(() => {
  oilRecovery();
  setInterval(oilRecovery, 30000);
}, 15000);



function isIllegalAddress(type = 'holdingRegister', address = 1, count = 1) {
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

const SERIAL_PORT = 'COM10';
const BAUDRATE = 19200;
const PARITY = 'even';
const DATA_BITS = 8;
const STOP_BITS = 1;
const UNIT_ID = 255;

export class ModbusServer extends EventEmitter {
  constructor(configuration: ModbusRtuServerConfiguration) {
    super();

    log.info('Running construcor');
    log.info(configuration);

    const vector: ModbusServerVector = {
      getCoil: (addr, _unitID, cb) => {
        log.debug(`Read single coil. Address: ${addr + OFFSET}`);
    
        if (isIllegalAddress('coil', addr)) {
          log.debug('Address out of range');
          return cb(ILLEGAL_ADDRESS_ERROR, null);
        }
        log.debug('Value', coils.readUInt8(addr));

        return cb(NO_ERROR, coils.readUInt8(addr));
      },
      getDiscreteInput: (addr, _unitID, cb) => {
        log.debug(`Read single discrete input. Address ${addr + OFFSET}`);
    
        if (isIllegalAddress('discreteInput', addr)) {
          log.debug('Address out of range');
          return cb(ILLEGAL_ADDRESS_ERROR, null);
        }
        return cb(NO_ERROR, discreteInputs.readUInt8(addr));
      },
      getInputRegister: (addr, _unitID, cb) => {
        log.debug(`Read single input register. Address: ${addr + OFFSET}`);
    
        if (isIllegalAddress('inputRegister', addr)) {
          log.debug('Address out of range');
          return cb(ILLEGAL_ADDRESS_ERROR, null);
        }
        return cb(
          null,
          inputRegisters.readUInt16LE(addr * Uint16Array.BYTES_PER_ELEMENT),
        );
      },
      getHoldingRegister: (addr, _unitID, cb) => {
        log.debug(`Read single holding register. Address: ${addr + OFFSET}`);
    
        if (isIllegalAddress('holdingRegister', addr)) {
          return cb(ILLEGAL_ADDRESS_ERROR, null);
        }
        const value = holdingRegisters.readUInt16LE(
          addr * Uint16Array.BYTES_PER_ELEMENT,
        );
        return cb(NO_ERROR, value);
      },
      getMultipleHoldingRegisters: (startAddr, length, _unitID, cb) => {
        log.debug(
          `Read multiple holding holdingRegisters. Address: ${startAddr + OFFSET}, count: ${length}`,
        );
    
        if (isIllegalAddress('holdingRegister', startAddr, length)) {
          log.debug('Out of range!');
          return cb(ILLEGAL_ADDRESS_ERROR, []);
        }
    
        const values = new Uint16Array(
          holdingRegisters.buffer,
          startAddr * Uint16Array.BYTES_PER_ELEMENT,
          length,
        );
    
        return cb(NO_ERROR, Array.from(values));
      },
      getMultipleInputRegisters: (startAddr, length, _unitID, cb) => {
        log.debug(
          `Read multiple input registers. Address: ${startAddr + OFFSET}, count: ${length}`,
        );
    
        if (isIllegalAddress('inputRegister', startAddr, length)) {
          log.debug('ILLEGAL ADDRESS!');
          return cb(ILLEGAL_ADDRESS_ERROR, []);
        }
    
        const values = new Uint16Array(
          inputRegisters.buffer,
          startAddr * Uint16Array.BYTES_PER_ELEMENT,
          length,
        );
    
        // log.debug(Array.from(values))
        // log.debug('Calling callback without error')
        return cb(NO_ERROR, Array.from(values));
      },
      setCoil: (addr, value, _unitID, cb) => {
        log.debug(`Write single coil. Address: ${addr + OFFSET}, value: ${value}`);

        this.emit('log', 'info', `Write single coil. Address: ${addr + OFFSET}, value: ${value}`);
    
        if (isIllegalAddress('coil', addr)) {
          log.debug('Address out of range');
          return cb(ILLEGAL_ADDRESS_ERROR, null);
        }
    
        coils.writeUInt8(value, addr);
        return cb();
      },
      // setCoilArray doesn't not seem to be used, not when writing from Modpoll at least
      setCoilArray: (startAddr, values, _unitID, cb) => {
        // log.debug(`Write multiple coils. Address: ${startAddr + OFFSET}. Values: [${values.join(',')}]`)
        this.emit('log', 'info', `Write multiple coils. Address: ${startAddr + OFFSET}, value: ${values}`);
    
        if (isIllegalAddress('coil', startAddr, values.length)) {
          return cb(ILLEGAL_ADDRESS_ERROR, null);
        }
        // coils.writeUInt8(values, startAddr)
        return cb();
      },
      setRegister: (addr, value, _unitID, cb) => {
        // log.debug(
        //   `Write single holding register. Address: ${addr + OFFSET}, value: ${value}`
        // )
        this.emit('log', 'info', `Write single holding register. Address: ${addr + OFFSET}, value: ${value}`);
    
        if (isIllegalAddress('holdingRegister', addr)) {
          log.debug('Address out of range');
          return cb(ILLEGAL_ADDRESS_ERROR, null);
        }
        holdingRegisters.writeUInt16LE(value, addr * Uint16Array.BYTES_PER_ELEMENT);
        return cb();
      },
      // setRegisterArray doesn't not seem to be used, not when writing from Modpoll at least
      setRegisterArray: (startAddr, values, _unitID, cb) => {
        // log.debug(`Write multiple holding register. Address: ${startAddr + OFFSET}. Values: ${values.join(',')}`)
        this.emit('log', 'info', `Write multiple holding register. Address: ${startAddr + OFFSET}. Values: ${values.join(',')}`);
    
        if (isIllegalAddress('holdingRegister', startAddr, values.length)) {
          this.emit('log', 'warn', 'Illegal address.');
          return cb(ILLEGAL_ADDRESS_ERROR, null);
        }
        values.forEach((value, index) => {
          holdingRegisters.writeUInt16LE(
            value,
            (startAddr + index) * Uint16Array.BYTES_PER_ELEMENT,
          );
        });
        return cb();
      },
    };

    try {
      const serverSerial = new ServerSerial(vector, {
        port: configuration.port || SERIAL_PORT,
        unitID: configuration.unitId || UNIT_ID,
        baudRate: configuration.baudRate || BAUDRATE,
        interval: 10,
        debug: true,
      }, { 
        parity: configuration.parity || PARITY,
        dataBits: configuration.dataBits || DATA_BITS,
        stopBits: configuration.stopBits || STOP_BITS,
      });

      log.info('Created serverSerial');

      serverSerial.on('open', () => {
        log.info('Opened Serial Server:');
      });
      
      serverSerial.on('close', () => {
        log.info('Closed Serial Server:');
      });
      
      serverSerial.on('initialized', () => {
        log.info(
          `Modbus Serial listening ${SERIAL_PORT}, baudrate: ${BAUDRATE}, Unit ID: ${UNIT_ID}`,
        );
      });
      
      serverSerial.on('error', (err: Error) => {
        log.error('An error occured in Serial Server:');
        log.error(err);
      });
      
      serverSerial.on('socketError', (err: Error) => {
        log.error(err);
        serverSerial.close(() => {
          log.info('Serial Server closed');
        });
      });

      serverSerial.on('log', (type: 'warn' | 'info', message: string) => {
        if (type === 'warn') {
          log.error(message);
        } else {
          // log.info(message)
        }
      });
    } catch (error) {
      log.error('Error in constructor');
      log.error(error);
    }
    
  }
  getData(type: string, startAddr: number, length: number) {
    if (type === 'input') {
      const values = new Uint16Array(
        inputRegisters.buffer,
        (startAddr - OFFSET) * Uint16Array.BYTES_PER_ELEMENT,
        length,
      );
  
      return Array.from(values);
    }
    if (type === 'holding') {
      const values = new Uint16Array(
        holdingRegisters.buffer,
        (startAddr - OFFSET) * Uint16Array.BYTES_PER_ELEMENT,
        length,
      );
  
      return Array.from(values);
    }
    if (type === 'coil') {
      const values = coils.slice((startAddr - OFFSET), (startAddr - OFFSET) + length);
  
      return Array.from(values);
    }
    if (type === 'discreteInput') {
      const values = discreteInputs.slice((startAddr - OFFSET), (startAddr - OFFSET) + length);
  
      return Array.from(values);
    }

    return [];
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
