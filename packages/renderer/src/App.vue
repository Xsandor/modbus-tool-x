<template>
  <el-container>
    <el-header>
      <!-- <span style="font-size: 1.5em; font-weight: bold;">Modbus Tool X</span> -->
      <img
        height="45"
        :src="logo"
      />
    </el-header>
    <el-container>
      <el-aside width="230px">
        <el-card header="Navigation">
          <el-menu
            class="el-menu-vertical-demo"
            :router="true"
            :default-active="$route.name?.toString()"
          >
            <el-menu-item
              v-for="link of links"
              :key="link.routeName"
              :index="link.routeName"
            >
              <el-icon>
                <component :is="link.icon" />
              </el-icon>
              <span>{{ link.name }}</span>
            </el-menu-item>
          </el-menu>
        </el-card>
      </el-aside>
      <el-container>
        <el-main>
          <el-scrollbar>
            <Suspense>
              <router-view
                v-if="!loading"
                v-slot="{Component, route}"
              >
                <Transition
                  name="el-fade-in-linear"
                  appear
                  mode="out-in"
                >
                  <div :key="route.name || 'undefined'">
                    <keep-alive>
                      <component :is="Component" />
                    </keep-alive>
                  </div>
                </Transition>
              </router-view>
            </Suspense>
          </el-scrollbar>
        </el-main>
        <!-- <el-footer>Copyright © Alexander Schmidt, 2023</el-footer> -->
      </el-container>
    </el-container>
  </el-container>
</template>

<script lang="ts" setup>
import {network} from '#preload';
import logo from '../assets/Modbus Tool X.svg';
import {useModbusStore} from '/@/stores/useModbus';

// eslint-disable-next-line no-undef

const loading = ref(true);

const modbusStore = useModbusStore();

const links = [
  {name: 'Modbus Client', routeName: 'ModbusClient', icon: IconEpMouse},
  {name: 'Modbus Server', routeName: 'ModbusServer', icon: IconEpCpu},
  {name: 'Modbus Scanner', routeName: 'ModbusScanner', icon: IconEpSearch},
  {name: 'Register Scanner', routeName: 'RegisterScanner', icon: IconEpSearch},
  {name: 'Modbus Logger', routeName: 'ModbusLogger', icon: IconEpDocument},
  {name: 'Modbus Analyzer', routeName: 'ModbusAnalyzer', icon: IconEpDataAnalysis},
  {name: 'Danfoss Explorer', routeName: 'DanfossExplorer', icon: IconEpDataAnalysis},
];

network.onInfo((_event, netInfo) => {
  console.log('Got network info!');
  console.log(netInfo);
  modbusStore.networkInfo = netInfo;
  loading.value = false;
});

network.getInfo();
</script>

<style lang="scss">
@import url('./style/index.scss');
</style>
