<template>

    <div v-if="$route.name === 'DashboardHome'">
        <h1 class="mb-3">Quick Stats</h1>

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
            <div class="row" v-if="false">
                <div class="col-3">
                    <h3>Uptime</h3>
                    <p>(24-hour)</p>
                    <span class="num"></span>
                </div>
                <div class="col-3">
                    <h3>Uptime</h3>
                    <p>(30-day)</p>
                    <span class="num"></span>
                </div>
            </div>
        </div>

        <div class="shadow-box" style="margin-top: 25px;">
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
                <tr v-for="beat in importantHeartBeatList">
                    <td>{{ beat.name }}</td>
                    <td><Status :status="beat.status" /></td>
                    <td><Datetime :value="beat.time" /></td>
                    <td>{{ beat.msg }}</td>
                </tr>

                <tr v-if="importantHeartBeatList.length === 0">
                    <td colspan="4">No important events</td>
                </tr>
                </tbody>
            </table>
        </div>
    </div>

    <router-view ref="child" />
</template>

<script>
import Status from "../components/Status.vue";
import Datetime from "../components/Datetime.vue";
export default {
    components: {Datetime, Status},
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
                let list =  this.$root.importantHeartbeatList[monitorID]
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
                } else if (a.time < b.time) {
                    return 1;
                } else {
                    return 0;
                }
            });

            return result;
        }
    }
}
</script>

<style scoped lang="scss">
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
</style>
