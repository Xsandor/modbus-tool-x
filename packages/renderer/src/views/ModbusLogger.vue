<template>
  <ElRow :gutter="20">
    <ElCol
      :span="24"
      :md="24"
      :lg="9"
      :xl="6"
    >
      <ElCard
        header="Modbus Logger"
        class="box-card"
      >
        <ElForm
          ref="ruleFormRef"
          label-width="120px"
        >
          <ElFormItem label="Connection Type">
            <ElRadioGroup v-model.number="connectionType">
              <ElRadioButton label="0">Modbus RTU</ElRadioButton>
              <ElRadioButton label="1">Modbus TCP</ElRadioButton>
            </ElRadioGroup>
          </ElFormItem>
          <template v-if="connectionType === CONNECTION_TYPE.TCP">
            <ElFormItem
              label="IP Address"
              prop="ip"
            >
              <ElInput
                v-model="tcpConfiguration.ip"
                required
                type="text"
                placeholder="Input IP address"
              />
            </ElFormItem>
            <ElFormItem label="Port">
              <ElInput
                v-model.number="tcpConfiguration.port"
                type="number"
                min="1"
                max="65535"
              />
            </ElFormItem>
            <ElFormItem label="Timeout">
              <ElInput
                v-model.number="tcpConfiguration.timeout"
                type="number"
                min="1"
                max="60000"
              >
                <template #suffix>ms</template>
              </ElInput>
            </ElFormItem>
          </template>
          <template v-else>
            <ElFormItem label="COM port">
              <ElSelect
                v-model="rtuConfiguration.port"
                placeholder="Select port"
              >
                <ElOption
                  v-for="item in comPorts"
                  :key="item.path"
                  :label="item.path"
                  :value="item.path"
                ></ElOption>
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="Baud rate">
              <ElSelect
                v-model.number="rtuConfiguration.baudRate"
                placeholder="Select baudRate"
              >
                <ElOption
                  v-for="item in baudRateOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                ></ElOption>
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="Parity">
              <ElSelect
                v-model="rtuConfiguration.parity"
                placeholder="Select parity"
              >
                <ElOption
                  v-for="item in parityOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                ></ElOption>
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="Data bits">
              <ElInputNumber
                v-model.number="rtuConfiguration.dataBits"
                :min="6"
                :max="8"
              />
            </ElFormItem>
            <ElFormItem label="Stop bits">
              <ElInputNumber
                v-model.number="rtuConfiguration.stopBits"
                :min="1"
                :max="2"
              />
            </ElFormItem>
            <ElFormItem label="Timeout">
              <ElInput
                v-model.number="rtuConfiguration.timeout"
                :min="1"
                :max="60000"
              >
                <template #suffix>ms</template>
              </ElInput>
            </ElFormItem>
          </template>
          <ElDivider></ElDivider>
          <ElFormItem label="Unit ID">
            <ElInputNumber
              v-model.number="commonConfiguration.unitId"
              :min="0"
              :max="254"
            />
          </ElFormItem>
          <ElFormItem label="Modbus Function">
            <ElSelect
              v-model="mbFunction"
              placeholder="Modbus function"
            >
              <ElOption
                v-for="item in mbFunctions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              ></ElOption>
            </ElSelect>
          </ElFormItem>
          <ElFormItem
            v-for="parameter in mbOptions"
            :key="parameter.id"
            :label="parameter.label"
          >
            <ElInputNumber
              v-if="parameter.type === 'number'"
              v-model.number="parameter.value"
              :min="parameter.min"
              :max="parameter.max"
            />
            <ElInput
              v-else
              v-model.number="parameter.value"
              :type="parameter.type"
              :min="parameter.min"
              :max="parameter.max"
            />
          </ElFormItem>
          <ElFormItem>
            <ElButton @click="clearTasks">Clear tasks</ElButton>
            <ElButton
              type="primary"
              @click="addTask"
            >
              Add task
            </ElButton>
          </ElFormItem>
          <ElTable
            :data="tasks"
            border
            empty-text="No tasks configured"
          >
            <ElTableColumn
              prop="unitId"
              label="Unit ID"
              width="100"
            />
            <ElTableColumn
              prop="mbFunction"
              label="Function"
              width="100"
            />
            <ElTableColumn
              prop="mbOptions"
              label="Register"
            >
              <template #default="scope">
                {{ formatMbOptions(scope.row.mbOptions) }}
              </template>
            </ElTableColumn>
          </ElTable>
          <ElDivider></ElDivider>
          <ElFormItem label="Count">
            <ElInputNumber
              v-model.number="requestCount"
              :min="1"
              :max="9999"
            />
          </ElFormItem>
          <ElFormItem label="Delay">
            <ElInputNumber
              v-model.number="requestDelay"
              :min="1"
              :max="9999"
            />
          </ElFormItem>
          <ElFormItem>
            <ElButton
              type="primary"
              @click="performRequest()"
            >
              Execute
            </ElButton>
          </ElFormItem>
        </ElForm>
      </ElCard>
    </ElCol>
    <ElCol
      :span="24"
      :md="24"
      :lg="15"
    >
      <ElCard>
        <template #header>
          <div class="card-header">
            <span>Result</span>
            <ElButton
              v-if="results.length"
              :size="'small'"
              @click="exportLog"
            >
              Export <el-icon class="el-icon--right"><i-ep-download /></el-icon>
            </ElButton>
          </div>
        </template>
        <el-result
          v-if="loggerError"
          icon="error"
          title="Error"
          :sub-title="loggerError"
        ></el-result>
        <template v-else>
          <ElDescriptions
            :column="1"
            border
            class="logger-stats-table"
          >
            <ElDescriptionsItem label="Progress">
              <ElProgress :percentage="stats.progress">
                <span>{{ stats.requestsDone }} / {{ stats.requestsTotal }}</span>
              </ElProgress>
            </ElDescriptionsItem>
            <ElDescriptionsItem label="Success">
              <ElProgress
                :percentage="statsSuccessPct"
                :color="colorGoodProgress"
              >
                <span>{{ stats.successfulRequests }} / {{ stats.requestsDone }}</span>
              </ElProgress>
              <!-- ({{ stats.successfulRequests }} out of {{ stats.requestsDone }}) -->
            </ElDescriptionsItem>
            <ElDescriptionsItem label="Timeouts">
              <ElProgress
                :percentage="statsTimedOutPct"
                :color="colorBadProgress"
              >
                <span>{{ stats.requestsTimedOut }} / {{ stats.requestsDone }}</span>
              </ElProgress>
              <!-- ({{ stats.requestsTimedOut }} out of {{ stats.requestsDone }}) -->
            </ElDescriptionsItem>
            <ElDescriptionsItem label="Average response">
              {{
                stats.averageResponseTime.toFixed(0)
              }} ms
            </ElDescriptionsItem>
          </ElDescriptions>
          <ElDivider></ElDivider>
          <ElAutoResizer>
            <template #default="{ width }">
              <ElTableV2
                :columns="columns"
                :data="results"
                :width="width"
                :height="613"
                fixed
              />
            </template>
          </ElAutoResizer>
          <!-- <el-table :data="results" height="600" style="width: 100%">
            <el-table-column prop="id" label="ID" width="100" />
            <el-table-column prop="unitId" label="Unit ID" width="100" />
            <el-table-column prop="mbFunction" label="Function" width="100" />
            <el-table-column prop="mbAddr" label="Address" width="100" />
            <el-table-column prop="errorText" label="Error" />
            <el-table-column prop="executionTime" label="Response" />
          </el-table> -->
        </template>
      </ElCard>
    </ElCol>
  </ElRow>
</template>

<script lang="tsx" setup>
  import { csv, logger } from '#preload';
  import useModbus from '/@/components/useModbus';
  import useComPorts from '/@/components/useComPorts';
  import * as Papa from 'papaparse';
  // import useToast from '/@/components/useToast'

  const { comPorts } = await useComPorts();
  // const { toast } = useToast()
  const { mbFunctions, parityOptions, baudRateOptions, connectionType, tcpConfiguration, rtuConfiguration, CONNECTION_TYPE } = useModbus();

  // console.log(ipcRenderer)

  const columns = [
    {
      key: 'id',
      dataKey: 'id',
      title: 'ID',
      width: 50,
    },
    {
      key: 'unitId',
      dataKey: 'unitId',
      title: 'Unit ID',
      width: 100,
    },
    {
      key: 'mbFunction',
      dataKey: 'mbFunction',
      title: 'Function',
      width: 100,
    },
    {
      key: 'mbAddr',
      dataKey: 'mbAddr',
      title: 'Register',
      width: 100,
    },
    {
      key: 'result',
      dataKey: 'result',
      title: 'Values',
      width: 150,
      cellRenderer: ({ cellData: result }: { cellData: { value: number }[] }) => <div class="el-table-v2__cell-text">{(result || []).map(i => i.value).join(', ')}</div>,
    },
    {
      key: 'errorText',
      dataKey: 'errorText',
      title: 'Error',
      width: 100,
    },
    {
      key: 'executionTime',
      dataKey: 'executionTime',
      title: 'Response',
      width: 100,
      cellRenderer: ({ cellData: executionTime }: { cellData: number }) => <div class="el-table-v2__cell-text">{executionTime.toFixed(0)} ms</div>,
    },
  ];

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
    return stats.value.successfulRequests / stats.value.requestsDone * 100;
  });

  const statsTimedOutPct = computed(() => {
    if (!stats.value.requestsDone) return 0;
    return stats.value.requestsTimedOut / stats.value.requestsDone * 100;
  });

  const colorGoodProgress = [
    { color: '#f56c6c', percentage: 0 },
    { color: '#e6a23c', percentage: 30 },
    { color: '#bfda01', percentage: 60 },
    { color: '#67c23a', percentage: 90 },
  ];

  const colorBadProgress = [
    { color: '#67c23a', percentage: 0 },
    { color: '#bfda01', percentage: 10 },
    { color: '#e6a23c', percentage: 30 },
    { color: '#f56c6c', percentage: 50 },
  ];

  const ruleFormRef = ref();

  // const rules = reactive({
  //   ip: [
  //     { required: true, message: 'Please input an IP address', trigger: 'blur' },
  //   ],
  // });

  function clearLog() {
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

  const commonConfiguration = ref({
    unitId: 1,
  });

  const tasks: Ref<ModbusTask[]> = ref([]);

  function addTask() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = mbOptions.value.reduce((acc: { [key: string]: any; }, item) => {
      acc[item.id] = item.value;
      return acc;
    }, {});

    const task: ModbusTask = {
      unitId: commonConfiguration.value.unitId,
      mbFunction: mbFunction.value,
      mbOptions: {
        ...options,
      },
    };

    console.log(task);

    tasks.value.push(task);
    console.log(tasks.value);
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

  const mbFunction = ref(mbFunctions[2].id);

  const mbOptions: Ref<MbOption[]> = ref([]);

  const selectedMbFunction = computed(() => {
    if (!mbFunction.value) {
      return null;
    }

    return mbFunctions.find(i => i.id === mbFunction.value);
  });

  function updateMbOptions() {
    const modbusFunction = selectedMbFunction.value;

    if (!modbusFunction) {
      mbOptions.value = [];
      return;
    }

    mbOptions.value = modbusFunction.parameters.map(i => {
      return {
        ...i,
        value: i.default,
      };
    });
  }

  watch(mbFunction, () => {
    updateMbOptions();
  });

  function exportLog() {
    console.log('Trying to save file');
    const text = Papa.unparse(results.value.map(i => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (i.result || []).map((j: any) => j.value).join(', ');
      return {
        ...i,
        result,
      };
    }));

    csv.save(text, 'Modbus Logger');
  }

  logger.onLog((_event, logs: LoggerLogMessage[]) => {
    console.log(logs);
    logs.forEach((message) => {
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
    if (connectionType.value === CONNECTION_TYPE.TCP) {
      // console.log('Modbus TCP')
      const configuration = {
        ...tcpConfiguration.value,
        tasks: tasks.value.map(i => JSON.parse(JSON.stringify(i))),
      };

      // console.log(configuration)
      const config: TcpLoggerConfiguration = {
        ...configuration,
        count: requestCount.value,
        delay: requestDelay.value,
      };
      console.log('Starting logger');
      logger.startTcp(config);
    } else if (connectionType.value === CONNECTION_TYPE.RTU) {
      // console.log('Modbus RTU')
      // console.log(tasks.value)
      const configuration = {
        ...rtuConfiguration.value,
        tasks: tasks.value.map(i => JSON.parse(JSON.stringify(i))),
      };

      const config: RtuLoggerConfiguration = {
        ...configuration,
        count: requestCount.value,
        delay: requestDelay.value,
      };
      // console.log(config)
      console.log('Starting logger');
      const { _result, error } = await logger.startRtu(config);
      if (error) {
        loggerError.value = error;
      }
    }
  };

  // function downloadLog() {
  //   const data = results.value
  //   const csv = Papa.unparse(data);
  //   console.log(csv)
  // }

  onMounted(async () => {
    console.log('Component is mounted!');
    // console.log(ipcRenderer)
    updateMbOptions();
    rtuConfiguration.value.port = comPorts.value[0].path;
  });

  function formatMbOptions(mbOptions: GenericObject[]) {
    if ('addr' in mbOptions && 'count' in mbOptions) {
      const { addr, count } = mbOptions as { addr: number, count: number };
      if (count === 1) return addr;
      return `${addr} - ${addr + count - 1}`;
    }

    return JSON.stringify(mbOptions);
  }
</script>

<style>
.logger-stats-table td:first-child {
  width: 185px;
}

.logger-stats-table .el-progress__text {
  width: 100px;
  text-align: center;
}
</style>
