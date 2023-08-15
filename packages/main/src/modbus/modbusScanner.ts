import ModbusRTU from 'modbus-serial';
import {Semaphore} from 'async-mutex';
import {EventEmitter} from 'events';
import {range} from 'underscore';
import {getIpList} from '../networkUtils';
import {sleep} from './utilities';
import {
  DANFOSS_MODEL_FILE_NUMBER,
  DANFOSS_MODEL_REF_TYPE,
  DANFOSS_MODEL_RECORD_NUMBER,
  DANFOSS_MODEL_RECORD_LENGTH,
  DANFOSS_VERSION_PNU,
  parseDanfossVersion,
  parseDanfossOrderNumber,
} from './danfoss';
import {REGISTER_OFFSET} from './modbusCommon';

const MAX_TCP_CONNECTIONS = 10;

enum ScanState {
  Waiting = 0,
  Scanning = 1,
  Online = 2,
  Offline = 3,
  Online_But_No_Response = 4, // Only relevant for Modbus TCP
  Error = 5,
}

const tcpSemaphore = new Semaphore(MAX_TCP_CONNECTIONS);

class ModbusScanner extends EventEmitter {
  scanList: ScanItem[];
  foundUnits: number;

  constructor() {
    super();
    this.scanList = [];
    this.foundUnits = 0;
  }

  log(type: LogType, message: string) {
    this.emit('log', {
      type,
      message,
    });
  }
}

function timeSince(start: [number, number]) {
  const [elapsedSec, elapsedNano] = process.hrtime(start);
  return `${elapsedSec}.${(elapsedNano / 1000000).toFixed().padStart(3, '0')}s`;
}

export class ModbusScannerTCP extends ModbusScanner {
  scanList: ScanItem[];
  stateList: string[];
  constructor() {
    super();
    this.scanList = [];
    this.stateList = [];
    this.stateList[ScanState.Waiting] = 'Waiting';
    this.stateList[ScanState.Scanning] = 'Scanning';
    this.stateList[ScanState.Online] = 'Online';
    this.stateList[ScanState.Offline] = 'Server offline';
    this.stateList[ScanState.Online_But_No_Response] = 'Server online but no response';
    this.stateList[ScanState.Error] = 'Error';

    this.emit('log', 'Scanner initiated!');
  }

  async scan({startIp, endIp, port, minUnitId, maxUnitId, timeout}: ModbusTcpScanConfiguration) {
    const start = process.hrtime();
    // console.log('Start:')
    // console.log(start[0])
    // console.log(start[1])
    this.scanList = getIpList(startIp, endIp).map(ip => {
      return {
        meta: {},
        id: ip,
        state: ScanState.Waiting,
        stateText: this.stateList[ScanState.Waiting],
        errorMessage: '',
      };
    });

    this.emit('status', this.scanList);
    this.emit('progress', [0, this.foundUnits]);

    const searchSlaves = async (scanItem: ScanItem) => {
      const client = new ModbusRTU();
      client.setTimeout(timeout);

      const ip = scanItem.id as string;
      this.log('info', `${timeSince(start)}: Checking if server at ${ip}:${port} `);
      scanItem.state = 1;
      scanItem.stateText = this.stateList[ScanState.Scanning];

      try {
        await client.connectTCP(ip, {port});
        this.log('success', `${timeSince(start)}: Server alive at ${ip}:${port} `);

        const checkUnitId = async (id: UnitId) => {
          if (!client.isOpen) {
            console.log('Reconnecting to host');
            await client.connectTCP(ip, {port});
          }
          this.log('info', `${timeSince(start)}: Checking if unitID ${id} responds`);
          // try to read a known register that exists on each controller
          client.setID(id);
          try {
            await client.readHoldingRegisters(0, 1);
            // if data exists outputs success
            this.log('success', `${timeSince(start)}: Unit is online`);
            scanItem.state = ScanState.Online;
            scanItem.stateText = this.stateList[ScanState.Online];
            scanItem.errorMessage = `Unit ID: ${id}.Online`;
            this.foundUnits++;
            return true;

            // if no response and timeout kicks in script assumes no slave exists on this address.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (error: any) {
            if (!error.message && !(error instanceof Error)) {
              console.log(error);
              this.log('error', `${timeSince(start)}: Unexpected error!`);
              scanItem.state = ScanState.Online_But_No_Response;
              scanItem.stateText = 'Error';
              scanItem.errorMessage = 'Unexpected error';
              return false;
            }

            // if err.name === 'TransactionTimedOutError'
            if (error.message.startsWith('Modbus exception')) {
              this.log(
                'info',
                `${timeSince(start)}: Unit gave response with a modbus exception(${error.message})`,
              );
              scanItem.state = ScanState.Online;
              scanItem.stateText = this.stateList[ScanState.Online];
              scanItem.errorMessage = `Unit ID: ${id}. ${error.message} `;
              this.foundUnits++;
              return true;
            } else {
              this.log('warning', `${timeSince(start)}: Unit is not responding(${error.message})`);
              // console.log(`${error.message} -> Unit is considered to be offline`);
              // console.log(err.message)
              scanItem.state = ScanState.Online_But_No_Response;
              scanItem.stateText = this.stateList[ScanState.Online_But_No_Response];
              scanItem.errorMessage = `${error.message} (${error.name})`;
              return false;
            }
          }
        };

        for (let id = minUnitId; id <= maxUnitId; id++) {
          scanItem.state = ScanState.Scanning;
          scanItem.stateText = this.stateList[ScanState.Scanning];
          const unitOK = await checkUnitId(id);
          if (unitOK) {
            // console.log(`${ ip } -${ id }: Will exit for loop!`)
            break;
          }
          // console.log(`${ ip } - ${ id }: Will continue for loop`)
        }
        // console.log(`${ ip }: Will break connection!`)
        client.close(() => null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (!error.message && !(error instanceof Error)) {
          console.log(error);
          this.log('error', `${timeSince(start)}: Unexpected error!`);
          scanItem.state = ScanState.Error;
          scanItem.stateText = this.stateList[ScanState.Error];
          scanItem.errorMessage = 'Unexpected error';
          return false;
        }
        // console.log(error)
        this.log('warning', `${timeSince(start)}: Unable to connect to ${ip}:${port} `);
        // console.log(`${timeSince(start)}: Unable to connect to ${ip}:${port} `)
        scanItem.state = ScanState.Offline;
        scanItem.stateText = this.stateList[ScanState.Offline];
        scanItem.errorMessage = error.message;
      }

      this.emit('status', this.scanList);

      const itemsScanned = this.scanList.reduce((acc, item) => {
        if (item.state > ScanState.Scanning) {
          acc++;
        }
        return acc;
      }, 0);

      const progress = (itemsScanned / this.scanList.length) * 100;

      this.emit('progress', [progress, this.foundUnits]);

      // if (host === endIp) {
      //
      //   return
      // }
    };

    const promises = this.scanList.map(item => {
      return tcpSemaphore.runExclusive(() => searchSlaves(item));
    });

    await Promise.all(promises);
    // console.log('Done!');
    // const end = process.hrtime()
    // console.log('End:')
    // console.log(start[0])
    // console.log(start[1])

    // console.log('Diff:')
    // console.log(process.hrtime(start)[0])
    // console.log(process.hrtime(start)[1])
    const executionTime = process.hrtime(start)[1] / 1000000; // divide by a million to get nano to milli
    // console.log(`${(new Date).getTime()} `)
    this.log('info', `Scan completed after ${executionTime.toFixed(1)} ms`);
  }
}

export class ModbusScannerRTU extends ModbusScanner {
  stateList: string[];
  constructor() {
    super();
    this.stateList = ['Waiting', 'Scanning', 'Alive', 'Unavailable', 'Dead'];

    this.emit('log', 'Scanner initiated!');
  }

  async scan({
    port,
    baudRate,
    parity,
    dataBits,
    stopBits,
    timeout,
    minUnitId,
    maxUnitId,
    delay,
  }: ModbusRtuScanConfiguration) {
    const start = process.hrtime();
    this.emit('status', this.scanList);
    this.emit('progress', [0, this.foundUnits]);

    this.scanList = range(minUnitId, maxUnitId + 1).map((unitId: UnitId) => {
      return {
        id: unitId,
        meta: {},
        state: 0,
        stateText: this.stateList[0],
        errorMessage: '',
      };
    });

    const searchSlaves = async () => {
      const client = new ModbusRTU();
      client.setTimeout(timeout);

      try {
        await client.connectRTUBuffered(port, {baudRate, parity, dataBits, stopBits});
        this.log('success', `Opened ${port} successfully`);

        const checkUnitId = async (scanItem: ScanItem) => {
          const id = scanItem.id as number;
          // if (!client.isOpen) {
          //   console.log('Reconnecting to host')
          //   await client.connectTCP(ip, { port })
          // }
          this.log('info', `${timeSince(start)}: Checking if unitID ${id} responds`);
          // try to read a known register that exists on each controller
          client.setID(id);
          try {
            const modbusRequest = client.readInputRegisters(
              DANFOSS_VERSION_PNU + REGISTER_OFFSET,
              1,
            );

            const result = await modbusRequest;
            const danfossVersion = parseDanfossVersion(result.data[0]);
            // if data exists outputs success
            this.log(
              'success',
              `${timeSince(start)}: Unit is online (v${danfossVersion.versionMajor}.${
                danfossVersion.versionMinor
              })`,
            );
            scanItem.meta.softwareVersion =
              danfossVersion.versionMajor + '.' + danfossVersion.versionMinor;
            scanItem.state = ScanState.Online;
            scanItem.stateText = this.stateList[ScanState.Online];
            scanItem.errorMessage = `Unit ID: ${id}.Online`;
            this.foundUnits++;
            return true;

            // if no response and timeout kicks in script assumes no slave exists on this address.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (error: any) {
            if (!error.message && !(error instanceof Error)) {
              console.log(error);
              this.log('error', `${timeSince(start)}: Unexpected error!`);
              scanItem.state = ScanState.Error;
              scanItem.stateText = this.stateList[ScanState.Error];
              scanItem.errorMessage = 'Unexpected error';
              return false;
            }

            // if err.name === 'TransactionTimedOutError'
            if (error.message.startsWith('Modbus exception')) {
              this.log(
                'info',
                `${timeSince(start)}: Unit gave response with a modbus exception(${error.message})`,
              );
              scanItem.state = ScanState.Online;
              scanItem.stateText = this.stateList[ScanState.Online];
              scanItem.errorMessage = `Unit ID: ${id}. ${error.message} `;
              this.foundUnits++;
              return true;
            } else {
              this.log('warning', `${timeSince(start)}: Unit is not responding(${error.message})`);
              // console.log(`${error.message} -> Unit is considered to be offline`);
              // console.log(err.message)
              scanItem.state = ScanState.Offline;
              scanItem.stateText = this.stateList[ScanState.Offline];
              scanItem.errorMessage = `${error.message} (${error.name})`;
              return false;
            }
          }
        };

        for (const scanItem of this.scanList) {
          scanItem.state = ScanState.Scanning;
          scanItem.stateText = this.stateList[ScanState.Scanning];
          await checkUnitId(scanItem);

          this.emit('status', this.scanList);
          await sleep(delay);

          const itemsScanned = this.scanList.reduce((acc, item) => {
            if (item.state > 1) {
              acc++;
            }
            return acc;
          }, 0);

          const progress = (itemsScanned / this.scanList.length) * 100;

          this.emit('progress', [progress, this.foundUnits]);
        }

        const checkDanfossModel = async (scanItem: ScanItem) => {
          const id = scanItem.id as number;
          this.log('info', `${timeSince(start)}: Checking Danfoss Model for unitID ${id}`);
          // try to read a known register that exists on each controller
          client.setID(id);
          console.log(`${timeSince(start)}: Checking Danfoss Model for unitID ${id}`);
          const modbusRequest = client.readFileRecords(
            DANFOSS_MODEL_FILE_NUMBER,
            DANFOSS_MODEL_RECORD_NUMBER,
            DANFOSS_MODEL_RECORD_LENGTH,
            DANFOSS_MODEL_REF_TYPE,
          );

          const result = await modbusRequest;
          console.log(`${timeSince(start)}: Result`);
          if (result.data) {
            console.log(result.data);
            this.log('info', `${timeSince(start)}: ${result.data}`);
            const danfossDevice = parseDanfossOrderNumber(result.data as string);
            scanItem.meta.deviceType = 'Danfoss ' + danfossDevice.protocolFamily;
            scanItem.meta.deviceModel = danfossDevice.orderNumber;
          } else {
            console.log(result);
          }
          scanItem.state = ScanState.Online;
          scanItem.stateText = this.stateList[ScanState.Online];
          scanItem.errorMessage = `Unit ID: ${id}.Online`;
        };

        // Loop over all units that we received a versionNumber from and device model from them
        for (const scanItem of this.scanList.filter(item => item.meta.softwareVersion)) {
          scanItem.state = ScanState.Scanning;
          scanItem.stateText = this.stateList[ScanState.Scanning];
          await checkDanfossModel(scanItem);

          this.emit('status', this.scanList);
          await sleep(delay);
        }

        // console.log(`${ ip }: Will break connection!`)
        client.close(() => null);
      } catch (error) {
        console.log(error);
        this.log('warning', `Unable to open ${port} `);
        throw error;
      }
    };

    await searchSlaves();
    // console.log('Done!');
    this.log('info', 'Scan complete!');
    this.emit('progress', [100, this.foundUnits]);
  }
}
