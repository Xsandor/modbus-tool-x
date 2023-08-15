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
            <el-form-item label="IP Address">
              <el-input
                v-model="modbusStore.clientConfiguration.tcp.ip"
                type="text"
                placeholder="Input IP address"
              />
            </el-form-item>
            <el-form-item label="Port">
              <el-input
                v-model.number="modbusStore.clientConfiguration.tcp.port"
                type="number"
                min="1"
                max="65535"
              />
            </el-form-item>
            <el-form-item label="Timeout">
              <el-input
                v-model.number="modbusStore.clientConfiguration.tcp.timeout"
                type="number"
                min="1"
                max="60000"
              >
                <template #suffix>ms</template>
              </el-input>
            </el-form-item>
          </template>
          <template v-else>
            <el-form-item label="COM port">
              <el-select
                v-model="modbusStore.clientConfiguration.rtu.port"
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
                v-model.number="modbusStore.clientConfiguration.rtu.baudRate"
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
                v-model="modbusStore.clientConfiguration.rtu.parity"
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
                v-model.number="modbusStore.clientConfiguration.rtu.dataBits"
                type="number"
                :min="6"
                :max="8"
              />
            </el-form-item>
            <el-form-item label="Stop bits">
              <el-input-number
                v-model.number="modbusStore.clientConfiguration.rtu.stopBits"
                type="number"
                :min="1"
                :max="2"
              />
            </el-form-item>
            <el-form-item label="Timeout">
              <el-input
                v-model.number="modbusStore.clientConfiguration.rtu.timeout"
                type="number"
                :min="1"
                :max="60000"
              >
                <template #suffix>ms</template>
              </el-input>
            </el-form-item>
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
          <el-form-item label="Modbus Function">
            <el-select
              v-model="modbusStore.clientConfiguration.common.mbFunction"
              placeholder="Modbus function"
            >
              <el-option
                v-for="item in mbFunctions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              ></el-option>
            </el-select>
          </el-form-item>
          <el-text class="tip">{{ modbusStore.selectedMbFunction?.description }}</el-text>
          <el-form-item
            v-for="parameter in modbusStore.mbOptions"
            :key="parameter.id"
            :label="parameter.label"
          >
            <el-input-number
              v-model="parameter.value"
              :type="parameter.type"
              :min="parameter.min"
              :max="parameter.max"
            />
          </el-form-item>
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
          <template v-if="response && response.result && response.result.length">
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
            <el-table
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
import type {TableColumnCtx} from 'element-plus';
import {CONNECTION_TYPE, mbFunctions, useModbusStore} from '/@/components/useModbus';

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
    acc[item.id] = item.value;
    return acc;
  }, {});

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

    console.log(configuration);

    const result = await modbus.tcpRequest(configuration);
    console.log(result);
    response.value = result;
  } else if (modbusStore.clientConfiguration.connectionType === CONNECTION_TYPE.RTU) {
    const configuration = {
      ...modbusStore.clientConfiguration.rtu,
      task,
    };

    console.log(configuration);

    const result = await modbus.rtuRequest(configuration);
    // console.log(result)
    response.value = result;
  }
};

// function clone<T>(obj: T): T {
//   return JSON.parse(JSON.stringify(obj));
// }

onMounted(async () => {
  // console.log('Component is mounted!')
  // const savedTcpConfiguration = store.get('tcpConfiguration');
  // tcpConfiguration.value = {
  // ...tcpConfiguration.value,
  // ...savedTcpConfiguration,
  // };
  // watch(tcpConfiguration.value, () => {
  // store.set('tcpConfiguration', clone(tcpConfiguration.value));
  // });
  // const savedRtuConfiguration = store.get('rtuConfiguration');
  // rtuConfiguration.value = {
  // ...rtuConfiguration.value,
  // ...savedRtuConfiguration,
  // };
  // const savedPort = rtuConfiguration.value.port;
  // const portExists = comPorts.value.find(i => i.path === savedPort);
  // if (!savedPort || !portExists) {
  // console.log('Taking first comport from list');
  // rtuConfiguration.value.port = comPorts.value[0].path;
  // }
  // watch(rtuConfiguration.value, () => {
  //   store.set('rtuConfiguration', clone(rtuConfiguration.value));
  // });
  // const savedConnectionType = store.get('connectionType');
  // if (savedConnectionType) {
  //   connectionType.value = savedConnectionType;
  // }
  // watch(connectionType, () => {
  //   store.set('connectionType', clone(connectionType.value));
  // });
});
</script>

<style>
.tip {
  display: block;
  font-size: 0.8em;
  line-height: 1.45em;
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 18px;
  background-color: #f5f5f5;
  padding: 8px 5px;
  border-left: 3px solid #ebebeb;
  border-radius: 4px;
}

.result-table .el-table__cell {
  text-align: right;
}
</style>
