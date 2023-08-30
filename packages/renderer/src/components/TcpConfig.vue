<template>
  <el-form-item
    v-if="has('ip')"
    label="IP Address"
  >
    <el-input
      v-model="tcp.ip"
      type="text"
      placeholder="Input IP address"
    />
  </el-form-item>
  <el-form-item
    v-if="has('startIp')"
    label="Start IP Address"
  >
    <el-input
      v-model="tcp.startIp"
      type="text"
    />
  </el-form-item>
  <el-form-item
    v-if="has('endIp')"
    label="End IP Address"
  >
    <el-input
      v-model="tcp.endIp"
      type="text"
    />
  </el-form-item>
  <el-form-item
    v-if="has('port')"
    label="Port"
  >
    <el-input
      v-model.number="tcp.port"
      type="number"
      min="1"
      max="65535"
    />
  </el-form-item>
  <el-form-item
    v-if="has('timeout')"
    label="Timeout"
  >
    <el-input
      v-model.number="tcp.timeout"
      type="number"
      min="1"
      max="60000"
    >
      <template #suffix>ms</template>
    </el-input>
  </el-form-item>
</template>

<script setup lang="ts">
const props = defineProps({
  modelValue: {
    type: Object as PropType<Partial<TcpRequestConfiguration & ScannerTcpConfiguration>>,
    required: true,
  },
});

function has(field: string) {
  return field in props.modelValue;
}

const emit = defineEmits(['update:modelValue']);

const tcp = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
});
</script>
