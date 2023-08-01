/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-case-declarations */
/* eslint-disable no-fallthrough */
import ModbusRTU from 'modbus-serial';
import{ SerialPort } from 'serialport';
import { InterByteTimeoutParser } from '@serialport/parser-inter-byte-timeout';
import { Semaphore } from 'async-mutex';
import { EventEmitter } from 'events';
import { range } from 'underscore';
import { getIpList } from './networkUtils';
import { crc16modbus } from 'crc';
import { splitFrame } from './frameSplitter.mjs';

const MAX_TCP_CONNECTIONS = 10;
const MODBUS_TCP_CONNECT_TIMEOUT = 100;
const tcpSemaphore = new Semaphore(MAX_TCP_CONNECTIONS);

// const MIN_UNIT_ID = 1
// const MAX_UNIT_ID = 247
const REGISTER_OFFSET = -1;
const REQUEST_TIMEOUT = 100;

const EXCEPTION_CODE = 0x80;

enum MB_FUNCTION {
  READ_COILS = 1,
  READ_DISCRETE_INPUTS = 2,
  READ_HOLDING_REGISTERS = 3,
  READ_INPUT_REGISTERS = 4,
  WRITE_SINGLE_COIL = 5,
  WRITE_SINGLE_HOLDING = 6,
  READ_EXCEPTION_STATUS = 7,
  WRITE_MULTIPLE_COILS = 15,
  WRITE_MULTIPLE_HOLDING = 16,
  READ_FILE = 20,
  WRITE_FILE = 21,
  READ_DEVICE_ID = 43,
  READ_COMPRESSED = 65,
  READ_DANFOSS_EXCEPTION_STATUS = 67,
  EXCEPTION_READ_COILS = EXCEPTION_CODE + READ_COILS,
  EXCEPTION_READ_DISCRETE_INPUTS = EXCEPTION_CODE + READ_DISCRETE_INPUTS,
  EXCEPTION_READ_HOLDING_REGISTERS = EXCEPTION_CODE + READ_HOLDING_REGISTERS,
  EXCEPTION_READ_INPUT_REGISTERS = EXCEPTION_CODE + READ_INPUT_REGISTERS,
  EXCEPTION_WRITE_SINGLE_COIL = EXCEPTION_CODE + WRITE_SINGLE_COIL,
  EXCEPTION_WRITE_SINGLE_HOLDING = EXCEPTION_CODE + WRITE_SINGLE_HOLDING,
  EXCEPTION_READ_EXCEPTION_STATUS = EXCEPTION_CODE + READ_EXCEPTION_STATUS,
  EXCEPTION_READ_DANFOSS_EXCEPTION_STATUS = EXCEPTION_CODE + READ_DANFOSS_EXCEPTION_STATUS,
  EXCEPTION_WRITE_MULTIPLE_COILS = EXCEPTION_CODE + WRITE_MULTIPLE_COILS,
  EXCEPTION_WRITE_MULTIPLE_HOLDING = EXCEPTION_CODE + WRITE_MULTIPLE_HOLDING,
  EXCEPTION_READ_FILE = EXCEPTION_CODE + READ_FILE,
  EXCEPTION_WRITE_FILE = EXCEPTION_CODE + WRITE_FILE,
  EXCEPTION_READ_DEVICE_ID = EXCEPTION_CODE + READ_DEVICE_ID,
  EXCEPTION_READ_COMPRESSED = EXCEPTION_CODE + READ_COMPRESSED
}

const EXCEPTION_CODES: { [key: number]: string} = {
  1: 'Illegal Function',
  2: 'Illegal Data Address',
  3: 'Illegal Data Value',
  4: 'Slave Device Failure',
  5: 'Acknowledge',
  6: 'Slave Device Busy',
  7: 'Negative Acknowledge',
  8: 'Memory Parity Error',
  10: 'Gateway Path Unavailable',
  11: 'Gateway Target Device Failed to Respond',
};

enum ScanState {
  Waiting = 0,
  Scanning = 1,
  Online = 2,
  Offline = 3,
  Online_But_No_Response = 4 // Only relevant for Modbus TCP
}

enum FRAME_TYPE {
  UNKNOWN = 0,
  REQUEST = 1,
  RESPONSE = 2
}

function formatByteArray(byteArray: Buffer) {
  const string = byteArray.reduce((string, byte) => {
    string += byte.toString(16).padStart(2, '0');  
    string += ' ';
    return string;
  }, '');

  return string;
}

function formatTimestamp(date: Date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');

  return `${h}:${m}:${s}:${ms}`;
}


function requestOrResponse(frame: MyModbusFrame, previousFrame: null | MyModbusFrame) {
  // If this frame does not have the same function and address as the previous, it is not a response
  if (frame.mbFunction && frame.mbFunction > EXCEPTION_CODE) {
    return FRAME_TYPE.RESPONSE;
  }

  if (previousFrame !== null) {
    if (frame.mbFunction !== previousFrame.mbFunction || frame.address !== previousFrame.address) {
      return FRAME_TYPE.REQUEST;
    }
  }

  switch (frame.mbFunction) {
    case MB_FUNCTION.READ_EXCEPTION_STATUS:
    case MB_FUNCTION.READ_DANFOSS_EXCEPTION_STATUS:
      if (!frame.data.length) {
        return FRAME_TYPE.REQUEST;
      }
      return FRAME_TYPE.RESPONSE;
    case MB_FUNCTION.READ_INPUT_REGISTERS:
    case MB_FUNCTION.READ_HOLDING_REGISTERS:
    case MB_FUNCTION.READ_COMPRESSED:
      const bytesToRead = frame.data.readUint8(0);
      if (frame.data.byteLength - 1 === bytesToRead){
        return FRAME_TYPE.RESPONSE;
      }
      return FRAME_TYPE.REQUEST;
    case MB_FUNCTION.WRITE_SINGLE_COIL:
    case MB_FUNCTION.WRITE_SINGLE_HOLDING:
    case MB_FUNCTION.WRITE_MULTIPLE_COILS:
    case MB_FUNCTION.WRITE_MULTIPLE_HOLDING:
      if (previousFrame !== null && frame.mbFunction === previousFrame.mbFunction && frame.address === previousFrame.address) {
        if (frame.timestamp.getTime() - previousFrame.timestamp.getTime() < REQUEST_TIMEOUT) {
          return FRAME_TYPE.RESPONSE;
        }
        return FRAME_TYPE.REQUEST;
      }
    case MB_FUNCTION.READ_FILE:
      // console.log('Read file length:')
      // console.log(frame.data.byteLength)
      // console.log(frame.data.length)
      if (frame.data.byteLength !== 8) {
        return FRAME_TYPE.RESPONSE;
      }
      return FRAME_TYPE.REQUEST;
    default:
      return FRAME_TYPE.UNKNOWN;
  }
}

function parseData(frame: MyModbusFrame, previousFrame: null | MyModbusFrame) {
  switch (frame.mbFunction) {
    case MB_FUNCTION.READ_INPUT_REGISTERS:
    case MB_FUNCTION.READ_HOLDING_REGISTERS:
      if (frame.type === FRAME_TYPE.REQUEST) {
        const firstPnu = frame.data.readUint16BE(0) - REGISTER_OFFSET;
        const reqCount = frame.data.readUint16BE(2);
        if (reqCount > 1) {
          return `${firstPnu}-${firstPnu + reqCount - 1}`;
        }
        return firstPnu.toString();
      } else if (frame.type === FRAME_TYPE.RESPONSE && previousFrame) {
        // Get PNU of first register from previous frame
        const firstPnu = previousFrame.data.readUint16BE(0) - REGISTER_OFFSET;
        const reqCount = previousFrame.data.readUint16BE(2);

        if (frame.mbFunction === MB_FUNCTION.READ_INPUT_REGISTERS && firstPnu === 2003 && reqCount === 1) {
          // Reading Danfoss controller version
          const version = frame.data.readInt16BE(1);
          const versionMajor = Math.floor(version / 256);
          const versionMinor = version % 256;
          return `${firstPnu} = ${version} (v${versionMajor}.${versionMinor})`;
        }

        const values = [];
        for (let i = 0; i < reqCount; i++) {
          const value = {
            pnu: firstPnu + i,
            value: frame.data.readInt16BE(1 + i * 2),
          };

          values.push(value);
        }
        return values.map(i => `${i.pnu} = ${i.value}`).join(', ');
      }
      break;
    case MB_FUNCTION.READ_COMPRESSED:
      // Get array of PNU from previousFrame, map to values in this frame
      if (frame.type === FRAME_TYPE.REQUEST) {
        const reqCount = frame.data.readInt8(0);
        const registers = [];
        for (let i = 0; i < reqCount; i++) {
          registers.push(frame.data.readInt16BE(1 + i * 2));
        }
        return registers.join(', ');
      } else if (frame.type === FRAME_TYPE.RESPONSE && previousFrame) {
        const reqCount = previousFrame.data.readInt8(0);
        const values: any[] = [];
        for (let i = 0; i < reqCount; i++) {
          const pnu = previousFrame.data.readInt16BE(1 + i * 2);
          const value = frame.data.readInt16BE(3 + i * 2);
          values.push(`${pnu} = ${value}`);
        }
        return values.join(', ');
      }
      break;
    case MB_FUNCTION.WRITE_SINGLE_COIL:
      {
        const pnu = frame.data.readInt16BE(0) - REGISTER_OFFSET;
        const value = frame.data.readInt16BE(2) === 0 ? 0 : 1;
        return `${pnu} = ${value}`;
      }
    case MB_FUNCTION.WRITE_SINGLE_HOLDING:
      {
        const pnu = frame.data.readInt16BE(0) - REGISTER_OFFSET;
        const value = frame.data.readInt16BE(2);
        return `${pnu} = ${value}`;
      }
    case MB_FUNCTION.WRITE_MULTIPLE_COILS:
      if (frame.type === FRAME_TYPE.REQUEST) {
        const firstPnu = frame.data.readInt16BE(0) - REGISTER_OFFSET;
        const writeCount = frame.data.readInt16BE(2);
        // const byteCount = frame.data.readInt8(4);
        const valuesBuffer = frame.data.slice(5);
        const values = [];
        for (let i = 0; i < writeCount; i++) {
          const pnu = firstPnu + i;
          const value = readBitInBuffer(valuesBuffer, i);
          values.push(`${pnu} = ${value}`);
        }
        return values.join(', ');
      }
      break;
    case MB_FUNCTION.READ_FILE:
      {
        if (frame.type === FRAME_TYPE.REQUEST) {
          console.log(`Frame data length: ${frame.data.length}`);
          const byteCount = frame.data.readInt8(0);
          const refType = frame.data.readInt8(1);
          const fileNumber = frame.data.readUInt16BE(2); // 64054
          const recordNumber = frame.data.readUInt16BE(4); // 0x0000
          // const recordLength = frame.data.readUInt16BE(6); // 3
          // const recordData = frame.data.slice(8, 8 + recordLength * 2); // 3
          if (byteCount === 7 && refType === 6) {
            if (fileNumber <= 0x0010) {
              console.log('Request: Read parameter group');
              return `Request group ${recordNumber}`;
            } else {
              console.log('Request: Read parameter properties');
              return `Request parameter ${recordNumber}`;
            }
          } else if (byteCount === 7 && refType === 7) {
            if (fileNumber === 2015) {
              return 'Request ordernumber';
            }
          }
        }
        if (frame.type === FRAME_TYPE.RESPONSE) {
          const responseDataLength = frame.data.readInt8(0);
          const subReqResponseLength = frame.data.readInt8(1);
          const refType = frame.data.readInt8(2);
          const data = frame.data.slice(3);
          if (responseDataLength === 0x20 && subReqResponseLength === 0x1f && refType === 6) {
            console.log('Response: Read parameter group');
            const groupNumber = data.slice(0, 2);
            console.log(groupNumber.toString());
            const groupName = data.slice(2);
            console.log(groupName);
            return `Group ${groupNumber} = ${groupName}`;
          }
          if (responseDataLength === 0x12 && subReqResponseLength === 0x11 && refType === 7) {
            // console.log("Response: Read order number")
            const [orderNumber, protocolFamily] = data.toString().replace(/\0.*$/g,'').split(' ');
            return `Order number = ${orderNumber}, type = ${protocolFamily || 'Non-EKC'}`;
          }
        }
        break;
      }
    case MB_FUNCTION.WRITE_FILE:
      {
        // console.log(`Frame data length: ${frame.data.length}`)
        // const byteCount = frame.data.readInt8(0);
        const refType = frame.data.readInt8(1);
        const fileNumber = frame.data.readUInt16BE(2); // 64054
        const recordNumber = frame.data.readUInt16BE(4); // 0x0000
        const recordLength = frame.data.readUInt16BE(6); // 3
        const recordData = frame.data.slice(8, 8 + recordLength * 2); // 3
        if (refType === 9 && fileNumber === 64054 && recordNumber === 0x0000) {
          const epoch = recordData.readInt32BE(0);
          const daylightSaving = recordData.readInt8(4);
          const timezone = recordData.readInt8(5);

          const date = new Date(epoch * 1000);
          const h = date.getUTCHours().toString().padStart(2, '0');
          const m = date.getUTCMinutes().toString().padStart(2, '0');
          const s = date.getUTCSeconds().toString().padStart(2, '0');
          const time = `${h}:${m}:${s}`;
          return `Set clock: ${time}, DST: ${daylightSaving}, Timezone: ${timezone}`;
        }
        break;
      }
    case MB_FUNCTION.READ_EXCEPTION_STATUS:
      if (frame.type === FRAME_TYPE.RESPONSE) {
        const status = frame.data.readInt8(0);
        const servicePin = status & 0x0001;
        const parameterChanged = status & 0x0002;
        const alarmStatusChanged = status & 0x0004;
        const alarmActive = status & 0x0008;
        return `Service PIN = ${servicePin}, Parameter changed = ${parameterChanged}, Alarm status changed = ${alarmStatusChanged}, Alarm active = ${alarmActive}`;
      }
      break;
  }

  if (frame.mbFunction && frame.mbFunction >= EXCEPTION_CODE) {
    const exceptionCode: number = frame.data.readInt8(0);
    if (exceptionCode in EXCEPTION_CODES) {
      return EXCEPTION_CODES[exceptionCode];
    }
    return 'Unknown exception';
  }

  return formatByteArray(frame.data);
}

function getBitInNumber(number: number, n: number) {
  return (number & (1 << n)) === 0 ? 0 : 1;
}

function readBitInBuffer(buffer: Buffer, n: number) {
  return getBitInNumber(buffer.readInt8(~~(n / 8)), n % 8);
}

function parseModbusFrame(buffer: Buffer, timestamp: Date): MyModbusFrame {
  let crc = false;
  let address = null;
  let mbFunction = null;
  let data = null;
  // console.log(formatByteArray(buffer))

  if (buffer.length < 4) {
    // console.log('Not enough data to be a real frame')
    data = buffer;
  } else {
    // console.log('Length is at least 4 bytes, so we will check CRC')
    const frameData = buffer.slice(0, -2);
    // console.log('Frame bytes:', formatByteArray(frameData))
    const crcIn = buffer.readUInt16LE(buffer.length - 2);
    crc = crcIn === crc16modbus(frameData);
    if (crc) {
      // console.log('CRC is OK!')
      address = frameData.readUint8(0);
      mbFunction = frameData.readUint8(1);
      data = frameData.slice(2);
    } else {
      // console.log('BAD CRC!')
      data = buffer;
    }
  }

  return {
    timestamp,
    crc,
    address,
    mbFunction,
    data,
    buffer,
  };
}

function uint16ToInt16(number: number) {
  return new Int16Array([number])[0];
}

function int16ToUint16(number: number) {
  return new Uint16Array([number])[0];
}

async function modbusRequest(client: ModbusRTU, unitId: number, timeout: number, mbFunction: number, mbOptions: GenericObject): Promise<ModbusRequestResponse> {
  let result;
  let errorCode;
  let errorText;
  let addr: number;
  let count: number;

  const start = process.hrtime();
  client.setID(unitId);
  client.setTimeout(timeout);
  try {
    switch (mbFunction) {
      case MB_FUNCTION.READ_COILS:
        addr = parseInt(mbOptions.addr);
        count = parseInt(mbOptions.count);
        result = await client.readCoils(addr + REGISTER_OFFSET, count);
        result = result.data.map((item, index) => {
          return { addr: addr + index, value: item ? 1 : 0 };
        });
        break;
      case MB_FUNCTION.READ_DISCRETE_INPUTS:
        addr = parseInt(mbOptions.addr);
        count = parseInt(mbOptions.count);
        result = await client.readDiscreteInputs(addr + REGISTER_OFFSET, count);
        result = result.data.map((item, index) => {
          return { addr: addr + index, value: item ? 1 : 0 };
        });
        break;
      case MB_FUNCTION.READ_HOLDING_REGISTERS:
        addr = parseInt(mbOptions.addr);
        count = parseInt(mbOptions.count);
        result = await client.readHoldingRegisters(addr + REGISTER_OFFSET, count);
        result = result.data.map((item, index) => {
          return { addr: addr + index, value: uint16ToInt16(item) };
        });
        break;
      case MB_FUNCTION.READ_INPUT_REGISTERS:
        addr = parseInt(mbOptions.addr);
        count = parseInt(mbOptions.count);
        result = await client.readInputRegisters(addr + REGISTER_OFFSET, count);
        result = result.data.map((item, index) => {
          return { addr: addr + index, value: uint16ToInt16(item) };
        });
        break;
      case MB_FUNCTION.WRITE_SINGLE_COIL:
        addr = parseInt(mbOptions.addr);
        result = await client.writeCoil(addr + REGISTER_OFFSET, mbOptions.value === 1);

        result = [{
          addr: result.address - REGISTER_OFFSET,
          value: result.state ? 1 : 0,
        }];
        break;
      case MB_FUNCTION.WRITE_MULTIPLE_COILS:
        {
          addr = parseInt(mbOptions.addr);
          const values: boolean[] = mbOptions.values.map((i: number) => i === 1);
          result = await client.writeCoils(addr + REGISTER_OFFSET, values);
          

          if (result.length !== values.length) {
            console.log('Write coils result did not match request length!');
            throw new Error('Write failed');
          }

          result = values.map((item, index) => {
            return { addr: addr + index, value: item };
          });
        }
        break;
      case MB_FUNCTION.WRITE_SINGLE_HOLDING:
        addr = parseInt(mbOptions.addr);
        const value = parseInt(mbOptions.value);
        result = await client.writeRegister(addr + REGISTER_OFFSET, int16ToUint16(value));

        result = [{
          addr: result.address - REGISTER_OFFSET,
          value: uint16ToInt16(result.value),
        }];
        break;
      case MB_FUNCTION.WRITE_MULTIPLE_HOLDING:
        {
          addr = parseInt(mbOptions.addr);
          const values: number[] = mbOptions.values.map(int16ToUint16);
          // TODO: Check if values are an array of numbers
          result = await client.writeRegisters(addr + REGISTER_OFFSET, values);

          if (result.length !== values.length) {
            console.log('Write registers result did not match request length!');
            throw new Error('Write failed');
          }

          result = values.map((item, index) => {
            return { addr: addr + index, value: uint16ToInt16(item) };
          });
        }
        break;
      default:
        console.log('Unknown modbus function!');
        errorCode = 998;
        errorText = 'Modbus function not implemented yet';
    }   
  } catch (err: any) {
    errorCode = err.modbusCode;
    errorText = err.message;
    if (err.name === 'TransactionTimedOutError') {
      errorCode = 408;
      errorText = 'Timeout: No response from device';
    }
    if (!errorCode) {
      errorCode = 999;
    }
  }

  const executionTime = process.hrtime(start)[1] / 1000000; // divide by a million to get nano to milli

  return {
    result,
    executionTime,
    errorCode,
    errorText,
    timestamp: new Date(),
  };
}

export async function modbusRtuRequest(configuration: SingleModbusRtuRequestConfiguration) {
  const { port, timeout, baudRate, parity, dataBits, stopBits, task } = configuration;
  const { unitId, mbFunction, mbOptions } = task;
  let result;
  const client = new ModbusRTU();
  if (client.isOpen) client.close(() => null);
  try {
    await client.connectRTUBuffered(port, { baudRate, parity, dataBits, stopBits });
    // console.log('Modbus RTU port opened!')
    result = await modbusRequest(client, unitId, timeout, mbFunction, mbOptions);
  } catch (error) {
    if (client.isOpen) client.close(() => null);
    return {
      result: null,
      executionTime: 0,
      errorCode: 996,
      errorText: 'Serial port already in use',
      timestamp: new Date(),
    };
  }

  if (client.isOpen) client.close(() => null);

  return result;
}

export async function modbusTcpRequest(configuration: SingleModbusTcpRequestConfiguration): Promise<ModbusRequestResponse> {
  const { ip, port, timeout, task } = configuration;
  const { unitId, mbFunction, mbOptions } = task;
  let result;
  const client = new ModbusRTU();
  try {
    client.setTimeout(MODBUS_TCP_CONNECT_TIMEOUT);
    await client.connectTCP(ip, { port });
    // console.log('Modbus TCP connected!')

    result = await modbusRequest(client, unitId, timeout, mbFunction, mbOptions);
  } catch (error) {
    if (client.isOpen) client.close(() => null); // TODO: Comment this to keep connections open
    return {
      result: null,
      executionTime: MODBUS_TCP_CONNECT_TIMEOUT,
      errorCode: 408,
      errorText: 'Timeout: Failed to establish connection',
      timestamp: new Date(),
    };
  }

  if (client.isOpen) client.close(() => null); // TODO: Comment this to keep connections open

  return result;
}

class ModbusLogger extends EventEmitter {
  requestsTotal!: number;
  requestsDone!: number;
  requestsTimedOut!: number;
  totalResponseTime!: number;
  countsDone!: number;
  progress!: number;
  successfulRequests!: number;

  constructor() {
    super();
    this.emit('log', 'Logger initiated!');
    this.reset();
  }

  reset() {
    this.requestsTotal = 0;
    this.requestsDone = 0;
    this.requestsTimedOut = 0;
    this.totalResponseTime = 0;
    this.countsDone = 0;
    this.progress = 0;
    this.successfulRequests = 0;
  }

  log(type: string, message: any) {
    this.emit('log', {
      type,
      message,
    });
  }
}

async function sleep(time: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

export class ModbusLoggerRTU extends ModbusLogger {
  constructor() {
    super();
  }

  async request(configuration: RtuLoggerConfiguration) {
    const { port, timeout, baudRate, parity, dataBits, stopBits, tasks, count, delay } = configuration;
    this.reset();
    this.requestsTotal = tasks.length * count;

    const client = new ModbusRTU();
    try {
      await client.connectRTUBuffered(port, { baudRate, parity, dataBits, stopBits });
      // console.log('Modbus RTU port opened!')
    } catch (error) {
      console.log('Error when opening RTU port');
      client.close(() => null); // TODO: Comment this to keep connections open
      // console.log('Closed port')
      throw (error);
    }

    while (this.countsDone < count) {
      for (const task of tasks) {
        const timestamp = new Date();
        let result = null;
        let errorText = '';
        let errorCode = 0;
        let executionTime = 0;

        try {
          // console.log(client.setID)
          const requestResult = await modbusRequest(client, task.unitId, timeout, task.mbFunction, task.mbOptions);
          executionTime = requestResult.executionTime;
          errorCode = requestResult.errorCode;
          errorText = requestResult.errorText;
          result = requestResult.result;

          // ({ executionTime, result } = await modbusRequest(client, task.mbFunction, task.mbOptions))
          if (errorCode === 408) {
            this.requestsTimedOut++;
          } else if (!errorCode) {
            this.successfulRequests++;
            this.totalResponseTime += executionTime;
          }
        } catch (err: any) {
          // console.log(err)
          errorText = err.message;
          errorCode = 999;
        }

        this.requestsDone++;

        this.progress = Math.round(this.requestsDone / this.requestsTotal * 100);

        this.emit('log', {
          request: {
            id: this.requestsDone,
            unitId: task.unitId,
            mbFunction: task.mbFunction,
            mbAddr: task.mbOptions.addr,
            executionTime,
            result,
            errorCode,
            errorText,
            timestamp,
          },
          stats: {
            successfulRequests: this.successfulRequests,
            averageResponseTime: this.successfulRequests ? this.totalResponseTime / this.successfulRequests : 0,
            requestsTimedOut: this.requestsTimedOut,
            requestsDone: this.requestsDone,
            requestsTotal: this.requestsTotal,
            progress: this.progress,
          },
        });
        await sleep(delay);
      }
      this.countsDone++;
    }
    client.close(() => null); // TODO: Comment this to keep connections open
  }
}

export class ModbusLoggerTCP extends ModbusLogger {
  constructor() {
    super();
  }

  async request(configuration: TcpLoggerConfiguration) {
    const { ip, port, timeout, tasks, count, delay } = configuration;
    this.countsDone = 0;
    this.requestsDone = 0;
    this.successfulRequests = 0;
    this.requestsTimedOut = 0;
    this.totalResponseTime = 0;
    this.progress = 0;
    this.requestsTotal = tasks.length * count;

    const client = new ModbusRTU();
    try {
      client.setTimeout(MODBUS_TCP_CONNECT_TIMEOUT);
      await client.connectTCP(ip, { port });
      // console.log('Modbus TCP connected!')
    } catch (error) {
      if (client.isOpen) client.close(() => null); // TODO: Comment this to keep connections open
      throw (error);
    }

    while (this.countsDone < count) {
      for (const task of tasks) {
        const timestamp = new Date();
        let result = null;
        let errorText = '';
        let errorCode = 0;
        let executionTime = 0;

        try {
          const requestResult = await modbusRequest(client, task.unitId, timeout, task.mbFunction, task.mbOptions);
          executionTime = requestResult.executionTime;
          errorCode = requestResult.errorCode;
          errorText = requestResult.errorText;
          result = requestResult.result;

          // ({ executionTime, result } = await modbusRequest(client, task.mbFunction, task.mbOptions))
          if (errorCode === 408) {
            this.requestsTimedOut++;
          } else if (!errorCode) {
            this.successfulRequests++;
            this.totalResponseTime += executionTime;
          }
        } catch (err: any) {
          // console.log(err)
          errorText = err.message;
          errorCode = 999;
        }

        this.requestsDone++;

        this.progress = Math.round(this.requestsDone / this.requestsTotal * 100);

        this.emit('log', {
          request: {
            id: this.requestsDone,
            unitId: task.unitId,
            mbFunction: task.mbFunction,
            mbAddr: task.mbOptions.addr,
            executionTime,
            result,
            errorCode,
            errorText,
            timestamp,
          },
          stats: {
            successfulRequests: this.successfulRequests,
            averageResponseTime: this.successfulRequests ? this.totalResponseTime / this.successfulRequests : 0,
            requestsTimedOut: this.requestsTimedOut,
            requestsDone: this.requestsDone,
            requestsTotal: this.requestsTotal,
            progress: this.progress,
          },
        });

        await sleep(delay);
      }
      this.countsDone++;
    }
    if (client.isOpen) client.close(() => null); // TODO: Comment this to keep connections open
  }
}

class ModbusScanner extends EventEmitter {
  scanList: any[];
  foundUnits: number;

  constructor() {
    super();
    this.scanList = [];
    this.foundUnits = 0;
  }

  log(type: string, message: any) {
    this.emit('log', {
      type,
      message,
    });
  }
}

function timeSince(start: [number, number]) {
  const [elapsedSec, elapsedNano] = process.hrtime(start);
  return `${elapsedSec}.${(elapsedNano / 1000000).toFixed().padStart(3, '0')}s`;
}

export class ModbusScannerTCP extends ModbusScanner {
  scanList: ScanItem[];
  stateList: string[];
  constructor() {
    super();
    this.scanList = [];
    this.stateList = [];
    this.stateList[ScanState.Waiting] = 'Waiting';
    this.stateList[ScanState.Scanning] = 'Scanning';
    this.stateList[ScanState.Online] = 'Online';
    this.stateList[ScanState.Offline] = 'Server offline';
    this.stateList[ScanState.Online_But_No_Response] = 'Server online but no response';

    this.emit('log', 'Scanner initiated!');
  }

  async scan({
    startIp,
    endIp,
    port,
    minUnitId,
    maxUnitId,
    timeout,
  }: ModbusTcpScanConfiguration) {
    const start = process.hrtime();
    // console.log('Start:')
    // console.log(start[0])
    // console.log(start[1])
    this.scanList = getIpList(startIp, endIp).map(ip => {
      return {
        id: ip,
        state: ScanState.Waiting,
        stateText: this.stateList[ScanState.Waiting],
        errorMessage: '',
      };
    });

    this.emit('status', this.scanList);
    this.emit('progress', [0, this.foundUnits]);

    const searchSlaves = async (scanItem: ScanItem) => {
      const client = new ModbusRTU();
      client.setTimeout(timeout);

      const ip = scanItem.id as string;
      this.log('info', `${timeSince(start)}: Checking if server at ${ip}:${port} `);
      scanItem.state = 1;
      scanItem.stateText = this.stateList[ScanState.Scanning];

      try {
        await client.connectTCP(ip, { port });
        this.log('success', `${timeSince(start)}: Server alive at ${ip}:${port} `);

        const checkUnitId = async (id: UnitId) => {
          if (!client.isOpen) {
            console.log('Reconnecting to host');
            await client.connectTCP(ip, { port });
          }
          this.log('info', `${timeSince(start)}: Checking if unitID ${id} responds`);
          // try to read a known register that exists on each controller
          client.setID(id);
          try {
            await client.readHoldingRegisters(0, 1);
            // if data exists outputs success
            this.log('success', `${timeSince(start)}: Unit is online`);
            scanItem.state = ScanState.Online;
            scanItem.stateText = this.stateList[ScanState.Online];
            scanItem.errorMessage = `Unit ID: ${id}.Online`;
            this.foundUnits++;
            return true;

            // if no response and timeout kicks in script assumes no slave exists on this address.
          } catch (error: any) {
            // if err.name === 'TransactionTimedOutError'
            if (error.message.startsWith('Modbus exception')) {
              this.log('info', `${timeSince(start)}: Unit gave response with a modbus exception(${error.message})`);
              scanItem.state = ScanState.Online;
              scanItem.stateText = this.stateList[ScanState.Online];
              scanItem.errorMessage = `Unit ID: ${id}. ${error.message} `;
              return true;
            } else {
              this.log('info', `${timeSince(start)}: Unit is not responding(${error.message})`);
              // console.log(`${error.message} -> Unit is considered to be offline`);
              // console.log(err.message)
              scanItem.state = ScanState.Online_But_No_Response;
              scanItem.stateText = this.stateList[ScanState.Online_But_No_Response];
              scanItem.errorMessage = `${error.message} (${error.name})`;
              return false;
            }
          }
        };

        for (let id = minUnitId; id <= maxUnitId; id++) {
          scanItem.state = ScanState.Scanning;
          scanItem.stateText = this.stateList[ScanState.Scanning];
          const unitOK = await checkUnitId(id);
          if (unitOK) {
            // console.log(`${ ip } -${ id }: Will exit for loop!`)
            break;
          }
          // console.log(`${ ip } - ${ id }: Will continue for loop`)
        }
        // console.log(`${ ip }: Will break connection!`)
        client.close(() => null);
      } catch (error: any) {
        // console.log(error)
        this.log('info', `${timeSince(start)}: Unable to connect to ${ip}:${port} `);
        // console.log(`${timeSince(start)}: Unable to connect to ${ip}:${port} `)
        scanItem.state = ScanState.Offline;
        scanItem.stateText = this.stateList[ScanState.Offline];
        scanItem.errorMessage = error.message;
      }

      this.emit('status', this.scanList);

      const itemsScanned = this.scanList.reduce((acc, item) => {
        if (item.state > ScanState.Scanning) {
          acc++;
        }
        return acc;
      }, 0);

      const progress = (itemsScanned / this.scanList.length) * 100;

      this.emit('progress', [progress, this.foundUnits]);

      // if (host === endIp) {
      //   
      //   return
      // }
    };


    const promises = this.scanList.map(item => {
      return tcpSemaphore.runExclusive(() => searchSlaves(item));
    });

    await Promise.all(promises);
    // console.log('Done!');
    // const end = process.hrtime()
    // console.log('End:')
    // console.log(start[0])
    // console.log(start[1])

    // console.log('Diff:')
    // console.log(process.hrtime(start)[0])
    // console.log(process.hrtime(start)[1])
    const executionTime = process.hrtime(start)[1] / 1000000; // divide by a million to get nano to milli
    // console.log(`${(new Date).getTime()} `)
    this.log('info', `Scan completed after ${(executionTime).toFixed(1)} ms`);
  }
}

export class ModbusScannerRTU extends ModbusScanner {
  stateList: string[];
  constructor() {
    super();
    this.stateList = [
      'Waiting',
      'Scanning',
      'Alive',
      'Unavailable',
      'Dead',
    ];

    this.emit('log', 'Scanner initiated!');
  }

  async scan({
    port,
    baudRate,
    parity,
    dataBits,
    stopBits,
    timeout,
    minUnitId,
    maxUnitId,
    delay,
  }: ModbusRtuScanConfiguration) {
    this.emit('status', this.scanList);
    this.emit('progress', [0, this.foundUnits]);

    this.scanList = range(minUnitId, maxUnitId + 1).map((unitId: UnitId) => {
      return {
        id: unitId,
        state: 0,
        stateText: this.stateList[0],
        errorMessage: '',
      };
    });

    const searchSlaves = async () => {
      const client = new ModbusRTU();
      client.setTimeout(timeout);

      try {
        await client.connectRTUBuffered(port, { baudRate, parity, dataBits, stopBits });
        this.log('success', `Opened ${port} successfully`);

        const checkUnitId = async (scanItem: ScanItem) => {
          const id = scanItem.id as number;
          // if (!client.isOpen) {
          //   console.log('Reconnecting to host')
          //   await client.connectTCP(ip, { port })
          // }
          this.log('info', `Checking if unitID ${id} responds`);
          // try to read a known register that exists on each controller
          client.setID(id);
          try {
            await client.readHoldingRegisters(0, 1);
            // if data exists outputs success
            this.log('success', 'Unit is online');
            scanItem.state = ScanState.Online;
            scanItem.stateText = this.stateList[ScanState.Online];
            scanItem.errorMessage = `Unit ID: ${id}.Online`;
            this.foundUnits++;
            return true;

            // if no response and timeout kicks in script assumes no slave exists on this address.
          } catch (error: any) {
            // if err.name === 'TransactionTimedOutError'
            if (error.message.startsWith('Modbus exception')) {
              this.log('info', `Unit gave response with a modbus exception(${error.message})`);
              scanItem.state = ScanState.Online;
              scanItem.stateText = this.stateList[ScanState.Online];
              scanItem.errorMessage = `Unit ID: ${id}. ${error.message} `;
              this.foundUnits++;
              return true;
            } else {
              this.log('info', `Unit is not responding(${error.message})`);
              // console.log(`${error.message} -> Unit is considered to be offline`);
              // console.log(err.message)
              scanItem.state = ScanState.Offline;
              scanItem.stateText = this.stateList[ScanState.Offline];
              scanItem.errorMessage = `${error.message} (${error.name})`;
              return false;
            }
          }
        };

        for (const scanItem of this.scanList) {
          scanItem.state = ScanState.Scanning;
          scanItem.stateText = this.stateList[ScanState.Scanning];
          await checkUnitId(scanItem);

          this.emit('status', this.scanList);
          await sleep(delay);

          const itemsScanned = this.scanList.reduce((acc, item) => {
            if (item.state > 1) {
              acc++;
            }
            return acc;
          }, 0);

          const progress = (itemsScanned / this.scanList.length) * 100;

          this.emit('progress', [progress, this.foundUnits]);
        }
        // console.log(`${ ip }: Will break connection!`)
        client.close(() => null);
      } catch (error) {
        console.log(error);
        this.log('info', `Unable to open ${port} `);
        throw(error);
      }
    };

    await searchSlaves();
    // console.log('Done!');
    this.log('info', 'Scan complete!');
    this.emit('progress', [100, this.foundUnits]);
  }
}

export class ModbusAnalyzer extends EventEmitter {
  serialPort: SerialPort | null;
  constructor() {
    super();

    this.serialPort = null;
  }

  async start(configuration: SerialPortConfiguration) {
    return new Promise((resolve, reject) => {
      const { port, baudRate, parity, dataBits, stopBits } = configuration;

      console.log('Creating now SerialPort');
      this.serialPort = new SerialPort({ path: port, baudRate, parity, dataBits, stopBits, autoOpen: false });
      console.log('Attaching to parser');
      const parser = this.serialPort.pipe(new InterByteTimeoutParser({ interval: 15 }));
    
      let previousFrame: MyModbusFrame | null = null;

      parser.on('data', (data) => {
        const timestamp = new Date();
        const frames = splitFrame(data);
        if (!frames.length) {
          // Found no good frame, use the whole frame
          frames[0] = data;
        }

        frames.forEach(frame => {
          const modbusFrame = parseModbusFrame(frame, timestamp);
          modbusFrame.type = requestOrResponse(modbusFrame, previousFrame);
          let data;

          if (modbusFrame.address === 170 && modbusFrame.mbFunction === 7 && !modbusFrame.data.length) {
            data = 'Danfoss baudrate sync';
          } else {
            try {
              data = parseData(modbusFrame, previousFrame);
            } catch (error) {
              console.error(error);
              data = 'Error! ' + formatByteArray(modbusFrame.data);
            }
          }

          this.emit('log', {
              timestamp: formatTimestamp(timestamp),
              crc: modbusFrame.crc,
              address: modbusFrame.address,
              mbFunction: modbusFrame.mbFunction,
              type: modbusFrame.type,
              data,
              buffer: formatByteArray(modbusFrame.buffer),
          });

          previousFrame = modbusFrame;
        });
      }); 
      
      this.serialPort.open((error) => {
        if (error) {
          console.log(error);
          reject('Unable to open port');
        }
        resolve(true);
      });
    });
  }

  async stop() {
    console.log('Stopping analyzer');
    if (this.serialPort) console.log(this.serialPort.isOpen);
    if (!this.serialPort) {
      return;
    }
    console.log('Closing port!');
    this.serialPort.close(() => {
      return;
    });
  }
}
