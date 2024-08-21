<script lang="ts" setup>
import {analyzer} from '#preload';
import {MODBUS_FUNCTIONS, useModbusStore} from '/@/stores/useModbus';
import useCSV from '/@/components/useCSV';

const modbusStore = useModbusStore();
const {saveCSV} = useCSV();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const props = defineProps({
  tabId: {
    type: Number,
    required: true,
  },
});

// TODO: Use tab id to identify Modbus Analyzer instance on the server

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

  if (rows.length > 200) {
    return rows.slice(0, 200);
  }

  return rows;
});

function exportLog() {
  const formattedList = dataRows.value.map(i => {
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
  });

  saveCSV(formattedList, 'Modbus Analyzer');
}

interface ModbusFunctionOption {
  id: number;
  name: string;
}

const modbusFunctionOptions: ModbusFunctionOption[] = Object.keys(MODBUS_FUNCTIONS).reduce(
  (acc: ModbusFunctionOption[], key: string) => {
    const id = Number(key);
    if (isNaN(id) || id > 128) return acc;

    const name = MODBUS_FUNCTIONS[id];

    acc.push({id, name});
    return acc;
  },
  [{id: 0, name: 'Show all'}],
);

const analyzerError: Ref<string> = ref('');

const filter = ref({
  mbFunction: 0,
});

// function formatFrameType(type: number) {
//   if (type === 1) return 'Request';
//   if (type === 2) return 'Response';

//   return 'Unknown';
// }

const dataRowClassName = ({row}: GenericObject) => {
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
    ...modbusStore.analyzerConfiguration.rtu,
  };

  // console.log(config)
  console.log('Sending start request');
  const {_result, error} = await analyzer.startRtu(config);
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
    <el-col
      :span="24"
      :md="24"
      :lg="8"
      :xl="5"
    >
      <collapsible-card title="Modbus Analyzer">
        <el-form
          ref="ruleFormRef"
          label-width="120px"
        >
          <rtu-config v-model="modbusStore.analyzerConfiguration.rtu" />
          <el-form-item>
            <el-button @click="clearLog">Clear</el-button>
            <el-button
              v-if="started"
              type="danger"
              @click="stopAnalyzer"
            >
              Stop
            </el-button>
            <el-button
              v-else
              type="primary"
              :disabled="starting"
              @click="startAnalyzer"
            >
              Start
            </el-button>
          </el-form-item>
        </el-form>
      </collapsible-card>
    </el-col>
    <el-col
      :span="24"
      :md="24"
      :lg="16"
      :xl="19"
    >
      <el-card shadow="never">
        <template #header>
          <div class="card-header">
            <span>Result</span>
            <el-button
              v-if="dataRows.length"
              :size="'small'"
              @click="exportLog"
            >
              Export <el-icon class="el-icon--right"><i-ep-download /></el-icon>
            </el-button>
          </div>
        </template>
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
          <el-table
            v-loading="starting"
            :data="filteredLog"
            :border="true"
            :empty-text="started ? 'Awaiting data' : 'Please start analyzer'"
            :row-class-name="dataRowClassName"
            element-loading-text="Opening serial port..."
          >
            <el-table-column
              prop="timestamp"
              label="Timestamp"
              width="130"
            />
            <el-table-column
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
            </el-table-column>
            <el-table-column
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
            </el-table-column>
            <el-table-column
              prop="address"
              label="Address"
              width="90"
            />
            <el-table-column
              prop="mbFunction"
              label="Function"
              width="200"
            >
              <template #default="scope">
                {{ modbusStore.formatFunctionCode(scope.row.mbFunction) }}
              </template>
            </el-table-column>
            <el-table-column
              prop="data"
              label="Data"
            />
            <el-table-column
              v-if="showColumns.buffer"
              prop="buffer"
              label="Raw"
            />
          </el-table>
        </template>
      </el-card>
    </el-col>
  </el-row>
</template>

<style></style>
