import EventEmitter from 'events';
import ModbusRTU from 'modbus-serial';
import {
  DANFOSS_MAX_EKC_PARAMETERS,
  DANFOSS_MODEL_FILE_NUMBER,
  DANFOSS_MODEL_RECORD_LENGTH,
  DANFOSS_MODEL_RECORD_NUMBER,
  DANFOSS_MODEL_REF_TYPE,
  DANFOSS_READ_COMPRESSED_MAX_PNUS,
  DANFOSS_READ_GROUP_RECORD_LENGTH,
  DANFOSS_READ_GROUP_RECORD_NUMBER,
  DANFOSS_READ_GROUP_REF_TYPE,
  DANFOSS_READ_PARAMETER_RECORD_LENGTH,
  DANFOSS_READ_PARAMETER_RECORD_NUMBER,
  DANFOSS_READ_PARAMETER_REF_TYPE,
  DANFOSS_VERSION_PNU,
  parseDanfossGroup,
  parseDanfossOrderNumber,
  parseDanfossParameter,
  parseDanfossVersion,
} from './danfoss';
import {clone, logger, splitArrayIntoBatches} from './utilities';
import {REGISTER_OFFSET} from './modbusCommon';

const log = logger.createLogger('Danfoss EKC');

interface Group {
  id: number;
  name: string;
}

interface Parameter {
  pnu: number;
  name: string;
  min: number;
  max: number;
  default: undefined | number;
  writable: boolean;
  dynamic: boolean;
  group: number;
  type: string;
  exp: number;
  unit: undefined | string; // Only available if parameter is read from .ed3
}

// DeviceModels are cached to avoid having to read the model from the device every time
// firstPNU, groups and parameters are saved in a key with the format: deviceModel:version
const cachedDeviceModels: GenericObject = {};

// Read file in electron app folder
import {readFile, writeFile} from 'fs/promises';
import {app} from 'electron';

const deviceModelsFilePath = app.getPath('userData') + '/cachedDeviceModels.json';

async function readCachedDeviceModels(): Promise<void> {
  try {
    const data = await readFile(deviceModelsFilePath, 'utf-8');
    const json = JSON.parse(data);
    Object.assign(cachedDeviceModels, json);
  } catch (err) {
    log.error(`Could not read deviceModelFile: ${err}`);
  }
}

async function writeCachedDeviceModels(): Promise<void> {
  try {
    await writeFile(deviceModelsFilePath, JSON.stringify(cachedDeviceModels), 'utf-8');
  } catch (err) {
    log.error(`Could not read deviceModelFile: ${err}`);
  }
}

readCachedDeviceModels();

interface DanfossEkcEventMap {
  status: {
    text: string;
    progress?: number;
  };
  parameterData: GenericObject;
}

export class DanfossEKC extends EventEmitter {
  client: ModbusRTU; // ModbusRTU instance
  serialPortConfiguration: SerialPortConfiguration;
  unitId: number;
  deviceType: undefined | string;
  deviceModel: undefined | string;
  version: undefined | number;
  groups: Group[] = [];
  parameters: Parameter[] = [];
  firstPNU: undefined | number;
  activeGroup: null | number = null;
  dataRequestActive = false;
  useCache: boolean;

  constructor(serialPortConfiguration: SerialPortConfiguration, unitId: number, useCache: boolean) {
    super();
    this.unitId = unitId;
    this.useCache = useCache;
    this.client = new ModbusRTU();
    this.client.setID(unitId);
    this.client.setTimeout(200);
    this.serialPortConfiguration = serialPortConfiguration;
  }

  emit<K extends keyof DanfossEkcEventMap>(
    eventName: K,
    eventData: DanfossEkcEventMap[K],
  ): boolean {
    return super.emit(eventName, eventData);
  }

  status(text: string, progress?: number) {
    log.debug(text);

    this.emit('status', {
      text,
      progress,
    });
  }

  emitParameterData(data: GenericObject) {
    this.emit('parameterData', data);
  }

  async connect() {
    const {port, baudRate, parity, dataBits, stopBits} = this.serialPortConfiguration;

    await this.client.connectRTUBuffered(port, {baudRate, parity, dataBits, stopBits});
    this.status(`Opened ${port} successfully`);
  }

  async close() {
    this.client.close(() => {
      return;
    });
  }

  setActiveGroup(groupId: number) {
    log.info(`Setting group ${groupId} as active group`);
    this.activeGroup = groupId;

    log.info('Starting data request loop');
    this.dataRequestLoop();

    return this.activeGroup;
  }

  async dataRequestLoop() {
    if (this.client.isOpen === false) {
      return;
    }

    if (this.dataRequestActive) {
      return;
    }
    if (this.activeGroup === null) {
      this.dataRequestActive = false;
      return;
    }

    this.dataRequestActive = true;
    // Prevent from rerunning more often than 1 second
    const minDuration = new Promise(resolve => setTimeout(resolve, 1000));
    const dataRequest = this.getParameterDataForGroup(this.activeGroup);

    await Promise.all([minDuration, dataRequest]);

    this.dataRequestActive = false;
    this.dataRequestLoop();
  }

  async getModel() {
    const modbusRequest = this.client.readFileRecords(
      DANFOSS_MODEL_FILE_NUMBER,
      DANFOSS_MODEL_RECORD_NUMBER,
      DANFOSS_MODEL_RECORD_LENGTH,
      DANFOSS_MODEL_REF_TYPE,
    );

    const result = await modbusRequest;
    const danfossDevice = parseDanfossOrderNumber(result.data as string);
    this.deviceType = danfossDevice.protocolFamily;
    this.deviceModel = danfossDevice.orderNumber;
    return this.deviceModel;
  }

  async getVersion() {
    const version = await this.client.readInputRegisters(DANFOSS_VERSION_PNU - 1, 1);
    const {versionMajor, versionMinor} = parseDanfossVersion(version.data[0]);
    this.version = versionMajor + versionMinor / 100;
    return this.version;
  }

  async getFirstPNU() {
    const firstPNU = await this.client.readHoldingRegisters(60026 - 1, 1);
    this.firstPNU = firstPNU.data[0];
    return firstPNU.data[0];
  }

  async getGroups() {
    this.groups = [];
    // this.groups.push({id: 1, name: 'Hidden parameters'});
    for (let i = 2; i <= 15; i++) {
      const result = await this.client.readFileRecords(
        i,
        DANFOSS_READ_GROUP_RECORD_NUMBER,
        DANFOSS_READ_GROUP_RECORD_LENGTH,
        DANFOSS_READ_GROUP_REF_TYPE,
      );

      const group = parseDanfossGroup(result.data as Buffer);
      this.groups.push(group);
    }
    // this.groups.push({id: 16, name: 'In all groups'});

    return this.groups;
  }

  async getParameters() {
    this.parameters = [];
    let nextPnu = this.firstPNU;
    while (nextPnu) {
      const result = await this.client.readFileRecords(
        nextPnu,
        DANFOSS_READ_PARAMETER_RECORD_NUMBER,
        DANFOSS_READ_PARAMETER_RECORD_LENGTH,
        DANFOSS_READ_PARAMETER_REF_TYPE,
      );

      const parameter = parseDanfossParameter(result.data as Buffer);

      nextPnu = parameter.nextPnu;

      this.parameters.push({
        pnu: parameter.pnu,
        name: parameter.name,
        min: parameter.min,
        max: parameter.max,
        default: undefined,
        group: parameter.group,
        writable: parameter.writable,
        type: parameter.type,
        exp: parameter.exp,
        dynamic: parameter.dynamic,
        unit: undefined,
      });

      this.status(
        `Getting parameters (${this.parameters.length + 1})...`,
        Math.round(25 + (75 * this.parameters.length) / DANFOSS_MAX_EKC_PARAMETERS),
      );
    }
  }

  async getParameterDataForGroup(group: number) {
    const parameters = this.parameters.filter(
      parameter => parameter.group === group || parameter.group === 16,
    );
    const pnus = parameters.map(parameter => parameter.pnu);
    const batchedPnus = splitArrayIntoBatches(pnus, DANFOSS_READ_COMPRESSED_MAX_PNUS) as number[][];

    const values: GenericObject = {};

    for (const batch of batchedPnus) {
      const result = await this.client.readCompressed(batch);
      // log.info(result);
      batch.forEach((pnu, index) => {
        values[pnu] = result.data[index];
      });
    }

    this.emitParameterData(values);
    return values;
  }

  async writeParameter(pnu: number, value: number) {
    const result = await this.client.writeRegister(pnu + REGISTER_OFFSET, value);
    this.emitParameterData({[pnu]: value});
    return result;
  }

  saveDeviceModel() {
    cachedDeviceModels[`${this.deviceModel}:${this.version}`] = clone({
      firstPNU: this.firstPNU,
      groups: this.groups,
      parameters: this.parameters,
    });
    writeCachedDeviceModels();
  }

  loadDeviceModel() {
    // Return false to load device if useCache is false
    if (!this.useCache) {
      return false;
    }

    // Check if device model is cached
    const cachedDeviceModel = cachedDeviceModels[`${this.deviceModel}:${this.version}`];

    // Return false if device model is not cached
    if (!cachedDeviceModel) {
      return false;
    }

    // Load cached device model
    this.firstPNU = cachedDeviceModel.firstPNU;
    this.groups = cachedDeviceModel.groups;
    this.parameters = cachedDeviceModel.parameters;
    return true;
  }

  device() {
    return {
      unitId: this.unitId,
      deviceType: this.deviceType,
      deviceModel: this.deviceModel,
      version: this.version,
      groups: this.groups,
      parameters: this.parameters,
    };
  }

  async initiate() {
    // log.info('Initiating Danfoss EKC');
    this.status('Connecting...', 0);
    await this.connect();
    this.status('Getting model...', 5);
    await this.getModel();
    // log.info(this.deviceModel);
    this.status('Getting version...', 10);
    await this.getVersion();
    // this.status(this.version);
    // Check if device type is cached already
    if (!this.loadDeviceModel()) {
      this.status('Getting first PNU...', 15);
      await this.getFirstPNU();
      // this.status(this.firstPNU);
      this.status('Getting groups...', 20);
      await this.getGroups();
      // this.status(`Scanned ${this.groups.length} groups`);
      this.status('Getting parameters...', 25);
      await this.getParameters();
      // this.status(`Scanned ${this.parameters.length} parameters`);
      this.saveDeviceModel();
    }
    this.status('Done!', 100);

    return this.device();
  }
}
