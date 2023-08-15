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

export const DANFOSS_VERSION_PNU = 2003;
export const DANFOSS_MCX_APP_PNU = 5002;
export const DANFOSS_MODEL_REF_TYPE = 7;
export const DANFOSS_MODEL_FILE_NUMBER = 2015;
export const DANFOSS_MODEL_RECORD_NUMBER = 0;
export const DANFOSS_MODEL_RECORD_LENGTH = 8;
export const DANFOSS_BAUDRATE_SYNC_ADDRESS = 170; // 0xAA
