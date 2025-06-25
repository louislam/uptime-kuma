<template>
  <div class="offline-list shadow-box mb-4">
    <h3>🚨 Offline Devices</h3>

    <ul class="list-unstyled" v-if="offlineMonitors.length > 0">
      <li
        v-for="monitor in offlineMonitors"
        :key="monitor.id"
        class="flashing-red mb-2"
      >
        <router-link :to="`/dashboard/${monitor.id}`" class="text-danger">
          {{ monitor.name }}
        </router-link>
      </li>
    </ul>

    <div v-else>
      ✅ All devices online
    </div>
  </div>
</template>

<script>
export default {
  computed: {
    offlineMonitors() {
      const monitors = Object.values(this.$root.monitorList || {});
      const heartbeats = this.$root.lastHeartbeatList || {};

      return monitors
        .filter((monitor) => {
          const status = heartbeats[monitor.id]?.status;
          return status === 0;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  },
};
</script>

<style scoped>
.flashing-red {
  animation: flash 1.5s infinite;
  font-weight: bold;
}
@keyframes flash {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
</style>
