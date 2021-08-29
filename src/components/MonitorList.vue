<template>
    <div class="shadow-box list mb-3" :class="{ scrollbar: scrollbar }">
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

.list {
    &.scrollbar {
        height: calc(100vh - 20px);
        overflow-y: scroll;
        position: sticky;
        top: 10px;
    }

    .item {
        display: block;
        text-decoration: none;
        padding: 13px 15px 10px 15px;
        border-radius: 10px;
        transition: all ease-in-out 0.15s;

        &.disabled {
            opacity: 0.3;
        }

        .info {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        &:hover {
            background-color: $highlight-white;
        }

        &.active {
            background-color: #cdf8f4;
        }
    }
}

.dark {
    .list {
        .item {
            &:hover {
                background-color: $dark-bg2;
            }

            &.active {
                background-color: $dark-bg2;
            }
        }
    }
}

.monitorItem {
    width: 100%;
}
</style>
