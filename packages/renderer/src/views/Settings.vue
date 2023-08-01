<!-- eslint-disable vue/multi-word-component-names -->
<script lang="ts" setup>

const APP_VERSION = import.meta.env.VITE_APP_VERSION;
</script>

<template>
  <el-row :gutter="20">
    <el-col
      :span="24"
      :md="12"
      :lg="9"
      :xl="6"
    >
      <el-card
        header="Settings"
        class="box-card"
      >
        <p>
          <!-- Example how to inject current app version to UI -->
          App version: {{ APP_VERSION }}
        </p>
      </el-card>
    </el-col>
  </el-row>
</template> 