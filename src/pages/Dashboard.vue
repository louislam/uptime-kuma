<template>
    <div class="container-fluid">
        <div class="row">
            <div v-if="! $root.isMobile" class="col-12 col-md-5 col-xl-4">
                <div class="dropdown dropdown-create">
                    <button class="btn btn-primary mb-3 dropdown-toggle" type="button" data-bs-toggle="dropdown">
                        <font-awesome-icon icon="plus" /> {{ $t("Create") }}
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li>
                            <button type="button" class="dropdown-item" @click="$router.push('/add')">
                                <font-awesome-icon icon="heartbeat" /> {{ $t("Monitor") }}
                            </button>
                        </li>
                        <li>
                            <button type="button" class="dropdown-item" @click="$router.push('/addMaintenance')">
                                <font-awesome-icon icon="exclamation-circle" /> {{ $t("Maintenance") }}
                            </button>
                        </li>
                    </ul>
                </div>
                <MonitorList :scrollbar="true" />
            </div>

            <div class="col-12 col-md-7 col-xl-8 mb-3">
                <!-- Add :key to disable vue router re-use the same component -->
                <router-view :key="$route.fullPath" />
            </div>
        </div>
    </div>
</template>

<script>

import MonitorList from "../components/MonitorList.vue";

export default {
    components: {
        MonitorList,
    },
    data() {
        return {};
    },
};
</script>

<style lang="scss" scoped>
.container-fluid {
    width: 98%;
}
</style>
