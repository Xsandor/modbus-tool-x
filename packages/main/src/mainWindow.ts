import {app, BrowserWindow, ipcMain, dialog} from 'electron';
import {join, resolve} from 'node:path';
import {throttle} from 'underscore';
import {
  ModbusLoggerTCP,
  ModbusLoggerRTU,
  modbusTcpRequest,
  modbusRtuRequest,
  ModbusScannerRTU,
  ModbusScannerTCP,
  ModbusAnalyzer,
  RegisterScanner,
  DanfossEKC,
} from './modbus';
import {ModbusServer} from './modbus';
import {getNetworkInfo} from './networkUtils';
import {writeFile} from 'node:fs';
import Store from 'electron-store';
import {sleep} from './modbus/utilities';

const store = new Store();

async function createWindow() {
  const browserWindow = new BrowserWindow({
    show: false, // Use the 'ready-to-show' event to show the instantiated BrowserWindow.
    width: 1640,
    height: 1080,
    icon: 'packages/main/src/icon.ico',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true, // Sandbox disabled because the demo of preload script depend on the Node.js api
      webviewTag: false, // The webview tag is not recommended. Consider alternatives like an iframe or Electron's BrowserView. @see https://www.electronjs.org/docs/latest/api/webview-tag#warning
      preload: join(app.getAppPath(), 'packages/preload/dist/index.cjs'),
    },
  });

  /**
   * If the 'show' property of the BrowserWindow's constructor is omitted from the initialization options,
   * it then defaults to 'true'. This can cause flickering as the window loads the html content,
   * and it also has show problematic behaviour with the closing of the window.
   * Use `show: false` and listen to the  `ready-to-show` event to show the window.
   *
   * @see https://github.com/electron/electron/issues/25012 for the afford mentioned issue.
   */
  browserWindow.on('ready-to-show', () => {
    browserWindow?.show();

    if (import.meta.env.DEV) {
      // browserWindow?.webContents.openDevTools();
    }
  });

  /**
   * Load the main page of the main window.
   */
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_SERVER_URL !== undefined) {
    /**
     * Load from the Vite dev server for development.
     */
    await browserWindow.loadURL(import.meta.env.VITE_DEV_SERVER_URL);
  } else {
    /**
     * Load from the local file system for production and test.
     *
     * Use BrowserWindow.loadFile() instead of BrowserWindow.loadURL() for WhatWG URL API limitations
     * when path contains special characters like `#`.
     * Let electron handle the path quirks.
     * @see https://github.com/nodejs/node/issues/12682
     * @see https://github.com/electron/electron/issues/6869
     */
    await browserWindow.loadFile(resolve(__dirname, '../../renderer/dist/index.html'));
  }

  // IPC listener
  ipcMain.on('electron-store-get', async (event, val) => {
    event.returnValue = store.get(val);
  });

  ipcMain.on('electron-store-set', async (_event, key, val) => {
    store.set(key, val);
  });

  ipcMain.handle('saveCSV', async (_event, data, source: null | string) => {
    let defaultFileName = '';
    if (source) {
      const date = new Date();
      defaultFileName = (source + ' ' + date.toLocaleString())
        .replaceAll(' ', '_')
        .replaceAll('-', '')
        .replaceAll(':', '');
    }

    const {canceled, filePath} = await dialog.showSaveDialog({
      defaultPath: defaultFileName,
      filters: [{name: 'CSV', extensions: ['csv']}],
    });

    if (!canceled && filePath) {
      writeFile(filePath, data, 'utf8', err => {
        if (err) {
          console.error(err);
        }
      });
    }
  });

  let logger: ModbusLoggerRTU | ModbusLoggerTCP | null = null;

  ipcMain.handle('startTcpLogger', async (_event, configuration) => {
    logger = new ModbusLoggerTCP();

    let logs: GenericObject[] = [];

    const sendLogsToWeb = throttle(() => {
      browserWindow.webContents.send('logger:log', logs);
      logs = [];
    }, 250);

    logger.on('log', log => {
      logs.push(log);
      sendLogsToWeb();
    });

    try {
      await logger.request(configuration);
      return {
        result: 'started',
        error: null,
      };
    } catch (error) {
      return {
        result: 'error',
        error: 'Unexpected error, check you settings',
      };
    }
  });

  ipcMain.handle('startRtuLogger', async (_event, configuration) => {
    logger = new ModbusLoggerRTU();

    let logs: GenericObject[] = [];

    const sendLogsToWeb = throttle(() => {
      browserWindow.webContents.send('logger:log', logs);
      logs = [];
    }, 250);

    logger.on('log', log => {
      logs.push(log);
      sendLogsToWeb();
    });

    try {
      await logger.request(configuration);
      return {
        result: 'started',
        error: null,
      };
    } catch (error) {
      return {
        result: 'error',
        error: 'Port already in use',
      };
    }
  });

  function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  ipcMain.handle('performTcpRequest', async (_event, configuration) => {
    try {
      return modbusTcpRequest(configuration);
    } catch (error) {
      return {
        errorCode: 997,
        errorText: getErrorMessage(error),
        timestamp: new Date(),
        data: [],
      };
    }
  });

  ipcMain.handle('performRtuRequest', async (_event, configuration) => {
    try {
      return modbusRtuRequest(configuration);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return {
        errorCode: 997,
        errorText: error.message || '',
        timestamp: new Date(),
        data: [],
      };
    }
  });

  let scanner: ModbusScannerTCP | ModbusScannerRTU | null = null;

  ipcMain.handle('startTcpScan', async (_event, options) => {
    console.log('Start TCP Scan');
    console.log(options);
    scanner = new ModbusScannerTCP();

    let logs: GenericObject[] = [];

    const sendLogsToWeb = throttle(() => {
      browserWindow.webContents.send('scanner:log', logs);
      logs = [];
    }, 250);

    scanner.on('log', log => {
      logs.push(log);
      sendLogsToWeb();
    });

    const sendStatusToWeb = throttle((statusList: GenericObject[]) => {
      browserWindow.webContents.send('scanner:status', statusList);
    }, 250);

    scanner.on('status', statusList => {
      sendStatusToWeb(statusList);
    });

    const sendProgressToWeb = throttle((progress: number) => {
      browserWindow.webContents.send('scanner:progress', progress);
    }, 250);

    scanner.on('progress', progress => {
      sendProgressToWeb(progress);
    });

    try {
      scanner.scan(options);
      return {
        result: 'started',
        error: null,
      };
    } catch (error) {
      return {
        result: 'error',
        error: 'Unexpected error, check your settings.',
      };
    }
  });

  ipcMain.handle('startRtuScan', async (_event, options) => {
    console.log('Start RTU Scan');
    console.log(options);
    scanner = new ModbusScannerRTU();

    let logs: GenericObject[] = [];

    const sendLogsToWeb = throttle(() => {
      browserWindow.webContents.send('scanner:log', logs);
      logs = [];
    }, 250);

    scanner.on('log', log => {
      logs.push(log);
      sendLogsToWeb();
    });

    const sendStatusToWeb = throttle((statusList: GenericObject[]) => {
      browserWindow.webContents.send('scanner:status', statusList);
    }, 250);

    scanner.on('status', statusList => {
      sendStatusToWeb(statusList);
    });

    const sendProgressToWeb = throttle((progress: number) => {
      browserWindow.webContents.send('scanner:progress', progress);
    }, 250);

    scanner.on('progress', progress => {
      sendProgressToWeb(progress);
    });

    try {
      scanner.scan(options);
      return {
        result: 'started',
        error: null,
      };
    } catch (_err) {
      return {
        result: 'error',
        error: 'Port already in use',
      };
    }
  });

  let registerScanner: null | RegisterScanner = null;

  ipcMain.handle('RegisterScanner:start', async (_event, serialPortConfiguration, unitId) => {
    if (registerScanner) {
      console.log('Register scanner already initiated, closing...');
      await registerScanner.close();
      registerScanner = null;
      await sleep(100);
    }
    console.log('Initiating register scanner');
    registerScanner = new RegisterScanner(serialPortConfiguration, unitId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendProgressToWeb = throttle((progress: any) => {
      browserWindow.webContents.send('RegisterScanner:progress', progress);
    }, 250);

    registerScanner.on('progress', sendProgressToWeb);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendFoundRegistersToWeb = throttle((foundRegisters: any) => {
      browserWindow.webContents.send('RegisterScanner:foundRegisters', foundRegisters);
    }, 250);

    registerScanner.on('foundRegisters', sendFoundRegistersToWeb);

    registerScanner.start();
  });

  let danfossEkc: null | DanfossEKC = null;

  ipcMain.handle('EKC:initiate', async (_event, serialPortConfiguration, unitId) => {
    if (danfossEkc) {
      console.log('Danfoss EKC device already initiated, closing...');
      await danfossEkc.close();
      danfossEkc = null;
      await sleep(100);
    }
    console.log('Initiating Danfoss EKC device');
    danfossEkc = new DanfossEKC(serialPortConfiguration, unitId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendStatusToWeb = throttle((status: any) => {
      browserWindow.webContents.send('EKC:status', status);
    }, 250);

    danfossEkc.on('status', sendStatusToWeb);

    danfossEkc.on('parameterData', data => {
      browserWindow.webContents.send('EKC:parameterData', data);
    });

    const device = await danfossEkc.initiate();

    return device;
  });

  ipcMain.handle('EKC:setActiveGroup', async (_event, groupId) => {
    if (!danfossEkc) {
      return;
    }
    danfossEkc.setActiveGroup(groupId);
    return;
  });

  ipcMain.handle('EKC:writeParameter', async (_event, pnu, value) => {
    if (!danfossEkc) {
      return;
    }
    console.log('Writing new value to:', pnu, value);
    return await danfossEkc.writeParameter(pnu, value);
  });

  let analyzer: ModbusAnalyzer | null = null;

  ipcMain.handle('startRtuAnalyzer', async (_event, options) => {
    console.log('Starting RTU Analyzer');
    console.log(options);
    // if (analyzer) {
    //   await analyzer.stop()
    // }
    analyzer = new ModbusAnalyzer();

    let logs: GenericObject[] = [];

    const sendLogsToWeb = throttle(() => {
      browserWindow.webContents.send('analyzer:log', logs);
      logs = [];
    }, 250);

    analyzer.on('log', log => {
      logs.push(log);
      sendLogsToWeb();
    });

    try {
      console.log('Will start now!');
      await analyzer.start(options);
      console.log('Done!');
      return {
        result: 'started',
        error: null,
      };
    } catch (error) {
      console.log('Error occurred!');
      return {
        result: 'error',
        error: 'Port already in use',
      };
    }
  });

  ipcMain.handle('stopRtuAnalyzer', async _event => {
    console.log('Stopping RTU Analyzer');
    if (analyzer) {
      await analyzer.stop();
      analyzer = null;
    }
  });

  let server: null | ModbusServer = null;

  ipcMain.handle('startRtuServer', async (_event, config: ModbusRtuServerConfiguration) => {
    console.log('Starting Modbus server');
    // const child = utilityProcess
    //   .fork(path.join(__dirname, '../../utilities/dist/index.cjs'))
    //   .on('spawn', () => {
    //     console.log('spawned new utilityProcess');
    //     child.postMessage({request: 'startRtuServer', config});
    //   })
    //   .on('exit', _code => console.log('existing utilityProcess'));
    if (server) {
      console.log('Server already running, stopping...');
      await server.stop();
      server = null;
      await sleep(1000);
      console.log('Server stopped, starting new one...');
    }

    server = new ModbusServer(config);

    server.on('log', (type, log) => {
      console.log('Got log from ModbusServer');
      browserWindow.webContents.send('server:log', type, log);
    });
  });

  ipcMain.handle('stopRtuServer', async _event => {
    console.log('Stopping Modbus server');

    server?.stop();

    server = null;
  });

  ipcMain.handle('getServerData', async (_event, {type, register, count}: ServerDataRequest) => {
    if (!server) return;

    console.log('Fetching data from Modbus server');

    return server.getData(type, register, count);
  });

  const networkInfo = await getNetworkInfo();
  browserWindow.webContents.send('network:info', networkInfo);

  ipcMain.on('getNetworkInfo', async () => {
    console.log('Someone is requesting network info!');
    browserWindow.webContents.send('network:info', networkInfo);
  });

  return browserWindow;
}

/**
 * Restore an existing BrowserWindow or Create a new BrowserWindow.
 */
export async function restoreOrCreateWindow() {
  let window = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());

  if (window === undefined) {
    window = await createWindow();
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.focus();
}
