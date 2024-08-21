<template>
  <el-row :gutter="20">
    <el-col
      :span="24"
      :md="12"
      :lg="9"
      :xl="6"
    >
      <collapsible-card title="Register Scanner">
        <el-form
          ref="form"
          label-width="120px"
        >
          <rtu-config v-model="modbusStore.registerScannerConfiguration.rtu" />
          <el-form-item label="Unit ID">
            <el-input
              v-model.number="modbusStore.registerScannerConfiguration.common.unitId"
              type="number"
              min="1"
              max="254"
            />
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              @click="scan"
            >
              Scan
            </el-button>
          </el-form-item>
        </el-form>
      </collapsible-card>
      <el-card
        shadow="never"
        header="Scanned registers"
      >
        <el-descriptions
          :column="1"
          style="max-width: 400px"
          :border="true"
        >
          <el-descriptions-item
            label="Coils"
            width="150px"
            >{{ progress.coils }}</el-descriptions-item
          >
          <el-descriptions-item
            label="Discrete Inputs"
            width="150px"
            >{{ progress.discreteInputs }}</el-descriptions-item
          >
          <el-descriptions-item
            label="Holding Registers"
            width="150px"
            >{{ progress.holdingRegisters }}</el-descriptions-item
          >
          <el-descriptions-item
            label="Input Registers"
            width="150px"
            >{{ progress.inputRegisters }}</el-descriptions-item
          >
        </el-descriptions>
      </el-card>
    </el-col>
    <el-col
      :span="24"
      :md="14"
      :lg="15"
      :xl="18"
    >
      <el-card
        shadow="never"
        class="box-card"
      >
        <template #header>
          <div class="card-header">
            <span>Found Registers</span>
            <el-button
              v-if="registers.length"
              :size="'small'"
              @click="exportList"
            >
              Export <el-icon class="el-icon--right"><i-ep-download /></el-icon>
            </el-button>
          </div>
        </template>
        <el-table
          v-if="registers.length"
          :data="registers"
        >
          <el-table-column
            prop="type"
            label="Type"
          />
          <el-table-column
            prop="address"
            label="Address"
          />
          <el-table-column
            prop="value"
            label="Value"
          />
        </el-table>
        <el-empty
          v-else
          description="Nothing to see here yet"
        />
      </el-card>
    </el-col>
  </el-row>
</template>

<script lang="ts" setup>
import {registerScanner} from '#preload';
import useCSV from '/@/components/useCSV';
import {useModbusStore} from '/@/stores/useModbus';

const {saveCSV} = useCSV();
const modbusStore = useModbusStore();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const props = defineProps({
  tabId: {
    type: Number,
    required: true,
  },
});

// TODO: Use tab id to identify Register Scanner instance on the server

const registers = ref([]);

const progress = ref({
  coils: 0,
  discreteInputs: 0,
  holdingRegisters: 0,
  inputRegisters: 0,
});

registerScanner.onProgress((_event, updatedProgress) => {
  // console.log('Got progress!');
  // console.log(progress);
  progress.value = updatedProgress;
});

registerScanner.onFoundRegisters((_event, foundRegisters) => {
  console.log('Got found registers!');
  console.log(foundRegisters);
  registers.value = foundRegisters;
});

function scan() {
  console.log('Start scan!');
  registerScanner.start(
    {...modbusStore.registerScannerConfiguration.rtu},
    modbusStore.registerScannerConfiguration.common.unitId,
  );
}

function exportList() {
  saveCSV(registers.value, 'Register Scanner');
}
</script>
