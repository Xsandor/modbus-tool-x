<template>
  <el-form-item
    v-if="has('port')"
    label="COM port"
  >
    <el-select
      v-model="rtu.port"
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
  <el-form-item
    v-if="has('baudRate')"
    label="Baud rate"
  >
    <el-select
      v-model.number="rtu.baudRate"
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
  <el-form-item
    v-if="has('parity')"
    label="Parity"
  >
    <el-select
      v-model="rtu.parity"
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
  <el-form-item
    v-if="has('dataBits')"
    label="Data bits"
  >
    <el-input
      v-model.number="rtu.dataBits"
      type="number"
      min="6"
      max="8"
    />
  </el-form-item>
  <el-form-item
    v-if="has('stopBits')"
    label="Stop bits"
  >
    <el-input
      v-model.number="rtu.stopBits"
      type="number"
      min="1"
      max="2"
    />
  </el-form-item>
  <el-form-item
    v-if="has('timeout')"
    label="Timeout"
  >
    <el-input
      v-model.number="rtu.timeout"
      type="number"
      min="1"
      max="10000"
    >
      <template #suffix>ms</template>
    </el-input>
  </el-form-item>
</template>

<script setup lang="ts">
import {useModbusStore} from '/@/stores/useModbus';

const modbusStore = useModbusStore();

const props = defineProps({
  modelValue: {
    type: Object as PropType<Partial<RtuRequestConfiguration>>,
    required: true,
  },
});

const emit = defineEmits(['update:modelValue']);

const rtu = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
});

function has(field: string) {
  return field in props.modelValue;
}
</script>
