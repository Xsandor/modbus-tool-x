<template>
  <el-row :gutter="20">
    <el-col
      :span="24"
      :md="18"
      :lg="12"
      :xl="6"
    >
      <el-card header="Modbus Server">
        <el-form
          ref="form"
          label-width="120px"
        >
          <el-form-item label="Connection Type">
            <el-radio-group v-model.number="modbusStore.serverConfiguration.connectionType">
              <el-radio-button label="0">Modbus RTU</el-radio-button>
              <el-radio-button
                label="1"
                title="Not supported yet"
                disabled
                >Modbus TCP</el-radio-button
              >
            </el-radio-group>
          </el-form-item>
          <template v-if="modbusStore.serverConfiguration.connectionType === CONNECTION_TYPE.TCP">
            <el-form-item label="Port">
              <el-input
                v-model.number="modbusStore.serverConfiguration.tcp.port"
                type="number"
                min="1"
                max="65535"
              />
            </el-form-item>
          </template>
          <template v-else>
            <rtu-config v-model="modbusStore.serverConfiguration.rtu" />
          </template>
          <el-form-item
            label="Unit ID"
            title="255 = Listens to all IDs"
          >
            <el-input-number
              v-model.number="modbusStore.serverConfiguration.common.unitId"
              type="number"
              :min="1"
              :max="255"
            />
          </el-form-item>
          <el-form-item>
            <el-button
              :disabled="!started"
              @click="stopServer"
              >Stop Server</el-button
            >
            <el-button
              :type="started ? 'primary' : 'default'"
              :disabled="started"
              @click="startServer"
              >Start Server</el-button
            >
          </el-form-item>
        </el-form>
      </el-card>
    </el-col>
    <el-col
      :span="24"
      :md="18"
      :lg="12"
      :xl="6"
    >
      <el-card header="Data">
        <template v-if="startedOnce">
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
        </template>
        <el-result
          v-else
          icon="info"
          title="Start server"
        >
          <template #sub-title>
            <p>You need to start the server for the data to be available.</p>
          </template>
        </el-result>
      </el-card>
    </el-col>
  </el-row>
  <el-row
    :gutter="20"
    style="margin-top: 10px"
  >
    <el-col
      :span="24"
      :md="6"
      :lg="12"
      :xl="12"
    >
      <log-container :log="logs" />
    </el-col>
  </el-row>
</template>

<!-- eslint-disable no-undef -->
<script lang="ts" setup>
import {server} from '#preload';
import {useModbusStore, CONNECTION_TYPE} from '/@/stores/useModbus';

const modbusStore = useModbusStore();

const started = ref(false);
const startedOnce = ref(false);
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
  startedOnce.value = true;
  await getData();
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

const logs: Ref<ScanLogItem[]> = ref([]);
const data = ref([]);

async function getData() {
  if (!started.value) {
    return;
  }

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
    text: log,
  });
});

watch([dataType, dataRegister, dataCount], () => {
  getData();
});
</script>

<style scoped lang="scss"></style>
