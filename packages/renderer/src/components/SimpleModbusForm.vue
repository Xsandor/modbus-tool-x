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
            <el-radio-group v-model.number="connectionType">
              <el-radio-button label="0">Modbus RTU</el-radio-button>
              <el-radio-button label="1">Modbus TCP</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <template v-if="connectionType === CONNECTION_TYPE.TCP">
            <el-form-item label="IP Address">
              <el-input
                v-model="tcpConfiguration.ip"
                type="text"
                placeholder="Input IP address"
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
                max="60000"
              >
                <template #suffix>ms</template>
              </el-input>
            </el-form-item>
          </template>
          <template v-else>
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
              <el-input-number
                v-model.number="rtuConfiguration.dataBits"
                type="number"
                :min="6"
                :max="8"
              />
            </el-form-item>
            <el-form-item label="Stop bits">
              <el-input-number
                v-model.number="rtuConfiguration.stopBits"
                type="number"
                :min="1"
                :max="2"
              />
            </el-form-item>
            <el-form-item label="Timeout">
              <el-input
                v-model.number="rtuConfiguration.timeout"
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
              v-model.number="commonConfiguration.unitId"
              type="number"
              :min="0"
              :max="254"
            />
          </el-form-item>
          <el-form-item label="Modbus Function">
            <el-select
              v-model="mbFunction"
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
          <el-form-item
            v-for="parameter in mbOptions"
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
      :lg="9"
      :xl="6"
    >
      <el-card>
        <template #header>
          Result
        </template>
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
              border
            >
              <el-descriptions-item
                v-if="response.timestamp"
                width="120px"
                label="Timestamp"
              >
                {{
                  response.timestamp.toLocaleTimeString()
                }}
              </el-descriptions-item>
              <el-descriptions-item
                v-if="response.executionTime"
                width="120px"
                label="Response time"
              >
                {{
                  response.executionTime.toFixed(2)
                }}
                ms
              </el-descriptions-item>
            </el-descriptions>
            <el-divider></el-divider>
            <el-table
              :data="response.result"
              height="600"
              style="width: 100%"
            >
              <el-table-column
                prop="addr"
                label="Address"
                width="100"
              />
              <el-table-column
                prop="value"
                label="Value"
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
  import { modbus } from '#preload';
  import useModbus from '/@/components/useModbus';
  import useComPorts from '/@/components/useComPorts';

  const { comPorts } = await useComPorts();
  const { mbFunctions, parityOptions, baudRateOptions, connectionType, tcpConfiguration, rtuConfiguration, CONNECTION_TYPE } = useModbus();

  const response: Ref<ModbusRequestResponse | null> = ref(null);

  function cancel() {
    response.value = null;
  }

  const commonConfiguration = ref({
    unitId: 1,
  });

  const mbFunction = ref(mbFunctions[2].id);
  const mbOptions: Ref<MbOption[]> = ref([]);

  const selectedMbFunction = computed(() => {
    if (!mbFunction.value) {
      return null;
    }

    return mbFunctions.find(i => i.id === mbFunction.value);
  });

  function updateMbOptions() {
    const modbusFunction = selectedMbFunction.value;

    if (!modbusFunction) {
      mbOptions.value = [];
      return;
    }

    mbOptions.value = modbusFunction.parameters.map(i => {
      return {
        ...i,
        value: i.default,
      };
    });
  }

  watch(mbFunction, () => {
    updateMbOptions();
  });

  const performRequest = async () => {
    // console.log('Will perform modbus request')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = mbOptions.value.reduce((acc: { [key: string]: any; }, item) => {
      acc[item.id] = item.value;
      return acc;
    }, {});

    const task: ModbusTask = {
      unitId: commonConfiguration.value.unitId,
      mbFunction: mbFunction.value,
      mbOptions: {
        ...options,
      },
    };

    if (connectionType.value === CONNECTION_TYPE.TCP) {
      const configuration = {
        ...tcpConfiguration.value,
        task,
      };

      console.log(configuration);

      const result = await modbus.tcpRequest(configuration);
      // console.log(result)
      response.value = result;
    } else if (connectionType.value === CONNECTION_TYPE.RTU) {
      const configuration = {
        ...rtuConfiguration.value,
        task,
      };

      console.log(configuration);

      const result = await modbus.rtuRequest(configuration);
      // console.log(result)
      response.value = result;
    }
  };

  onMounted(async () => {
    // console.log('Component is mounted!')
    updateMbOptions();
    rtuConfiguration.value.port = comPorts.value[0].path;
  });
</script>

<style scoped>

</style>
