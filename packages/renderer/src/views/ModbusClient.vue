<template>
  <el-row :gutter="20">
    <el-col
      :span="24"
      :md="12"
      :lg="9"
      :xl="6"
    >
      <el-card
        header="Modbus Client"
        class="box-card"
      >
        <el-form
          ref="form"
          label-width="120px"
        >
          <el-form-item label="Connection Type">
            <el-radio-group v-model.number="modbusStore.clientConfiguration.connectionType">
              <el-radio-button label="0">Modbus RTU</el-radio-button>
              <el-radio-button label="1">Modbus TCP</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <template v-if="modbusStore.clientConfiguration.connectionType === CONNECTION_TYPE.TCP">
            <tcp-config v-model="modbusStore.clientConfiguration.tcp" />
          </template>
          <template v-else>
            <rtu-config v-model="modbusStore.clientConfiguration.rtu" />
          </template>
          <el-divider></el-divider>
          <el-form-item label="Unit ID">
            <el-input-number
              v-model.number="modbusStore.clientConfiguration.common.unitId"
              type="number"
              :min="0"
              :max="254"
            />
          </el-form-item>
          <modbus-function-config v-model="modbusStore.clientConfiguration.common.mbFunction" />
          <el-form-item>
            <el-button
              type="primary"
              @click="performRequest"
            >
              Execute
            </el-button>
            <el-button @click="cancel">Cancel</el-button>
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
      <el-card>
        <template #header> Result </template>
        <el-result
          v-if="response && response.errorText"
          icon="error"
          title="Error"
          :sub-title="response.errorText"
        ></el-result>
        <template v-else>
          <template v-if="response && response.result">
            <el-descriptions
              :column="1"
              :border="true"
              style="max-width: 300px"
            >
              <el-descriptions-item
                v-if="response.timestamp"
                width="120px"
                label="Timestamp"
              >
                {{ response.timestamp.toLocaleTimeString() }}
              </el-descriptions-item>
              <el-descriptions-item
                v-if="response.executionTime"
                width="120px"
                label="Response time"
              >
                {{ response.executionTime.toFixed(2) }}
                ms
              </el-descriptions-item>
            </el-descriptions>
            <el-divider></el-divider>
            <template v-if="response.result.json">
              <el-descriptions
                v-for="(item, name) in response.result.json"
                :key="name"
                :title="capitalize(name.toString())"
                :column="1"
                :border="true"
                style="max-width: 300px"
              >
                <el-descriptions-item
                  v-for="(value, key) in item"
                  :key="key"
                  :label="capitalize(key.toString())"
                  >{{ value }}</el-descriptions-item
                >
              </el-descriptions>
            </template>
            <el-table
              v-else
              :data="response.result"
              height="600"
              class="result-table"
              style="width: 100%"
            >
              <el-table-column
                prop="addr"
                label="Address"
                width="100"
              />
              <el-table-column
                prop="value"
                label="INT16"
                :formatter="onlyShowValidNumbers"
                width="100"
              />
              <el-table-column
                prop="uint16"
                label="UINT16"
                :formatter="onlyShowValidNumbers"
                width="100"
              />
              <el-table-column
                prop="int32"
                label="INT32"
                :formatter="onlyShowValidNumbers"
                width="130"
              />
              <el-table-column
                prop="uint32"
                label="UINT32"
                :formatter="onlyShowValidNumbers"
                width="130"
              />
              <el-table-column
                prop="int32_word_swapped"
                label="INT32 (WS)"
                :formatter="onlyShowValidNumbers"
                width="130"
              />
              <el-table-column
                prop="uint32_word_swapped"
                label="UINT32 (W)"
                :formatter="onlyShowValidNumbers"
                width="130"
              />
              <el-table-column
                prop="float32"
                label="FLOAT32"
                :formatter="onlyShowValidNumbers"
                width="130"
              />
              <el-table-column
                prop="float32_word_swapped"
                label="FLOAT32 (WS)"
                :formatter="onlyShowValidNumbers"
                width="130"
              />
            </el-table>
          </template>
          <el-empty
            v-else
            description="Nothing to see here yet"
          />
        </template>
      </el-card>
    </el-col>
  </el-row>
</template>

<script lang="ts" setup>
import {modbus} from '#preload';
import {capitalize} from '/@/helpers/utilities';
import type {TableColumnCtx} from 'element-plus';
import {CONNECTION_TYPE, useModbusStore} from '/@/stores/useModbus';

const modbusStore = useModbusStore();

const response: Ref<ModbusRequestResponse | null> = ref(null);

function cancel() {
  response.value = null;
}

function onlyShowValidNumbers(
  _row: unknown,
  _column: TableColumnCtx<unknown>,
  cellValue: unknown,
  _index: number,
): string {
  if (cellValue === null || cellValue === undefined) {
    return '';
  }
  if (typeof cellValue === 'number' && !Number.isNaN(cellValue)) {
    return cellValue % 1 === 0 ? cellValue.toFixed(0) : cellValue.toFixed(2);
  }
  return '';
}

const performRequest = async () => {
  // console.log('Will perform modbus request')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options = modbusStore.mbOptions.reduce((acc: {[key: string]: any}, item) => {
    if (item.type === 'numberArray') {
      // only use values that are are numbers above 0
      acc[item.id] = item.values?.filter(i => typeof i === 'number' && i >= 0);
      return acc;
    }

    acc[item.id] = item.value;
    return acc;
  }, {});

  // console.log(options);

  const task: ModbusTask = {
    unitId: modbusStore.clientConfiguration.common.unitId,
    mbFunction: modbusStore.clientConfiguration.common.mbFunction,
    mbOptions: {
      ...options,
    },
  };

  if (modbusStore.clientConfiguration.connectionType === CONNECTION_TYPE.TCP) {
    const configuration = {
      ...modbusStore.clientConfiguration.tcp,
      task,
    };

    // console.log(configuration);

    const result = await modbus.tcpRequest(configuration);
    // console.log(result);
    response.value = result;
  } else if (modbusStore.clientConfiguration.connectionType === CONNECTION_TYPE.RTU) {
    const configuration = {
      ...modbusStore.clientConfiguration.rtu,
      task,
    };

    // console.log(configuration);

    const result = await modbus.rtuRequest(configuration);
    // console.log(result)
    response.value = result;
  }
};
</script>

<style>
.result-table .el-table__cell {
  text-align: right;
}
</style>
