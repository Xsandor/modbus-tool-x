<script lang="ts" setup>
  import { network } from '#preload';
  import logo from '../assets/Modbus Tool X.svg';
  import { networkInfoKey } from '/@/helpers/injectionKeys';

  // eslint-disable-next-line no-undef
  const networkInfo = ref();

  // eslint-disable-next-line no-undef
  provide(networkInfoKey, networkInfo);

  network.onInfo((_event, netInfo) => {
    console.log('Got network info!');
    console.log(netInfo);
    networkInfo.value = netInfo;
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
            :default-active="$route.path || '/'"
          >
            <el-menu-item index="/">
              <el-icon>
                <i-ep-mouse />
              </el-icon>
              <span>Modbus Client</span>
            </el-menu-item>
            <el-menu-item
              index="/server"
              :disabled="true"
            >
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
              <router-view></router-view>
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
  font-family: "Helvetica Neue", Helvetica;
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
  padding-top: 20px;
  /* var(--el-main-padding) */

  .el-menu {
    border-right: 0;
  }
}

.el-scrollbar__view > .el-row {
  margin-right: 0;
}

.el-main {
  max-height: calc(100vh - 60px - 20px - 8px);
  padding: 0px;

  > .el-scrollbar {
    box-sizing: border-box;
    padding: 20px;
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
</style>
