<template>
  <el-container style="max-width: 800px; margin: 0 auto">
    <el-row
      :gutter="50"
      style="margin-left: -15px; margin-right: -15px"
    >
      <el-col
        v-for="link in links"
        :key="link.routeName"
        :span="8"
      >
        <el-card
          class="new-tab-button"
          shadow="hover"
          @click="changeTabComponent(link.routeName)"
        >
          <el-icon :size="50"> <component :is="link.icon" /></el-icon>
          <el-divider />
          <el-text size="large">{{ link.name }}</el-text>
        </el-card>
      </el-col>
    </el-row>
  </el-container>
</template>

<script setup lang="ts">
import {useTabsStore} from '/@/stores/useTabs';

const {changeTabComponent} = useTabsStore();

const links = [
  {name: 'Modbus Client', routeName: 'ModbusClient', icon: IconEpMouse},
  {name: 'Modbus Server', routeName: 'ModbusServer', icon: IconEpCpu},
  {name: 'Modbus Scanner', routeName: 'ModbusScanner', icon: IconEpSearch},
  {name: 'Register Scanner', routeName: 'RegisterScanner', icon: IconEpSearch},
  {name: 'Modbus Logger', routeName: 'ModbusLogger', icon: IconEpDocument},
  {name: 'Modbus Analyzer', routeName: 'ModbusAnalyzer', icon: IconEpDataAnalysis},
  {name: 'Danfoss Explorer', routeName: 'DanfossExplorer', icon: IconEpDataAnalysis},
];
</script>
<style lang="scss">
.new-tab-button {
  margin-bottom: 50px;
  text-align: center;
  cursor: pointer;

  // &:hover {
  //   background-color: #f5f7fa;
  // }
}
</style>
