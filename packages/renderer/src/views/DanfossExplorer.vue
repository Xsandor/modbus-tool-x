<template>
  <el-row :gutter="20">
    <el-col
      :span="24"
      :sm="12"
      :md="10"
      :lg="9"
      :xl="6"
    >
      <collapsible-card title="Danfoss Explorer">
        <el-form
          ref="form"
          label-width="120px"
        >
          <rtu-config v-model="modbusStore.ekcDeviceConfiguration.rtu" />
          <el-form-item label="Unit ID">
            <el-input
              v-model.number="modbusStore.ekcDeviceConfiguration.common.unitId"
              type="number"
              min="1"
              max="254"
            />
          </el-form-item>
          <el-form-item label="Use cache">
            <el-switch v-model="modbusStore.ekcDeviceConfiguration.common.useCache" />
          </el-form-item>
          <el-form-item>
            <el-button
              :disabled="!initiated"
              @click="disconnect"
            >
              Disconnect
            </el-button>
            <el-button
              type="primary"
              @click="initiate"
            >
              Connect
            </el-button>
          </el-form-item>
        </el-form>
      </collapsible-card>
      <el-card
        shadow="never"
        header="Device"
      >
        <el-text>{{ status }}</el-text>
        <template v-if="initiating">
          <el-progress :percentage="progress" />
        </template>
        <el-descriptions
          v-if="initiated"
          :column="1"
          style="max-width: 400px"
          :border="true"
        >
          <el-descriptions-item
            label="Address"
            width="150px"
            >{{ device.unitId }}</el-descriptions-item
          >
          <el-descriptions-item
            label="Model"
            width="150px"
            >{{ device.deviceModel }}</el-descriptions-item
          >
          <el-descriptions-item
            label="Version"
            width="150px"
            >{{ device.version }}</el-descriptions-item
          >
          <el-descriptions-item
            label="Type"
            width="150px"
            >{{ device.deviceType }}</el-descriptions-item
          >
        </el-descriptions>
      </el-card>
    </el-col>
    <el-col
      :span="24"
      :lg="15"
      :xl="18"
    >
      <el-card
        shadow="never"
        header="Parameters"
        style="white-space: pre"
      >
        <template v-if="initiated">
          <el-tabs
            v-model="openTab"
            type="border-card"
            @tab-change="setActiveGroup"
          >
            <el-tab-pane
              v-for="group in visibleGroups"
              :key="group.id"
              :name="group.id"
              :label="group.name"
            >
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-card
                    header="Status"
                    shadow="never"
                  >
                    <el-table
                      :data="parametersInGroup(group.id, false)"
                      height="500"
                    >
                      <el-table-column type="expand">
                        <template #default="props">
                          <el-descriptions
                            :column="2"
                            style="max-width: 400px"
                            :border="true"
                          >
                            <el-descriptions-item
                              label="Min"
                              width="150px"
                              >{{ props.row.min }}</el-descriptions-item
                            >
                            <el-descriptions-item
                              label="Max"
                              width="150px"
                              >{{ props.row.max }}</el-descriptions-item
                            >
                            <el-descriptions-item
                              label="Type"
                              width="150px"
                              >{{ props.row.type }}</el-descriptions-item
                            >
                            <el-descriptions-item
                              label="Exp"
                              width="150px"
                              >{{ props.row.exp }}</el-descriptions-item
                            >
                            <el-descriptions-item
                              label="Dynamic"
                              width="150px"
                              >{{ props.row.dynamic }}</el-descriptions-item
                            >
                          </el-descriptions>
                        </template>
                      </el-table-column>
                      <el-table-column
                        prop="pnu"
                        label="PNU"
                        width="100"
                      />
                      <el-table-column
                        prop="name"
                        label="Name"
                        width="250"
                      />
                      <el-table-column
                        label="Value"
                        width="250"
                      >
                        <template #default="scope">
                          {{ formattedParameterValue(scope.row) }}
                        </template>
                      </el-table-column>
                    </el-table>
                  </el-card>
                </el-col>
                <el-col :span="12">
                  <el-card
                    header="Settings"
                    shadow="never"
                  >
                    <el-table
                      :data="parametersInGroup(group.id, true)"
                      height="500"
                    >
                      <el-table-column type="expand">
                        <template #default="props">
                          <el-descriptions
                            :column="2"
                            style="max-width: 400px"
                            :border="true"
                          >
                            <el-descriptions-item
                              label="Min"
                              width="150px"
                              >{{ props.row.min }}</el-descriptions-item
                            >
                            <el-descriptions-item
                              label="Max"
                              width="150px"
                              >{{ props.row.max }}</el-descriptions-item
                            >
                            <el-descriptions-item
                              label="Type"
                              width="150px"
                              >{{ props.row.type }}</el-descriptions-item
                            >
                            <el-descriptions-item
                              label="Exp"
                              width="150px"
                              >{{ props.row.exp }}</el-descriptions-item
                            >
                            <el-descriptions-item
                              label="Dynamic"
                              width="150px"
                              >{{ props.row.dynamic }}</el-descriptions-item
                            >
                          </el-descriptions></template
                        >
                      </el-table-column>
                      <el-table-column
                        prop="pnu"
                        label="PNU"
                        width="100"
                      />
                      <el-table-column
                        prop="name"
                        label="Name"
                        width="250"
                      />
                      <el-table-column
                        label="Value"
                        width="250"
                      >
                        <template #default="scope">
                          <el-button
                            text
                            @click="changeValue(scope.row)"
                            >{{ formattedParameterValue(scope.row) }}</el-button
                          >
                        </template>
                      </el-table-column>
                    </el-table>
                  </el-card>
                </el-col>
              </el-row>
            </el-tab-pane>
            <!-- <el-tab-pane name="device">
            <template #title>Device</template>
            {{ device }}
          </el-tab-pane> -->
          </el-tabs>
        </template>
        <el-empty
          v-else
          description="Nothing to see here yet"
        />
      </el-card>
    </el-col>
  </el-row>
</template>

<!-- eslint-disable no-undef -->
<script lang="ts" setup>
import {danfossEkc} from '#preload';
import {ElInputNumber, ElMessage, ElMessageBox, type TabPaneName} from 'element-plus';
// import {Edit} from '@element-plus/icons-vue';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/message-box/style/css';
import 'element-plus/es/components/input-number/style/css';
import useToast from '/@/components/useToast';
import {useModbusStore} from '/@/stores/useModbus';

const modbusStore = useModbusStore();
const {toast} = useToast();

const openTab = ref();

const device: Ref<GenericObject> = ref({});

const initiating = ref(false);
const initiated = ref(false);
const progress = ref(0);
const status = ref('Connect to a device to get started');

const parameterData: Ref<GenericObject> = ref({});

function setActiveGroup(tab: TabPaneName) {
  danfossEkc.setActiveGroup(tab as number);
}

function formattedParameterValue(parameter: GenericObject) {
  if (!(parameter.pnu in parameterData.value)) return '';

  const scaledValue = parameterData.value[parameter.pnu] * 10 ** parameter.exp;
  const decimals = Math.abs(parameter.exp);
  return scaledValue.toFixed(decimals);
}

const visibleGroups = computed(() => {
  if (!device.value.groups || !device.value.parameters) {
    return [];
  }

  return device.value.groups.filter((g: GenericObject) => {
    return device.value.parameters.some((p: GenericObject) => p.group === g.id);
  });
});

const IN_ALL_GROUPS = 16;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function changeValue(parameter: any) {
  if (!parameter.writable) {
    return;
  }

  console.log('Change triggered for parameter:');
  console.log(parameter);

  const oldValue = ref(parameterData.value[parameter.pnu] * 10 ** parameter.exp);

  ElMessageBox({
    title: `Change '${parameter.name}'`,
    message: () => {
      return h('div', {className: 'form-box'}, [
        h(
          'p',
          null,
          `Please enter a new value between ${parameter.min * 10 ** parameter.exp} and ${
            parameter.max * 10 ** parameter.exp
          }`,
        ),
        h(ElInputNumber, {
          modelValue: oldValue.value,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          'onUpdate:modelValue': (val: any) => {
            oldValue.value = val;
          },
          min: parameter.min * 10 ** parameter.exp,
          max: parameter.max * 10 ** parameter.exp,
          step: 1 * 10 ** parameter.exp,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onChange: (_value: any) => {
            console.log(oldValue);
          },
        }),
      ]);
    },
    confirmButtonText: 'Save',
    cancelButtonText: 'Cancel',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    beforeClose: async (action: any, instance: any, done: any) => {
      if (action === 'confirm') {
        let newValue = oldValue.value.toString();
        // console.log(`Raw value from user: ${newValue}`);
        if (!newValue) {
          return console.log('User aborted!');
        }
        const scaledValue = Math.round(parseFloat(newValue) / 10 ** parameter.exp);
        // console.log(`Parsed value from user: ${scaledValue}`);
        if (scaledValue > parameter.max || scaledValue < parameter.min) {
          const message = `Illegal value
Supplied: ${newValue}
Valid range: ${parameter.min * 10 ** parameter.exp} to ${parameter.max * 10 ** parameter.exp}`;

          toast(message, 'error');
          return console.warn('User is trying to write an illegal value!');
        }

        // console.log(`Will write ${scaledValue} to pollerIndex ${parameter.pollerIndex}`);
        try {
          instance.confirmButtonLoading = true;
          instance.confirmButtonText = 'Saving...';
          console.log(`Writing ${scaledValue} to PNU ${parameter.pnu}`);
          await danfossEkc.writeParameter(parameter.pnu, scaledValue);
          done();
          instance.confirmButtonLoading = false;
          toast(`Parameter changed successfully`, 'success');
        } catch (_error) {
          toast('Failed to change parameter', 'error');
          done();
          instance.confirmButtonLoading = false;
        }
      } else {
        done();
      }
    },
  });
}

function parametersInGroup(groupId: number, writable: undefined | boolean): GenericObject[] {
  const parameters = device.value.parameters
    .filter(
      (p: GenericObject) =>
        (p.group === groupId || p.group === IN_ALL_GROUPS) &&
        (writable === undefined || p.writable === writable),
    )
    .sort((a: GenericObject, b: GenericObject) => {
      if (a.name < b.name) {
        return -1;
      }
      if (a.name > b.name) {
        return 1;
      }
      return 0;
    });
  if (!parameters.length) {
    return [];
  }
  return parameters;
}

danfossEkc.onStatus((_event, update) => {
  // console.log('onStatus');
  // console.log(update);
  status.value = update.text;
  progress.value = update.progress;
});

danfossEkc.onParameterData((_event, data) => {
  // console.log('onParameterData');
  // console.log(data);
  parameterData.value = {
    ...parameterData.value,
    ...data,
  };
  // console.log(parameterData.value);
});

const initiate = async () => {
  status.value = 'Initiating...';
  initiated.value = false;
  try {
    initiating.value = true;
    parameterData.value = {};
    const response = await danfossEkc.initiate(
      {...modbusStore.ekcDeviceConfiguration.rtu},
      modbusStore.ekcDeviceConfiguration.common.unitId,
      modbusStore.ekcDeviceConfiguration.common.useCache,
    );
    // console.log(response);
    initiated.value = true;
    device.value = response;

    if (!openTab.value) {
      // console.log('Setting openTab to first group with parameters');
      const firstGroupWithParameters = device.value.groups.find((g: GenericObject) => {
        return device.value.parameters.some((p: GenericObject) => p.group === g.id);
      });

      // console.log(firstGroupWithParameters);
      if (firstGroupWithParameters) {
        openTab.value = firstGroupWithParameters.id;
      }
    }

    // console.log('Setting active group to ' + openTab.value);
    setActiveGroup(openTab.value);
  } catch (_error) {
    ElMessage({
      offset: 40,
      type: 'error',
      message: 'Connection failed',
    });
    status.value = 'Connection failed, try again';
  } finally {
    initiating.value = false;
  }
};

const disconnect = async () => {
  danfossEkc.disconnect();
  initiated.value = false;
  initiating.value = false;
  status.value = 'Connect to a device to get started';
  device.value = {};
};
</script>

<style lang="scss"></style>
