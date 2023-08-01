<template>
  <el-row :gutter="20">
    <el-col
      :span="24"
      :md="12"
      :lg="9"
      :xl="6"
    >
      <el-card
        header="Modbus Scanner"
        class="box-card"
      >
        <el-form
          ref="form"
          label-width="120px"
        >
          <el-form-item label="Connection Type">
            <el-radio-group v-model="connectionType">
              <el-radio-button label="0">Modbus RTU</el-radio-button>
              <el-radio-button label="1">Modbus TCP</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <template v-if="connectionType == CONNECTION_TYPE.RTU">
            <el-form-item label="COM port">
              <el-select
                v-model="rtuConfiguration.port"
                placeholder="Select port"
              >
                <el-option
                  v-for="item in comPorts"
                  :key="item.path"
                  :label="item.path"
                  :value="item.path"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="Baud rate">
              <el-select
                v-model.number="rtuConfiguration.baudRate"
                placeholder="Select baudRate"
              >
                <el-option
                  v-for="item in baudRateOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="Parity">
              <el-select
                v-model="rtuConfiguration.parity"
                placeholder="Select parity"
              >
                <el-option
                  v-for="item in parityOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="Data bits">
              <el-input
                v-model.number="rtuConfiguration.dataBits"
                type="number"
                min="6"
                max="8"
              />
            </el-form-item>
            <el-form-item label="Stop bits">
              <el-input
                v-model.number="rtuConfiguration.stopBits"
                type="number"
                min="1"
                max="2"
              />
            </el-form-item>
            <el-form-item label="Timeout">
              <el-input
                v-model.number="rtuConfiguration.timeout"
                type="number"
                min="1"
                max="10000"
              >
                <template #suffix>ms</template>
              </el-input>
            </el-form-item>
          </template>
          <template v-else>
            <el-form-item label="Start IP Address">
              <el-input
                v-model="scanConfiguration.startIp"
                type="text"
              />
            </el-form-item>
            <el-form-item label="End IP Address">
              <el-input
                v-model="scanConfiguration.endIp"
                type="text"
              />
            </el-form-item>
            <el-form-item label="Port">
              <el-input
                v-model.number="tcpConfiguration.port"
                type="number"
                min="1"
                max="65535"
              />
            </el-form-item>
            <el-form-item label="Timeout">
              <el-input
                v-model.number="tcpConfiguration.timeout"
                type="number"
                min="1"
                max="10000"
              >
                <template #suffix>ms</template>
              </el-input>
            </el-form-item>
          </template>
          <el-form-item label="Delay">
            <el-input
              v-model.number="requestDelay"
              type="number"
              min="1"
              max="9999"
            >
              <template #suffix>ms</template>
            </el-input>
          </el-form-item>
          <el-form-item label="Min. Unit ID">
            <el-input
              v-model.number="commonConfiguration.minUnitId"
              type="number"
              min="1"
              max="254"
            />
          </el-form-item>
          <el-form-item label="Max. Unit ID">
            <el-input
              v-model.number="commonConfiguration.maxUnitId"
              type="number"
              min="1"
              max="254"
            />
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              :disabled="scanning"
              @click="startScan"
            >
              Execute
            </el-button>
            <el-button @click="clearScanList">Clear</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </el-col>
    <el-col
      :span="24"
      :md="12"
      :lg="15"
      :xl="18"
    >
      <el-space
        direction="vertical"
        :fill="true"
        style="width:100%"
      >
        <el-card>
          <template #header>
            <div class="card-header">
              <span>{{ scanState }}</span>
              <ElButton
                v-if="scanList.length"
                :size="'small'"
                @click="exportLog"
              >
                Export <el-icon class="el-icon--right"><i-ep-download /></el-icon>
              </ElButton>
            </div>
          </template>
          <el-result
            v-if="scannerError"
            icon="error"
            title="Error"
            :sub-title="scannerError"
          ></el-result>
          <el-row
            v-if="scanList.length"
            :gutter="20"
          >
            <el-col
              v-for="item in scanList"
              :key="item.id"
              :span="6"
              style="padding: 5px;"
            >
              <div
                :class="getStatusClass(item.state)"
                class="status-item"
              >
                <h4 style="margin-top: 5px; margin-bottom: 3px;">{{ item.id }}</h4>
                <span
                  style="font-size: 0.8em;"
                  :title="item.errorMessage"
                >{{ item.stateText }}</span>
              </div>
            </el-col>
          </el-row>
          <el-empty
            v-else
            description="Nothing to see here yet"
          />
        </el-card>
        <el-card header="Log">
          <div class="log-container">
            <span
              v-for="(logRow, index) in resultLog"
              :key="'result-' + index"
              :class="logRow.type"
            >{{ logRow.message }}</span>
          </div>
        </el-card>
      </el-space>
    </el-col>
  </el-row>
</template>

<!-- eslint-disable no-undef -->
<script lang="ts" setup>
import { csv, scanner } from '#preload';
import useModbus from '/@/components/useModbus';
import useComPorts from '/@/components/useComPorts';
import { networkInfoKey } from '/@/helpers/injectionKeys';
import * as Papa from 'papaparse';

const { comPorts } = await useComPorts();
const { parityOptions, baudRateOptions, connectionType, tcpConfiguration, rtuConfiguration, CONNECTION_TYPE } = useModbus();

const networkInfo = inject(networkInfoKey);

const commonConfiguration = ref({
  minUnitId: 1,
  maxUnitId: 247,
});

const scanConfiguration = ref({
  startIp: '',
  endIp: '',
});

const requestDelay = ref(50);

const resultLog: Ref<ScanLogItem[]> = ref([]);
const scanning = ref(false);
const scanList: Ref<ScanItem[]> = ref([]);
const scanProgress = ref(0);
const foundUnits = ref(-1);

const scannerError: Ref<string> = ref('');

function exportLog() {
  console.log('Trying to save file');
  const text = Papa.unparse(scanList.value);

  if (connectionType.value == CONNECTION_TYPE.RTU) {
    csv.save(text, `Modbus Scanner RTU ${rtuConfiguration.value.port} ${rtuConfiguration.value.baudRate} ${rtuConfiguration.value.dataBits}${rtuConfiguration.value.parity[0].toUpperCase()}${rtuConfiguration.value.stopBits}`);
  } else {
    csv.save(text, 'Modbus Scanner TCP');
  }
}

function clearScanList() {
  scannerError.value = '';
  foundUnits.value = -1;
  scanList.value = [];
  resultLog.value = [];
}

const scanState = computed(() => {
  if (!scanning.value) {
    if (foundUnits.value >= 0) {
      return `${foundUnits.value} ${foundUnits.value === 1 ? 'unit' : 'units'} online`;
    }
    return 'Idle';
  }
  return `Scanning: ${scanProgress.value.toFixed(0)} % (found ${foundUnits.value} ${foundUnits.value === 1 ? 'unit' : 'units'})`;
});

onMounted(async () => {
  console.log('Component is mounted, getting com ports');
  if (networkInfo) {
    scanConfiguration.value.startIp = networkInfo.value.firstIpOnSubnet;
    scanConfiguration.value.endIp = networkInfo.value.lastIpOnSubnet;
    rtuConfiguration.value.port = comPorts.value[0].path;

    watch(networkInfo, () => {
      scanConfiguration.value.startIp = networkInfo.value.firstIpOnSubnet;
      scanConfiguration.value.endIp = networkInfo.value.lastIpOnSubnet;
    });
  }
});

function appendToLog(logRow: ScanLogItem) {
  resultLog.value.unshift(logRow);
}

scanner.onStatus((_event, updatedScanList) => {
  scanList.value = updatedScanList;
});

scanner.onLog((_event, message) => {
  appendToLog(message);
});

scanner.onProgress((_event, [progress, found]) => {
  // appendToLog(message)
  foundUnits.value = found;
  scanProgress.value = progress;
  if (progress >= 100) {
    scanning.value = false;
  }
});

const startScan = async () => {
  clearScanList();
  appendToLog({ type: 'info', message: 'Starting scanner' });

  if (connectionType.value == CONNECTION_TYPE.RTU) {
    const config = {
      ...rtuConfiguration.value,
      ...commonConfiguration.value,
      delay: requestDelay.value,
    };

    const {error } = await scanner.startRtuScan(config);
    if (error) {
      scannerError.value = error;
    } else {
      scanning.value = true;
    }

  } else {
    const config = {
      ...tcpConfiguration.value,
      ...commonConfiguration.value,
      startIp: scanConfiguration.value.startIp,
      endIp: scanConfiguration.value.endIp,
    };

    const {error } = await scanner.startTcpScan(config);
    if (error) {
      scannerError.value = error;
    } else {
      scanning.value = true;
    }
  }
};

const statusClasses = [
  'state-waiting', //'Waiting',
  'state-scanning',//'Scanning',
  'state-online',//'Online',
  'state-offline',//'Server offline',
  'state-warning',//'Server online but no response
];

function getStatusClass(state: number) {
  return statusClasses[state];
}

</script>

<style scoped lang="scss">
.log-container {
  max-height: 200px;
  overflow-y: auto;

  span {
    display: block;
    font-size: 13px;
    color: var(--el-text-color-regular);
    line-height: 25px;

    // &.info {
    //   // color: grey;
    // }

    &.success {
      color: green;
    }
  }
}

.status-item {
  border-radius: 5px;
  padding: 1px 10px 5px 10px;
  color: #fff;

  &.state-waiting {
    background-color: rgb(124, 124, 124);
  }

  &.state-scanning {
    background-color: rgb(55, 147, 163);
  }

  &.state-online {
    background-color: rgb(45, 163, 45);
  }

  &.state-offline {
    background-color: rgb(160, 108, 108);
  }

  &.state-warning {
    background-color: rgb(180, 114, 38);
  }
}
</style>
