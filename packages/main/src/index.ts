import {app, ipcMain, Menu} from 'electron';
import './security-restrictions';
import {getSerialPorts} from './serialUtils';
import {restoreOrCreateWindow} from '/@/mainWindow';
import {platform} from 'node:process';
// import log from 'electron-log'
// import { autoUpdater }  from 'electron-updater'

// log.transports.file.level = 'info';
// autoUpdater.logger = log;
// log.info('App starting...');

/**
 * Prevent electron from running multiple instances.
 */
const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', restoreOrCreateWindow);

/**
 * Disable Hardware Acceleration to save more system resources.
 */
app.disableHardwareAcceleration();

const aboutOptions: Electron.AboutPanelOptionsOptions = {
  applicationName: 'Modbus Tool X',
  applicationVersion: app.getVersion(),
  authors: ['Alexander Schmidt'],
  copyright: '© Alexander Schmidt, 2024',
};

app.setAboutPanelOptions(aboutOptions);

const template: Electron.MenuItemConstructorOptions[] = [
  {
    label: 'File',
    submenu: [{role: 'quit'}],
  },
  {
    label: 'Edit',
    submenu: [
      {
        role: 'cut',
      },
      {
        role: 'copy',
      },
      {
        role: 'paste',
      },
    ],
  },
  {
    label: 'View',
    submenu: [
      {
        role: 'reload',
      },
      {
        role: 'toggleDevTools',
      },
    ],
  },
  {
    label: 'View',
    submenu: [
      {
        role: 'about',
      },
    ],
  },
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

/**
 * Shout down background process if all windows was closed
 */
app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit();
  }
});

/**
 * @see https://www.electronjs.org/docs/latest/api/app#event-activate-macos Event: 'activate'.
 */
app.on('activate', restoreOrCreateWindow);

/**
 * Create the application window when the background process is ready.
 */
app
  .whenReady()
  .then(restoreOrCreateWindow)
  .catch(e => console.error('Failed create window:', e));

/**
 * Install Vue.js or any other extension in development mode only.
 * Note: You must install `electron-devtools-installer` manually
 */
// if (import.meta.env.DEV) {
//   app
//     .whenReady()
//     .then(() => import('electron-devtools-installer'))
//     .then(module => {
//       const {default: installExtension, VUEJS3_DEVTOOLS} =
//         // @ts-expect-error Hotfix for https://github.com/cawa-93/vite-electron-builder/issues/915
//         typeof module.default === 'function' ? module : (module.default as typeof module);
//
//       return installExtension(VUEJS3_DEVTOOLS, {
//         loadExtensionOptions: {
//           allowFileAccess: true,
//         },
//       });
//     })
//     .catch(e => console.error('Failed install extension:', e));
// }

ipcMain.handle('getComPorts', async _event => {
  const comPorts = await getSerialPorts();
  return comPorts;
});

// let win: null | BrowserWindow;

// function sendStatusToWindow(text: string) {
//   if (!win) return
//   log.info(text);
//   win.webContents.send('message', text);
// }
// function createDefaultWindow() {
//   win = new BrowserWindow();
//   win.webContents.openDevTools();
//   win.on('closed', () => {
//     win = null;
//   });
//   win.loadURL(`file://${__dirname}/version.html#v${app.getVersion()}`);
//   return win;
// }
// autoUpdater.on('checking-for-update', () => {
//   sendStatusToWindow('Checking for update...');
// })
// autoUpdater.on('update-available', (info) => {
//   sendStatusToWindow('Update available.');
// })
// autoUpdater.on('update-not-available', (info) => {
//   sendStatusToWindow('Update not available.');
// })
// autoUpdater.on('error', (ev, err) => {
//   sendStatusToWindow('Error in auto-updater.');
// })
// autoUpdater.on('download-progress', (progressObj) => {
//   sendStatusToWindow('Download progress...');
// })
// autoUpdater.on('update-downloaded', (info) => {
//   sendStatusToWindow('Update downloaded; will install in 5 seconds');
// })

process.on('uncaughtException', function (error) {
  console.error(error);
});

/**
 * Check for app updates, install it in background and notify user that new version was installed.
 * No reason run this in non-production build.
 * @see https://www.electron.build/auto-update.html#quick-se-tup-guide
 *
 * Note: It may throw "ENOENT: no such file app-update.yml"
 * if you compile production app without publishing it to distribution server.
 * Like `npm run compile` does. It's ok 😅
 */
if (!import.meta.env.DEV) {
  app
    .whenReady()
    .then(async () => {
      /**
       * Here we forced to use `require` since electron doesn't fully support dynamic import in asar archives
       * @see https://github.com/electron/electron/issues/38829
       * Potentially it may be fixed by this https://github.com/electron/electron/pull/37535
       */
      const {autoUpdater} = await import('electron-updater');
      autoUpdater.checkForUpdatesAndNotify();
      // require('electron-updater').autoUpdater.checkForUpdatesAndNotify(),
    })
    .catch(e => console.error('Failed check and install updates:', e));
}
