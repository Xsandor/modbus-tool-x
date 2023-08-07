<template>
  <el-row
    v-if="list.length"
    :gutter="20"
  >
    <el-col
      v-for="item in list"
      :key="$.uid + '-' + item.id"
      :span="6"
      style="padding: 5px"
    >
      <div
        :class="getStatusClass(item.state)"
        class="status-item"
      >
        <h4 style="margin-top: 5px; margin-bottom: 3px">{{ item.id }}</h4>
        <span
          style="font-size: 0.8em"
          :title="item.errorMessage"
          >{{ item.stateText }}</span
        >
      </div>
    </el-col>
  </el-row>
  <!-- <el-empty
    v-else
    description="Nothing to see here yet"
  /> -->
</template>

<script lang="ts" setup>
defineProps({
  list: {
    type: Array as PropType<GenericObject[]>,
    required: true,
  },
});

const statusClasses = [
  'state-waiting', //'Waiting',
  'state-scanning', //'Scanning',
  'state-online', //'Online',
  'state-offline', //'Server offline',
  'state-warning', //'Server online but no response
];

function getStatusClass(state: number) {
  return statusClasses[state];
}
</script>

<style lang="scss">
.status-item {
  border-radius: 5px;
  padding: 1px 10px 5px 10px;
  color: #fff;

  &.state-waiting {
    background-color: rgb(124, 124, 124);
  }

  &.state-scanning {
    background-color: rgb(55, 147, 163);
  }

  &.state-online {
    background-color: rgb(45, 163, 45);
  }

  &.state-offline {
    background-color: rgb(160, 108, 108);
  }

  &.state-warning {
    background-color: rgb(180, 114, 38);
  }
}
</style>
