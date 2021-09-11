<template>
    <div class="container mt-3">
        <h1><img src="/icon.svg" alt /> Uptime Kuma</h1>

        <div v-if="hasToken" class="mt-3">
            <button class="btn btn-info me-2" @click="edit">
                <font-awesome-icon icon="edit" />
                Edit Status Page
            </button>

            <router-link to="/dashboard" class="btn btn-info">
                <font-awesome-icon icon="tachometer-alt" />
                Go to Dashboard
            </router-link>
        </div>

        <div class="shadow-box list mt-4 p-4 overall-status">
            <font-awesome-icon icon="check-circle" class="ok" /> All Systems Operational
        </div>

        <div class="shadow-box monitor-list mt-4">
            <div v-if="Object.keys(monitorList).length === 0" class="text-center my-3">
                {{ $t("No Monitors") }}
            </div>

            <div v-for="(item, index) in monitorList" :key="index" class="item">
                <div class="row">
                    <div class="col-6 col-md-8 small-padding">
                        <div class="info">
                            <Uptime :monitor="item" type="24" :pill="true" />
                            {{ item.name }}
                        </div>
                    </div>
                    <div :key="$root.userHeartbeatBar" class="col-6 col-md-4">
                        <HeartbeatBar size="small" :monitor-id="item.id" />
                    </div>
                </div>
            </div>
        </div>

        <footer class="mt-4">
            Powered by <a target="_blank" href="https://github.com/louislam/uptime-kuma">Uptime Kuma</a>
        </footer>
    </div>
</template>

<script>
import { useToast } from "vue-toastification";
const toast = useToast();

import axios from "axios";
import HeartbeatBar from "../components/HeartbeatBar.vue";
import Uptime from "../components/Uptime.vue";

const env = process.env.NODE_ENV || "production";

// change the axios base url for development
if (env === "development" || localStorage.dev === "dev") {
    axios.defaults.baseURL = location.protocol + "//" + location.hostname + ":3001";
}

export default {
    components: {
        HeartbeatBar,
        Uptime,
    },
    data() {
        return {
            hasToken: false,
            config: {},
            monitorList: {},
        }
    },
    computed: {

    },
    watch: {

    },
    async created() {
        this.hasToken = ("token" in localStorage);
        this.config = (await axios.get("/api/status-page/config")).data;

        // Set Theme
        this.$root.statusPageTheme = this.config.statusPageTheme;
    },
    async mounted() {
        this.monitorList = (await axios.get("/api/status-page/monitor-list")).data;
    },
    methods: {
        edit() {
            this.$root.initSocketIO(true);
        }
    },
}
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.overall-status {
    font-weight: bold;
    font-size: 20px;

    .ok {
        color: $primary;
    }
}

h1 {
    font-size: 30px;

    img {
        vertical-align: middle;
        height: 60px;
        width: 60px;
    }
}

footer {
    text-align: center;
    font-size: 14px;
}
</style>
