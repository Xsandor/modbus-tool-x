<template>
  <el-row :gutter="20">
    <el-col
      :span="24"
      :md="18"
      :lg="12"
      :xl="6"
    >
      <el-card header="Modbus Server">
        <el-form-item label="Connection Type">
          <el-radio-group v-model="modbusStore.serverConfiguration.connectionType">
            <el-radio-button label="0">Modbus RTU</el-radio-button>
            <el-radio-button
              label="1"
              :disabled="true"
              title="Not supported yet"
              >Modbus TCP</el-radio-button
            >
          </el-radio-group>
        </el-form-item>

        <el-form-item label="COM port">
          <el-select
            v-model="modbusStore.serverConfiguration.rtu.port"
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
            v-model.number="modbusStore.serverConfiguration.rtu.baudRate"
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
            v-model="modbusStore.serverConfiguration.rtu.parity"
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
          <el-input-number
            v-model.number="modbusStore.serverConfiguration.rtu.dataBits"
            type="number"
            :min="6"
            :max="8"
          />
        </el-form-item>
        <el-form-item label="Stop bits">
          <el-input-number
            v-model.number="modbusStore.serverConfiguration.rtu.stopBits"
            type="number"
            :min="1"
            :max="2"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            :disabled="!started"
            @click="stopServer"
            >Stop Server</el-button
          >
          <el-button
            type="primary"
            :disabled="started"
            @click="startServer"
            >Start Server</el-button
          >
        </el-form-item>
        <el-divider></el-divider>
        <el-form-item>
          <el-radio-group
            v-model="dataType"
            placeholder="Select"
          >
            <el-radio-button label="coil"> Coils </el-radio-button>
            <el-radio-button label="discreteInput"> Discrete Inputs </el-radio-button>
            <el-radio-button label="holding"> Holding Registers </el-radio-button>
            <el-radio-button label="input"> Input Registers </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form label-width="100">
          <el-form-item label="Register">
            <el-input-number
              v-model.number="dataRegister"
              :min="0"
              :max="65535"
              :step="dataCount"
              placeholder="Data register"
            />
          </el-form-item>
          <el-form-item label="Count">
            <el-input-number
              v-model.number="dataCount"
              :min="1"
              placeholder="Data type"
            />
          </el-form-item>
          <el-button @click="getData">Refresh</el-button>
        </el-form>
        <el-table
          :data="data"
          style="width: 100%"
          height="500"
        >
          <el-table-column
            prop="register"
            label="Register"
            width="100"
          />
          <el-table-column
            prop="value"
            label="Value"
            width="180"
          />
        </el-table>
      </el-card>
    </el-col>
    <el-col
      :span="24"
      :md="6"
      :lg="12"
      :xl="12"
    >
      <el-card header="Logs">
        <div class="log-container">
          <span
            v-for="(log, index) in logs"
            :key="'log-' + index"
            :class="log.type"
            >{{ log.message }}</span
          >
        </div>
      </el-card>
    </el-col>
  </el-row>
</template>

<!-- eslint-disable no-undef -->
<script lang="ts" setup>
import {server} from '#preload';
import {useModbusStore} from '/@/components/useModbus';

const modbusStore = useModbusStore();

const started = ref(false);
// const serverError = ref('');

async function startServer() {
  const config: SerialPortConfiguration = {
    ...modbusStore.serverConfiguration.common,
    ...modbusStore.serverConfiguration.rtu,
  };

  // console.log(config)
  console.log('Sending start request');
  await server.startRtu(config);
  console.log('Got response!');
  started.value = true;
}

async function stopServer() {
  if (started.value) {
    await server.stopRtu();
    started.value = false;
  }
}

const dataType = ref('holding');
const dataRegister = ref(1);
const dataCount = ref(100);

const logs: Ref<{type: string; message: string}[]> = ref([]);
const data = ref([]);

async function getData() {
  console.log(dataType.value);

  let values = await server.getData({
    type: dataType.value,
    register: dataRegister.value,
    count: dataCount.value,
  });

  values = values.map((value: number, index: number) => {
    return {
      register: dataRegister.value + index,
      value,
    };
  });

  data.value = values;
}

server.onLog((_event, type: string, log: string) => {
  logs.value.push({
    type,
    message: log,
  });
});

watch([dataType, dataRegister, dataCount], () => {
  getData();
});

onMounted(async () => {
  await getData();
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
