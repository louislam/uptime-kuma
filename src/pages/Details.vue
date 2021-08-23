<template>
    <transition name="slide-fade" appear>
        <div v-if="monitor">
            <h1> {{ monitor.name }}</h1>
            <p class="url">
                <a v-if="monitor.type === 'http' || monitor.type === 'keyword' " :href="monitor.url" target="_blank">{{ monitor.url }}</a>
                <span v-if="monitor.type === 'port'">TCP Ping {{ monitor.hostname }}:{{ monitor.port }}</span>
                <span v-if="monitor.type === 'ping'">Ping: {{ monitor.hostname }}</span>
                <span v-if="monitor.type === 'keyword'">
                    <br>
                    <span>Keyword:</span> <span class="keyword">{{ monitor.keyword }}</span>
                </span>
            </p>

            <div class="functions">
                <button v-if="monitor.active" class="btn btn-light" @click="pauseDialog">
                    <font-awesome-icon icon="pause" /> Pause
                </button>
                <button v-if="! monitor.active" class="btn btn-primary" @click="resumeMonitor">
                    <font-awesome-icon icon="play" /> Resume
                </button>
                <router-link :to=" '/edit/' + monitor.id " class="btn btn-secondary">
                    <font-awesome-icon icon="edit" /> Edit
                </router-link>
                <button class="btn btn-danger" @click="deleteDialog">
                    <font-awesome-icon icon="trash" /> Delete
                </button>
            </div>

            <div class="shadow-box">
                <div class="row">
                    <div class="col-md-8">
                        <HeartbeatBar :monitor-id="monitor.id" />
                        <span class="word">Check every {{ monitor.interval }} seconds.</span>
                    </div>
                    <div class="col-md-4 text-center">
                        <span class="badge rounded-pill" :class=" 'bg-' + status.color " style="font-size: 30px">{{ status.text }}</span>
                    </div>
                </div>
            </div>

            <div class="shadow-box big-padding text-center stats">
                <div class="row">
                    <div class="col">
                        <h4>{{ pingTitle }}</h4>
                        <p>(Current)</p>
                        <span class="num">
                            <a href="#" @click.prevent="showPingChartBox = !showPingChartBox">
                                <CountUp :value="ping" />
                            </a>
                        </span>
                    </div>
                    <div class="col">
                        <h4>Avg. {{ pingTitle }}</h4>
                        <p>(24-hour)</p>
                        <span class="num"><CountUp :value="avgPing" /></span>
                    </div>
                    <div class="col">
                        <h4>Uptime</h4>
                        <p>(24-hour)</p>
                        <span class="num"><Uptime :monitor="monitor" type="24" /></span>
                    </div>
                    <div class="col">
                        <h4>Uptime</h4>
                        <p>(30-day)</p>
                        <span class="num"><Uptime :monitor="monitor" type="720" /></span>
                    </div>

                    <div v-if="certInfo" class="col">
                        <h4>Cert Exp.</h4>
                        <p>(<Datetime :value="certInfo.validTo" date-only />)</p>
                        <span class="num">
                            <a href="#" @click.prevent="toggleCertInfoBox = !toggleCertInfoBox">{{ certInfo.daysRemaining }} days</a>
                        </span>
                    </div>
                </div>
            </div>

            <transition name="slide-fade" appear>
                <div v-if="showCertInfoBox" class="shadow-box big-padding text-center">
                    <div class="row">
                        <div class="col">
                            <h4>Certificate Info</h4>
                            <table class="text-start">
                                <tbody>
                                    <tr class="my-3">
                                        <td class="px-3">
                                            Valid:
                                        </td>
                                        <td>{{ certInfo.valid }}</td>
                                    </tr>
                                    <tr class="my-3">
                                        <td class="px-3">
                                            Valid To:
                                        </td>
                                        <td><Datetime :value="certInfo.validTo" /></td>
                                    </tr>
                                    <tr class="my-3">
                                        <td class="px-3">
                                            Days Remaining:
                                        </td>
                                        <td>{{ certInfo.daysRemaining }}</td>
                                    </tr>
                                    <tr class="my-3">
                                        <td class="px-3">
                                            Issuer:
                                        </td>
                                        <td>{{ certInfo.issuer }}</td>
                                    </tr>
                                    <tr class="my-3">
                                        <td class="px-3">
                                            Fingerprint:
                                        </td>
                                        <td>{{ certInfo.fingerprint }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </transition>

            <div v-if="showPingChartBox" class="shadow-box big-padding text-center ping-chart-wrapper">
                <div class="row">
                    <div class="col">
                        <PingChart :monitor-id="monitor.id" />
                    </div>
                </div>
            </div>

            <div class="shadow-box table-shadow-box">
                <table class="table table-borderless table-hover">
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>DateTime</th>
                            <th>Message</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(beat, index) in displayedRecords" :key="index" :class="{ 'shadow-box': $root.windowWidth <= 550}" style="padding: 10px;">
                            <td><Status :status="beat.status" /></td>
                            <td :class="{ 'border-0':! beat.msg}"><Datetime :value="beat.time" /></td>
                            <td class="border-0">{{ beat.msg }}</td>
                        </tr>

                        <tr v-if="importantHeartBeatList.length === 0">
                            <td colspan="3">
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

            <Confirm ref="confirmPause" @yes="pauseMonitor">
                Are you sure want to pause?
            </Confirm>

            <Confirm ref="confirmDelete" btn-style="btn-danger" @yes="deleteMonitor">
                Are you sure want to delete this monitor?
            </Confirm>
        </div>
    </transition>
</template>

<script>
import { defineAsyncComponent } from "vue";
import { useToast } from "vue-toastification"
const toast = useToast()
import Confirm from "../components/Confirm.vue";
import HeartbeatBar from "../components/HeartbeatBar.vue";
import Status from "../components/Status.vue";
import Datetime from "../components/Datetime.vue";
import CountUp from "../components/CountUp.vue";
import Uptime from "../components/Uptime.vue";
import Pagination from "v-pagination-3";
const PingChart = defineAsyncComponent(() => import("../components/PingChart.vue"));

export default {
    components: {
        Uptime,
        CountUp,
        Datetime,
        HeartbeatBar,
        Confirm,
        Status,
        Pagination,
        PingChart,
    },
    data() {
        return {
            page: 1,
            perPage: 25,
            heartBeatList: [],
            toggleCertInfoBox: false,
            showPingChartBox: true,
        }
    },
    computed: {

        pingTitle() {
            if (this.monitor.type === "http") {
                return "Response"
            }

            return "Ping"
        },

        monitor() {
            let id = this.$route.params.id
            return this.$root.monitorList[id];
        },

        lastHeartBeat() {
            if (this.monitor.id in this.$root.lastHeartbeatList && this.$root.lastHeartbeatList[this.monitor.id]) {
                return this.$root.lastHeartbeatList[this.monitor.id]
            }

            return {
                status: -1,
            }
        },

        ping() {
            if (this.lastHeartBeat.ping || this.lastHeartBeat.ping === 0) {
                return this.lastHeartBeat.ping;
            }

            return "N/A"
        },

        avgPing() {
            if (this.$root.avgPingList[this.monitor.id] || this.$root.avgPingList[this.monitor.id] === 0) {
                return this.$root.avgPingList[this.monitor.id];
            }

            return "N/A"
        },

        importantHeartBeatList() {
            if (this.$root.importantHeartbeatList[this.monitor.id]) {
                this.heartBeatList = this.$root.importantHeartbeatList[this.monitor.id];
                return this.$root.importantHeartbeatList[this.monitor.id]
            }

            return [];
        },

        status() {
            if (this.$root.statusList[this.monitor.id]) {
                return this.$root.statusList[this.monitor.id]
            }

            return { }
        },

        certInfo() {
            if (this.$root.certInfoList[this.monitor.id]) {
                return this.$root.certInfoList[this.monitor.id]
            }

            return null
        },

        showCertInfoBox() {
            return this.certInfo != null && this.toggleCertInfoBox;
        },

        displayedRecords() {
            const startIndex = this.perPage * (this.page - 1);
            const endIndex = startIndex + this.perPage;
            return this.heartBeatList.slice(startIndex, endIndex);
        },
    },
    mounted() {

    },
    methods: {
        testNotification() {
            this.$root.getSocket().emit("testNotification", this.monitor.id)
            toast.success("Test notification is requested.")
        },

        pauseDialog() {
            this.$refs.confirmPause.show();
        },

        resumeMonitor() {
            this.$root.getSocket().emit("resumeMonitor", this.monitor.id, (res) => {
                this.$root.toastRes(res)
            })
        },

        pauseMonitor() {
            this.$root.getSocket().emit("pauseMonitor", this.monitor.id, (res) => {
                this.$root.toastRes(res)
            })
        },

        deleteDialog() {
            this.$refs.confirmDelete.show();
        },

        deleteMonitor() {
            this.$root.deleteMonitor(this.monitor.id, (res) => {
                if (res.ok) {
                    toast.success(res.msg);
                    this.$router.push("/dashboard")
                } else {
                    toast.error(res.msg);
                }
            })
        },

    },
}
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

@media (max-width: 767px) {
    .badge {
        margin-top: 14px;
    }
}

@media (max-width: 550px) {
    .functions {
        text-align: center;
    }

    button, a {
        margin-left: 10px !important;
        margin-right: 10px !important;
    }

    .ping-chart-wrapper {
        padding: 10px !important;
    }
}

@media (max-width: 400px) {
    .btn {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        padding-top: 10px;
    }

    a.btn {
        padding-left: 25px;
        padding-right: 25px;
    }
}

.url {
    color: $primary;
    margin-bottom: 20px;
    font-weight: bold;

    a {
        color: $primary;
    }
}

.functions {
    button, a {
        margin-right: 20px;
    }
}

.shadow-box {
    padding: 20px;
    margin-top: 25px;
}

.word {
    color: #AAA;
    font-size: 14px;
}

table {
    font-size: 14px;

    tr {
        transition: all ease-in-out 0.2ms;
    }
}

.stats p {
    font-size: 13px;
    color: #AAA;
}

.stats {
    padding: 10px;

    .col {
        margin: 20px 0;
    }
}

.keyword {
    color: black;
}

.dark  {
    .keyword {
        color: $dark-font-color;
    }
}
</style>
