/* eslint-disable @typescript-eslint/no-explicit-any */
export function uint16ToInt16(number: number): number {
  return new Int16Array([number])[0];
}

export function int16ToUint16(number: number): number {
  return new Uint16Array([number])[0];
}

export function getBitInNumber(number: number, n: number): 0 | 1 {
  return (number & (1 << n)) === 0 ? 0 : 1;
}

export function readBitInBuffer(buffer: Buffer, n: number): 0 | 1 {
  return getBitInNumber(buffer.readInt8(~~(n / 8)), n % 8);
}

export function formatByteArray(byteArray: Buffer): string {
  const string = byteArray.reduce((string, byte) => {
    string += byte.toString(16).padStart(2, '0');
    string += ' ';
    return string;
  }, '');

  return string;
}

export function formatTimestamp(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');

  return `${h}:${m}:${s}:${ms}`;
}

export function splitArrayIntoBatches<T>(arr: T[], batchSize: number): T[][] {
  const batches = [];
  for (let i = 0; i < arr.length; i += batchSize) {
    batches.push(arr.slice(i, i + batchSize));
  }
  return batches;
}

export function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export async function sleep(timeInMilliseconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, timeInMilliseconds);
  });
}

const DEBUG = process.env.NODE_ENV !== 'production';

function formatLogText(source: string, text: any) {
  return `[${formatTimestamp(new Date())}] [${source}] ${JSON.stringify(text)}`;
}

export const logger = {
  info: (source: string, text: any) => console.log(formatLogText(source, text)),
  debug: DEBUG ? (source: string, text: any) => console.log(formatLogText(source, text)) : () => {},
  error: (source: string, text: any) => console.error(formatLogText(source, text)),
  createLogger: (source: string) => ({
    info: (text: any) => console.log(formatLogText(source, text)),
    debug: DEBUG ? (text: any) => console.log(formatLogText(source, text)) : () => {},
    error: (text: any) => console.error(formatLogText(source, text)),
  }),
};
