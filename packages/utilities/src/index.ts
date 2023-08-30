import _electron from 'electron';
import {ModbusServer} from '../../main/src/modbus/modbusServer';
import {sleep} from '../../main/src/modbus/utilities';

let server: null | ModbusServer = null;

process.parentPort.on('message', async e => {
  if (e.data.request === 'startRtuServer') {
    const config = e.data.config as ModbusRtuServerConfiguration;

    console.log('Starting Modbus server');
    if (server) {
      console.log('Server already running, stopping...');
      await server.stop();
      server = null;
      await sleep(1000);
      console.log('Server stopped, starting new one...');
    }

    server = new ModbusServer(config);

    server.on('log', (_type, _log) => {
      console.log('Got log from ModbusServer');
      // browserWindow.webContents.send('server:log', type, log);
    });
  }
});

// ipcMain.handle('stopRtuServer', async _event => {
//   console.log('Stopping Modbus server');

//   server?.stop();

//   server = null;
// });

// ipcMain.handle('getServerData', async (_event, {type, register, count}: ServerDataRequest) => {
//   if (!server) return;

//   console.log('Fetching data from Modbus server');

//   return server.getData(type, register, count);
// });
