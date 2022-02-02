<template>
    <div v-if="loadedTheme" class="container mt-3">
        <!-- Logo & Title -->
        <h1 class="mb-4">
            <!-- Logo -->
            <span class="logo-wrapper" @click="showImageCropUploadMethod">
                <img :src="logoURL" alt class="logo me-2" :class="logoClass" />
                <font-awesome-icon v-if="enableEditMode" class="icon-upload" icon="upload" />
            </span>

            <!-- Uploader -->
            <!--    url="/api/status-page/upload-logo" -->
            <ImageCropUpload v-model="showImageCropUpload"
                             field="img"
                             :width="128"
                             :height="128"
                             :langType="$i18n.locale"
                             img-format="png"
                             :noCircle="true"
                             :noSquare="false"
                             @crop-success="cropSuccess"
            />

            <!-- Title -->
            <Editable v-model="config.title" tag="span" :contenteditable="editMode" :noNL="true" />
        </h1>

        <!-- Admin functions -->
        <div v-if="hasToken" class="mb-4">
            <div v-if="!enableEditMode">
                <button class="btn btn-info me-2" @click="edit">
                    <font-awesome-icon icon="edit" />
                    {{ $t("Edit Status Page") }}
                </button>

                <a href="/dashboard" class="btn btn-info">
                    <font-awesome-icon icon="tachometer-alt" />
                    {{ $t("Go to Dashboard") }}
                </a>
            </div>

            <div v-else>
                <button class="btn btn-success me-2" @click="save">
                    <font-awesome-icon icon="save" />
                    {{ $t("Save") }}
                </button>

                <button class="btn btn-danger me-2" @click="discard">
                    <font-awesome-icon icon="save" />
                    {{ $t("Discard") }}
                </button>

                <!--
                <button v-if="isPublished" class="btn btn-light me-2" @click="">
                    <font-awesome-icon icon="save" />
                    {{ $t("Unpublish") }}
                </button>

                <button v-if="!isPublished" class="btn btn-info me-2" @click="">
                    <font-awesome-icon icon="save" />
                    {{ $t("Publish") }}
                </button>-->

                <!-- Set Default Language -->
                <!-- Set theme -->
                <button v-if="theme == 'dark'" class="btn btn-light me-2" @click="changeTheme('light')">
                    <font-awesome-icon icon="save" />
                    {{ $t("Switch to Light Theme") }}
                </button>

                <button v-if="theme == 'light'" class="btn btn-dark me-2" @click="changeTheme('dark')">
                    <font-awesome-icon icon="save" />
                    {{ $t("Switch to Dark Theme") }}
                </button>

                <button class="btn btn-secondary me-2" @click="changeTagsVisibilty(!tagsVisible)">
                    <template v-if="tagsVisible">
                        <font-awesome-icon icon="eye-slash" />
                        {{ $t("Hide Tags") }}
                    </template>
                    <template v-else>
                        <font-awesome-icon icon="eye" />
                        {{ $t("Show Tags") }}
                    </template>
                </button>
            </div>
        </div>

        <!-- Incidents -->
        <template v-if="incidents.length">
        <div v-for="incident in sortedIncidentsList" class="shadow-box alert mb-4 p-4 incident mt-4 position-relative" role="alert">
            <div class="item">
                <div class="row">
                    <div class="col-1 col-md-1 d-flex justify-content-center align-items-center">
                        <font-awesome-icon v-if="incident.style === 'info'" icon="info-circle"
                                           class="incident-icon incident-bg-info"/>
                        <font-awesome-icon v-if="incident.style === 'warning'" icon="exclamation-triangle"
                                           class="incident-icon incident-bg-warning"/>
                        <font-awesome-icon v-if="incident.style === 'critical'" icon="exclamation-circle"
                                           class="incident-icon incident-bg-danger"/>
                    </div>
                    <div class="col-11 col-md-11">
                        <router-link :to="'/incident/' + incident.id">
                            <h4 class="alert-heading">{{ incident.title }}</h4>
                        </router-link>
                        <div class="content">{{ incident.description }}</div>

                        <!-- Incident Date -->
                        <div class="date mt-3">
                            {{ $t("Opened") }}: {{ $root.datetime(incident.createdDate) }} ({{
                                dateFromNow(incident.createdDate)
                            }})<br/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </template>

        <!-- Overall Status -->
        <div class="shadow-box list  p-4 overall-status mb-4">
            <div v-if="Object.keys($root.publicMonitorList).length === 0 && loadedData">
                <font-awesome-icon icon="question-circle" class="ok" />
                {{ $t("No Services") }}
            </div>

            <template v-else>
                <div v-if="allDown">
                    <font-awesome-icon icon="times-circle" class="danger" />
                    {{ $t("Degraded Service") }}
                </div>

                <div v-else-if="partialDown">
                    <font-awesome-icon icon="exclamation-circle" class="warning" />
                    {{ $t("Partially Degraded Service") }}
                </div>

                <div v-else-if="allUp">
                    <font-awesome-icon icon="check-circle" class="ok" />
                    {{ $t("All Systems Operational") }}
                </div>

                <div v-else>
                    <font-awesome-icon icon="question-circle" style="color: #efefef;" />
                </div>
            </template>
        </div>

        <!-- Description -->
        <strong v-if="editMode">{{ $t("Description") }}:</strong>
        <Editable v-model="config.description" :contenteditable="editMode" tag="div" class="mb-4 description" />

        <div v-if="editMode" class="mb-4">
            <div>
                <button class="btn btn-primary btn-add-group me-2" @click="addGroup">
                    <font-awesome-icon icon="plus" />
                    {{ $t("Add Group") }}
                </button>
            </div>

            <div class="mt-3">
                <div v-if="allMonitorList.length > 0 && loadedData">
                    <label>{{ $t("Add a monitor") }}:</label>
                    <select v-model="selectedMonitor" class="form-control">
                        <option v-for="monitor in allMonitorList" :key="monitor.id" :value="monitor">{{ monitor.name }}</option>
                    </select>
                </div>
                <div v-else class="text-center">
                    {{ $t("No monitors available.") }}  <router-link to="/addMonitor">{{ $t("Add one") }}</router-link>
                </div>
            </div>
        </div>

        <div class="mb-4">
            <div v-if="$root.publicGroupList.length === 0 && loadedData" class="text-center">
                <!-- 👀 Nothing here, please add a group or a monitor. -->
                👀 {{ $t("statusPageNothing") }}
            </div>

            <PublicGroupList :edit-mode="enableEditMode" />
        </div>

        <div class="mb-4">
            <PublicIncidentsList />
        </div>

        <footer class="mt-5 mb-4">
            {{ $t("Powered by") }} <a target="_blank" href="https://github.com/louislam/uptime-kuma">{{ $t("Uptime Kuma" ) }}</a>
        </footer>
    </div>
</template>

<script>
import axios from "axios";
import PublicGroupList from "../components/PublicGroupList.vue";
import PublicIncidentsList from "../components/PublicIncidentsList.vue";
import ImageCropUpload from "vue-image-crop-upload";
import { STATUS_PAGE_ALL_DOWN, STATUS_PAGE_ALL_UP, STATUS_PAGE_PARTIAL_DOWN, UP } from "../util.ts";
import { useToast } from "vue-toastification";
import dayjs from "dayjs";
const toast = useToast();

const leavePageMsg = "Do you really want to leave? you have unsaved changes!";

let feedInterval;

export default {
    components: {
        PublicGroupList,
        PublicIncidentsList,
        ImageCropUpload,
    },

    // Leave Page for vue route change
    beforeRouteLeave(to, from, next) {
        if (this.editMode) {
            const answer = window.confirm(leavePageMsg);
            if (answer) {
                next();
            } else {
                next(false);
            }
        }
        next();
    },

    data() {
        return {
            enableEditMode: false,
            hasToken: false,
            config: {},
            selectedMonitor: null,
            showImageCropUpload: false,
            imgDataUrl: "/icon.svg",
            loadedTheme: false,
            loadedData: false,
            baseURL: "",
            incidents: [],
            overrideStatus: {},
        };
    },
    computed: {
        sortedIncidentsList() {
            let result = Object.values(this.incidents).filter((incident) => !incident.resolved);
            
            result.sort((i1, i2) => {

                if (i1.style !== i2.style) {
                    if (i1.style === "critical") {
                        return -1;
                    }

                    if (i2.style === "critical") {
                        return 1;
                    }

                    if (i1.style === "warning") {
                        return -1;
                    }

                    if (i2.style === "warning") {
                        return 1;
                    }
                }
                else {
                    if (Date.parse(i1.createdDate) > Date.parse(i2.createdDate)) {
                        return -1;
                    }

                    if (Date.parse(i2.createdDate) < Date.parse(i1.createdDate)) {
                        return 1;
                    }
                }

                return i1.title.localeCompare(i2.title);
            });

            return result;
        },

        logoURL() {
            if (this.imgDataUrl.startsWith("data:")) {
                return this.imgDataUrl;
            } else {
                return this.baseURL + this.imgDataUrl;
            }
        },

        /**
         * If the monitor is added to public list, which will not be in this list.
         */
        allMonitorList() {
            let result = [];

            for (let id in this.$root.monitorList) {
                if (this.$root.monitorList[id] && ! (id in this.$root.publicMonitorList)) {
                    let monitor = this.$root.monitorList[id];
                    result.push(monitor);
                }
            }

            return result;
        },

        editMode() {
            return this.enableEditMode && this.$root.socket.connected;
        },

        isPublished() {
            return this.config.statusPagePublished;
        },

        theme() {
            return this.config.statusPageTheme;
        },

        tagsVisible() {
            return this.config.statusPageTags
        },

        logoClass() {
            if (this.editMode) {
                return {
                    "edit-mode": true,
                };
            }
            return {};
        },

        incidentClass() {
            return "bg-" + this.incident.style;
        },

        overallStatus() {

            if (Object.keys(this.$root.publicLastHeartbeatList).length === 0) {
                return -1;
            }

            let status = STATUS_PAGE_ALL_UP;
            let hasUp = false;

            for (let id in this.$root.publicLastHeartbeatList) {
                let beat = this.$root.publicLastHeartbeatList[id];

                if (beat.status === UP) {
                    hasUp = true;
                } else {
                    status = STATUS_PAGE_PARTIAL_DOWN;
                }
            }

            if (! hasUp) {
                status = STATUS_PAGE_ALL_DOWN;
            }

            return status;
        },

        allUp() {
            if (this.overrideStatus.override) {
                return this.overrideStatus.allUp;
            } else {
                return this.overallStatus === STATUS_PAGE_ALL_UP;
            }
        },

        partialDown() {
            if (this.overrideStatus.override) {
                return this.overrideStatus.partialDown;
            } else {
                return this.overallStatus === STATUS_PAGE_PARTIAL_DOWN;
            }
        },

        allDown() {
            if (this.overrideStatus.override) {
                return this.overrideStatus.allDown;
            } else {
                return this.overallStatus === STATUS_PAGE_ALL_DOWN;
            }
        },

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
        },

        // Set Theme
        "config.statusPageTheme"() {
            this.$root.statusPageTheme = this.config.statusPageTheme;
            this.loadedTheme = true;
        },

        "config.title"(title) {
            document.title = title;
        }

    },
    async created() {
        this.hasToken = ("token" in this.$root.storage());

        // Browser change page
        // https://stackoverflow.com/questions/7317273/warn-user-before-leaving-web-page-with-unsaved-changes
        window.addEventListener("beforeunload", (e) => {
            if (this.editMode) {
                (e || window.event).returnValue = leavePageMsg;
                return leavePageMsg;
            } else {
                return null;
            }
        });

        // Special handle for dev
        const env = process.env.NODE_ENV;
        if (env === "development" || localStorage.dev === "dev") {
            this.baseURL = location.protocol + "//" + location.hostname + ":3001";
        }
    },
    async mounted() {
        axios.get("/api/status-page/config").then((res) => {
            this.config = res.data;

            if (this.config.logo) {
                this.imgDataUrl = this.config.logo;
            }
        });

        axios.get("/api/status-page/incidents").then((res) => {
            if (res.data.ok) {
                this.incidents = res.data.incidents;
                this.$root.publicIncidentsList = res.data.incidents;

                this.overrideStatus = {
                    override: Object.values(this.incidents).filter((incident) => !incident.resolved && incident.overrideStatus).length !== 0,
                    allUp: Object.values(this.incidents).filter((incident) => !incident.resolved && incident.overrideStatus && incident.status === "operational").length !== 0,
                    partialDown: Object.values(this.incidents).filter((incident) => !incident.resolved && incident.overrideStatus && incident.status === "partial-outage").length !== 0,
                    allDown: Object.values(this.incidents).filter((incident) => !incident.resolved && incident.overrideStatus && incident.status === "full-outage").length !== 0,
                };
            }
        });

        axios.get("/api/status-page/monitor-list").then((res) => {
            this.$root.publicGroupList = res.data;
        });

        // 5mins a loop
        this.updateHeartbeatList();
        feedInterval = setInterval(() => {
            this.updateHeartbeatList();
        }, (300 + 10) * 1000);
    },
    methods: {

        updateHeartbeatList() {
            // If editMode, it will use the data from websocket.
            if (! this.editMode) {
                axios.get("/api/status-page/heartbeat").then((res) => {
                    this.$root.heartbeatList = res.data.heartbeatList;
                    this.$root.uptimeList = res.data.uptimeList;
                    this.loadedData = true;
                });
            }
        },

        edit() {
            this.$root.initSocketIO(true);
            this.enableEditMode = true;
        },

        save() {
            this.$root.getSocket().emit("saveStatusPage", this.config, this.imgDataUrl, this.$root.publicGroupList, (res) => {
                if (res.ok) {
                    this.enableEditMode = false;
                    this.$root.publicGroupList = res.publicGroupList;
                    location.reload();
                } else {
                    toast.error(res.msg);
                }
            });
        },

        monitorSelectorLabel(monitor) {
            return `${monitor.name}`;
        },

        addGroup() {
            let groupName = this.$t("Untitled Group");

            if (this.$root.publicGroupList.length === 0) {
                groupName = this.$t("Services");
            }

            this.$root.publicGroupList.unshift({
                name: groupName,
                monitorList: [],
            });
        },

        discard() {
            location.reload();
        },

        changeTheme(name) {
            this.config.statusPageTheme = name;
        },
        changeTagsVisibilty(newState) {
            this.config.statusPageTags = newState;

            // On load, the status page will not include tags if it's not enabled for security reasons
            // Which means if we enable tags, it won't show in the UI until saved
            // So we have this to enhance UX and load in the tags from the authenticated source instantly
            this.$root.publicGroupList = this.$root.publicGroupList.map((group) => {
                return {
                    ...group,
                    monitorList: group.monitorList.map((monitor) => {
                        // We only include the tags if visible so we can reuse the logic to hide the tags on disable
                        return {
                            ...monitor,
                            tags: newState ? this.$root.monitorList[monitor.id].tags : []
                        }
                    })
                }
            });
        },

        /**
         * Crop Success
         */
        cropSuccess(imgDataUrl) {
            this.imgDataUrl = imgDataUrl;
        },

        showImageCropUploadMethod() {
            if (this.editMode) {
                this.showImageCropUpload = true;
            }
        },

        /**
         * Click Edit Button
         */
        dateFromNow(date) {
            return dayjs.utc(date).fromNow();
        },

    }
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";
@import "../assets/timeline.scss";

.overall-status {
    font-weight: bold;
    font-size: 25px;

    .ok {
        color: $primary;
    }

    .warning {
        color: $warning;
    }

    .danger {
        color: $danger;
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

.description span {
    min-width: 50px;
}

.logo-wrapper {
    display: inline-block;
    position: relative;

    &:hover {
        .icon-upload {
            transform: scale(1.2);
        }
    }

    .icon-upload {
        transition: all $easing-in 0.2s;
        position: absolute;
        bottom: 6px;
        font-size: 20px;
        left: -14px;
        background-color: white;
        padding: 5px;
        border-radius: 10px;
        cursor: pointer;
        box-shadow: 0 15px 70px rgba(0, 0, 0, 0.9);
    }
}

.logo {
    transition: all $easing-in 0.2s;

    &.edit-mode {
        cursor: pointer;

        &:hover {
            transform: scale(1.2);
        }
    }
}

.mobile {
    h1 {
        font-size: 22px;
    }

    .overall-status {
        font-size: 20px;
    }
}

.incident.info {
    background-color: #0c4128;
}

.incident-bg-info {
    color: rgba(53, 162, 220, 0.52);
}

.incident-bg-warning {
    color: rgba(255, 165, 0, 0.52);
}

.incident-bg-danger {
    color: #dc354585;
}

.incident a {
    text-decoration: none;
}

.incident-icon {
    font-size: 30px;
    vertical-align: middle;
}

.dark .shadow-box {
    background-color: #0d1117;
}

</style>
