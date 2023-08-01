<script lang="ts" setup>
  import { analyzer, csv } from '#preload';
  import useModbus from '/@/components/useModbus';
  import useComPorts from '/@/components/useComPorts';
  import * as Papa from 'papaparse';

  const { comPorts } = await useComPorts();
  const { formatFunctionCode, parityOptions, baudRateOptions, rtuConfiguration, MODBUS_FUNCTIONS } = useModbus();

  const dataRows: Ref<GenericObject[]> = ref([]);

  const starting: Ref<boolean> = ref(false);
  const started: Ref<boolean> = ref(false);

  const showColumns: Ref<GenericObject> = ref({
    timestamp: true,
    crc: true,
    type: true,
    address: true,
    mbFunction: true,
    data: true,
    buffer: false,
  });

  analyzer.onLog((_event, logs: GenericObject[]) => {
    logs.forEach((data: GenericObject) => {
      dataRows.value.unshift(data);
    });
  });

  const filteredLog = computed(() => {
    let rows = [];

    if (filter.value.mbFunction) {
      const filteredMbFunction = filter.value.mbFunction;
      rows = dataRows.value.filter(i => i.mbFunction === filteredMbFunction);
    } else {
      rows = dataRows.value;
    }

    console.log(rows.length);

    if (rows.length > 200) {
      return rows.slice(0, 200);
    }

    return rows;
  });

  function exportLog() {
    console.log('Trying to save file');
    const text = Papa.unparse(dataRows.value.map(i => {
      let type = 'unknown';
      if (i.type === 1) {
        type = 'request';
      } else if (i.type === 2) {
        type = 'response';
      }

      return {
        ...i,
        type,
      };
    }));

    csv.save(text, 'Modbus Analyzer');
  }

  const allModbusFunctions: {
    id: number
    name: string
  }[] = Object.keys(MODBUS_FUNCTIONS)
    .map((key) => {
      return { id: parseInt(key), name: MODBUS_FUNCTIONS[key]};
    });

  const modbusFunctionOptions = [{ id: 0, name: 'Show all' }].concat(allModbusFunctions);

  const analyzerError: Ref<string> = ref('');

  const filter = ref({
    mbFunction: 0,
  });

  // function formatFrameType(type: number) {
  //   if (type === 1) return 'Request';
  //   if (type === 2) return 'Response';

  //   return 'Unknown';
  // }

  const dataRowClassName = ({
    row,
    _rowIndex,
  }: GenericObject) => {
    if (row.type === 1) {
      return 'warning-row';
    } else if (row.type === 2) {
      return 'success-row';
    }
    return '';
  };

  function clearLog() {
    analyzerError.value = '';
    dataRows.value = [];
  }

  async function startAnalyzer() {
    starting.value = true;
    analyzerError.value = '';

    const config: SerialPortConfiguration = {
      ...rtuConfiguration.value,
    };

    // console.log(config)
    console.log('Sending start request');
    const { _result, error } = await analyzer.startRtu(config);
    console.log('Got response!');
    if (error) {
      analyzerError.value = error;
    } else {
      started.value = true;
    }
    starting.value = false;
  }

  async function stopAnalyzer() {
    if (started.value) {
      await analyzer.stopRtu();
      started.value = false;
      starting.value = false;
    }
  }

  onMounted(async () => {
    // rtuConfiguration.value.port = "COM10"
  });

  onBeforeUnmount(() => {
    stopAnalyzer();
  });
</script>

<template>
  <el-row :gutter="20">
    <ElCol
      :span="24"
      :md="24"
      :lg="8"
      :xl="5"
    >
      <ElCard
        header="Modbus Analyzer"
        class="box-card"
      >
        <ElForm
          ref="ruleFormRef"
          label-width="120px"
        >
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
          <ElFormItem>
            <ElButton @click="clearLog">Clear</ElButton>
            <ElButton
              v-if="started"
              type="danger"
              @click="stopAnalyzer"
            >
              Stop
            </ElButton>
            <ElButton
              v-else
              type="primary"
              :disabled="starting"
              @click="startAnalyzer"
            >
              Start
            </ElButton>
          </ElFormItem>
        </ElForm>
      </ElCard>
    </ElCol>
    <el-col
      :span="24"
      :md="24"
      :lg="16"
      :xl="19"
    >
      <el-card>
        <template #header>
          <div class="card-header">
            <span>Result</span>
            <ElButton
              v-if="dataRows.length"
              :size="'small'"
              @click="exportLog"
            >
              Export <el-icon class="el-icon--right"><i-ep-download /></el-icon>
            </ElButton>
          </div>
        </template>
        <!-- <ElAutoResizer>
            <template #default="{ height, width }">
              <ElTableV2 :columns="columns" :data="results" :width="width" :height="613" fixed />
            </template>
          </ElAutoResizer> -->
        <!-- <el-result v-if="starting" icon="info" title="Initiating" sub-title="Opening serial port.."></el-result> -->
        <el-result
          v-if="analyzerError"
          icon="error"
          title="Error"
          :sub-title="analyzerError"
        ></el-result>
        <template v-else>
          <el-form-item label="Modbus Function">
            <el-select
              v-model="filter.mbFunction"
              placeholder="Modbus function"
            >
              <el-option
                v-for="item in modbusFunctionOptions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              ></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="Show raw data">
            <el-switch v-model="showColumns.buffer" />
          </el-form-item>
          <ElTable
            v-loading="starting"
            :data="filteredLog"
            border
            :empty-text="started ? 'Awaiting data' : 'Please start analyzer'"
            :row-class-name="dataRowClassName"
            element-loading-text="Opening serial port..."
          >
            <ElTableColumn
              prop="timestamp"
              label="Timestamp"
              width="130"
            />
            <ElTableColumn
              prop="crc"
              label="CRC"
              width="60"
              align="center"
            >
              <template #default="scope">
                <el-icon>
                  <el-icon-circle-check
                    v-if="scope.row.crc"
                    color="green"
                  ></el-icon-circle-check>
                  <el-icon-circle-close
                    v-else
                    color="red"
                  ></el-icon-circle-close>
                </el-icon>
              </template>   
            </ElTableColumn>
            <ElTableColumn
              prop="type"
              label="Type"
              width="60"
              align="center"
            >
              <template #default="scope">
                <el-icon>
                  <el-icon-arrow-right-bold
                    v-if="scope.row.type === 1"
                    color="orange"
                  ></el-icon-arrow-right-bold>
                  <el-icon-arrow-left-bold
                    v-if="scope.row.type === 2"
                    color="green"
                  ></el-icon-arrow-left-bold>
                </el-icon>
              </template>
            </ElTableColumn>>
            <ElTableColumn
              prop="address"
              label="Address"
              width="90"
            />
            <ElTableColumn
              prop="mbFunction"
              label="Function"
              width="200"
            >
              <template #default="scope">
                {{ formatFunctionCode(scope.row.mbFunction) }}
              </template>
            </ElTableColumn>
            <ElTableColumn
              prop="data"
              label="Data"
            />
            <ElTableColumn
              v-if="showColumns.buffer"
              prop="buffer"
              label="Raw"
            />
          </ElTable>
        </template>
      </el-card>
    </el-col>
  </el-row>
</template> 

<style>
.el-table .warning-row {
  --el-table-tr-bg-color: var(--el-color-warning-light-9);
}
.el-table .success-row {
  --el-table-tr-bg-color: var(--el-color-success-light-9);
}
</style>