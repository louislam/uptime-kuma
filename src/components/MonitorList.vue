<template>
    <div class="shadow-box monitor-list mb-3" :class="{ scrollbar: scrollbar }">
        <div v-if="Object.keys($root.monitorList).length === 0" class="text-center mt-3">
            {{ $t("No Monitors, please") }} <router-link to="/add">{{ $t("add one") }}</router-link>
        </div>

        <router-link v-for="(item, index) in sortedMonitorList" :key="index" :to="monitorURL(item.id)" class="item" :class="{ 'disabled': ! item.active }">
            <div class="row">
                <div class="col-6 col-md-8 small-padding" :class="{ 'monitorItem': $root.userHeartbeatBar == 'bottom' || $root.userHeartbeatBar == 'none' }">
                    <div class="info">
                        <Uptime :monitor="item" type="24" :pill="true" />
                        {{ item.name }}
                    </div>
                </div>
                <div v-show="$root.userHeartbeatBar == 'normal'" :key="$root.userHeartbeatBar" class="col-6 col-md-4">
                    <HeartbeatBar size="small" :monitor-id="item.id" />
                </div>
            </div>

            <div v-if="$root.userHeartbeatBar == 'bottom'" class="row">
                <div class="col-12">
                    <HeartbeatBar size="small" :monitor-id="item.id" />
                </div>
            </div>
        </router-link>
    </div>
</template>

<script>
import HeartbeatBar from "../components/HeartbeatBar.vue";
import Uptime from "../components/Uptime.vue";
export default {
    components: {
        Uptime,
        HeartbeatBar,
    },
    props: {
        scrollbar: {
            type: Boolean,
        },
    },
    computed: {
        sortedMonitorList() {
            let result = Object.values(this.$root.monitorList);

            result.sort((m1, m2) => {

                if (m1.active !== m2.active) {
                    if (m1.active === 0) {
                        return 1;
                    }

                    if (m2.active === 0) {
                        return -1;
                    }
                }

                if (m1.weight !== m2.weight) {
                    if (m1.weight > m2.weight) {
                        return -1;
                    }

                    if (m1.weight < m2.weight) {
                        return 1;
                    }
                }

                return m1.name.localeCompare(m2.name);
            })

            return result;
        },
    },
    methods: {
        monitorURL(id) {
            return "/dashboard/" + id;
        },
    },
}
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.small-padding {
    padding-left: 5px !important;
    padding-right: 5px !important;
}

.monitorItem {
    width: 100%;
}
</style>
