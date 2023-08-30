import ModbusRTU from 'modbus-serial';
import {uint16ToInt16, int16ToUint16, logger} from './utilities';

import {
  DEVICE_ID_CODE,
  ERROR_CODE_UNKNOWN,
  MB_FUNCTION,
  MODBUS_TCP_CONNECT_TIMEOUT,
  REGISTER_OFFSET,
} from './modbusCommon';
import {
  DANFOSS_MCX_APP_PNU,
  DANFOSS_MODEL_FILE_NUMBER,
  DANFOSS_MODEL_REF_TYPE,
  DANFOSS_READ_GROUP_MAX_FILE_NUMBER,
  DANFOSS_READ_GROUP_REF_TYPE,
  DANFOSS_VERSION_PNU,
  parseDanfossExceptionStatus,
  parseDanfossGroup,
  parseDanfossParameter,
  parseDanfossVersion,
} from './danfoss';

const log = logger.createLogger('Modbus Request');

function parseRegisters(startAddr: number, registers: number[]) {
  const length = registers.length;

  return registers.map((item, index, list) => {
    const int16 = uint16ToInt16(item);
    let int32 = NaN;
    let uint32 = NaN;
    let int32_word_swapped = NaN;
    let uint32_word_swapped = NaN;
    let float32 = NaN;
    let float32_word_swapped = NaN;
    // if there is at least one more item in the list, combine the current and next item to both a signed and unsigned 32 bit integer
    if (index < length - 1) {
      const nextItem = list[index + 1];
      int32 = (item << 16) | nextItem;
      uint32 = int32 >>> 0;
      int32_word_swapped = (nextItem << 16) | item;
      uint32_word_swapped = int32_word_swapped >>> 0;

      // Create a DataView to interpret the combined integer as Float32
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setInt32(0, int32);

      // Get the Float32 value
      float32 = view.getFloat32(0);
      view.setInt32(0, int32_word_swapped);
      float32_word_swapped = view.getFloat32(0);
    }

    return {
      addr: startAddr + index,
      value: int16,
      uint16: item,
      int32,
      uint32,
      int32_word_swapped,
      uint32_word_swapped,
      float32,
      float32_word_swapped,
    };
  });
}

export async function modbusRequest(
  client: ModbusRTU,
  unitId: number,
  timeout: number,
  mbFunction: number,
  mbOptions: GenericObject,
): Promise<ModbusRequestResponse> {
  let result;
  let errorCode: number = 0;
  let errorText: string = '';
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
          return {addr: addr + index, value: item ? 1 : 0};
        });
        break;
      case MB_FUNCTION.READ_DISCRETE_INPUTS:
        addr = parseInt(mbOptions.addr);
        count = parseInt(mbOptions.count);
        result = await client.readDiscreteInputs(addr + REGISTER_OFFSET, count);
        result = result.data.map((item, index) => {
          return {addr: addr + index, value: item ? 1 : 0};
        });
        break;
      case MB_FUNCTION.READ_HOLDING_REGISTERS:
        addr = parseInt(mbOptions.addr);
        count = parseInt(mbOptions.count);
        result = await client.readHoldingRegisters(addr + REGISTER_OFFSET, count);
        result = parseRegisters(addr, result.data);
        break;
      case MB_FUNCTION.READ_INPUT_REGISTERS:
        addr = parseInt(mbOptions.addr);
        count = parseInt(mbOptions.count);
        result = await client.readInputRegisters(addr + REGISTER_OFFSET, count);
        result = parseRegisters(addr, result.data);
        break;
      case MB_FUNCTION.WRITE_SINGLE_COIL:
        addr = parseInt(mbOptions.addr);
        result = await client.writeCoil(addr + REGISTER_OFFSET, mbOptions.value === 1);

        result = [
          {
            addr: result.address - REGISTER_OFFSET,
            value: result.state ? 1 : 0,
          },
        ];
        break;
      case MB_FUNCTION.WRITE_MULTIPLE_COILS:
        {
          addr = parseInt(mbOptions.addr);
          const values: boolean[] = mbOptions.values.map((i: number) => i === 1);
          result = await client.writeCoils(addr + REGISTER_OFFSET, values);

          if (result.length !== values.length) {
            log.error('Write coils result did not match request length!');
            throw new Error('Write failed');
          }

          result = values.map((item, index) => {
            return {addr: addr + index, value: item};
          });
        }
        break;
      case MB_FUNCTION.WRITE_SINGLE_HOLDING:
        addr = parseInt(mbOptions.addr);
        // eslint-disable-next-line no-case-declarations
        const value = parseInt(mbOptions.value);
        result = await client.writeRegister(addr + REGISTER_OFFSET, int16ToUint16(value));

        result = [
          {
            addr: result.address - REGISTER_OFFSET,
            value: uint16ToInt16(result.value),
          },
        ];
        break;
      case MB_FUNCTION.WRITE_MULTIPLE_HOLDING:
        {
          addr = parseInt(mbOptions.addr);
          const values: number[] = mbOptions.values.map(int16ToUint16);
          result = await client.writeRegisters(addr + REGISTER_OFFSET, values);

          if (result.length !== values.length) {
            log.error('Write registers result did not match request length!');
            throw new Error('Write failed');
          }

          result = values.map((item, index) => {
            return {addr: addr + index, value: uint16ToInt16(item)};
          });
        }
        break;
      case MB_FUNCTION.READ_FILE:
        result = await client.readFileRecords(
          mbOptions.fileNumber,
          mbOptions.recordNumber,
          mbOptions.recordLength,
          mbOptions.refType,
        );

        log.debug(result);

        if (mbOptions.refType === DANFOSS_READ_GROUP_REF_TYPE) {
          const buffer = result.data as Buffer;
          if (mbOptions.fileNumber <= DANFOSS_READ_GROUP_MAX_FILE_NUMBER) {
            // This is a read group request
            const group = parseDanfossGroup(buffer);

            // set result to an array of the keys and values of the group
            result = {json: {group}};
          } else {
            // This is a read parameter request
            const parameter = parseDanfossParameter(buffer);

            result = {json: {parameter}};
          }

          // log.debug(result);
        }

        break;
      case MB_FUNCTION.READ_EXCEPTION_STATUS:
        result = await client.readExceptionStatus();

        result = {
          json: {
            exceptionStatus: parseDanfossExceptionStatus(result as number),
          },
        };
        break;
      case MB_FUNCTION.READ_DEVICE_ID:
        result = await client.readDeviceIdentification(
          DEVICE_ID_CODE.BASIC_DEVICE_IDENTIFICATION,
          1,
        );

        log.info(result);
        break;
      case MB_FUNCTION.READ_COMPRESSED:
        {
          log.info('Someone wants to read compressed!');
          const addresses = mbOptions.addrArr;
          log.info('addresses: ' + addresses);
          result = await client.readCompressed(addresses);
          log.info(result);
          result = result.data.map((value, i) => {
            return {
              addr: addresses[i],
              value,
            };
          });
          log.info(result);
        }
        break;
      default:
        log.info('Unknown modbus function!');
        errorCode = 998;
        errorText = 'Modbus function not implemented yet';
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    log.error('EXCEPTION!!');
    log.error(err);

    if (!err.message && !(err instanceof Error)) {
      errorCode = ERROR_CODE_UNKNOWN;
      errorText = 'Unknown error';
    } else if ('modbusCode' in err) {
      errorCode = err.modbusCode as number;
      errorText = err.message;
    } else if (err.name === 'TransactionTimedOutError') {
      errorCode = 408;
      errorText = 'Timeout: No response from device';
    } else {
      errorCode = ERROR_CODE_UNKNOWN;
      errorText = 'Unknown error';
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
  const {port, timeout, baudRate, parity, dataBits, stopBits, task} = configuration;
  const {unitId, mbFunction, mbOptions} = task;
  let result;
  const client = new ModbusRTU();
  if (client.isOpen) client.close(() => null);
  try {
    log.info(`Opening ${port}...`);
    await client.connectRTUBuffered(port, {baudRate, parity, dataBits, stopBits});
    log.info('Port opened, sending request');
    result = await modbusRequest(client, unitId, timeout, mbFunction, mbOptions);
    log.info('Got response!');
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

  if (client.isOpen) {
    log.info('Closing port!');
    client.close(() => null);
  }

  log.info('Returning result!');

  return result;
}

export async function modbusTcpRequest(
  configuration: SingleModbusTcpRequestConfiguration,
): Promise<ModbusRequestResponse> {
  const {ip, port, timeout, task} = configuration;
  const {unitId, mbFunction, mbOptions} = task;
  let result;
  const client = new ModbusRTU();
  try {
    client.setTimeout(MODBUS_TCP_CONNECT_TIMEOUT);
    await client.connectTCP(ip, {port});
    // console.log.info('Modbus TCP connected!')

    result = await modbusRequest(client, unitId, timeout, mbFunction, mbOptions);
  } catch (error) {
    if (client.isOpen) client.close(() => null);
    return {
      result: null,
      executionTime: MODBUS_TCP_CONNECT_TIMEOUT,
      errorCode: 408,
      errorText: 'Timeout: Failed to establish connection',
      timestamp: new Date(),
    };
  }

  if (client.isOpen) client.close(() => null);

  return result;
}

const _knownModbusRegisters = [
  {
    name: 'Danfoss Version',
    type: 'inputRegister',
    addr: DANFOSS_VERSION_PNU,
    size: 1,
    parser: (data: number[]) => parseDanfossVersion(data[0]),
  },
];

function buildDanfossReadVersionModbusTask(unitId: number) {
  return {
    unitId,
    mbFunction: MB_FUNCTION.READ_INPUT_REGISTERS,
    mbOptions: {
      addr: DANFOSS_VERSION_PNU,
      count: 1,
    },
  };
}

function _buildDanfossReadMcxAppModbusTask(unitId: number) {
  return {
    unitId,
    mbFunction: MB_FUNCTION.READ_HOLDING_REGISTERS,
    mbOptions: {
      addr: DANFOSS_MCX_APP_PNU,
      count: 1,
    },
  };
}

function _buildDanfossModelModbusTask(unitId: number) {
  return {
    unitId,
    mbFunction: MB_FUNCTION.READ_FILE,
    mbOptions: {
      refType: DANFOSS_MODEL_REF_TYPE,
      fileNumber: DANFOSS_MODEL_FILE_NUMBER,
    },
  };
}

export async function requestDanfossVersion(rtuConfig: RtuRequestConfiguration, unitId: number) {
  const configuration: SingleModbusRtuRequestConfiguration = {
    ...rtuConfig,
    task: buildDanfossReadVersionModbusTask(unitId),
  };

  const result = await modbusRtuRequest(configuration);
  return parseDanfossVersion(result.result[0].value);
}
