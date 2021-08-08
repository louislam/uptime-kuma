<template>
    <h1 class="my-3">
        {{ pageName }}
    </h1>
    <form @submit.prevent="submit">
        <div class="shadow-box">
            <div class="row">
                <div class="col-md-6">
                    <h2>General</h2>

                    <div class="my-3">
                        <label for="type" class="form-label">Monitor Type</label>
                        <select id="type" v-model="monitor.type" class="form-select" aria-label="Default select example">
                            <option value="http">
                                HTTP(s)
                            </option>
                            <option value="port">
                                TCP Port
                            </option>
                            <option value="ping">
                                Ping
                            </option>
                            <option value="keyword">
                                HTTP(s) - Keyword
                            </option>
                        </select>
                    </div>

                    <div class="my-3">
                        <label for="name" class="form-label">Friendly Name</label>
                        <input id="name" v-model="monitor.name" type="text" class="form-control" required>
                    </div>

                    <div v-if="monitor.type === 'http' || monitor.type === 'keyword' " class="my-3">
                        <label for="url" class="form-label">URL</label>
                        <input id="url" v-model="monitor.url" type="url" class="form-control" pattern="https?://.+" required>
                    </div>

                    <div v-if="monitor.type === 'keyword' " class="my-3">
                        <label for="keyword" class="form-label">Keyword</label>
                        <input id="keyword" v-model="monitor.keyword" type="text" class="form-control" required>
                        <div class="form-text">
                            Search keyword in plain html or JSON response and it is case-sensitive
                        </div>
                    </div>

                    <div v-if="monitor.type === 'port' || monitor.type === 'ping' " class="my-3">
                        <label for="hostname" class="form-label">Hostname</label>
                        <input id="hostname" v-model="monitor.hostname" type="text" class="form-control" required>
                    </div>

                    <div v-if="monitor.type === 'port' " class="my-3">
                        <label for="port" class="form-label">Port</label>
                        <input id="port" v-model="monitor.port" type="number" class="form-control" required min="0" max="65535" step="1">
                    </div>

                    <div class="my-3">
                        <label for="interval" class="form-label">Heartbeat Interval (Every {{ monitor.interval }} seconds)</label>
                        <input id="interval" v-model="monitor.interval" type="number" class="form-control" required min="20" step="1">
                    </div>

                    <div class="my-3">
                        <label for="maxRetries" class="form-label">Retries</label>
                        <input id="maxRetries" v-model="monitor.maxretries" type="number" class="form-control" required min="0" step="1">
                        <div class="form-text">
                            Maximum retries before the service is marked as down and a notification is sent
                        </div>
                    </div>

                    <h2 class="my-3">Advanced</h2>

                    <div v-if="monitor.type === 'http' || monitor.type === 'keyword' " class="my-3 form-check">
                        <input id="ignore-tls" v-model="monitor.ignoreTls" class="form-check-input" type="checkbox" value="">
                        <label class="form-check-label" for="ignore-tls">
                            Ignore TLS/SSL error for HTTPS websites
                        </label>
                    </div>

                    <div class="my-3 form-check">
                        <input id="upside-down" v-model="monitor.upsideDown" class="form-check-input" type="checkbox">
                        <label class="form-check-label" for="upside-down">
                            Upside Down Mode
                        </label>
                        <div class="form-text">
                            Flip the status upside down. If the service is reachable, it is DOWN.
                        </div>
                    </div>

                    <div class="my-3">
                        <label for="maxRedirects" class="form-label">Max. Redirects</label>
                        <input id="maxRedirects" v-model="monitor.maxredirects" type="number" class="form-control" required min="0" step="1">
                        <div class="form-text">
                            Maximum number of redirects to follow. Set to 0 to disable redirects.
                        </div>
                    </div>

                    <div class="my-3">
                        <label for="acceptedStatusCodes" class="form-label">Accepted Status Codes</label>

                        <VueMultiselect
                            id="acceptedStatusCodes"
                            v-model="monitor.accepted_statuscodes"
                            :options="acceptedStatusCodeOptions"
                            :multiple="true"
                            :close-on-select="false"
                            :clear-on-select="false"
                            :preserve-search="true"
                            placeholder="Pick Accepted Status Codes..."
                            :preselect-first="false"
                            :max-height="600"
                            :taggable="true"
                        ></VueMultiselect>

                        <div class="form-text">
                            Select status codes which are considered as a successful response.
                        </div>
                    </div>

                    <div>
                        <button class="btn btn-primary" type="submit" :disabled="processing">
                            Save
                        </button>
                    </div>
                </div>

                <div class="col-md-6">
                    <div v-if="$root.isMobile" class="mt-3" />

                    <h2>Notifications</h2>
                    <p v-if="$root.notificationList.length === 0">
                        Not available, please setup.
                    </p>

                    <div v-for="notification in $root.notificationList" :key="notification.id" class="form-check form-switch my-3">
                        <input :id=" 'notification' + notification.id" v-model="monitor.notificationIDList[notification.id]" class="form-check-input" type="checkbox">

                        <label class="form-check-label" :for=" 'notification' + notification.id">
                            {{ notification.name }}
                            <a href="#" @click="$refs.notificationDialog.show(notification.id)">Edit</a>
                        </label>
                    </div>

                    <button class="btn btn-primary me-2" type="button" @click="$refs.notificationDialog.show()">
                        Setup Notification
                    </button>
                </div>
            </div>
        </div>
    </form>

    <NotificationDialog ref="notificationDialog" />
</template>

<script>
import NotificationDialog from "../components/NotificationDialog.vue";
import { useToast } from "vue-toastification"
import VueMultiselect from "vue-multiselect"
const toast = useToast()

export default {
    components: {
        NotificationDialog,
        VueMultiselect,
    },

    data() {
        return {
            processing: false,
            monitor: {
                notificationIDList: {},
            },
            acceptedStatusCodeOptions: [],
        }
    },

    computed: {
        pageName() {
            return (this.isAdd) ? "Add New Monitor" : "Edit"
        },
        isAdd() {
            return this.$route.path === "/add";
        },
        isEdit() {
            return this.$route.path.startsWith("/edit");
        },
    },
    watch: {
        "$route.fullPath" () {
            this.init();
        },
    },
    mounted() {
        this.init();

        let acceptedStatusCodeOptions = [
            "100-199",
            "200-299",
            "300-399",
            "400-499",
            "500-599",
        ];

        for (let i = 100; i <= 999; i++) {
            acceptedStatusCodeOptions.push(i.toString());
        }

        this.acceptedStatusCodeOptions = acceptedStatusCodeOptions;
    },
    methods: {
        init() {
            if (this.isAdd) {
                console.log("??????")
                this.monitor = {
                    type: "http",
                    name: "",
                    url: "https://",
                    interval: 60,
                    maxretries: 0,
                    notificationIDList: {},
                    ignoreTls: false,
                    upsideDown: false,
                    maxredirects: 10,
                    accepted_statuscodes: ["200-299"],
                }
            } else if (this.isEdit) {
                this.$root.getSocket().emit("getMonitor", this.$route.params.id, (res) => {
                    if (res.ok) {
                        this.monitor = res.monitor;
                    } else {
                        toast.error(res.msg)
                    }
                })
            }

        },

        submit() {
            this.processing = true;

            if (this.isAdd) {
                this.$root.add(this.monitor, (res) => {
                    this.processing = false;

                    if (res.ok) {
                        toast.success(res.msg);
                        this.$router.push("/dashboard/" + res.monitorID)
                    } else {
                        toast.error(res.msg);
                    }

                })
            } else {
                this.$root.getSocket().emit("editMonitor", this.monitor, (res) => {
                    this.processing = false;
                    this.$root.toastRes(res)
                })
            }
        },
    },
}
</script>

<style src="vue-multiselect/dist/vue-multiselect.css"></style>

<style lang="scss">
    @import "../assets/vars.scss";

    .multiselect__tags {
        border-radius: 1.5rem;
        border: 1px solid #ced4da;
    }

    .multiselect--active .multiselect__tags {
        border-radius: 1rem;
    }

    .multiselect__option--highlight {
        background: $primary !important;
    }

    .multiselect__option--highlight::after {
        background: $primary !important;
    }

    .multiselect__tag {
        border-radius: 50rem;
        background: $primary !important;
    }

    .dark {
        .multiselect__tag {
            color: $dark-font-color2;
        }
    }
</style>

<style scoped>
    .shadow-box {
        padding: 20px;
    }
</style>
