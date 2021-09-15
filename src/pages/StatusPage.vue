<template>
    <div class="container mt-3">
        <!-- Logo & Title -->
        <h1>
            <!-- Logo -->
            <img :src="imgDataUrl" alt class="logo me-2" :class="logoClass" @click="showImageCropUploadMethod" />

            <!-- Uploader -->
            <!--    url="/api/status-page/upload-logo" -->
            <ImageCropUpload v-model="showImageCropUpload"
                             field="img"
                             :width="128"
                             :height="128"
                             :langType="$i18n.locale"
                             :headers="uploadHeader"
                             img-format="png"
                             :noCircle="true"
                             :noSquare="false"
                             @crop-success="cropSuccess"
                             @crop-upload-success="cropUploadSuccess"
                             @crop-upload-fail="cropUploadFail"
            />

            <!-- Title -->
            <Editable v-model="config.title" tag="span" :contenteditable="editMode" :noNL="true" />
        </h1>

        <!-- Admin functions -->
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

                <button class="btn btn-danger me-2" @click="discard">
                    <font-awesome-icon icon="save" />
                    {{ $t("Discard") }}
                </button>

                <button class="btn btn-primary btn-add-group me-2" @click="">
                    <font-awesome-icon icon="bullhorn" />
                    {{ $t("Create Incident") }}
                </button>

                <button v-if="isPublished" class="btn btn-light me-2" @click="">
                    <font-awesome-icon icon="save" />
                    {{ $t("Unpublish") }}
                </button>

                <button v-if="!isPublished" class="btn btn-info me-2" @click="">
                    <font-awesome-icon icon="save" />
                    {{ $t("Publish") }}
                </button>

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
            </div>
        </div>

        <!-- Overall Status -->
        <div class="shadow-box list  p-4 overall-status mt-4">
            <div v-if="false">
                <font-awesome-icon icon="check-circle" class="ok" />
                All Systems Operational
            </div>
            <div v-if="false">
                <font-awesome-icon icon="exclamation-circle" class="warning" />
                Partially Degraded Service
            </div>
            <div>
                <font-awesome-icon icon="times-circle" class="danger" />
                Degraded Service
            </div>
        </div>

        <!-- Description -->
        <Editable v-model="config.description" :contenteditable="editMode" tag="div" class="mt-4 description" />

        <!-- Incident -->
        <div class="shadow-box alert alert-success mt-4 p-4" role="alert">
            <h4 class="alert-heading">Well done!</h4>
            <p>Aww yeah, you successfully read this important alert message. This example text is going to run a bit longer so that you can see how spacing within an alert works with this kind of content.</p>
            <hr>
            <p class="mb-0">Whenever you need to, be sure to use margin utilities to keep things nice and tidy.</p>

            <div class="mt-3">
                <button v-if="editMode" class="btn btn-light me-2">Unpin</button>
                <button v-if="editMode" class="btn btn-light">Edit</button>
            </div>
        </div>

        <div v-if="editMode" class="mt-4">
            <div>
                <button class="btn btn-primary btn-add-group me-2" @click="addGroup">
                    <font-awesome-icon icon="plus" />
                    Add Group
                </button>
            </div>

            <div class="mt-3">
                <VueMultiselect
                    v-model="selectedMonitor"
                    :options="allMonitorList"
                    :custom-label="monitorSelectorLabel"
                    :searchable="true"
                    placeholder="Add a monitor"
                ></VueMultiselect>
            </div>
        </div>

        <div class="mt-4">
            <div v-if="$root.publicGroupList.length === 0" class="text-center">
                👀 Nothing here, please add a group or a monitor.
            </div>

            <GroupList :edit-mode="enableEditMode" />
        </div>

        <footer class="mt-5 mb-4">
            Powered by <a target="_blank" href="https://github.com/louislam/uptime-kuma">Uptime Kuma</a>
        </footer>
    </div>
</template>

<script>
import VueMultiselect from "vue-multiselect"
import axios from "axios";
import GroupList from "../components/GroupList.vue";
import ImageCropUpload from "vue-image-crop-upload";

const leavePageMsg = "Do you really want to leave? you have unsaved changes!";

export default {
    components: {
        GroupList,
        VueMultiselect,
        ImageCropUpload
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
            incident: null,
            showImageCropUpload: false,
            imgDataUrl: "/icon.svg",
        }
    },
    computed: {

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

        uploadHeader() {
            return {
                Authorization: "Bearer " + localStorage.token,
            }
        },

        logoClass() {
            if (this.editMode) {
                return {
                    "edit-mode": true,
                }
            }
            return {};
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
        },

        // Set Theme
        "config.statusPageTheme"() {
            this.$root.statusPageTheme = this.config.statusPageTheme;
        }

    },
    async created() {
        this.hasToken = ("token" in localStorage);
        this.config = (await axios.get("/api/status-page/config")).data;

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
            let groupName = "Untitled Group";

            if (this.$root.publicGroupList.length === 0) {
                groupName = "Services";
            }

            this.$root.publicGroupList.push({
                name: groupName,
                monitorList: [],
            })
        },

        discard() {
            location.reload();
        },

        changeTheme(name) {
            this.config.statusPageTheme = name;
        },

        /**
         * Crop success
         */
        cropSuccess(imgDataUrl, field) {
            console.log("-------- crop success --------");
            this.imgDataUrl = imgDataUrl;
        },

        showImageCropUploadMethod() {
            if (this.editMode) {
                this.showImageCropUpload = true;
            }
        }
    }
}
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

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

.logo {
    transition: all $easing-in 0.2s;

    &.edit-mode {
        cursor: pointer;

        &:hover {
            transform: scale(1.2);
        }
    }
}

</style>
