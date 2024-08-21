/**
 * TODO: Rewrite this config to ESM
 * But currently electron-builder doesn't support ESM configs
 * @see https://github.com/develar/read-config-file/issues/10
 */

/**
 * @type {() => import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
module.exports = async function () {
  const {getVersion} = await import('./version/getVersion.mjs');

  return {
    appId: 'com.modbus-tool-x.app',
    productName: 'Modbus Tool X',
    copyright: 'Copyright © 2024 ${author}',
    directories: {
      output: 'dist',
      buildResources: 'buildResources',
    },
    nsis: {
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      shortcutName: 'Modbus Tool X',
    },
    win: {
      target: 'nsis',
      icon: 'packages/main/src/icon.ico',
    },
    publish: [
      {
        provider: 'generic',
        url: 'https://download.karlborgselkontroll.se:8443/update/${os}${arch}/',
        channel: 'latest',
        useMultipleRangeRequest: false,
      },
    ],
    files: ['packages/**/dist/**'],
    extraMetadata: {
      version: getVersion(),
    },

    // Specify linux target just for disabling snap compilation
    linux: {
      target: 'deb',
    },
  };
};
