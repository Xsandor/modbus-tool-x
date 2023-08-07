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
            <el-radio-group v-model="modbusStore.scannerConfiguration.connectionType">
              <el-radio-button label="0">Modbus RTU</el-radio-button>
              <el-radio-button label="1">Modbus TCP</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <template v-if="modbusStore.scannerConfiguration.connectionType == CONNECTION_TYPE.RTU">
            <el-form-item label="COM port">
              <el-select
                v-model="modbusStore.scannerConfiguration.rtu.port"
                placeholder="Select port"
              >
                <el-option
                  v-for="item in modbusStore.comPorts"
                  :key="item.path"
                  :label="item.path"
                  :value="item.path"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="Baud rate">
              <el-select
                v-model.number="modbusStore.scannerConfiguration.rtu.baudRate"
                placeholder="Select baudRate"
              >
                <el-option
                  v-for="item in modbusStore.baudRateOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="Parity">
              <el-select
                v-model="modbusStore.scannerConfiguration.rtu.parity"
                placeholder="Select parity"
              >
                <el-option
                  v-for="item in modbusStore.parityOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="Data bits">
              <el-input
                v-model.number="modbusStore.scannerConfiguration.rtu.dataBits"
                type="number"
                min="6"
                max="8"
              />
            </el-form-item>
            <el-form-item label="Stop bits">
              <el-input
                v-model.number="modbusStore.scannerConfiguration.rtu.stopBits"
                type="number"
                min="1"
                max="2"
              />
            </el-form-item>
            <el-form-item label="Timeout">
              <el-input
                v-model.number="modbusStore.scannerConfiguration.rtu.timeout"
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
                v-model="modbusStore.scannerConfiguration.tcp.startIp"
                type="text"
              />
            </el-form-item>
            <el-form-item label="End IP Address">
              <el-input
                v-model="modbusStore.scannerConfiguration.tcp.endIp"
                type="text"
              />
            </el-form-item>
            <el-form-item label="Port">
              <el-input
                v-model.number="modbusStore.scannerConfiguration.tcp.port"
                type="number"
                min="1"
                max="65535"
              />
            </el-form-item>
            <el-form-item label="Timeout">
              <el-input
                v-model.number="modbusStore.scannerConfiguration.tcp.timeout"
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
              v-model.number="modbusStore.scannerConfiguration.rtu.requestDelay"
              type="number"
              min="1"
              max="9999"
            >
              <template #suffix>ms</template>
            </el-input>
          </el-form-item>
          <el-form-item label="Min. Unit ID">
            <el-input
              v-model.number="modbusStore.scannerConfiguration.common.minUnitId"
              type="number"
              min="1"
              max="254"
            />
          </el-form-item>
          <el-form-item label="Max. Unit ID">
            <el-input
              v-model.number="modbusStore.scannerConfiguration.common.maxUnitId"
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
        style="width: 100%"
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
          <el-collapse v-model="openSections">
            <el-collapse-item name="1">
              <template #title
                >Online nodes
                <el-tag
                  class="ml-1"
                  size="small"
                  type="success"
                  effect="dark"
                  >{{ onlineItems.length }}</el-tag
                ></template
              >
              <GridList :list="onlineItems" />
            </el-collapse-item>
            <el-collapse-item name="2">
              <template #title
                >Offline nodes
                <el-tag
                  class="ml-1"
                  size="small"
                  type="danger"
                  effect="dark"
                  >{{ offlineItems.length }}</el-tag
                ></template
              >
              <GridList :list="offlineItems" />
            </el-collapse-item>
            <el-collapse-item name="3">
              <template #title
                >Waiting
                <el-tag
                  class="ml-1"
                  size="small"
                  type="info"
                  effect="dark"
                  >{{ unknownItems.length }}</el-tag
                ></template
              >
              <GridList :list="unknownItems" />
            </el-collapse-item>
          </el-collapse>
        </el-card>
        <el-card header="Log">
          <div class="log-container">
            <span
              v-for="(logRow, index) in resultLog"
              :key="'result-' + index"
              :class="logRow.type"
              >{{ logRow.message }}</span
            >
          </div>
        </el-card>
      </el-space>
    </el-col>
  </el-row>
</template>

<!-- eslint-disable no-undef -->
<script lang="ts" setup>
import {csv, scanner} from '#preload';
import {CONNECTION_TYPE, useModbusStore} from '/@/components/useModbus';
import * as Papa from 'papaparse';

const modbusStore = useModbusStore();

const resultLog: Ref<ScanLogItem[]> = ref([]);
const scanning = ref(false);
const scanList: Ref<ScanItem[]> = ref([]);

const enum ScanItemState {
  Waiting = 0,
  Scanning = 1,
  Online = 2,
  Offline = 3,
  OnlineNoResponse = 4,
}

const onlineItems = computed(() => {
  return scanList.value.filter(
    item => item.state === ScanItemState.Online || item.state === ScanItemState.OnlineNoResponse,
  );
});

const offlineItems = computed(() => {
  return scanList.value.filter(item => item.state === ScanItemState.Offline);
});

const unknownItems = computed(() => {
  return scanList.value.filter(
    item => item.state === ScanItemState.Scanning || item.state === ScanItemState.Waiting,
  );
});

const scanProgress = ref(0);
const foundUnits = ref(-1);

const openSections = ref(['1']);

const scannerError: Ref<string> = ref('');

function exportLog() {
  console.log('Trying to save file');
  const text = Papa.unparse(scanList.value);

  if (modbusStore.scannerConfiguration.connectionType == CONNECTION_TYPE.RTU) {
    csv.save(
      text,
      `Modbus Scanner RTU ${modbusStore.scannerConfiguration.rtu.port} ${
        modbusStore.scannerConfiguration.rtu.baudRate
      } ${
        modbusStore.scannerConfiguration.rtu.dataBits
      }${modbusStore.scannerConfiguration.rtu.parity[0].toUpperCase()}${
        modbusStore.scannerConfiguration.rtu.stopBits
      }`,
    );
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
  return `Scanning: ${scanProgress.value.toFixed(0)} % (found ${foundUnits.value} ${
    foundUnits.value === 1 ? 'unit' : 'units'
  })`;
});

function appendToLog(logRows: ScanLogItem[]) {
  resultLog.value = logRows.reverse().concat(resultLog.value);
}

scanner.onStatus((_event, updatedScanList) => {
  scanList.value = updatedScanList;
});

scanner.onLog((_event, messages) => {
  appendToLog(messages);
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
  appendToLog([{type: 'info', message: 'Starting scanner'}]);

  if (modbusStore.scannerConfiguration.connectionType == CONNECTION_TYPE.RTU) {
    const config = {
      ...modbusStore.scannerConfiguration.rtu,
      minUnitId: modbusStore.scannerConfiguration.common.minUnitId,
      maxUnitId: modbusStore.scannerConfiguration.common.maxUnitId,
      delay: modbusStore.scannerConfiguration.rtu.requestDelay,
    };

    const {error} = await scanner.startRtuScan(config);
    if (error) {
      scannerError.value = error;
    } else {
      console.log('Scanning started');
      scanning.value = true;
    }
  } else {
    const config = {
      ...modbusStore.scannerConfiguration.tcp,
      minUnitId: modbusStore.scannerConfiguration.common.minUnitId,
      maxUnitId: modbusStore.scannerConfiguration.common.maxUnitId,
    };

    const {error} = await scanner.startTcpScan(config);
    if (error) {
      scannerError.value = error;
    } else {
      console.log('Scanning started');
      scanning.value = true;
    }
  }
};

onMounted(() => {
  if (!modbusStore.scannerConfiguration.tcp.startIp) {
    modbusStore.scannerConfiguration.tcp.startIp = modbusStore.networkInfo?.firstIpOnSubnet;
    modbusStore.scannerConfiguration.tcp.endIp = modbusStore.networkInfo?.lastIpOnSubnet;
  }
});
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
</style>
