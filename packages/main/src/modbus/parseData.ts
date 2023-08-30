import {parseDanfossOrderNumber, parseDanfossVersion} from './danfoss';
import {
  EXCEPTION_CODE,
  EXCEPTION_CODES,
  FRAME_TYPE,
  MB_FUNCTION,
  REGISTER_OFFSET,
} from './modbusCommon';
import {formatByteArray, readBitInBuffer} from './utilities';

export function parseData(frame: MyModbusFrame, previousFrame: null | MyModbusFrame) {
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

        if (
          frame.mbFunction === MB_FUNCTION.READ_INPUT_REGISTERS &&
          firstPnu === 2003 &&
          reqCount === 1
        ) {
          // Reading Danfoss controller version
          const version = frame.data.readInt16BE(1);
          const {versionMajor, versionMinor} = parseDanfossVersion(version);
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
        const values: string[] = [];
        for (let i = 0; i < reqCount; i++) {
          const pnu = previousFrame.data.readInt16BE(1 + i * 2);
          const value = frame.data.readInt16BE(3 + i * 2);
          values.push(`${pnu} = ${value}`);
        }
        return values.join(', ');
      }
      break;
    case MB_FUNCTION.WRITE_SINGLE_COIL: {
      const pnu = frame.data.readInt16BE(0) - REGISTER_OFFSET;
      const value = frame.data.readInt16BE(2) === 0 ? 0 : 1;
      return `${pnu} = ${value}`;
    }
    case MB_FUNCTION.WRITE_SINGLE_HOLDING: {
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
    case MB_FUNCTION.READ_FILE: {
      if (frame.type === FRAME_TYPE.REQUEST) {
        // console.log(`Frame data length: ${frame.data.length}`);
        const byteCount = frame.data.readInt8(0);
        const refType = frame.data.readInt8(1);
        const fileNumber = frame.data.readUInt16BE(2); // 64054
        const recordNumber = frame.data.readUInt16BE(4); // 0x0000
        // const recordLength = frame.data.readUInt16BE(6); // 3
        // const recordData = frame.data.slice(8, 8 + recordLength * 2); // 3
        if (byteCount === 7 && refType === 6) {
          if (fileNumber <= 0x0010) {
            // console.log('Request: Read parameter group');
            return `Request group ${recordNumber}`;
          } else {
            // console.log('Request: Read parameter properties');
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
          // console.log('Response: Read parameter group');
          const groupNumber = data.slice(0, 2);
          // console.log(groupNumber.toString());
          const groupName = data.slice(2);
          // console.log(groupName);
          return `Group ${groupNumber} = ${groupName}`;
        }
        if (responseDataLength === 0x12 && subReqResponseLength === 0x11 && refType === 7) {
          // console.log("Response: Read order number")
          const {orderNumber, protocolFamily} = parseDanfossOrderNumber(data);
          return `Order number = ${orderNumber}, type = ${protocolFamily}`;
        }
      }
      break;
    }
    case MB_FUNCTION.WRITE_FILE: {
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
    // console.log(`Exception code: ${exceptionCode}`);
    if (exceptionCode in EXCEPTION_CODES) {
      return EXCEPTION_CODES[exceptionCode];
    }
    return 'Unknown exception';
  }

  return formatByteArray(frame.data);
}
