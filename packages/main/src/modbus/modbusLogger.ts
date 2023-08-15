import ModbusRTU from 'modbus-serial';
import {EventEmitter} from 'events';
import {ERROR_CODE_UNKNOWN, MODBUS_TCP_CONNECT_TIMEOUT} from './modbusCommon';
import {sleep} from './utilities';
import {modbusRequest} from './modbusRequest';

class ModbusLogger extends EventEmitter {
  requestsTotal!: number;
  requestsDone!: number;
  requestsTimedOut!: number;
  totalResponseTime!: number;
  countsDone!: number;
  progress!: number;
  successfulRequests!: number;

  constructor() {
    super();
    this.emit('log', 'Logger initiated!');
    this.reset();
  }

  reset() {
    this.requestsTotal = 0;
    this.requestsDone = 0;
    this.requestsTimedOut = 0;
    this.totalResponseTime = 0;
    this.countsDone = 0;
    this.progress = 0;
    this.successfulRequests = 0;
  }

  log(type: LogType, message: string) {
    this.emit('log', {
      type,
      message,
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
    this.reset();
    this.requestsTotal = tasks.length * count;

    const client = new ModbusRTU();
    try {
      await client.connectRTUBuffered(port, {baudRate, parity, dataBits, stopBits});
      // console.log('Modbus RTU port opened!')
    } catch (error) {
      console.log('Error when opening RTU port');
      client.close(() => null); // TODO: Comment this to keep connections open
      // console.log('Closed port')
      throw error;
    }

    while (this.countsDone < count) {
      for (const task of tasks) {
        const timestamp = new Date();
        let result = null;
        let errorText = '';
        let errorCode = 0;
        let executionTime = 0;

        try {
          // console.log(client.setID)
          const requestResult = await modbusRequest(
            client,
            task.unitId,
            timeout,
            task.mbFunction,
            task.mbOptions,
          );
          executionTime = requestResult.executionTime;
          errorCode = requestResult.errorCode;
          errorText = requestResult.errorText;
          result = requestResult.result;

          // ({ executionTime, result } = await modbusRequest(client, task.mbFunction, task.mbOptions))
          if (errorCode === 408) {
            this.requestsTimedOut++;
          } else if (!errorCode) {
            this.successfulRequests++;
            this.totalResponseTime += executionTime;
          }
        } catch (err: unknown) {
          // console.log(err)
          if (!(err instanceof Error)) {
            errorCode = ERROR_CODE_UNKNOWN;
            errorText = 'Unknown error';
          } else {
            errorCode = ERROR_CODE_UNKNOWN;
            errorText = err.message;
          }
        }

        this.requestsDone++;

        this.progress = Math.round((this.requestsDone / this.requestsTotal) * 100);

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
        await sleep(delay);
      }
      this.countsDone++;
    }
    client.close(() => null); // TODO: Comment this to keep connections open
  }
}

export class ModbusLoggerTCP extends ModbusLogger {
  constructor() {
    super();
  }

  async request(configuration: TcpLoggerConfiguration) {
    const {ip, port, timeout, tasks, count, delay} = configuration;
    this.countsDone = 0;
    this.requestsDone = 0;
    this.successfulRequests = 0;
    this.requestsTimedOut = 0;
    this.totalResponseTime = 0;
    this.progress = 0;
    this.requestsTotal = tasks.length * count;

    const client = new ModbusRTU();
    try {
      client.setTimeout(MODBUS_TCP_CONNECT_TIMEOUT);
      await client.connectTCP(ip, {port});
      // console.log('Modbus TCP connected!')
    } catch (error) {
      if (client.isOpen) client.close(() => null); // TODO: Comment this to keep connections open
      throw error;
    }

    while (this.countsDone < count) {
      for (const task of tasks) {
        const timestamp = new Date();
        let result = null;
        let errorText = '';
        let errorCode = 0;
        let executionTime = 0;

        try {
          const requestResult = await modbusRequest(
            client,
            task.unitId,
            timeout,
            task.mbFunction,
            task.mbOptions,
          );
          executionTime = requestResult.executionTime;
          errorCode = requestResult.errorCode;
          errorText = requestResult.errorText;
          result = requestResult.result;

          // ({ executionTime, result } = await modbusRequest(client, task.mbFunction, task.mbOptions))
          if (errorCode === 408) {
            this.requestsTimedOut++;
          } else if (!errorCode) {
            this.successfulRequests++;
            this.totalResponseTime += executionTime;
          }
        } catch (err: unknown) {
          // console.log(err)
          if (!(err instanceof Error)) {
            errorCode = ERROR_CODE_UNKNOWN;
            errorText = 'Unknown error';
          } else {
            errorCode = ERROR_CODE_UNKNOWN;
            errorText = err.message;
          }
        }

        this.requestsDone++;

        this.progress = Math.round((this.requestsDone / this.requestsTotal) * 100);

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

        await sleep(delay);
      }
      this.countsDone++;
    }
    if (client.isOpen) client.close(() => null); // TODO: Comment this to keep connections open
  }
}
