<template>
  <el-row :gutter="20">
    <el-col
      :span="24"
      :md="18"
      :lg="12"
      :xl="6"
    >
      <el-card header="Modbus Server">
        <el-form-item>
          <el-radio-group
            v-model="dataType"
            placeholder="Select"
          >
            <el-radio-button
              label="coil"
            >
              Coils
            </el-radio-button>
            <el-radio-button
              label="discreteInput"
            >
              Discrete Inputs
            </el-radio-button>
            <el-radio-button
              label="holding"
            >
              Holding Registers
            </el-radio-button>
            <el-radio-button
              label="input"
            >
              Input Registers
            </el-radio-button>
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
          >{{ log.message }}</span>
        </div>
      </el-card>
    </el-col>
  </el-row>
</template>

<!-- eslint-disable no-undef -->
<script lang="ts" setup>
import { server } from '#preload';

const dataType = ref('holding');
const dataRegister = ref(1);
const dataCount = ref(100);

const logs: Ref<{ type: string, message: string }[]> = ref([]);
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
  console.log('Browser starting server');
  await server.start();
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