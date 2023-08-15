<script lang="ts" setup>
import {network} from '#preload';
import logo from '../assets/Modbus Tool X.svg';
import {useModbusStore} from './components/useModbus';

// eslint-disable-next-line no-undef

const loading = ref(true);

const modbusStore = useModbusStore();

network.onInfo((_event, netInfo) => {
  console.log('Got network info!');
  console.log(netInfo);
  modbusStore.networkInfo = netInfo;
  loading.value = false;
});

network.getInfo();
</script>

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
            :default-active="$route.path"
          >
            <el-menu-item index="/">
              <el-icon>
                <i-ep-mouse />
              </el-icon>
              <span>Modbus Client</span>
            </el-menu-item>
            <el-menu-item index="/server">
              <el-icon>
                <i-ep-cpu />
              </el-icon>
              <span>Modbus Server</span>
            </el-menu-item>
            <el-menu-item index="/scanner">
              <el-icon>
                <i-ep-search />
              </el-icon>
              <span>Modbus Scanner</span>
            </el-menu-item>
            <el-menu-item index="/logger">
              <el-icon>
                <i-ep-document />
              </el-icon>
              <span>Modbus Logger</span>
            </el-menu-item>
            <el-menu-item index="/analyzer">
              <el-icon>
                <i-ep-data-analysis />
              </el-icon>
              <span>Modbus Analyzer</span>
            </el-menu-item>
            <!-- <el-menu-item index="/settings">
              <el-icon>
                <i-ep-setting />
              </el-icon>
              <span>Settings</span>
            </el-menu-item> -->
          </el-menu>
        </el-card>
      </el-aside>
      <el-container>
        <el-main>
          <el-scrollbar>
            <Suspense>
              <router-view
                v-if="!loading"
                v-slot="{Component}"
              >
                <keep-alive>
                  <component :is="Component" />
                </keep-alive>
              </router-view>
            </Suspense>
          </el-scrollbar>
        </el-main>
        <!-- <el-footer>Copyright © Alexander Schmidt, 2023</el-footer> -->
      </el-container>
    </el-container>
  </el-container>
</template>

<style lang="scss">
* {
  font-family: 'Helvetica Neue', Helvetica;
}

body {
  background-color: #fcfcfc;
  margin: 0;
  padding: 0;
}

.ml-1 {
  margin-left: 5px;
}

.ml-2 {
  margin-left: 10px;
}

.el-header {
  border-bottom: 1px solid #ddd;
}

.el-header,
.el-footer {
  /* background-color: #ddd; */
  text-align: center;
  line-height: 60px;
}

.el-aside {
  /* background-color: #eee; */
  padding: 10px 10px 20px 10px;
  margin-top: 10px;
  /* var(--el-main-padding) */

  > .el-card .el-card__body {
    padding: 0;
    padding-top: 10px;
    padding-bottom: 10px;
  }

  .el-menu {
    border-right: 0;
  }
}

.el-scrollbar__view > .el-row {
  margin-right: 0;
}

.el-main {
  max-height: calc(100vh - 60px);
  padding: 0;

  > .el-scrollbar:first-of-type {
    box-sizing: border-box;

    > .el-scrollbar__wrap > .el-scrollbar__view {
      padding: 20px 10px 10px 10px;
    }
  }
}

.box-card {
  margin-bottom: 15px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.el-form-item__content .el-input {
  max-width: 214px;
}
</style>
