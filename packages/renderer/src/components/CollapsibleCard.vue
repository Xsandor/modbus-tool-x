<template>
  <el-card
    shadow="never"
    :class="hide ? 'hide-body' : ''"
  >
    <template #header>
      <div class="card-header">
        <span>{{ title }}</span>
        <el-button
          :size="'small'"
          @click="hide = !hide"
        >
          <el-icon>
            <i-ep-arrow-down v-if="!hide" />
            <i-ep-arrow-right v-else />
          </el-icon>
        </el-button>
      </div>
    </template>
    <slot></slot>
  </el-card>
</template>

<script lang="ts" setup>
defineProps({
  title: {
    type: String,
    default: 'Setup',
  },
});

const hide = ref(false);
</script>

<style lang="scss">
.el-card {
  .el-card__header {
    button {
      margin: -3px 0;
    }
  }

  &.hide-body {
    .el-card__header {
      border-bottom: none;
    }

    .el-card__body {
      display: none;
      visibility: hidden;
      padding: 0 var(--el-card-padding);
    }
  }
}
</style>
