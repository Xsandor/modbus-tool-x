<template>
  <el-row :gutter="20">
    <el-col
      :span="24"
      :md="12"
      :lg="9"
      :xl="6"
    >
      <!-- <el-card
        shadow="never"
        header="Modbus Scanner"
        class="box-card"
      > -->
      <collapsible-card title="Modbus Scanner">
        <el-form
          ref="form"
          label-width="120px"
        >
          <el-form-item label="Connection Type">
            <el-radio-group v-model.number="modbusStore.scannerConfiguration.connectionType">
              <el-radio-button :value="0">Modbus RTU</el-radio-button>
              <el-radio-button :value="1">Modbus TCP</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <template v-if="modbusStore.scannerConfiguration.connectionType == CONNECTION_TYPE.RTU">
            <rtu-config v-model="modbusStore.scannerConfiguration.rtu" />
          </template>
          <template v-else>
            <tcp-config v-model="modbusStore.scannerConfiguration.tcp" />
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
              :disabled="modbusStore.scannerConfiguration.common.unitIds.length > 0"
            />
          </el-form-item>
          <el-form-item label="Max. Unit ID">
            <el-input
              v-model.number="modbusStore.scannerConfiguration.common.maxUnitId"
              type="number"
              min="1"
              max="254"
              :disabled="modbusStore.scannerConfiguration.common.unitIds.length > 0"
            />
          </el-form-item>
          <el-form-item label="Or list of IDs">
            <el-select
              :model-value="modbusStore.scannerConfiguration.common.unitIds"
              :multiple="true"
              :filterable="true"
              :allow-create="true"
              :default-first-option="true"
              :reserve-keyword="false"
              :clearable="true"
              no-data-text="Type new unit ID"
              placeholder="example: 1, 3, 13"
              @update:modelValue="updateUnitList"
            />
          </el-form-item>
          <el-form-item>
            <el-button @click="clearScanList">Clear log</el-button>
            <el-button
              type="primary"
              :disabled="scanning"
              @click="startScan"
            >
              Execute
            </el-button>
          </el-form-item>
        </el-form>
      </collapsible-card>
      <!-- </el-card> -->
    </el-col>
    <el-col
      :span="24"
      :md="12"
      :lg="15"
      :xl="18"
    >
      <el-card shadow="never">
        <template #header>
          <div class="card-header">
            <span>{{ scanState }}</span>
            <el-button
              v-if="scanList.length"
              :size="'small'"
              @click="exportLog"
            >
              Export <el-icon class="el-icon--right"><i-ep-download /></el-icon>
            </el-button>
          </div>
        </template>
        <el-result
          v-if="scannerError"
          icon="error"
          title="Error"
          :sub-title="scannerError"
        ></el-result>
        <el-empty
          v-if="!scanList.length"
          description="Nothing to see here yet"
        />
        <el-collapse
          v-else
          v-model="openSections"
        >
          <el-collapse-item
            name="1"
            :disabled="!onlineItems.length"
          >
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
          <el-collapse-item
            name="2"
            :disabled="!offlineItems.length"
          >
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
          <el-collapse-item
            name="3"
            :disabled="!unknownItems.length"
          >
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
      <log-container :log="resultLog" />
    </el-col>
  </el-row>
</template>

<!-- eslint-disable no-undef -->
<script lang="ts" setup>
import {scanner} from '#preload';
import useCSV from '/@/components/useCSV';
import {CONNECTION_TYPE, useModbusStore} from '/@/stores/useModbus';

const {saveCSV} = useCSV();
const modbusStore = useModbusStore();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const props = defineProps({
  tabId: {
    type: Number,
    required: true,
  },
});

function updateUnitList(val: string[]) {
  modbusStore.scannerConfiguration.common.unitIds = val.map(Number).filter(Number);
}

// TODO: Use tab id to identify Modbus Scanner instance on the server

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
  return scanList.value
    .filter(
      item => item.state === ScanItemState.Online || item.state === ScanItemState.OnlineNoResponse,
    )
    .map(item => {
      let details = '';
      if (item.meta.deviceType) {
        details += `${item.meta.deviceType}
`;
      }
      if (item.meta.deviceModel) {
        details += `${item.meta.deviceModel}`;
      }
      if (item.meta.softwareVersion) {
        details += ` v${item.meta.softwareVersion}`;
      }
      return {
        ...item,
        details,
      };
    });
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
  let filename = 'Modbus Scanner';
  if (modbusStore.scannerConfiguration.connectionType == CONNECTION_TYPE.RTU) {
    const {port, baudRate, dataBits, parity, stopBits} = modbusStore.scannerConfiguration.rtu;

    filename += ` RTU ${port} ${baudRate} ${dataBits}${parity[0].toUpperCase()}${stopBits}`;
  } else {
    filename += ' TCP';
  }

  saveCSV(scanList.value, filename);
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
  appendToLog([{type: 'info', text: 'Starting scanner'}]);

  if (modbusStore.scannerConfiguration.connectionType == CONNECTION_TYPE.RTU) {
    // console.log(modbusStore);
    // console.log(modbusStore.scannerConfiguration);
    // console.log(modbusStore.scannerConfiguration.common);
    // console.log(modbusStore.scannerConfiguration.common.unitIds);
    const config = {
      ...modbusStore.scannerConfiguration.rtu,
      minUnitId: modbusStore.scannerConfiguration.common.minUnitId,
      maxUnitId: modbusStore.scannerConfiguration.common.maxUnitId,
      unitIds: toRaw(modbusStore.scannerConfiguration.common.unitIds),
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
      unitIds: modbusStore.scannerConfiguration.common.unitIds,
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
</script>

<style scoped lang="scss"></style>
