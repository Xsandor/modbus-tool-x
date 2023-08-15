import {SerialPort} from 'serialport';
import {InterByteTimeoutParser} from '@serialport/parser-inter-byte-timeout';
import {EventEmitter} from 'events';
import {crc16modbus} from 'crc';
import {splitFrame} from './frameSplitter.mjs';
import {EXCEPTION_CODE, FRAME_TYPE, MB_FUNCTION} from './modbusCommon';
import {formatByteArray, formatTimestamp} from './utilities';
import {parseData} from './parseData';
import {DANFOSS_BAUDRATE_SYNC_ADDRESS} from './danfoss';

const REQUEST_TIMEOUT = 100;

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
      // eslint-disable-next-line no-case-declarations
      const bytesToRead = frame.data.readUint8(0);
      if (frame.data.byteLength - 1 === bytesToRead) {
        return FRAME_TYPE.RESPONSE;
      }
      return FRAME_TYPE.REQUEST;
    case MB_FUNCTION.WRITE_SINGLE_COIL:
    case MB_FUNCTION.WRITE_SINGLE_HOLDING:
    case MB_FUNCTION.WRITE_MULTIPLE_COILS:
    case MB_FUNCTION.WRITE_MULTIPLE_HOLDING:
      if (
        previousFrame !== null &&
        frame.mbFunction === previousFrame.mbFunction &&
        frame.address === previousFrame.address
      ) {
        if (frame.timestamp.getTime() - previousFrame.timestamp.getTime() < REQUEST_TIMEOUT) {
          return FRAME_TYPE.RESPONSE;
        }
        return FRAME_TYPE.REQUEST;
      }
      return FRAME_TYPE.UNKNOWN;
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

export class ModbusAnalyzer extends EventEmitter {
  serialPort: SerialPort | null;
  constructor() {
    super();

    this.serialPort = null;
  }

  async start(configuration: SerialPortConfiguration) {
    return new Promise((resolve, reject) => {
      const {port, baudRate, parity, dataBits, stopBits} = configuration;

      console.log('Creating now SerialPort');
      this.serialPort = new SerialPort({
        path: port,
        baudRate,
        parity,
        dataBits,
        stopBits,
        autoOpen: false,
      });
      console.log('Attaching to parser');
      const parser = this.serialPort.pipe(new InterByteTimeoutParser({interval: 15}));

      let previousFrame: MyModbusFrame | null = null;

      parser.on('data', data => {
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

          if (
            modbusFrame.address === DANFOSS_BAUDRATE_SYNC_ADDRESS &&
            modbusFrame.mbFunction === MB_FUNCTION.READ_EXCEPTION_STATUS &&
            !modbusFrame.data.length
          ) {
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

      this.serialPort.open(error => {
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
