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
                                <select id="type" v-model="monitor.type" class="form-select">
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
                                    <option value="push">
                                        Push
                                    </option>
                                    <option value="steam">
                                        Steam Game Server
                                    </option>
                                    <option value="mqtt">
                                        MQTT
                                    </option>
                                </select>
                            </div>

                            <!-- Friendly Name -->
                            <div class="my-3">
                                <label for="name" class="form-label">{{ $t("Friendly Name") }}</label>
                                <input id="name" v-model="monitor.name" type="text" class="form-control" required>
                            </div>

                            <!-- URL -->
                            <div v-if="monitor.type === 'http' || monitor.type === 'keyword' " class="my-3">
                                <label for="url" class="form-label">{{ $t("URL") }}</label>
                                <input id="url" v-model="monitor.url" type="url" class="form-control" pattern="https?://.+" required>
                            </div>

                            <!-- Push URL -->
                            <div v-if="monitor.type === 'push' " class="my-3">
                                <label for="push-url" class="form-label">{{ $t("PushUrl") }}</label>
                                <CopyableInput id="push-url" v-model="pushURL" type="url" disabled="disabled" />
                                <div class="form-text">
                                    {{ $t("needPushEvery", [monitor.interval]) }}<br />
                                    {{ $t("pushOptionalParams", ["status, msg, ping"]) }}
                                </div>
                            </div>

                            <!-- Keyword -->
                            <div v-if="monitor.type === 'keyword' " class="my-3">
                                <label for="keyword" class="form-label">{{ $t("Keyword") }}</label>
                                <input id="keyword" v-model="monitor.keyword" type="text" class="form-control" required>
                                <div class="form-text">
                                    {{ $t("keywordDescription") }}
                                </div>
                            </div>

                            <!-- Hostname -->
                            <!-- TCP Port / Ping / DNS / Steam / MQTT only -->
                            <div v-if="monitor.type === 'port' || monitor.type === 'ping' || monitor.type === 'dns' || monitor.type === 'steam' || monitor.type === 'mqtt'" class="my-3">
                                <label for="hostname" class="form-label">{{ $t("Hostname") }}</label>
                                <input id="hostname" v-model="monitor.hostname" type="text" class="form-control" :pattern="`${ipRegexPattern}|${hostnameRegexPattern}`" required>
                            </div>

                            <!-- Port -->
                            <!-- For TCP Port / Steam / MQTT Type -->
                            <div v-if="monitor.type === 'port' || monitor.type === 'steam' || monitor.type === 'mqtt'" class="my-3">
                                <label for="port" class="form-label">{{ $t("Port") }}</label>
                                <input id="port" v-model="monitor.port" type="number" class="form-control" required min="0" max="65535" step="1">
                            </div>

                            <!-- DNS Resolver Server -->
                            <!-- For DNS Type -->
                            <template v-if="monitor.type === 'dns'">
                                <div class="my-3">
                                    <label for="dns_resolve_server" class="form-label">{{ $t("Resolver Server") }}</label>
                                    <input id="dns_resolve_server" v-model="monitor.dns_resolve_server" type="text" class="form-control" :pattern="ipRegex" required>
                                    <div class="form-text">
                                        {{ $t("resolverserverDescription") }}
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
                                        :placeholder="$t('Pick a RR-Type...')"
                                        :preselect-first="false"
                                        :max-height="500"
                                        :taggable="false"
                                    ></VueMultiselect>

                                    <div class="form-text">
                                        {{ $t("rrtypeDescription") }}
                                    </div>
                                </div>
                            </template>

                            <!-- MQTT -->
                            <!-- For MQTT Type -->
                            <template v-if="monitor.type === 'mqtt'">
                                <div class="my-3">
                                    <label for="mqttUsername" class="form-label">MQTT {{ $t("Username") }}</label>
                                    <input id="mqttUsername" v-model="monitor.mqttUsername" type="text" class="form-control">
                                </div>

                                <div class="my-3">
                                    <label for="mqttPassword" class="form-label">MQTT {{ $t("Password") }}</label>
                                    <input id="mqttPassword" v-model="monitor.mqttPassword" type="password" class="form-control">
                                </div>

                                <div class="my-3">
                                    <label for="mqttTopic" class="form-label">MQTT {{ $t("Topic") }}</label>
                                    <input id="mqttTopic" v-model="monitor.mqttTopic" type="text" class="form-control" required>
                                    <div class="form-text">
                                        {{ $t("topicExplanation") }}
                                    </div>
                                </div>

                                <div class="my-3">
                                    <label for="mqttSuccessMessage" class="form-label">MQTT {{ $t("successMessage") }}</label>
                                    <input id="mqttSuccessMessage" v-model="monitor.mqttSuccessMessage" type="text" class="form-control">
                                    <div class="form-text">
                                        {{ $t("successMessageExplanation") }}
                                    </div>
                                </div>
                            </template>

                            <!-- Interval -->
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

                            <div class="my-3">
                                <label for="retry-interval" class="form-label">
                                    {{ $t("Heartbeat Retry Interval") }}
                                    <span>({{ $t("retryCheckEverySecond", [ monitor.retryInterval ]) }})</span>
                                </label>
                                <input id="retry-interval" v-model="monitor.retryInterval" type="number" class="form-control" required min="20" step="1">
                            </div>

                            <h2 v-if="monitor.type !== 'push'" class="mt-5 mb-2">{{ $t("Advanced") }}</h2>

                            <div v-if="monitor.type === 'http' || monitor.type === 'keyword' " class="my-3 form-check">
                                <input id="expiry-notification" v-model="monitor.expiryNotification" class="form-check-input" type="checkbox">
                                <label class="form-check-label" for="expiry-notification">
                                    {{ $t("Certificate Expiry Notification") }}
                                </label>
                                <div class="form-text">
                                </div>
                            </div>

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
                                        :placeholder="$t('Pick Accepted Status Codes...')"
                                        :preselect-first="false"
                                        :max-height="600"
                                        :taggable="true"
                                    ></VueMultiselect>

                                    <div class="form-text">
                                        {{ $t("acceptedStatusCodesDescription") }}
                                    </div>
                                </div>
                            </template>

                            <div class="my-3">
                                <tags-manager ref="tagsManager" :pre-selected-tags="monitor.tags"></tags-manager>
                            </div>

                            <div class="mt-5 mb-1">
                                <button id="monitor-submit-btn" class="btn btn-primary" type="submit" :disabled="processing">{{ $t("Save") }}</button>
                            </div>
                        </div>

                        <div class="col-md-6">
                            <div v-if="$root.isMobile" class="mt-3" />

                            <!-- Notifications -->
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

                                <span v-if="notification.isDefault == true" class="badge bg-primary ms-2">{{ $t("Default") }}</span>
                            </div>

                            <button class="btn btn-primary me-2" type="button" @click="$refs.notificationDialog.show()">
                                {{ $t("Setup Notification") }}
                            </button>

                            <!-- Proxies -->
                            <div v-if="monitor.type === 'http' || monitor.type === 'keyword'">
                                <h2 class="mt-5 mb-2">{{ $t("Proxy") }}</h2>
                                <p v-if="$root.proxyList.length === 0">
                                    {{ $t("Not available, please setup.") }}
                                </p>

                                <div v-if="$root.proxyList.length > 0" class="form-check my-3">
                                    <input id="proxy-disable" v-model="monitor.proxyId" :value="null" name="proxy" class="form-check-input" type="radio">
                                    <label class="form-check-label" for="proxy-disable">{{ $t("No Proxy") }}</label>
                                </div>

                                <div v-for="proxy in $root.proxyList" :key="proxy.id" class="form-check my-3">
                                    <input :id="`proxy-${proxy.id}`" v-model="monitor.proxyId" :value="proxy.id" name="proxy" class="form-check-input" type="radio">

                                    <label class="form-check-label" :for="`proxy-${proxy.id}`">
                                        {{ proxy.host }}:{{ proxy.port }} ({{ proxy.protocol }})
                                        <a href="#" @click="$refs.proxyDialog.show(proxy.id)">{{ $t("Edit") }}</a>
                                    </label>

                                    <span v-if="proxy.default === true" class="badge bg-primary ms-2">{{ $t("default") }}</span>
                                </div>

                                <button class="btn btn-primary me-2" type="button" @click="$refs.proxyDialog.show()">
                                    {{ $t("Setup Proxy") }}
                                </button>
                            </div>

                            <!-- HTTP Options -->
                            <template v-if="monitor.type === 'http' || monitor.type === 'keyword' ">
                                <h2 class="mt-5 mb-2">{{ $t("HTTP Options") }}</h2>

                                <!-- Method -->
                                <div class="my-3">
                                    <label for="method" class="form-label">{{ $t("Method") }}</label>
                                    <select id="method" v-model="monitor.method" class="form-select">
                                        <option value="GET">
                                            GET
                                        </option>
                                        <option value="POST">
                                            POST
                                        </option>
                                        <option value="PUT">
                                            PUT
                                        </option>
                                        <option value="PATCH">
                                            PATCH
                                        </option>
                                        <option value="DELETE">
                                            DELETE
                                        </option>
                                        <option value="HEAD">
                                            HEAD
                                        </option>
                                        <option value="OPTIONS">
                                            OPTIONS
                                        </option>
                                    </select>
                                </div>

                                <!-- Body -->
                                <div class="my-3">
                                    <label for="body" class="form-label">{{ $t("Body") }}</label>
                                    <textarea id="body" v-model="monitor.body" class="form-control" :placeholder="bodyPlaceholder"></textarea>
                                </div>

                                <!-- Headers -->
                                <div class="my-3">
                                    <label for="headers" class="form-label">{{ $t("Headers") }}</label>
                                    <textarea id="headers" v-model="monitor.headers" class="form-control" :placeholder="headersPlaceholder"></textarea>
                                </div>

                                <!-- HTTP Basic Auth -->
                                <h4 class="mt-5 mb-2">{{ $t("HTTP Basic Auth") }}</h4>

                                <div class="my-3">
                                    <label for="basicauth" class="form-label">{{ $t("Username") }}</label>
                                    <input id="basicauth-user" v-model="monitor.basic_auth_user" type="text" class="form-control" :placeholder="$t('Username')">
                                </div>

                                <div class="my-3">
                                    <label for="basicauth" class="form-label">{{ $t("Password") }}</label>
                                    <input id="basicauth-pass" v-model="monitor.basic_auth_pass" type="password" autocomplete="new-password" class="form-control" :placeholder="$t('Password')">
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </form>

            <NotificationDialog ref="notificationDialog" @added="addedNotification" />
            <ProxyDialog ref="proxyDialog" @added="addedProxy" />
        </div>
    </transition>
</template>

<script>
import VueMultiselect from "vue-multiselect";
import { useToast } from "vue-toastification";
import CopyableInput from "../components/CopyableInput.vue";
import NotificationDialog from "../components/NotificationDialog.vue";
import ProxyDialog from "../components/ProxyDialog.vue";
import TagsManager from "../components/TagsManager.vue";
import { genSecret, isDev } from "../util.ts";

const toast = useToast();

export default {
    components: {
        ProxyDialog,
        CopyableInput,
        NotificationDialog,
        TagsManager,
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
            ipRegexPattern: "((^\\s*((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))\\s*$)|(^\\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:)))(%.+)?\\s*$))",
            // Source: https://stackoverflow.com/questions/106179/regular-expression-to-match-dns-hostname-or-ip-address
            hostnameRegexPattern: "^(([a-zA-Z0-9_]|[a-zA-Z0-9_][a-zA-Z0-9\\-_]*[a-zA-Z0-9_])\\.)*([A-Za-z0-9_]|[A-Za-z0-9_][A-Za-z0-9\\-_]*[A-Za-z0-9_])$"
        };
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

        pushURL() {
            return this.$root.baseURL + "/api/push/" + this.monitor.pushToken + "?status=up&msg=OK&ping=";
        },

        bodyPlaceholder() {
            return this.$t("Example:", [ `
{
    "key": "value"
}` ]);
        },

        headersPlaceholder() {
            return this.$t("Example:", [ `
{
    "HeaderName": "HeaderValue"
}` ]);
        }

    },
    watch: {
        "$root.proxyList"() {
            if (this.isAdd) {
                if (this.$root.proxyList && !this.monitor.proxyId) {
                    const proxy = this.$root.proxyList.find(proxy => proxy.default);

                    if (proxy) {
                        this.monitor.proxyId = proxy.id;
                    }
                }
            }
        },

        "$route.fullPath"() {
            this.init();
        },

        "monitor.interval"(value, oldValue) {
            // Link interval and retryInterval if they are the same value.
            if (this.monitor.retryInterval === oldValue) {
                this.monitor.retryInterval = value;
            }
        },

        "monitor.type"() {
            if (this.monitor.type === "push") {
                if (! this.monitor.pushToken) {
                    this.monitor.pushToken = genSecret(10);
                }
            }
        }

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

                this.monitor = {
                    type: "http",
                    name: "",
                    url: "https://",
                    method: "GET",
                    interval: 60,
                    retryInterval: this.interval,
                    maxretries: 0,
                    notificationIDList: {},
                    ignoreTls: false,
                    upsideDown: false,
                    expiryNotification: false,
                    maxredirects: 10,
                    accepted_statuscodes: [ "200-299" ],
                    dns_resolve_type: "A",
                    dns_resolve_server: "1.1.1.1",
                    proxyId: null,
                    mqttUsername: "",
                    mqttPassword: "",
                    mqttTopic: "",
                    mqttSuccessMessage: "",
                };

                if (this.$root.proxyList && !this.monitor.proxyId) {
                    const proxy = this.$root.proxyList.find(proxy => proxy.default);

                    if (proxy) {
                        this.monitor.proxyId = proxy.id;
                    }
                }

                for (let i = 0; i < this.$root.notificationList.length; i++) {
                    if (this.$root.notificationList[i].isDefault === true) {
                        this.monitor.notificationIDList[this.$root.notificationList[i].id] = true;
                    }
                }
            } else if (this.isEdit) {
                this.$root.getSocket().emit("getMonitor", this.$route.params.id, (res) => {
                    if (res.ok) {
                        this.monitor = res.monitor;

                        // Handling for monitors that are created before 1.7.0
                        if (this.monitor.retryInterval === 0) {
                            this.monitor.retryInterval = this.monitor.interval;
                        }
                    } else {
                        toast.error(res.msg);
                    }
                });
            }

        },

        isInputValid() {
            if (this.monitor.body) {
                try {
                    JSON.parse(this.monitor.body);
                } catch (err) {
                    toast.error(this.$t("BodyInvalidFormat") + err.message);
                    return false;
                }
            }
            if (this.monitor.headers) {
                try {
                    JSON.parse(this.monitor.headers);
                } catch (err) {
                    toast.error(this.$t("HeadersInvalidFormat") + err.message);
                    return false;
                }
            }
            return true;
        },

        async submit() {
            this.processing = true;

            if (!this.isInputValid()) {
                this.processing = false;
                return;
            }

            // Beautify the JSON format
            if (this.monitor.body) {
                this.monitor.body = JSON.stringify(JSON.parse(this.monitor.body), null, 4);
            }

            if (this.monitor.headers) {
                this.monitor.headers = JSON.stringify(JSON.parse(this.monitor.headers), null, 4);
            }

            if (this.isAdd) {
                this.$root.add(this.monitor, async (res) => {

                    if (res.ok) {
                        await this.$refs.tagsManager.submit(res.monitorID);

                        toast.success(res.msg);
                        this.processing = false;
                        this.$root.getMonitorList();
                        this.$router.push("/dashboard/" + res.monitorID);
                    } else {
                        toast.error(res.msg);
                        this.processing = false;
                    }

                });
            } else {
                await this.$refs.tagsManager.submit(this.monitor.id);

                this.$root.getSocket().emit("editMonitor", this.monitor, (res) => {
                    this.processing = false;
                    this.$root.toastRes(res);
                    this.init();
                });
            }
        },

        // Added a Notification Event
        // Enable it if the notification is added in EditMonitor.vue
        addedNotification(id) {
            this.monitor.notificationIDList[id] = true;
        },

        // Added a Proxy Event
        // Enable it if the proxy is added in EditMonitor.vue
        addedProxy(id) {
            this.monitor.proxyId = id;
        },
    },
};
</script>

<style lang="scss" scoped>
    .shadow-box {
        padding: 20px;
    }

    textarea {
        min-height: 200px;
    }
</style>
