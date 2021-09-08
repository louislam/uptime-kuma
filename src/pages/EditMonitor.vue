<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">{{ pageName }}</h1>
            <form @submit.prevent="submit">
                <div class="shadow-box">
                    <div class="row">
                        <div class="col-md-6">
                            <h2 class="mb-2">{{ $t("General") }}</h2>

                            <div class="my-3">
                                <label for="type" class="form-label">{{ $t("Monitor Type") }}</label>
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
                                        HTTP(s) - {{ $t("Keyword") }}
                                    </option>
                                    <option value="dns">
                                        DNS
                                    </option>
                                </select>
                            </div>

                            <div class="my-3">
                                <label for="name" class="form-label">{{ $t("Friendly Name") }}</label>
                                <input id="name" v-model="monitor.name" type="text" class="form-control" required>
                            </div>

                            <div v-if="monitor.type === 'http' || monitor.type === 'keyword' " class="my-3">
                                <label for="url" class="form-label">{{ $t("URL") }}</label>
                                <input id="url" v-model="monitor.url" type="url" class="form-control" pattern="https?://.+" required>
                            </div>

                            <div v-if="monitor.type === 'keyword' " class="my-3">
                                <label for="keyword" class="form-label">{{ $t("Keyword") }}</label>
                                <input id="keyword" v-model="monitor.keyword" type="text" class="form-control" required>
                                <div class="form-text">
                                    {{ $t("keywordDescription") }}
                                </div>
                            </div>

                            <!-- TCP Port / Ping / DNS only -->
                            <div v-if="monitor.type === 'port' || monitor.type === 'ping' || monitor.type === 'dns' " class="my-3">
                                <label for="hostname" class="form-label">{{ $t("Hostname") }}</label>
                                <input id="hostname" v-model="monitor.hostname" type="text" class="form-control" required>
                            </div>

                            <!-- For TCP Port Type -->
                            <div v-if="monitor.type === 'port' " class="my-3">
                                <label for="port" class="form-label">{{ $t("Port") }}</label>
                                <input id="port" v-model="monitor.port" type="number" class="form-control" required min="0" max="65535" step="1">
                            </div>

                            <!-- For DNS Type -->
                            <template v-if="monitor.type === 'dns'">
                                <div class="my-3">
                                    <label for="dns_resolve_server" class="form-label">{{ $t("Resolver Server") }}</label>
                                    <input id="dns_resolve_server" v-model="monitor.dns_resolve_server" type="text" class="form-control" :pattern="ipRegex" required>
                                    <div class="form-text">
                                        {{ $t("resoverserverDescription") }}
                                    </div>
                                </div>

                                <div class="my-3">
                                    <label for="dns_resolve_type" class="form-label">{{ $t("Resource Record Type") }}</label>

                                    <!-- :allow-empty="false" is not working, set a default value instead https://github.com/shentao/vue-multiselect/issues/336   -->
                                    <VueMultiselect
                                        id="dns_resolve_type"
                                        v-model="monitor.dns_resolve_type"
                                        :options="dnsresolvetypeOptions"
                                        :multiple="false"
                                        :close-on-select="true"
                                        :clear-on-select="false"
                                        :preserve-search="false"
                                        placeholder="Pick a RR-Type..."
                                        :preselect-first="false"
                                        :max-height="500"
                                        :taggable="false"
                                    ></VueMultiselect>

                                    <div class="form-text">
                                        {{ $t("rrtypeDescription") }}
                                    </div>
                                </div>
                            </template>

                            <div class="my-3">
                                <label for="interval" class="form-label">{{ $t("Heartbeat Interval") }} ({{ $t("checkEverySecond", [ monitor.interval ]) }})</label>
                                <input id="interval" v-model="monitor.interval" type="number" class="form-control" required min="20" step="1">
                            </div>

                            <div class="my-3">
                                <label for="maxRetries" class="form-label">{{ $t("Retries") }}</label>
                                <input id="maxRetries" v-model="monitor.maxretries" type="number" class="form-control" required min="0" step="1">
                                <div class="form-text">
                                    {{ $t("retriesDescription") }}
                                </div>
                            </div>

                            <h2 class="mt-5 mb-2">{{ $t("Advanced") }}</h2>

                            <div v-if="monitor.type === 'http' || monitor.type === 'keyword' " class="my-3 form-check">
                                <input id="ignore-tls" v-model="monitor.ignoreTls" class="form-check-input" type="checkbox" value="">
                                <label class="form-check-label" for="ignore-tls">
                                    {{ $t("ignoreTLSError") }}
                                </label>
                            </div>

                            <div class="my-3 form-check">
                                <input id="upside-down" v-model="monitor.upsideDown" class="form-check-input" type="checkbox">
                                <label class="form-check-label" for="upside-down">
                                    {{ $t("Upside Down Mode") }}
                                </label>
                                <div class="form-text">
                                    {{ $t("upsideDownModeDescription") }}
                                </div>
                            </div>

                            <!-- HTTP / Keyword only -->
                            <template v-if="monitor.type === 'http' || monitor.type === 'keyword' ">
                                <div class="my-3">
                                    <label for="maxRedirects" class="form-label">{{ $t("Max. Redirects") }}</label>
                                    <input id="maxRedirects" v-model="monitor.maxredirects" type="number" class="form-control" required min="0" step="1">
                                    <div class="form-text">
                                        {{ $t("maxRedirectDescription") }}
                                    </div>
                                </div>

                                <div class="my-3">
                                    <label for="acceptedStatusCodes" class="form-label">{{ $t("Accepted Status Codes") }}</label>

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
                                        {{ $t("acceptedStatusCodesDescription") }}
                                    </div>
                                </div>
                            </template>

                            <div class="mt-5 mb-1">
                                <button class="btn btn-primary" type="submit" :disabled="processing">{{ $t("Save") }}</button>
                            </div>
                        </div>

                        <div class="col-md-6">
                            <div v-if="$root.isMobile" class="mt-3" />

                            <h2 class="mb-2">{{ $t("Notifications") }}</h2>
                            <p v-if="$root.notificationList.length === 0">
                                {{ $t("Not available, please setup.") }}
                            </p>

                            <div v-for="notification in $root.notificationList" :key="notification.id" class="form-check form-switch my-3">
                                <input :id=" 'notification' + notification.id" v-model="monitor.notificationIDList[notification.id]" class="form-check-input" type="checkbox">

                                <label class="form-check-label" :for=" 'notification' + notification.id">
                                    {{ notification.name }}
                                    <a href="#" @click="$refs.notificationDialog.show(notification.id)">{{ $t("Edit") }}</a>
                                </label>

                                <span v-if="notification.isDefault == true" class="badge bg-primary ms-2">Default</span>
                            </div>

                            <button class="btn btn-primary me-2" type="button" @click="$refs.notificationDialog.show()">
                                {{ $t("Setup Notification") }}
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            <NotificationDialog ref="notificationDialog" />
        </div>
    </transition>
</template>

<script>
import NotificationDialog from "../components/NotificationDialog.vue";
import { useToast } from "vue-toastification"
import VueMultiselect from "vue-multiselect"
import { isDev } from "../util.ts";
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
                // Do not add default value here, please check init() method
            },
            acceptedStatusCodeOptions: [],
            dnsresolvetypeOptions: [],

            // Source: https://digitalfortress.tech/tips/top-15-commonly-used-regex/
            ipRegexPattern: "((^\s*((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))\s*$)|(^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$))",
        }
    },

    computed: {

        ipRegex() {

            // Allow to test with simple dns server with port (127.0.0.1:5300)
            if (! isDev) {
                return this.ipRegexPattern;
            }
            return null;
        },

        pageName() {
            return this.$t((this.isAdd) ? "Add New Monitor" : "Edit");
        },
        isAdd() {
            return this.$route.path === "/add";
        },
        isEdit() {
            return this.$route.path.startsWith("/edit");
        },
    },
    watch: {
        "$route.fullPath"() {
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

        let dnsresolvetypeOptions = [
            "A",
            "AAAA",
            "CAA",
            "CNAME",
            "MX",
            "NS",
            "PTR",
            "SOA",
            "SRV",
            "TXT",
        ];

        for (let i = 100; i <= 999; i++) {
            acceptedStatusCodeOptions.push(i.toString());
        }

        this.acceptedStatusCodeOptions = acceptedStatusCodeOptions;
        this.dnsresolvetypeOptions = dnsresolvetypeOptions;
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
                    dns_resolve_type: "A",
                    dns_resolve_server: "1.1.1.1",
                }

                for (let i = 0; i < this.$root.notificationList.length; i++) {
                    if (this.$root.notificationList[i].isDefault == true) {
                        this.monitor.notificationIDList[this.$root.notificationList[i].id] = true;
                    }
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
