/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'network';

interface GenericObject {
  [key: string]: any;
}

type LogType = 'info' | 'success' | 'warning' | 'error';

interface NetworkInfo {
  interface: string;
  ipAddress: string;
  netmask: string;
  gateway: string;
  firstIpOnSubnet: string;
  lastIpOnSubnet: string;
}

interface ScanLogItem {
  type: string;
  text: string;
}

type ScanProgress = [number, number];

interface ComPort {
  path: string;
  manufacturer: string;
}

interface LogStats {
  averageResponseTime: number;
  successfulRequests: number;
  requestsTimedOut: number;
  requestsDone: number;
  requestsTotal: number;
  progress: number;
}

interface LoggerLogMessage {
  stats: LogStats;
  request: GenericObject;
}

interface ModbusTask {
  unitId: number;
  mbFunction: number;
  mbOptions: {
    [x: string]: any;
  };
}

interface MbFunction {
  id: string;
  label: string;
  type: string;
  min: number;
  max: number;
  default: number;
}

interface MbOption extends MbFunction {
  value: number;
  values?: number[];
  maxLength?: number;
}

interface ModbusRequestConfiguration {
  timeout: number;
}

interface SingleModbusRequestConfiguration {
  task: ModbusTask;
}

interface ModbusRequestResponse {
  result: any;
  executionTime: number;
  errorCode: number;
  errorText: string;
  timestamp: Date;
}

interface MyModbusFrame {
  timestamp: Date;
  crc: boolean;
  address: number | null;
  mbFunction: number | null;
  data: Buffer;
  buffer: Buffer;
  type?: null | 0 | 1 | 2;
}

interface ServerDataRequest {
  type: string;
  register: number;
  count: number;
}

interface SerialPortConfiguration {
  port: string;
  baudRate: number;
  parity: 'none' | 'even' | 'mark' | 'odd' | 'space';
  dataBits: 5 | 6 | 7 | 8;
  stopBits: 1 | 2 | 1.5;
}

interface ModbusRtuServerConfiguration extends SerialPortConfiguration {
  unitId: number;
}

interface RtuRequestConfiguration extends ModbusRequestConfiguration, SerialPortConfiguration {}

interface SingleModbusRtuRequestConfiguration
  extends RtuRequestConfiguration,
    SingleModbusRequestConfiguration {}

interface TcpRequestConfiguration extends ModbusRequestConfiguration {
  ip: string;
  port: number;
}

interface ScannerTcpConfiguration {
  startIp: string;
  endIp: string;
  port: number;
  timeout: number;
}

interface SingleModbusTcpRequestConfiguration
  extends TcpRequestConfiguration,
    SingleModbusRequestConfiguration {}

interface LoggerConfiguration {
  count: number;
  delay: number;
  tasks: ModbusTask[];
}

interface TcpLoggerConfiguration extends LoggerConfiguration, TcpRequestConfiguration {}

interface RtuLoggerConfiguration extends LoggerConfiguration, RtuRequestConfiguration {}

type IP = string;
type TcpPort = number;
type UnitId = number;

interface ModbusTcpScanConfiguration {
  startIp: IP;
  endIp: IP;
  port: TcpPort;
  minUnitId: UnitId;
  maxUnitId: UnitId;
  timeout: number;
}

interface ModbusRtuScanConfiguration extends RtuRequestConfiguration {
  minUnitId: UnitId;
  maxUnitId: UnitId;
  delay: number;
}

interface ScanItem {
  meta: GenericObject;
  state: SCAN_ITEM_STATE;
  stateText: string;
  errorMessage: string;
  id: string | number;
}
