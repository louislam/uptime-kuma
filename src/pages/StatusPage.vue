<template>
    <div class="container mt-3">
        <h1><img src="/icon.svg" alt /> Uptime Kuma</h1>

        <div v-if="hasToken" class="mt-3" style="height: 38px;">
            <div v-if="!enableEditMode">
                <button class="btn btn-info me-2" @click="edit">
                    <font-awesome-icon icon="edit" />
                    Edit Status Page
                </button>

                <router-link to="/dashboard" class="btn btn-info">
                    <font-awesome-icon icon="tachometer-alt" />
                    Go to Dashboard
                </router-link>
            </div>

            <div v-else>
                <button class="btn btn-success me-2" @click="leaveEditMode">
                    <font-awesome-icon icon="save" />
                    {{ $t("Save") }}
                </button>

                <button class="btn btn-danger me-2" @click="">
                    <font-awesome-icon icon="save" />
                    {{ $t("Discard") }}
                </button>

                <!-- Set Default Language -->
                <!-- Set theme -->
            </div>
        </div>

        <div class="shadow-box list  p-4 overall-status mt-4">
            <font-awesome-icon icon="check-circle" class="ok" /> All Systems Operational
        </div>

        <div v-if="showEditFeature" class="row mt-4" style="height: 43px;">
            <div class="col-2">
                <button class="btn btn-primary btn-add-group" @click="addGroup">Add Group</button>
            </div>
            <div class="col-10">
                <div>
                    <VueMultiselect
                        v-model="selectedMonitor"
                        :options="allMonitorList"
                        :custom-label="monitorSelectorLabel"
                        :searchable="true"
                        placeholder="Add a monitor"
                    ></VueMultiselect>
                </div>
            </div>
        </div>

        <div>
            <GroupList :edit-mode="enableEditMode" />
        </div>

        <footer class="my-4">
            Powered by <a target="_blank" href="https://github.com/louislam/uptime-kuma">Uptime Kuma</a>
        </footer>
    </div>
</template>

<script>
import VueMultiselect from "vue-multiselect"
import axios from "axios";
import GroupList from "../components/GroupList.vue";

const env = process.env.NODE_ENV || "production";

// change the axios base url for development
if (env === "development" || localStorage.dev === "dev") {
    axios.defaults.baseURL = location.protocol + "//" + location.hostname + ":3001";
}

export default {
    components: {
        GroupList,
        VueMultiselect,
    },
    data() {
        return {
            enableEditMode: false,
            hasToken: false,
            config: {},
            monitorList: {},
            selectedMonitor: null,
        }
    },
    computed: {

        allMonitorList() {
            let result = [];

            for (let id in this.$root.monitorList) {
                if (this.$root.monitorList[id] && ! (id in this.monitorList)) {
                    let monitor = this.$root.monitorList[id];
                    result.push(monitor);
                }
            }

            return result;
        },
        showEditFeature() {
            return this.enableEditMode && this.$root.socket.connected;
        }
    },
    watch: {

        /**
         * Selected a monitor and add to the list.
         */
        selectedMonitor(monitor) {
            if (monitor) {
                if (this.$root.publicGroupList.length === 0) {
                    this.addGroup();
                }

                const firstGroup = this.$root.publicGroupList[0];

                firstGroup.monitorList.push(monitor);
                this.selectedMonitor = null;
            }
        }
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
            this.enableEditMode = true;
        },

        leaveEditMode() {
            this.enableEditMode = false;
        },

        monitorSelectorLabel(monitor) {
            return `${monitor.name}`;
        },

        addGroup() {
            this.$root.publicGroupList.push({
                name: "Untitled Group",
                monitorList: [],
            })
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

.btn-add-group {
    height: 100%;
    width: 100%;
}
</style>
