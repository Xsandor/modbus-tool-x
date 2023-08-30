import {getBitInNumber} from './utilities';

export function parseDanfossOrderNumber(data: Buffer | string) {
  const result = data.toString().replace(/\0.*$/g, '').split(' ');
  const orderNumber = result[0];
  const protocolFamily = result[1] || 'Non-EKC';

  return {orderNumber, protocolFamily};
}

export function parseDanfossVersion(version: number) {
  const versionMajor = Math.floor(version / 256);
  const versionMinor = version % 256;
  return {versionMajor, versionMinor};
}

interface DanfossExceptionStatus {
  servicePin: boolean;
  settingParameterChanged: boolean;
  alarmStatusChanged: boolean;
  activeAlarm: boolean;
}

export function parseDanfossExceptionStatus(value: number): DanfossExceptionStatus {
  const exceptionStatus = {
    servicePin: !!getBitInNumber(value, 0),
    settingParameterChanged: !!getBitInNumber(value, 1),
    alarmStatusChanged: !!getBitInNumber(value, 2),
    activeAlarm: !!getBitInNumber(value, 3),
  };

  return exceptionStatus;
}

interface RawDanfossGroup {
  id: number;
  name: string;
}

export function parseDanfossGroup(buffer: Buffer): RawDanfossGroup {
  const group = {
    id: buffer.readInt8(1),
    name: buffer.toString('utf8', 2, 2 + 27).replace(/\0.*$/g, ''),
  };

  return group;
}

interface RawDanfossParameter {
  dynamic: boolean;
  pnu: number;
  min: number;
  max: number;
  exp: number;
  group: number;
  writable: boolean;
  type: string;
  nextPnu: number;
  name: string;
}

export function parseDanfossParameter(buffer: Buffer): RawDanfossParameter {
  const groupAndType = buffer.readInt8(9);
  const group = ((groupAndType >> 4) & 0xf) + 1;
  const parameterType = groupAndType & 0xf;
  // The first bit of parameterType is 1 if parameter is writable
  const writable = !!getBitInNumber(parameterType, 0);
  const isDynamic = !!getBitInNumber(parameterType, 1);
  const isInt = !!getBitInNumber(parameterType, 2);
  const isFloat = !!getBitInNumber(parameterType, 3);
  let type = 'Boolean';
  if (isFloat) type = 'Float';
  else if (isInt) type = 'Int';

  const parameter = {
    pnu: buffer.readUInt16BE(0),
    min: buffer.readInt16BE(4),
    max: buffer.readInt16BE(6),
    exp: buffer.readInt8(8),
    group,
    writable,
    type,
    dynamic: isDynamic,
    nextPnu: buffer.readUInt16BE(10),
    name: buffer.toString('utf8', 13, 13 + 16).replace(/\0.*$/g, ''),
  };

  return parameter;
}

export const DANFOSS_VERSION_PNU = 2003;
export const DANFOSS_MCX_APP_PNU = 5002;

export const DANFOSS_READ_COMPRESSED_MAX_PNUS = 16;

export const DANFOSS_MODEL_REF_TYPE = 7;
export const DANFOSS_MODEL_FILE_NUMBER = 2015;
export const DANFOSS_MODEL_RECORD_NUMBER = 0;
export const DANFOSS_MODEL_RECORD_LENGTH = 8;

export const DANFOSS_READ_GROUP_REF_TYPE = 6;
export const DANFOSS_READ_GROUP_MIN_FILE_NUMBER = 1;
export const DANFOSS_READ_GROUP_MAX_FILE_NUMBER = 16;
export const DANFOSS_READ_GROUP_RECORD_NUMBER = 0;
export const DANFOSS_READ_GROUP_RECORD_LENGTH = 15;

export const DANFOSS_READ_PARAMETER_REF_TYPE = 6;
export const DANFOSS_READ_PARAMETER_RECORD_NUMBER = 0;
export const DANFOSS_READ_PARAMETER_RECORD_LENGTH = 15;

export const DANFOSS_MAX_EKC_PARAMETERS = 300;

// Other input registers that give values (from AK-CC55)
// 60001 = 0
// 60005 = 0
// 60006 = 3
// 60008 = 49
// 60029 = 0
export const DANFOSS_REGISTER_FOR_EKC_STATUS = 60021;
export const DANFOSS_REGISTER_FOR_FIRST_PNU = 60026;

export const DANFOSS_BAUDRATE_SYNC_ADDRESS = 170; // 0xAA
