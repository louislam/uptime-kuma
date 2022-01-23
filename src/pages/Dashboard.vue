<template>
    <div class="container-fluid">
        <div class="row">
            <div v-if="! $root.isMobile" class="col-12 col-md-5 col-xl-4">
                <div>
                    <router-link to="/add" class="btn btn-primary mb-3"><font-awesome-icon icon="plus" /> {{ $t("Add New Monitor") }}</router-link>
                    <router-link to="/addMaintenance" class="btn btn-primary mb-3 float-end"><font-awesome-icon icon="wrench" /> {{ $t("Add New Maintenance") }}</router-link>
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
        return {}
    },
}
</script>

<style lang="scss" scoped>
.container-fluid {
    width: 98%;
}
</style>
