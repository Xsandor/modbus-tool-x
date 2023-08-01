/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @module preload
 */

import { ipcRenderer } from 'electron';

export const csv = {
  save: async (data: any, source: string) => {
    return ipcRenderer.invoke('saveCSV', data, source);
  },
};

export const logger = {
  startTcp: async (config: TcpLoggerConfiguration) => {
    return ipcRenderer.invoke('startTcpLogger', config);
  },
  startRtu: async (config: RtuLoggerConfiguration) => {
    return ipcRenderer.invoke('startRtuLogger', config);
  },
  stop: async () => {
    return ipcRenderer.invoke('stopLogger');
  },
  onLog: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.on('logger:log', callback);
  },
  removeOnLog: (callback: () => void) => {
    ipcRenderer.removeListener('logger:log', callback);
  },
};

export const analyzer = {
  startRtu: async (config: SerialPortConfiguration) => {
    return ipcRenderer.invoke('startRtuAnalyzer', config);
  },
  stopRtu: async () => {
    return ipcRenderer.invoke('stopRtuAnalyzer');
  },
  onLog: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.on('analyzer:log', callback);
  },
  removeOnLog: (callback: () => void) => {
    ipcRenderer.removeListener('analyzer:log', callback);
  },
};

export const server = {
  start: async () => {
    return ipcRenderer.invoke('startServer');
  },
  getData: async (serverDataRequest: ServerDataRequest) => {
    return ipcRenderer.invoke('getServerData', serverDataRequest);
  },
  onLog: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.on('server:log', callback);
  },
};

export const scanner = {
  startTcpScan: async (config: ModbusTcpScanConfiguration) => {
    return ipcRenderer.invoke('startTcpScan', config);
  },
  startRtuScan: async (config: ModbusRtuScanConfiguration) => {
    return ipcRenderer.invoke('startRtuScan', config);
  },
  onLog: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.on('scanner:log', callback);
  },
  removeOnLog: (callback: () => void) => {
    ipcRenderer.removeListener('scanner:log', callback);
  },
  onStatus: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.on('scanner:status', callback);
  },
  removeOnStatus: (callback: () => void) => {
    ipcRenderer.removeListener('scanner:status', callback);
  },
  onProgress: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.on('scanner:progress', callback);
  },
  removeOnProgress: (callback: () => void) => {
    ipcRenderer.removeListener('scanner:progress', callback);
  },
};

export const network = {
  getInfo: async () => {
    ipcRenderer.send('getNetworkInfo');
  },
  onInfo: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.on('network:info', callback);
  },
  // removeOnInfo: (callback: () => void) => {
  //   ipcRenderer.removeListener("logger:log", callback);
  // },
};

export const modbus = {
  rtuRequest: async (configuration: RtuRequestConfiguration) => {
    return ipcRenderer.invoke('performRtuRequest', configuration);
  },
  tcpRequest: async (configuration: TcpRequestConfiguration) => {
    return ipcRenderer.invoke('performTcpRequest', configuration);
  },
};

export const serial = {
  getComPorts: async (): Promise<ComPort[]> => {
    return await ipcRenderer.invoke('getComPorts');
  },
};