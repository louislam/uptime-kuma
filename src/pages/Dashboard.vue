<template>
    <div class="container-fluid">
        <div class="row">
            <div v-if="! $root.isMobile" class="col-12 col-md-5 col-xl-4">
                <div>
                    <router-link to="/add" class="btn btn-primary mb-3"><font-awesome-icon icon="plus" /> {{ $t("Add New Monitor") }}</router-link>
                </div>
                <MonitorList />
            </div>

            <div class="col-12 col-md-7 col-xl-8">
                <router-view />
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
