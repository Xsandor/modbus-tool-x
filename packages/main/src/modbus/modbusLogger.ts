import ModbusRTU from 'modbus-serial';
import {EventEmitter} from 'events';
import {ERROR_CODE_UNKNOWN, MODBUS_TCP_CONNECT_TIMEOUT} from './modbusCommon';
import {sleep, logger} from './utilities';
import {modbusRequest} from './modbusRequest';

const log = logger.createLogger('Modbus Logger');

class ModbusLogger extends EventEmitter {
  requestsTotal!: number;
  requestsDone!: number;
  requestsTimedOut!: number;
  totalResponseTime!: number;
  countsDone!: number;
  progress!: number;
  successfulRequests!: number;
  client: ModbusRTU;

  constructor() {
    super();
    this.client = new ModbusRTU();
    this.emit('log', 'Logger initiated!');
    this.resetStats();
  }

  close() {
    if (this.client.isOpen) {
      this.client.close(() => null);
    }
  }

  protected resetStats() {
    this.requestsTotal = 0;
    this.requestsDone = 0;
    this.requestsTimedOut = 0;
    this.totalResponseTime = 0;
    this.countsDone = 0;
    this.progress = 0;
    this.successfulRequests = 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected parseError(err: any) {
    if (!err.message && !(err instanceof Error)) {
      return {errorCode: ERROR_CODE_UNKNOWN, errorText: 'Unknown error'};
    }

    return {errorCode: ERROR_CODE_UNKNOWN, errorText: err.message};
  }

  protected async handleTasks(count: number, tasks: ModbusTask[], timeout: number, delay: number) {
    while (this.countsDone < count) {
      for (const task of tasks) {
        const timestamp = new Date();

        const {executionTime, result, errorCode, errorText} = await this.performRequest(
          task,
          timeout,
        );

        this.requestsDone++;

        this.reportProgress();

        this.reportResult(task, executionTime, result, errorCode, errorText, timestamp);

        await sleep(delay);
      }
      this.countsDone++;
    }
  }

  protected async performRequest(task: ModbusTask, timeout: number) {
    let result = null;
    let errorText = '';
    let errorCode = 0;
    let executionTime = 0;

    try {
      const requestResult = await modbusRequest(
        this.client,
        task.unitId,
        timeout,
        task.mbFunction,
        task.mbOptions,
      );

      ({executionTime, errorCode, errorText, result} = requestResult);

      if (errorCode === 408) {
        this.requestsTimedOut++;
      } else if (!errorCode) {
        this.successfulRequests++;
        this.totalResponseTime += executionTime;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // log.info(err)
      ({errorCode, errorText} = this.parseError(err));
    }
    return {executionTime, result, errorCode, errorText};
  }

  protected reportProgress() {
    this.progress = Math.round((this.requestsDone / this.requestsTotal) * 100);
  }

  protected reportResult(
    task: ModbusTask,
    executionTime: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: any,
    errorCode: number,
    errorText: string,
    timestamp: Date,
  ) {
    this.emit('log', {
      request: {
        id: this.requestsDone,
        unitId: task.unitId,
        mbFunction: task.mbFunction,
        mbAddr: task.mbOptions.addr,
        executionTime,
        result,
        errorCode,
        errorText,
        timestamp,
      },
      stats: {
        successfulRequests: this.successfulRequests,
        averageResponseTime: this.successfulRequests
          ? this.totalResponseTime / this.successfulRequests
          : 0,
        requestsTimedOut: this.requestsTimedOut,
        requestsDone: this.requestsDone,
        requestsTotal: this.requestsTotal,
        progress: this.progress,
      },
    });
  }
}

export class ModbusLoggerRTU extends ModbusLogger {
  constructor() {
    super();
  }

  async request(configuration: RtuLoggerConfiguration) {
    const {port, timeout, baudRate, parity, dataBits, stopBits, tasks, count, delay} =
      configuration;

    this.resetStats();
    this.requestsTotal = tasks.length * count;

    try {
      await this.client.connectRTUBuffered(port, {baudRate, parity, dataBits, stopBits});
      log.info(`Port ${port} opened`);
    } catch (error) {
      log.error(`Failed to open port ${port}`);
      this.close();
      // log.info('Closed port')
      throw error;
    }

    await this.handleTasks(count, tasks, timeout, delay);

    this.close();
  }
}

export class ModbusLoggerTCP extends ModbusLogger {
  constructor() {
    super();
  }

  async request(configuration: TcpLoggerConfiguration) {
    const {ip, port, timeout, tasks, count, delay} = configuration;

    this.resetStats();
    this.requestsTotal = tasks.length * count;

    try {
      this.client.setTimeout(MODBUS_TCP_CONNECT_TIMEOUT);
      await this.client.connectTCP(ip, {port});
      log.debug(`Connected to ${ip}:${port}`);
    } catch (error) {
      log.error(`Connection failed to ${ip}:${port}`);
      this.close();
      throw error;
    }

    await this.handleTasks(count, tasks, timeout, delay);

    this.close();
  }
}
