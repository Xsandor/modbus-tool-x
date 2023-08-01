export default function useModbus(){
  enum CONNECTION_TYPE {
    RTU = 0,
    TCP = 1
  }
  
  const tcpConfiguration: Ref<TcpRequestConfiguration> = ref({
    ip: '',
    port: 502,
    timeout: 25,
  });

  const rtuConfiguration: Ref<RtuRequestConfiguration> = ref({
    port: '',
    baudRate: 38400,
    parity: 'even',
    dataBits: 8,
    stopBits: 1,
    timeout: 100,
  });

  const baudRateOptions = [
    { value: 4800, label: '4 800' },
    { value: 9600, label: '9 600' },
    { value: 19200, label: '19 200' },
    { value: 38400, label: '38 400' },
    { value: 57600, label: '57 600' },
  ];
  
  const parityOptions = [
    { value: 'none', label: 'None' },
    { value: 'even', label: 'Even' },
    { value: 'odd', label: 'Odd' },
  ];

  const MODBUS_FUNCTIONS: GenericObject = {
    1: '1: Read Coils',
    2: '2: Read Discrete Inputs',
    3: '3: Read Holding Registers',
    4: '4: Read Input Registers',
    5: '5: Write Single Coil',
    6: '6: Write Single Holding',
    7: '7: Read Exception Status',
    15: '15: Write Multiple Coils',
    16: '16: Write Multiple Holding',
    20: '20: Read File Record',
    21: '21: Write File Record',
    43: '43: Read Device Identification',
    65: '65: Read Compressed',
    67: '65: Read Exception Status (Danfoss)',
    129: 'Exception: Read Coils',
    130: 'Exception: Read Discrete Inputs',
    131: 'Exception: Read Holding Registers',
    132: 'Exception: Read Input Registers',
    133: 'Exception: Write Single Coil',
    134: 'Exception: Write Single Holding',
    135: 'Exception: Read Exception Status',
    143: 'Exception: Write Multiple Coils',
    144: 'Exception: Write Multiple Holding',
    148: 'Exception: Read File Record',
    149: 'Exception: Write File Record',
    171: 'Exception: Read Device Identification',
    193: 'Exception: Read Compressed',
  };

  function formatFunctionCode(code: number) {
    if (!code) return '';
    if (code in MODBUS_FUNCTIONS) {
      return MODBUS_FUNCTIONS[code];
    }
    return `${code}: Unknown Function`;
  }

  const mbFunctions = [
    {
        id: 1, write: false, name: MODBUS_FUNCTIONS[1], parameters: [
            { id: 'addr', label: 'Address', type: 'number', min: 1, max: 0xFFFF, default: 1 },
            { id: 'count', label: 'Registers', type: 'number', min: 1, max: 0xFF, default: 1 },
        ],
    },
    {
        id: 2, write: false, name: MODBUS_FUNCTIONS[2], parameters: [
            { id: 'addr', label: 'Address', type: 'number', min: 1, max: 0xFFFF, default: 1 },
            { id: 'count', label: 'Registers', type: 'number', min: 1, max: 0xFF, default: 1 },
        ],
    },
    {
        id: 3, write: false, name: MODBUS_FUNCTIONS[3], parameters: [
            { id: 'addr', label: 'Address', type: 'number', min: 1, max: 0xFFFF, default: 1 },
            { id: 'count', label: 'Registers', type: 'number', min: 1, max: 0xFF, default: 1 },
        ],
    },
    {
        id: 4, write: false, name: MODBUS_FUNCTIONS[4], parameters: [
            { id: 'addr', label: 'Address', type: 'number', min: 1, max: 0xFFFF, default: 1 },
            { id: 'count', label: 'Registers', type: 'number', min: 1, max: 0xFF, default: 1 },
        ],
    },
    {
        id: 5, write: true, name: MODBUS_FUNCTIONS[5], parameters: [
            { id: 'addr', label: 'Address', type: 'number', min: 1, max: 0xFFFF, default: 1 },
            { id: 'value', label: 'Value', type: 'number', min: 0, max: 1, default: 0 },
        ],
    },
    {
        id: 6, write: true, name: MODBUS_FUNCTIONS[6], parameters: [
            { id: 'addr', label: 'Address', type: 'number', min: 1, max: 0xFFFF, default: 1 },
            { id: 'value', label: 'Value', type: 'number', min: -32768, max: 0xFFFF, default: 0 },
        ],
    },
    // {
    //     id: 15, write: true, name: MODBUS_FUNCTIONS[15], parameters: [
    //         { id: 'addr', label: 'Address', type: 'number', min: 1, max: 0xFFFF, default: 1 },
    //         { id: 'value', label: 'Values', type: 'numberArray', min: 0, max: 1, default: 0 }
    //     ]
    // },
    // {
    //     id: 16, write: true, name: MODBUS_FUNCTIONS[16], parameters: [
    //         { id: 'addr', label: 'Address', type: 'number', min: 1, max: 0xFFFF, default: 1 },
    //         { id: 'value', label: 'Values', type: 'numberArray', min: 0, max: 0xFFFF, default: 0 }
    //     ]
    // },
    // {
    //     id: 20, write: false, name: MODBUS_FUNCTIONS[20], parameters: [
    //         { id: 'fileNumber', label: 'File', type: 'number', min: 1, max: 0xFFFF, default: 1 },
    //         { id: 'recordNumber', label: 'Record', type: 'number', min: 0, max: 0xFFFF, default: 1 }
    //     ]
    // },
    // {
    //     id: 43, write: false, name: MODBUS_FUNCTIONS[43], parameters: [
    //         { id: 'idCode', label: 'ID', type: 'number', min: 1, max: 0xFFFF, default: 1 },
    //         { id: 'objectId', label: 'Object', type: 'number', min: 0, max: 0xFFFF, default: 1 }
    //     ]
    // },
    {
      id: 65, write: false, name: MODBUS_FUNCTIONS[65], parameters: [
          { id: 'addr', label: 'Address', type: 'number', min: 1, max: 0xFFFF, default: 1 },
      ],
    },
  ];

  const mbFunctionOptions = mbFunctions.map((i) => {
      return { value: i.id, label: i.name };
  });

  const connectionType = ref(CONNECTION_TYPE.TCP);

  return {
    formatFunctionCode, mbFunctions, mbFunctionOptions, baudRateOptions, parityOptions, connectionType, CONNECTION_TYPE, tcpConfiguration, rtuConfiguration, MODBUS_FUNCTIONS,
  };
}