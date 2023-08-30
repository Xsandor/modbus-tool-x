<template>
  <el-card :header="`Logs (${log.length})`">
    <div
      v-if="log.length"
      class="log-container"
    >
      <span
        v-for="(logRow, index) in log"
        :key="'result-' + index"
        :class="logRow.type"
        >{{ logRow.text }}</span
      >
    </div>
    <el-text v-else>No log entries yet..</el-text>
  </el-card>
</template>

<script setup lang="ts">
defineProps({
  log: {
    type: Array as PropType<ScanLogItem[]>,
    default: () => [],
  },
});
</script>

<style lang="scss">
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
