<template>
  <el-form-item label="Modbus Function">
    <el-select
      v-model="common.mbFunction"
      placeholder="Modbus function"
      @change="updateMbOptions"
    >
      <el-option
        v-for="item in mbFunctions"
        :key="item.id"
        :label="item.name"
        :value="item.id"
      ></el-option>
    </el-select>
  </el-form-item>
  <el-text class="tip">{{ selectedMbFunction?.description }}</el-text>
  <template v-for="parameter in common.mbFunctionParameters">
    <template v-if="parameter.type === 'numberArray'">
      <el-form-item
        v-for="index in parameter.values!.length"
        :key="parameter.id + ':' + (index - 1)"
        :label="parameter.label + ' ' + index"
      >
        <el-input-number
          v-model.number="parameter.values![index - 1]"
          type="number"
          :min="parameter.min"
          :max="parameter.max"
        />
      </el-form-item>
      <el-button
        :key="parameter.id + '-btn'"
        @click="addValue(parameter)"
        >+</el-button
      >
    </template>
    <el-form-item
      v-else
      :key="parameter.id"
      :label="parameter.label"
    >
      <el-input-number
        v-model.number="parameter.value"
        :type="parameter.type"
        :min="parameter.min"
        :max="parameter.max"
      />
    </el-form-item>
  </template>
</template>

<script setup lang="ts">
import {useModbusStore, mbFunctions} from '/@/stores/useModbus';

const {getParametersForMbFunction} = useModbusStore();

const props = defineProps({
  modelValue: {
    type: Object as PropType<{mbFunction: number; mbFunctionParameters: MbFunctionParameter[]}>,
    required: true,
  },
});

const emit = defineEmits(['update:modelValue']);

const common = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
});

const selectedMbFunction = computed(() =>
  mbFunctions.find(item => item.id === common.value.mbFunction),
);

function updateMbOptions(mbFunctionId: number) {
  const parameters = getParametersForMbFunction(mbFunctionId);

  common.value.mbFunctionParameters = parameters;
}

onMounted(() => {
  updateMbOptions(common.value.mbFunction);
});

function addValue(parameter: MbFunctionParameter) {
  if (parameter.values && parameter.values.length < parameter.maxLength!) {
    const previousValue = parameter.values[parameter.values.length - 1];
    parameter.values.push(previousValue + 1);
  }
}
</script>
