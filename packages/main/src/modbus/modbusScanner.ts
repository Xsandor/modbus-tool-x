import ModbusRTU from 'modbus-serial';
import {Semaphore} from 'async-mutex';
import {EventEmitter} from 'events';
import {range} from 'underscore';
import {getIpList, validateIPv4} from '../networkUtils';
import {sleep, logger} from './utilities';
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

const log = logger.createLogger('Modbus Scanner');

const MAX_TCP_CONNECTIONS = 10;
const SCAN_REGISTER = 0;

function timeSince(start: [number, number]) {
  const [elapsedSec, elapsedNano] = process.hrtime(start);
  return `${elapsedSec}.${(elapsedNano / 1000000).toFixed().padStart(3, '0')}s`;
}

enum ScanState {
  Waiting = 0,
  Scanning = 1,
  Online = 2,
  Offline = 3,
  Online_But_No_Response = 4, // Only relevant for Modbus TCP
  Error = 5,
}

interface ModbusScannerEventMap {
  log: ScanLogItem;
  progress: ScanProgress;
  status: ScanItem[];
}

class ModbusScanner extends EventEmitter {
  scanList: ScanItem[];
  itemsScanned: number;
  stateList: string[];
  scanStartedAt: undefined | [number, number];
  foundUnits: number;
  abort: boolean = false;

  constructor() {
    super();
    this.scanList = [];
    this.stateList = [];
    this.itemsScanned = 0;
    this.foundUnits = 0;
  }

  stop() {
    this.abort = true;
  }

  public setScanItemState(scanItem: ScanItem, state: ScanState) {
    scanItem.state = state;
    scanItem.stateText = this.stateList[state];
  }

  emit<K extends keyof ModbusScannerEventMap>(
    eventName: K,
    eventData: ModbusScannerEventMap[K],
  ): boolean {
    return super.emit(eventName, eventData);
  }

  protected reportStatus() {
    this.emit('status', this.scanList);
  }

  protected reportProgress(aborted = false) {
    let progress = 0;

    if (aborted) {
      progress = 100;
    } else if (this.itemsScanned && this.scanList.length) {
      progress = (this.itemsScanned / this.scanList.length) * 100;
    }

    this.emit('progress', [progress, this.foundUnits]);
  }

  protected log(type: LogType, message: string) {
    let text = message;

    log.info(message);

    if (this.scanStartedAt) {
      text = `${timeSince(this.scanStartedAt)}: ${message}`;
    }

    const logData = {
      type,
      text,
    };

    this.emit('log', logData);
  }
}

export class ModbusScannerTCP extends ModbusScanner {
  semaphore: Semaphore;

  constructor() {
    super();
    this.stateList[ScanState.Waiting] = 'Waiting';
    this.stateList[ScanState.Scanning] = 'Scanning';
    this.stateList[ScanState.Online] = 'Online';
    this.stateList[ScanState.Offline] = 'Server offline';
    this.stateList[ScanState.Online_But_No_Response] = 'Server online but no response';
    this.stateList[ScanState.Error] = 'Error';

    this.semaphore = new Semaphore(MAX_TCP_CONNECTIONS);

    this.log('info', 'Scanner initiated!');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleRequestError(id: string | number, error: any) {
    if (!error.message && !(error instanceof Error)) {
      log.info(error);
      this.log('error', 'Unexpected error!');

      return {
        state: ScanState.Online_But_No_Response,
        stateText: 'Error',
        errorMessage: 'Unexpected error',
      };
      // return false;
    }

    // if err.name === 'TransactionTimedOutError'
    if (error.message.startsWith('Modbus exception')) {
      this.log('info', `Unit gave response with a modbus exception(${error.message})`);
      return {
        state: ScanState.Online,
        stateText: this.stateList[ScanState.Online],
        errorMessage: `Unit ID: ${id}. ${error.message} `,
      };
      // this.foundUnits++;
      // return true;
    } else {
      this.log('warning', `Unit is not responding(${error.message})`);
      return {
        state: ScanState.Online_But_No_Response,
        stateText: this.stateList[ScanState.Online_But_No_Response],
        errorMessage: `${error.message} (${error.name})`,
      };
      // return false;
    }
  }

  async scan({
    startIp,
    endIp,
    port,
    minUnitId,
    maxUnitId,
    timeout,
    unitIds,
  }: ModbusTcpScanConfiguration) {
    // Check if start IP and end IP are valid
    if (!validateIPv4(startIp) || !validateIPv4(endIp)) {
      throw new TypeError('Start IP or end IP is not a valid IPv4 address');
    }

    if (minUnitId > maxUnitId) {
      throw new Error('minUnitId cannot be higher than maxUnitId');
    }

    this.generateScanList(startIp, endIp);

    this.scanStartedAt = process.hrtime();

    this.reportStatus();

    this.reportProgress();

    const searchSlaves = async (scanItem: ScanItem) => {
      if (this.abort) {
        return;
      }

      const client = new ModbusRTU();
      client.setTimeout(timeout);

      const ip = scanItem.id as string;
      this.log('info', `Checking if server at ${ip}:${port} `);
      this.setScanItemState(scanItem, ScanState.Scanning);

      try {
        await client.connectTCP(ip, {port});
        this.log('success', `Server alive at ${ip}:${port} `);

        const checkUnitId = async (id: UnitId) => {
          if (!client.isOpen) {
            log.info('Reconnecting to host');
            await client.connectTCP(ip, {port});
          }
          this.log('info', `Checking if unit ID ${id} responds`);
          // try to read a known register that exists on each controller
          client.setID(id);
          try {
            await client.readHoldingRegisters(SCAN_REGISTER, 1);
            // if data exists outputs success
            this.log('success', 'Unit is online');
            this.setScanItemState(scanItem, ScanState.Online);
            scanItem.errorMessage = `Unit ID: ${id}.Online`;
            this.foundUnits++;
            return true;

            // if no response and timeout kicks in script assumes no slave exists on this address.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (error: any) {
            const result = this.handleRequestError(id, error);
            scanItem.state = result.state;
            scanItem.stateText = result.stateText;
            scanItem.errorMessage = result.errorMessage;

            if (scanItem.state === ScanState.Online) {
              this.foundUnits++;
              return true;
            }

            return false;
          }
        };

        this.setScanItemState(scanItem, ScanState.Scanning);

        const list = unitIds.length ? unitIds : range(minUnitId, maxUnitId + 1);

        for (const id of list) {
          if (this.abort) {
            break;
          }

          const unitOK = await checkUnitId(id);

          if (unitOK) {
            break;
          }
        }

        client.close(() => null);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (!error.message && !(error instanceof Error)) {
          log.info(error);
          this.log('error', 'Unexpected error!');
          this.setScanItemState(scanItem, ScanState.Error);
          scanItem.errorMessage = 'Unexpected error';
          return false;
        }
        // log.info(error)
        this.log('warning', `Unable to connect to ${ip}:${port}`);
        // log.info(`${timeSince(start)}: Unable to connect to ${ip}:${port} `)
        this.setScanItemState(scanItem, ScanState.Offline);
        scanItem.errorMessage = error.message;
      } finally {
        this.itemsScanned++;
        this.reportStatus();
        this.reportProgress(this.abort);
      }
    };

    const promises = this.scanList.map(item => {
      // semaphore.runExclusive() will make sure that only MAX_TCP_CONNECTIONS are running at the same time
      return this.semaphore.runExclusive(() => searchSlaves(item));
    });

    await Promise.all(promises);

    this.log('info', `Scan completed after ${timeSince(this.scanStartedAt)}`);
  }

  private generateScanList(startIp: string, endIp: string) {
    this.scanList = getIpList(startIp, endIp).map(ip => {
      return {
        meta: {},
        id: ip,
        state: ScanState.Waiting,
        stateText: this.stateList[ScanState.Waiting],
        errorMessage: '',
      };
    });
  }
}

export class ModbusScannerRTU extends ModbusScanner {
  constructor() {
    super();
    this.stateList = ['Waiting', 'Scanning', 'Alive', 'Unavailable', 'Dead'];

    this.log('info', 'Scanner initiated!');
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
    unitIds,
  }: ModbusRtuScanConfiguration) {
    if (minUnitId > maxUnitId) {
      throw new Error('minUnitId cannot be higher than maxUnitId');
    }

    this.generateScanList(minUnitId, maxUnitId, unitIds);

    this.scanStartedAt = process.hrtime();

    this.reportStatus();

    this.reportProgress();

    const searchSlaves = async () => {
      const client = new ModbusRTU();
      client.setTimeout(timeout);

      try {
        this.log('info', `Trying to open ${port}...`);
        await client.connectRTUBuffered(port, {baudRate, parity, dataBits, stopBits});
        this.log('success', `Opened ${port} successfully`);

        const checkUnitId = async (scanItem: ScanItem) => {
          this.setScanItemState(scanItem, ScanState.Scanning);
          const id = scanItem.id as number;
          this.log('info', `Checking if unit ID ${id} responds`);
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
              `Unit is online (v${danfossVersion.versionMajor}.${danfossVersion.versionMinor})`,
            );
            scanItem.meta.softwareVersion =
              danfossVersion.versionMajor + '.' + danfossVersion.versionMinor;
            this.setScanItemState(scanItem, ScanState.Online);
            scanItem.errorMessage = `Unit ID: ${id}.Online`;
            this.foundUnits++;
            return true;

            // if no response and timeout kicks in script assumes no slave exists on this address.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (error: any) {
            if (!error.message && !(error instanceof Error)) {
              log.info(error);
              this.log('error', 'Unexpected error!');
              this.setScanItemState(scanItem, ScanState.Error);
              scanItem.errorMessage = 'Unexpected error';
              return false;
            }

            // if err.name === 'TransactionTimedOutError'
            if (error.message.startsWith('Modbus exception')) {
              this.log('info', `Unit gave response with a modbus exception(${error.message})`);
              // TODO: Make a setState function that takes a ScanItem and a ScanState, and sets the state and stateText, also allow for a custom error message

              this.setScanItemState(scanItem, ScanState.Online);
              scanItem.errorMessage = `Unit ID: ${id}. ${error.message} `;
              this.foundUnits++;
              return true;
            } else {
              this.log('warning', `Unit is not responding(${error.message})`);
              // log.info(`${error.message} -> Unit is considered to be offline`);
              // log.info(err.message)
              this.setScanItemState(scanItem, ScanState.Offline);
              scanItem.errorMessage = `${error.message} (${error.name})`;
              return false;
            }
          } finally {
            this.itemsScanned++;
          }
        };

        for (const scanItem of this.scanList) {
          if (this.abort) {
            break;
          }
          await checkUnitId(scanItem);

          this.reportStatus();
          await sleep(delay);

          this.reportProgress();
        }

        const checkDanfossModel = async (scanItem: ScanItem) => {
          const id = scanItem.id as number;
          this.log('info', `Checking Danfoss Model for unitID ${id}`);
          // try to read a known register that exists on each controller
          client.setID(id);
          log.info(`Checking Danfoss Model for unitID ${id}`);
          const modbusRequest = client.readFileRecords(
            DANFOSS_MODEL_FILE_NUMBER,
            DANFOSS_MODEL_RECORD_NUMBER,
            DANFOSS_MODEL_RECORD_LENGTH,
            DANFOSS_MODEL_REF_TYPE,
          );

          try {
            const result = await modbusRequest;

            if (result.data) {
              this.log('info', `${result.data}`);
              const danfossDevice = parseDanfossOrderNumber(result.data as string);
              scanItem.meta.deviceType = 'Danfoss ' + danfossDevice.protocolFamily;
              scanItem.meta.deviceModel = danfossDevice.orderNumber;
            } else {
              log.info(result);
            }
          } catch (_error) {
            this.log('warning', `Failed to get Danfoss Model for unitID ${scanItem.id}`);
          }

          this.setScanItemState(scanItem, ScanState.Online);
          scanItem.errorMessage = `Unit ID: ${id}.Online`;
        };

        // Loop over all units that we received a versionNumber from and device model from them
        for (const scanItem of this.scanList.filter(item => item.meta.softwareVersion)) {
          if (this.abort) {
            break;
          }
          this.setScanItemState(scanItem, ScanState.Scanning);
          await checkDanfossModel(scanItem);

          this.reportStatus();
          await sleep(delay);
        }

        // log.info(`${ ip }: Will break connection!`)
        client.close(() => null);
      } catch (error) {
        log.info(error);
        this.log('warning', `Unable to open ${port} `);
        throw error;
      }
    };

    await searchSlaves();
    // log.info('Done!');
    this.log('info', 'Scan complete!');
    this.reportProgress(this.abort);
  }

  private generateScanList(minUnitId: number, maxUnitId: number, unitIds: number[]) {
    const list = unitIds.length ? unitIds : range(minUnitId, maxUnitId + 1);

    this.scanList = list.map((unitId: UnitId) => {
      return {
        id: unitId,
        meta: {},
        state: ScanState.Waiting,
        stateText: this.stateList[ScanState.Waiting],
        errorMessage: '',
      };
    });
  }
}
