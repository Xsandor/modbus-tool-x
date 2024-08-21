/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @module preload
 */

import {ipcRenderer} from 'electron';
// import {electronAPI} from '@electron-toolkit/preload';
import {Titlebar, TitlebarColor} from 'custom-electron-titlebar';
import type {TitleBarOptions} from 'custom-electron-titlebar/titlebar/options';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let titlebar: null | Titlebar;

window.addEventListener('DOMContentLoaded', () => {
  const options: TitleBarOptions = {
    backgroundColor: TitlebarColor.fromHex('#fcfcfc'),
    titleHorizontalAlignment: 'center',
    enableMnemonics: true,
    menuPosition: 'left',
    // menuSeparatorColor: TitlebarColor.fromHex('#FF0000'),
  };

  titlebar = new Titlebar(options);
});

export const titleBar = {
  setDark: (dark: boolean) => {
    if (!titlebar) {
      return;
    }
    titlebar.updateBackground(TitlebarColor.fromHex(dark ? '#1d1e1f' : '#fcfcfc'));
    titlebar.updateItemBGColor(TitlebarColor.fromHex(dark ? '#393a3c' : '#dedfe0'));
  },
};

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
  startRtu: async (config: ModbusRtuServerConfiguration) => {
    return ipcRenderer.invoke('startRtuServer', config);
  },
  stopRtu: async () => {
    return ipcRenderer.invoke('stopRtuServer');
  },
  getRtuData: async (serverDataRequest: ServerDataRequest) => {
    return ipcRenderer.invoke('getRtuServerData', serverDataRequest);
  },
  onLog: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.on('server:log', callback);
  },
  startTcp: async (config: ModbusTcpServerConfiguration) => {
    return ipcRenderer.invoke('startTcpServer', config);
  },
  stopTcp: async () => {
    return ipcRenderer.invoke('stopTcpServer');
  },
  getTcpData: async (serverDataRequest: ServerDataRequest) => {
    return ipcRenderer.invoke('getTcpServerData', serverDataRequest);
  },
  // TODO: Make separate loggers for TCP and RTU
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

export const registerScanner = {
  start: async (serialPortConfiguration: SerialPortConfiguration, unitId: number) => {
    return ipcRenderer.invoke('RegisterScanner:start', serialPortConfiguration, unitId);
  },
  onProgress: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.on('RegisterScanner:progress', callback);
  },
  onFoundRegisters: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.on('RegisterScanner:foundRegisters', callback);
  },
};

export const danfossEkc = {
  initiate: async (
    serialPortConfiguration: SerialPortConfiguration,
    unitId: number,
    useCache: boolean,
  ) => {
    return ipcRenderer.invoke('EKC:initiate', serialPortConfiguration, unitId, useCache);
  },
  disconnect: async () => {
    return ipcRenderer.invoke('EKC:disconnect');
  },
  onStatus: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.on('EKC:status', callback);
  },
  onParameterData: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.on('EKC:parameterData', callback);
  },
  setActiveGroup: async (groupId: number) => {
    return ipcRenderer.invoke('EKC:setActiveGroup', groupId);
  },
  writeParameter: async (pnu: number, value: number) => {
    return ipcRenderer.invoke('EKC:writeParameter', pnu, value);
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

// export const store = {
//   get: (key: string) => {
//     // console.log('Someone is getting the value for key:', key, ' in from the electron store');
//     return ipcRenderer.sendSync('electron-store-get', key);
//   },
//   set: (key: string, val: any) => {
//     // console.log('Someone is setting the value for key:', key, ' in the electron store to:', val);
//     ipcRenderer.send('electron-store-set', key, val);
//   },
// };

// if (process.contextIsolated) {
//   try {
//     contextBridge.exposeInMainWorld('electron', electronAPI);
//   } catch (error) {
//     console.error(error);
//   }
// } else {
//   window.electron = electronAPI;
// }
