<template>
    <div class="container-fluid">
        <div class="row">
            <div v-if="!$root.isMobile" class="col-12 col-md-5 col-xl-4">
                <div class="row flex">
                    <div class="col-6">
                        <router-link to="/add" class="col-12 btn btn-primary mb-3"><font-awesome-icon icon="plus" /> {{ $t("Add New Monitor") }}</router-link>
                    </div>
                <div class="col-6">
                    <select v-model="monitorStatusFilter" class="form-control col-12 form-select" >
                        <option  disabled selected value="null">{{ $t("Filter by Status") }}</option>
                        <option :value="-1">{{ $t("All") }}</option>
                        <option :value="0">{{ $t("Down") }}</option>
                        <option :value="1">{{ $t("Up") }}</option>
                    </select>
                </div>
                </div>
                <MonitorList :scrollbar="true" />
            </div>

            <div class="col-12 col-md-7 col-xl-8 mb-3">
                <!-- Add :key to disable vue router re-use the same component -->
                <router-view :key="$route.fullPath" :monitorStatusFilter="monitorStatusFilter" />
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
        return {
            monitorStatusFilter: null,
        };
    },
};
</script>

<style lang="scss" scoped>
.container-fluid {
    width: 98%;
}
</style>
