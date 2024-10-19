<template>
  <el-row :gutter="20">
    <el-col
      :span="24"
      :md="24"
      :lg="9"
      :xl="6"
    >
      <collapsible-card title="Modbus Logger">
        <el-form
          v-if="initiated"
          ref="ruleFormRef"
          label-width="120px"
        >
          <el-form-item label="Connection Type">
            <el-radio-group v-model.number="tabData.connectionType">
              <el-radio-button :value="0">Modbus RTU</el-radio-button>
              <el-radio-button :value="1">Modbus TCP</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <template v-if="tabData.connectionType === CONNECTION_TYPE.TCP">
            <tcp-config v-model="tabData.tcp" />
          </template>
          <template v-else>
            <rtu-config v-model="tabData.rtu" />
          </template>
          <el-divider></el-divider>
          <el-form-item label="Unit ID">
            <el-input-number
              v-model.number="tabData.common.unitId"
              :min="0"
              :max="254"
            />
          </el-form-item>
          <modbus-function-config v-model="tabData.common" />
          <el-form-item>
            <el-button @click="clearTasks">Clear tasks</el-button>
            <el-button
              type="primary"
              @click="addTask"
            >
              Add task
            </el-button>
          </el-form-item>
          <el-table
            :data="tasks"
            :border="true"
            empty-text="No tasks configured"
          >
            <el-table-column
              prop="unitId"
              label="Unit ID"
              width="100"
            />
            <el-table-column
              prop="mbFunction"
              label="Function"
              width="100"
            />
            <el-table-column
              prop="mbOptions"
              label="Register"
            >
              <template #default="scope">
                {{ formatMbOptions(scope.row.mbOptions) }}
              </template>
            </el-table-column>
          </el-table>
          <el-divider></el-divider>
          <el-form-item label="Count">
            <el-input-number
              v-model.number="requestCount"
              :min="1"
              :max="10000"
            />
          </el-form-item>
          <el-form-item label="Delay (ms)">
            <el-input-number
              v-model.number="requestDelay"
              :min="1"
            />
          </el-form-item>
          <el-form-item>
            <el-button @click="clearLog">Clear log</el-button>
            <el-button
              type="primary"
              :disabled="inProgress"
              @click="performRequest()"
            >
              Start
            </el-button>
            <el-button
              v-if="inProgress"
              type="danger"
              @click="stop()"
            >
              Stop
            </el-button>
          </el-form-item>
        </el-form>
      </collapsible-card>
    </el-col>
    <el-col
      :span="24"
      :md="24"
      :lg="15"
    >
      <el-card shadow="never">
        <template #header>
          <div class="card-header">
            <span>Result</span>
            <el-button
              v-if="results.length"
              :size="'small'"
              @click="exportLog"
            >
              Export <el-icon class="el-icon--right"><i-ep-download /></el-icon>
            </el-button>
          </div>
        </template>
        <el-result
          v-if="loggerError"
          icon="error"
          title="Error"
          :sub-title="loggerError"
        ></el-result>
        <template v-if="started">
          <el-descriptions
            :column="1"
            border
            class="logger-stats-table"
          >
            <el-descriptions-item label="Progress">
              <el-progress :percentage="stats.progress">
                <span>{{ stats.requestsDone }} / {{ stats.requestsTotal }}</span>
              </el-progress>
            </el-descriptions-item>
            <el-descriptions-item label="Success">
              <el-progress
                :percentage="statsSuccessPct"
                :color="colorGoodProgress"
              >
                <span>{{ stats.successfulRequests }} / {{ stats.requestsDone }}</span>
              </el-progress>
              <!-- ({{ stats.successfulRequests }} out of {{ stats.requestsDone }}) -->
            </el-descriptions-item>
            <el-descriptions-item label="Timeouts">
              <el-progress
                :percentage="statsTimedOutPct"
                :color="colorBadProgress"
              >
                <span>{{ stats.requestsTimedOut }} / {{ stats.requestsDone }}</span>
              </el-progress>
              <!-- ({{ stats.requestsTimedOut }} out of {{ stats.requestsDone }}) -->
            </el-descriptions-item>
            <el-descriptions-item label="Average response">
              {{ stats.averageResponseTime.toFixed(0) }} ms
            </el-descriptions-item>
          </el-descriptions>
          <el-divider></el-divider>
          <el-auto-resizer>
            <template #default="{width}">
              <el-table-v2
                :columns="columns"
                :data="results"
                :width="width"
                :height="613"
                fixed
              />
            </template>
          </el-auto-resizer>
          <!-- <el-table :data="results" height="600" style="width: 100%">
            <el-table-column prop="id" label="ID" width="100" />
            <el-table-column prop="unitId" label="Unit ID" width="100" />
            <el-table-column prop="mbFunction" label="Function" width="100" />
            <el-table-column prop="mbAddr" label="Address" width="100" />
            <el-table-column prop="errorText" label="Error" />
            <el-table-column prop="executionTime" label="Response" />
          </el-table> -->
        </template>
        <el-empty
          v-else
          description="Nothing to see here yet"
        />
      </el-card>
    </el-col>
  </el-row>
</template>

<script lang="tsx" setup>
import {logger} from '#preload';
import {useTabsStore} from '/@/stores/useTabs';
import useCSV from '/@/components/useCSV';
import {CONNECTION_TYPE, useModbusStore} from '/@/stores/useModbus';
import {clone} from '../helpers/utilities';

const {saveCSV} = useCSV();
// import useToast from '/@/components/useToast'

const modbusStore = useModbusStore();
const {getTabDataById, setTabDataById} = useTabsStore();

const props = defineProps({
  tabId: {
    type: Number,
    required: true,
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabData: Ref<any> = ref({});

const columns = [
  {
    key: 'id',
    dataKey: 'id',
    title: '#',
    width: 50,
  },
  {
    key: 'unitId',
    dataKey: 'unitId',
    title: 'Unit ID',
    width: 80,
  },
  {
    key: 'mbFunction',
    dataKey: 'mbFunction',
    title: 'Function',
    width: 80,
  },
  {
    key: 'mbAddr',
    dataKey: 'mbAddr',
    title: 'Register',
    width: 80,
  },
  {
    key: 'result',
    dataKey: 'result',
    title: 'Values',
    width: 200,
    cellRenderer: ({cellData: result}: {cellData: {value: number}[]}) => (
      <div class="el-table-v2__cell-text">{(result || []).map(i => i.value).join(', ')}</div>
    ),
  },
  {
    key: 'errorText',
    dataKey: 'errorText',
    title: 'Error',
    width: 200,
  },
  {
    key: 'executionTime',
    dataKey: 'executionTime',
    title: 'Response',
    width: 100,
    cellRenderer: ({cellData: executionTime}: {cellData: number}) => (
      <div class="el-table-v2__cell-text">{executionTime.toFixed(0)} ms</div>
    ),
  },
];

const started = ref(false);
const inProgress = ref(false);

const results: Ref<GenericObject[]> = ref([]);

const loggerError: Ref<string> = ref('');

const stats: Ref<LogStats> = ref({
  averageResponseTime: 0,
  successfulRequests: 0,
  requestsTimedOut: 0,
  requestsDone: 0,
  requestsTotal: 0,
  progress: 0,
});

const statsSuccessPct = computed(() => {
  if (!stats.value.requestsDone) return 0;
  return (stats.value.successfulRequests / stats.value.requestsDone) * 100;
});

const statsTimedOutPct = computed(() => {
  if (!stats.value.requestsDone) return 0;
  return (stats.value.requestsTimedOut / stats.value.requestsDone) * 100;
});

const colorGoodProgress = [
  {color: '#f56c6c', percentage: 0},
  {color: '#e6a23c', percentage: 30},
  {color: '#bfda01', percentage: 60},
  {color: '#67c23a', percentage: 90},
];

const colorBadProgress = [
  {color: '#67c23a', percentage: 0},
  {color: '#bfda01', percentage: 10},
  {color: '#e6a23c', percentage: 30},
  {color: '#f56c6c', percentage: 50},
];

const ruleFormRef = ref();

// const rules = reactive({
//   ip: [
//     { required: true, message: 'Please input an IP address', trigger: 'blur' },
//   ],
// });

function clearLog() {
  started.value = false;
  loggerError.value = '';
  results.value = [];
  stats.value = {
    averageResponseTime: 0,
    successfulRequests: 0,
    requestsTimedOut: 0,
    requestsDone: 0,
    requestsTotal: 0,
    progress: 0,
  };
}

const requestCount = ref(10);
const requestDelay = ref(10);

const tasks: Ref<ModbusTask[]> = ref([]);

function addTask() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options = tabData.value.common.mbFunctionParameters.reduce(
    (acc: GenericObject, item: MbFunctionParameter) => {
      acc[item.id] = item.value;
      return acc;
    },
    {},
  );

  const task: ModbusTask = {
    unitId: tabData.value.common.unitId,
    mbFunction: tabData.value.common.mbFunction,
    mbOptions: {
      ...options,
    },
  };

  tasks.value.push(task);
}

function clearTasks() {
  tasks.value = [];
}

// const resultText = computed(() => {
//   if (!results.value.length) {
//     return '';
//   }
//   const succeededRequests = results.value.reduce((success, item) => {
//     if (!item.errorCode) {
//       success++;
//     }
//     return success;
//   }, 0);

//   const successPercent = Math.round(succeededRequests / results.value.length * 100);

//   return `${successPercent}% success (${succeededRequests} / ${results.value.length})`;
// });

function exportLog() {
  const formattedList = results.value.map(i => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (i.result || []).map((j: any) => j.value).join(', ');
    return {
      ...i,
      result,
    };
  });

  saveCSV(formattedList, 'Modbus Logger');
}

logger.onLog((_event, logs: LoggerLogMessage[]) => {
  // console.log(logs);
  logs.forEach(message => {
    // console.log(message.request)
    stats.value = message.stats;
    results.value.unshift(message.request);
  });
});

const performRequest = async () => {
  clearLog();

  if (!tasks.value.length) {
    addTask();
  }
  // if (!form) return
  // await form.validate((valid, fields) => {
  //     if (valid) {
  //         console.log('submit!')
  //     } else {
  //         console.log('error submit!', fields)
  //     }
  // })
  // return
  // console.log('Will perform modbus request')
  if (tabData.value.connectionType === CONNECTION_TYPE.TCP) {
    // console.log('Modbus TCP')
    const configuration = {
      ...tabData.value.tcp,
      tasks: tasks.value.map(i => JSON.parse(JSON.stringify(i))),
    };

    // console.log(configuration);
    const config: TcpLoggerConfiguration = {
      ...configuration,
      count: requestCount.value,
      delay: requestDelay.value,
    };
    // console.log('Starting logger');
    started.value = true;
    inProgress.value = true;
    await logger.startTcp(config);
    inProgress.value = false;
  } else if (tabData.value.connectionType === CONNECTION_TYPE.RTU) {
    // console.log('Modbus RTU')
    // console.log(tasks.value)
    const configuration = {
      ...tabData.value.rtu,
      tasks: tasks.value.map(i => JSON.parse(JSON.stringify(i))),
    };

    const config: RtuLoggerConfiguration = {
      ...configuration,
      count: requestCount.value,
      delay: requestDelay.value,
    };
    // console.log(config);
    console.log('Starting logger');
    started.value = true;
    inProgress.value = true;
    const {_result, error} = await logger.startRtu(config);
    inProgress.value = false;
    if (error) {
      loggerError.value = error;
    }
  }
};

function stop() {
  logger.stop();
  inProgress.value = false;
}

function formatMbOptions(mbOptions: GenericObject[]) {
  if ('addr' in mbOptions && 'count' in mbOptions) {
    const {addr, count} = mbOptions as {addr: number; count: number};
    if (count === 1) return addr;
    return `${addr} - ${addr + count - 1}`;
  }

  return JSON.stringify(mbOptions);
}

const initiated = ref(false);

onMounted(() => {
  initiated.value = false;
  tabData.value = getTabDataById(props.tabId);

  if (!tabData.value) {
    const defaultValues = clone(modbusStore.clientConfiguration);
    tabData.value = setTabDataById(props.tabId, defaultValues);
  }

  initiated.value = true;
});
</script>

<style>
.logger-stats-table td:first-child {
  width: 150px;
}

.logger-stats-table .el-progress__text {
  width: 120px;
  text-align: center;
}
</style>
