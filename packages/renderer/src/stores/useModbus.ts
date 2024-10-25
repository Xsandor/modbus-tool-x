import {defineStore} from 'pinia';
import {useSystemStore} from './useSystem';

interface ClientConfiguration {
  connectionType: CONNECTION_TYPE;
  common: {
    unitId: number;
    mbFunction: number;
    mbFunctionParameters: MbFunctionParameter[];
  };
  tcp: TcpRequestConfiguration;
  rtu: RtuRequestConfiguration;
}

interface ServerConfiguration {
  connectionType: CONNECTION_TYPE;
  common: {
    unitId: number;
  };
  tcp: {
    host: string;
    port: number;
  };
  rtu: SerialPortConfiguration;
}

interface ScannerConfiguration {
  connectionType: CONNECTION_TYPE;
  common: {
    minUnitId: number;
    maxUnitId: number;
    unitIds: number[];
  };
  rtu: RtuRequestConfiguration & {
    requestDelay: number;
  };
  tcp: ScannerTcpConfiguration;
}

interface EkcDeviceConfiguration {
  common: {
    unitId: number;
    useCache: boolean;
  };
  rtu: RtuRequestConfiguration;
}

interface RegisterScannerConfiguration {
  common: {
    unitId: number;
  };
  rtu: RtuRequestConfiguration;
}

interface AnalyzerConfiguration {
  rtu: RtuRequestConfiguration;
}

interface Defaults {
  rtu: RtuRequestConfiguration;
  tcp: {
    port: number;
  };
}

// TODO: Get state from main process
// TODO: Store state of Modbus Server, Analyzer, etc.
// TODO: Add actions to start/stop Modbus Server, Analyzer, etc.
// TODO: Add actions to scan and perform requests.

export const useModbusStore = defineStore(
  'modbus',
  () => {
    const {comPorts: availableComPorts} = useSystemStore();

    const defaults: Defaults = {
      rtu: {
        baudRate: 38400,
        parity: 'even',
        dataBits: 8,
        stopBits: 1,
        timeout: 100,
        port: availableComPorts[0].path,
      },
      tcp: {
        port: 502,
      },
    };

    const clientConfiguration: Ref<ClientConfiguration> = ref({
      connectionType: CONNECTION_TYPE.TCP,
      common: {
        unitId: 1,
        mbFunction: mbFunctions[2].id,
        mbFunctionParameters: {
          ...mbFunctions[2].parameters,
          value: mbFunctions[2].parameters[0].default,
        },
      },
      tcp: {
        ip: '',
        port: defaults.tcp.port,
        timeout: 25,
      },
      rtu: {
        port: defaults.rtu.port,
        baudRate: defaults.rtu.baudRate,
        parity: defaults.rtu.parity,
        dataBits: defaults.rtu.dataBits,
        stopBits: defaults.rtu.stopBits,
        timeout: defaults.rtu.timeout,
      },
    });

    const serverConfiguration: Ref<ServerConfiguration> = ref({
      connectionType: CONNECTION_TYPE.RTU,
      common: {
        unitId: 1,
      },
      tcp: {
        port: defaults.tcp.port,
        host: '0.0.0.0',
      },
      rtu: {
        baudRate: 19200,
        dataBits: 8,
        parity: 'none',
        stopBits: 2,
        port: 'COM14',
      },
    });

    const scannerConfiguration: Ref<ScannerConfiguration> = ref({
      connectionType: CONNECTION_TYPE.RTU,
      common: {
        minUnitId: 1,
        maxUnitId: 247,
        unitIds: [],
      },
      rtu: {
        port: defaults.rtu.port,
        baudRate: defaults.rtu.baudRate,
        parity: defaults.rtu.parity,
        dataBits: defaults.rtu.dataBits,
        stopBits: defaults.rtu.stopBits,
        timeout: defaults.rtu.timeout,
        requestDelay: 50,
      },
      tcp: {
        startIp: '',
        endIp: '',
        port: defaults.tcp.port,
        timeout: 25,
      },
    });

    const ekcDeviceConfiguration: Ref<EkcDeviceConfiguration> = ref({
      common: {
        unitId: 1,
        useCache: true,
      },
      rtu: {
        port: defaults.rtu.port,
        baudRate: defaults.rtu.baudRate,
        parity: defaults.rtu.parity,
        dataBits: defaults.rtu.dataBits,
        stopBits: defaults.rtu.stopBits,
        timeout: defaults.rtu.timeout,
      },
    });

    const registerScannerConfiguration: Ref<RegisterScannerConfiguration> = ref({
      common: {
        unitId: 1,
      },
      rtu: {
        port: defaults.rtu.port,
        baudRate: defaults.rtu.baudRate,
        parity: defaults.rtu.parity,
        dataBits: defaults.rtu.dataBits,
        stopBits: defaults.rtu.stopBits,
        timeout: defaults.rtu.timeout,
      },
    });

    const analyzerConfiguration: Ref<AnalyzerConfiguration> = ref({
      rtu: {
        port: defaults.rtu.port,
        baudRate: defaults.rtu.baudRate,
        parity: defaults.rtu.parity,
        dataBits: defaults.rtu.dataBits,
        stopBits: defaults.rtu.stopBits,
        timeout: defaults.rtu.timeout,
      },
    });

    const formatFunctionCode = computed(() => (code: number) => {
      if (!code) return '';
      if (code in MODBUS_FUNCTIONS) {
        return MODBUS_FUNCTIONS[code];
      }
      return `${code}: Unknown Function`;
    });

    // const selectedMbFunction = computed(() => {
    //   const mbFunction = clientConfiguration.value.common.mbFunction;
    //   if (!mbFunction) {
    //     return null;
    //   }

    //   return mbFunctions.find(i => i.id === mbFunction);
    // });

    // const mbOptions: Ref<MbOption[]> = ref([]);

    const getParametersForMbFunction = (mbFunctionId: number): MbFunctionParameter[] => {
      // console.log('getParametersForMbFunction => ', mbFunctionId);
      const mbFunction = mbFunctions.find(i => i.id === mbFunctionId);

      if (!mbFunction) {
        // console.log('No function found');
        return [];
      }

      const parameters = mbFunction.parameters.map(i => {
        return {
          ...i,
          value: i.default,
          values: i.type === 'numberArray' ? [i.default] : undefined,
        };
      });

      // console.log('parameters => ', parameters);

      return parameters;
    };

    // watch(selectedMbFunction, updateVisibleMbOptions);
    // updateVisibleMbOptions();

    const baudRateOptions = computed(() => [
      {value: 4800, label: '4 800'},
      {value: 9600, label: '9 600'},
      {value: 19200, label: '19 200'},
      {value: 38400, label: '38 400'},
      {value: 57600, label: '57 600'},
      {value: 115200, label: '115 200'},
    ]);

    const parityOptions = computed(() => [
      {value: 'none', label: 'None'},
      {value: 'even', label: 'Even'},
      {value: 'odd', label: 'Odd'},
    ]);

    const mbFunctionOptions = computed(() => {
      mbFunctions.map(i => {
        return {value: i.id, label: i.name};
      });
    });

    return {
      clientConfiguration,
      serverConfiguration,
      scannerConfiguration,
      analyzerConfiguration,
      ekcDeviceConfiguration,
      registerScannerConfiguration,
      formatFunctionCode,
      getParametersForMbFunction,
      baudRateOptions,
      parityOptions,
      mbFunctionOptions,
    };
  },
  {
    persist: true,
  },
);

export enum CONNECTION_TYPE {
  RTU = 0,
  TCP = 1,
}

export enum MODBUS_FUNCTIONS {
  '01: Read Coils' = 1,
  '02: Read Discrete Inputs' = 2,
  '03: Read Holding Registers' = 3,
  '04: Read Input Registers' = 4,
  '05: Write Single Coil' = 5,
  '06: Write Single Holding' = 6,
  '07: Read Exception Status' = 7,
  '15: Write Multiple Coils' = 15,
  '16: Write Multiple Holding' = 16,
  '20: Read File Record' = 20,
  '21: Write File Record' = 21,
  '43: Read Device Identification' = 43,
  '65: Read Compressed' = 65,
  '65: Read Exception Status (Danfoss)' = 67,
  'Exception: Read Coils' = 129,
  'Exception: Read Discrete Inputs' = 130,
  'Exception: Read Holding Registers' = 131,
  'Exception: Read Input Registers' = 132,
  'Exception: Write Single Coil' = 133,
  'Exception: Write Single Holding' = 134,
  'Exception: Read Exception Status' = 135,
  'Exception: Write Multiple Coils' = 143,
  'Exception: Write Multiple Holding' = 144,
  'Exception: Read File Record' = 148,
  'Exception: Write File Record' = 149,
  'Exception: Read Device Identification' = 171,
  'Exception: Read Compressed' = 193,
}

export const mbFunctions: MbFunctionDefinition[] = [
  {
    id: 1,
    name: MODBUS_FUNCTIONS[1],
    description: `This command allows you to request the status of one or multiple coils.
Coils are typically writable and can be in either an "ON" (1) or "OFF" (0) state.
For writing, see function 5 and 15.`,
    parameters: [
      {id: 'addr', label: 'Address', type: 'number', min: 1, max: 0xffff, default: 1},
      {id: 'count', label: 'Registers', type: 'number', min: 1, max: 0xff, default: 1},
    ],
  },
  {
    id: 2,
    name: MODBUS_FUNCTIONS[2],
    description: `This command allows you to request the status of one or multiple discrete inputs.
Discrete inputs are strictly read-only and can be in either an "ON" (1) or "OFF" (0) state.`,
    parameters: [
      {id: 'addr', label: 'Address', type: 'number', min: 1, max: 0xffff, default: 1},
      {id: 'count', label: 'Registers', type: 'number', min: 1, max: 0xff, default: 1},
    ],
  },
  {
    id: 3,
    name: MODBUS_FUNCTIONS[3],
    description: `This command requests the status for one or multiple holding registers.
Holding registers are typically writable and are composed of 2 bytes (16 bits) and typically represents either a signed integer (-32768 to 32767) or an unsigned integer (0 to 65535).
For writing, see function 6 and 16.`,
    parameters: [
      {id: 'addr', label: 'Address', type: 'number', min: 1, max: 0xffff, default: 1},
      {id: 'count', label: 'Registers', type: 'number', min: 1, max: 0xff, default: 1},
    ],
  },
  {
    id: 4,
    name: MODBUS_FUNCTIONS[4],
    description: `This command allows you to request the status of one or multiple input registers.
Input registers are strictly read-only and are composed of 2 bytes (16 bits).`,
    parameters: [
      {id: 'addr', label: 'Address', type: 'number', min: 1, max: 0xffff, default: 1},
      {id: 'count', label: 'Registers', type: 'number', min: 1, max: 0xff, default: 1},
    ],
  },
  {
    id: 5,
    name: MODBUS_FUNCTIONS[5],
    description: `This command lets you write a new value to a single coil.
Coils can be set to either an "ON" (1) or "OFF" (0) state.
For writing multiple coils simultaneously, see function 15.`,
    parameters: [
      {id: 'addr', label: 'Address', type: 'number', min: 1, max: 0xffff, default: 1},
      {id: 'value', label: 'Value', type: 'number', min: 0, max: 1, default: 0},
    ],
  },
  {
    id: 6,
    name: MODBUS_FUNCTIONS[6],
    description: `With this command, you can write a new value to a single holding register.
Holding registers are typically writable and are composed of 2 bytes (16 bits) and typically represents either a signed integer (-32768 to 32767) or an unsigned integer (0 to 65535).`,
    parameters: [
      {id: 'addr', label: 'Address', type: 'number', min: 1, max: 0xffff, default: 1},
      {id: 'value', label: 'Value', type: 'number', min: -32768, max: 0xffff, default: 0},
    ],
  },
  {
    id: 7,
    name: MODBUS_FUNCTIONS[7],
    description: `With this command, you can read eight Exception Status outputs in a remote device.`,
    parameters: [],
  },
  // {
  //   id: 15,
  //   write: true,
  //   name: MODBUS_FUNCTIONS[15],
  //   description:
  //     'This command enables you to simultaneously write to one or multiple consecutive coils. Coils can be set to either an "ON" (1) or "OFF" (0) state.',
  //   parameters: [
  //     {id: 'addr', label: 'Address', type: 'number', min: 1, max: 0xffff, default: 1},
  //     {id: 'value', label: 'Values', type: 'numberArray', min: 0, max: 1, default: 0},
  //   ],
  // },
  // {
  //   id: 16,
  //   write: true,
  //   name: MODBUS_FUNCTIONS[16],
  //   description:
  //     'Using this command, you can write values to one or multiple consecutive holding registers. Holding registers are 2 bytes (16 bits) in size and are often employed for setting control parameters or configuration values.',
  //   parameters: [
  //     {id: 'addr', label: 'Address', type: 'number', min: 1, max: 0xffff, default: 1},
  //     {id: 'value', label: 'Values', type: 'numberArray', min: 0, max: 0xffff, default: 0},
  //   ],
  // },
  {
    id: 20,
    name: MODBUS_FUNCTIONS[20],
    description:
      'This command enables you to read a block of data from one or more files stored on the server (slave) device. It is particularly useful for retrieving structured data or records from designated files. The read operation can encompass multiple files and records within those files, offering a versatile means of gathering information.',
    parameters: [
      {id: 'fileNumber', label: 'File Number', type: 'number', min: 1, max: 0xffff, default: 1},
      {id: 'recordNumber', label: 'Record Number', type: 'number', min: 0, max: 0xffff, default: 0},
      {id: 'recordLength', label: 'Record Length', type: 'number', min: 0, max: 100, default: 100},
      {id: 'refType', label: 'Ref. Type', type: 'number', min: 0, max: 0xffff, default: 6},
    ],
  },
  // {
  //   id: 21,

  //   name: MODBUS_FUNCTIONS[21],
  //   description:
  //     'This command empowers you to write a block of data to one or more files stored on the server (slave) device. It offers the ability to update and modify structured data or records within designated files. By combining multiple files and records within those files, this function provides a versatile approach to altering and managing information.',
  //   parameters: [
  //     {id: 'fileNumber', label: 'File', type: 'number', min: 1, max: 0xffff, default: 1},
  //     {id: 'recordNumber', label: 'Record', type: 'number', min: 0, max: 0xffff, default: 1},
  //   ],
  // },
  {
    id: 43,
    name: MODBUS_FUNCTIONS[43],
    description: `This command facilitates the retrieval of comprehensive information about the device from the server (slave) device. It can give information about the device's identity, manufacturer, supported features, and more.`,
    parameters: [
      // {id: 'idCode', label: 'ID', type: 'number', min: 1, max: 0xffff, default: 1},
      // {id: 'objectId', label: 'Object', type: 'number', min: 0, max: 0xffff, default: 1},
    ],
  },
  {
    id: 65,
    name: MODBUS_FUNCTIONS[65],
    description:
      'Function specific to Danfoss controllers. With this function, you can efficiently read up to 16 non-consecutive parameters from the controller in a single request. Unlike standard Modbus functions, this function enables you to retrieve parameters with addresses that are not necessarily in sequential order.',
    parameters: [
      {
        id: 'addrArr',
        label: 'Address',
        type: 'numberArray',
        min: 1,
        max: 0xffff,
        maxLength: 16,
        default: 1,
      },
    ],
  },
];
