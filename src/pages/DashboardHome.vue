<template>
    <transition name="slide-fade" appear>
        <div v-if="$route.name === 'DashboardHome'">
            <h1 class="mb-3">
                Quick Stats
            </h1>

            <div class="shadow-box big-padding text-center">
                <div class="row">
                    <div class="col">
                        <h3>Up</h3>
                        <span class="num">{{ stats.up }}</span>
                    </div>
                    <div class="col">
                        <h3>Down</h3>
                        <span class="num text-danger">{{ stats.down }}</span>
                    </div>
                    <div class="col">
                        <h3>Unknown</h3>
                        <span class="num text-secondary">{{ stats.unknown }}</span>
                    </div>
                    <div class="col">
                        <h3>Pause</h3>
                        <span class="num text-secondary">{{ stats.pause }}</span>
                    </div>
                </div>
                <div v-if="false" class="row">
                    <div class="col-3">
                        <h3>Uptime</h3>
                        <p>(24-hour)</p>
                        <span class="num" />
                    </div>
                    <div class="col-3">
                        <h3>Uptime</h3>
                        <p>(30-day)</p>
                        <span class="num" />
                    </div>
                </div>
            </div>

            <div class="shadow-box" style="margin-top: 25px;overflow-x: scroll">
                <table class="table table-borderless table-hover">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Status</th>
                            <th>DateTime</th>
                            <th>Message</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(beat, index) in displayedRecords" :key="index" :class="{ 'shadow-box': $root.windowWidth <= 550}">
                            <td>{{ beat.name }}</td>
                            <td><Status :status="beat.status" /></td>
                            <td :class="{ 'border-0':! beat.msg}"><Datetime :value="beat.time" /></td>
                            <td class="border-0">{{ beat.msg }}</td>
                        </tr>

                        <tr v-if="importantHeartBeatList.length === 0">
                            <td colspan="4">
                                No important events
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div class="d-flex justify-content-center kuma_pagination">
                    <pagination
                        v-model="page"
                        :records="importantHeartBeatList.length"
                        :per-page="perPage"
                    />
                </div>
            </div>
        </div>
    </transition>
    <router-view ref="child" />
</template>

<script>
import Status from "../components/Status.vue";
import Datetime from "../components/Datetime.vue";
import Pagination from "v-pagination-3";

export default {
    components: {
        Datetime,
        Status,
        Pagination,
    },
    data() {
        return {
            page: 1,
            perPage: 25,
            heartBeatList: [],
        }
    },
    computed: {
        stats() {
            let result = {
                up: 0,
                down: 0,
                unknown: 0,
                pause: 0,
            };

            for (let monitorID in this.$root.monitorList) {
                let beat = this.$root.lastHeartbeatList[monitorID];
                let monitor = this.$root.monitorList[monitorID]

                if (monitor && ! monitor.active) {
                    result.pause++;
                } else if (beat) {
                    if (beat.status === 1) {
                        result.up++;
                    } else if (beat.status === 0) {
                        result.down++;
                    } else if (beat.status === 2) {
                        result.up++;
                    } else {
                        result.unknown++;
                    }
                } else {
                    result.unknown++;
                }
            }

            return result;
        },

        importantHeartBeatList() {
            let result = [];

            for (let monitorID in this.$root.importantHeartbeatList) {
                let list = this.$root.importantHeartbeatList[monitorID]
                result = result.concat(list);
            }

            for (let beat of result) {
                let monitor = this.$root.monitorList[beat.monitorID];

                if (monitor) {
                    beat.name = monitor.name
                }
            }

            result.sort((a, b) => {
                if (a.time > b.time) {
                    return -1;
                }

                if (a.time < b.time) {
                    return 1;
                }

                return 0;
            });

            this.heartBeatList = result;

            return result;
        },

        displayedRecords() {
            const startIndex = this.perPage * (this.page - 1);
            const endIndex = startIndex + this.perPage;
            return this.heartBeatList.slice(startIndex, endIndex);
        },
    },
}
</script>

<style lang="scss" scoped>
@import "../assets/vars";

.num {
    font-size: 30px;
    color: $primary;
    font-weight: bold;
    display: block;
}

.shadow-box {
    padding: 20px;
}

table {
    font-size: 14px;

    tr {
        transition: all ease-in-out 0.2ms;
    }
}

@media (max-width: 550px) {
    tr.shadow-box, .shadow-box:last-child {
        padding: 10px;
    }

    thead {
        display: none;
    }
  
    tr {
        display: block;
        margin-bottom: 10px;
    }
  
    td {
        border-bottom: 1px solid $dark-font-color;
        display: block;
        padding: 6px;
    }
}
</style>
