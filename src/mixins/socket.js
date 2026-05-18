import { io } from "socket.io-client";
import { useToast } from "vue-toastification";
import jwtDecode from "jwt-decode";
import Favico from "favico.js";
import dayjs from "dayjs";
import mitt from "mitt";

import { DOWN, MAINTENANCE, PENDING, UP } from "../util.ts";
import {
    getDevContainerServerHostname,
    isDevContainer,
    getToastSuccessTimeout,
    getToastErrorTimeout,
} from "../util-frontend.js";
import { requestCloudflareJson } from "../cloudflare-worker-api.js";
const toast = useToast();

let socket;

const cloudflareWorkerHostnames = new Set([
    "uptimeworker.wgsglobal.workers.dev",
    "uptime.wgsglobal.app",
    "up.wgsglobal.app",
]);

const noSocketIOPages = [
    /^\/status-page$/, //  /status-page
    /^\/status/, // /status**
    /^\/$/, //  /
];

const favicon = new Favico({
    animation: "none",
});

export default {
    data() {
        return {
            info: {},
            socket: {
                token: null,
                firstConnect: true,
                connected: false,
                connectCount: 0,
                initedSocketIO: false,
            },
            username: null,
            remember: localStorage.remember !== "0",
            allowLoginDialog: false, // Allowed to show login dialog, but "loggedIn" have to be true too. This exists because prevent the login dialog show 0.1s in first before the socket server auth-ed.
            loggedIn: false,
            monitorList: {},
            monitorTypeList: {},
            maintenanceList: {},
            apiKeyList: {},
            heartbeatList: {},
            avgPingList: {},
            uptimeList: {},
            tlsInfoList: {},
            domainInfoList: {},
            notificationList: [],
            dockerHostList: [],
            remoteBrowserList: [],
            statusPageListLoaded: false,
            statusPageList: [],
            proxyList: [],
            isCloudflareWorkerUI: false,
            workerLocalAuthConfigured: false,
            connectionErrorMsg: `${this.$t("Cannot connect to the socket server.")} ${this.$t("Reconnecting...")}`,
            cloudflared: {
                cloudflareTunnelToken: "",
                installed: null,
                running: false,
                message: "",
                errorMessage: "",
                currentPassword: "",
            },
            faviconUpdateDebounce: null,
            emitter: mitt(),
        };
    },

    created() {
        this.initSocketIO();
    },

    methods: {
        /**
         * Initialize connection to socket server
         * @param {boolean} bypass Should the check for if we
         * are on a status page be bypassed?
         * @returns {void}
         */
        initSocketIO(bypass = false) {
            // No need to re-init
            if (this.socket.initedSocketIO) {
                return;
            }

            if (isCloudflareWorkerUI()) {
                this.initCloudflareWorkerUI();
                return;
            }

            // No need to connect to the socket.io for status page
            if (!bypass && location.pathname) {
                for (let page of noSocketIOPages) {
                    if (location.pathname.match(page)) {
                        return;
                    }
                }
            }

            // Also don't need to connect to the socket.io for setup database page
            if (location.pathname === "/setup-database") {
                return;
            }

            this.socket.initedSocketIO = true;

            let protocol = location.protocol + "//";

            let url;
            const env = process.env.NODE_ENV || "production";
            if (env === "development" && isDevContainer()) {
                url = protocol + getDevContainerServerHostname();
            } else if (env === "development" || localStorage.dev === "dev") {
                url = protocol + location.hostname + ":3001";
            } else {
                // Connect to the current url
                url = undefined;
            }

            socket = io(url);

            socket.on("info", (info) => {
                this.info = info;
            });

            socket.on("setup", (monitorID, data) => {
                this.$router.push("/setup");
            });

            socket.on("autoLogin", (monitorID, data) => {
                this.loggedIn = true;
                this.storage().token = "autoLogin";
                this.socket.token = "autoLogin";
                this.allowLoginDialog = false;
            });

            socket.on("loginRequired", () => {
                let token = this.storage().token;
                if (token && token !== "autoLogin") {
                    this.loginByToken(token);
                } else {
                    this.$root.storage().removeItem("token");
                    this.allowLoginDialog = true;
                }
            });

            socket.on("monitorList", (data) => {
                this.assignMonitorUrlParser(data);
                this.monitorList = data;
            });

            socket.on("updateMonitorIntoList", (data) => {
                this.assignMonitorUrlParser(data);
                Object.entries(data).forEach(([monitorID, updatedMonitor]) => {
                    this.monitorList[monitorID] = updatedMonitor;
                });
            });

            socket.on("deleteMonitorFromList", (monitorID) => {
                if (this.monitorList[monitorID]) {
                    delete this.monitorList[monitorID];
                }
            });

            socket.on("monitorTypeList", (data) => {
                this.monitorTypeList = data;
            });

            socket.on("maintenanceList", (data) => {
                this.maintenanceList = data;
            });

            socket.on("apiKeyList", (data) => {
                this.apiKeyList = data;
            });

            socket.on("notificationList", (data) => {
                this.notificationList = data;
            });

            socket.on("statusPageList", (data) => {
                this.statusPageListLoaded = true;
                this.statusPageList = data;
            });

            socket.on("proxyList", (data) => {
                this.proxyList = normalizeProxyList(data);
            });

            socket.on("dockerHostList", (data) => {
                this.dockerHostList = data;
            });

            socket.on("remoteBrowserList", (data) => {
                this.remoteBrowserList = data;
            });

            socket.on("heartbeat", (data) => {
                if (!(data.monitorID in this.heartbeatList)) {
                    this.heartbeatList[data.monitorID] = [];
                }

                this.heartbeatList[data.monitorID].push(data);

                if (this.heartbeatList[data.monitorID].length >= 150) {
                    this.heartbeatList[data.monitorID].shift();
                }

                // Add to important list if it is important
                // Also toast
                if (data.important) {
                    if (this.monitorList[data.monitorID] !== undefined) {
                        if (data.status === 0) {
                            toast.error(`[${this.monitorList[data.monitorID].name}] [DOWN] ${data.msg}`, {
                                timeout: getToastErrorTimeout(),
                            });
                        } else if (data.status === 1) {
                            toast.success(`[${this.monitorList[data.monitorID].name}] [Up] ${data.msg}`, {
                                timeout: getToastSuccessTimeout(),
                            });
                        } else {
                            toast(`[${this.monitorList[data.monitorID].name}] ${data.msg}`);
                        }
                    }

                    this.emitter.emit("newImportantHeartbeat", data);
                }
            });

            socket.on("heartbeatList", (monitorID, data, overwrite = false) => {
                if (!(monitorID in this.heartbeatList) || overwrite) {
                    this.heartbeatList[monitorID] = data;
                } else {
                    this.heartbeatList[monitorID] = data.concat(this.heartbeatList[monitorID]);
                }
            });

            socket.on("avgPing", (monitorID, data) => {
                this.avgPingList[monitorID] = data;
            });

            socket.on("uptime", (monitorID, type, data) => {
                this.uptimeList[`${monitorID}_${type}`] = data;
            });

            socket.on("certInfo", (monitorID, data) => {
                this.tlsInfoList[monitorID] = JSON.parse(data);
            });

            socket.on("domainInfo", (monitorID, daysRemaining, expiresOn) => {
                this.domainInfoList[monitorID] = { daysRemaining: daysRemaining, expiresOn: expiresOn };
            });

            socket.on("connect_error", (err) => {
                console.error(`Failed to connect to the backend. Socket.io connect_error: ${err.message}`);
                this.connectionErrorMsg = `${this.$t("Cannot connect to the socket server.")} [${err}] ${this.$t("Reconnecting...")}`;
                this.socket.connected = false;
                this.socket.firstConnect = false;
            });

            socket.on("disconnect", () => {
                console.log("disconnect");
                this.connectionErrorMsg = `${this.$t("Lost connection to the socket server.")} ${this.$t("Reconnecting...")}`;
                this.socket.connected = false;
            });

            socket.on("connect", () => {
                console.log("Connected to the socket server");
                this.socket.connectCount++;
                this.socket.connected = true;

                // Reset Heartbeat list if it is re-connect
                if (this.socket.connectCount >= 2) {
                    this.clearData();
                }

                this.socket.firstConnect = false;
            });

            // cloudflared
            socket.on("cloudflared_installed", (res) => (this.cloudflared.installed = res));
            socket.on("cloudflared_running", (res) => (this.cloudflared.running = res));
            socket.on("cloudflared_message", (res) => (this.cloudflared.message = res));
            socket.on("cloudflared_errorMessage", (res) => (this.cloudflared.errorMessage = res));
            socket.on("cloudflared_token", (res) => (this.cloudflared.cloudflareTunnelToken = res));

            socket.on("initServerTimezone", () => {
                socket.emit("initServerTimezone", dayjs.tz.guess());
            });

            socket.on("refresh", () => {
                location.reload();
            });
        },
        /**
         * Initialize the dashboard when hosted directly by the Cloudflare Worker.
         * The Worker deployment exposes REST endpoints instead of the upstream
         * Socket.IO server.
         * @returns {void}
         */
        async initCloudflareWorkerUI() {
            this.isCloudflareWorkerUI = true;
            this.socket.initedSocketIO = true;
            this.socket.connected = true;
            this.socket.firstConnect = false;
            this.socket.token = null;
            this.loggedIn = false;
            this.allowLoginDialog = false;
            this.username = null;
            socket = createCloudflareSocketStub(this);
            await this.loadCloudflareWorkerInfo();
            await this.refreshCloudflareWorkerAuthSession();
        },

        /**
         * Load public Worker deployment metadata.
         * @returns {Promise<void>}
         */
        async loadCloudflareWorkerInfo() {
            try {
                const health = await requestCloudflareJson("/api/health");
                if (health.version) {
                    this.info.version = health.version;
                }
            } catch (error) {
                console.warn(`Failed to load Cloudflare Worker version: ${error.message}`);
            }
        },

        /**
         * Load the current Worker-local auth session.
         * @returns {Promise<void>}
         */
        async refreshCloudflareWorkerAuthSession() {
            try {
                const session = await requestCloudflareJson("/api/auth/session");
                this.workerLocalAuthConfigured = Boolean(session.localAuthConfigured);
                if (session.authenticated) {
                    this.loggedIn = true;
                    this.allowLoginDialog = false;
                    this.username = session.username;
                    this.socket.token = this.storage().token || (session.localAuthConfigured ? null : "bootstrap");
                    await this.loadCloudflareWorkerData();
                } else {
                    this.loggedIn = false;
                    this.username = null;
                    this.socket.token = null;
                    this.allowLoginDialog = true;
                }
            } catch (error) {
                console.error(`Failed to load Cloudflare Worker auth session: ${error.message}`);
                this.connectionErrorMsg = `Cannot load Cloudflare Worker auth session. [${error.message}]`;
                this.socket.connected = false;
                this.allowLoginDialog = true;
            }
        },

        /**
         * Load monitor state from the Cloudflare Worker REST API.
         * @returns {Promise<void>}
         */
        async loadCloudflareWorkerData() {
            try {
                const [body, notificationBody, proxyBody, dockerHostBody, remoteBrowserBody] = await Promise.all([
                    requestCloudflareJson("/api/monitors"),
                    requestCloudflareJson("/api/notifications"),
                    requestCloudflareJson("/api/proxies"),
                    requestCloudflareJson("/api/docker-hosts"),
                    requestCloudflareJson("/api/remote-browsers"),
                ]);
                const monitorList = {};
                const heartbeatList = {};
                const avgPingList = {};
                const uptimeList = {};

                await Promise.all((body.monitors || []).map(async (monitor) => {
                    const lastHeartbeat = monitor.lastHeartbeat;
                    delete monitor.lastHeartbeat;
                    monitor.getUrl = () => {
                        try {
                            return new URL(monitor.url);
                        } catch (_) {
                            return null;
                        }
                    };
                    monitorList[monitor.id] = monitor;
                    const heartbeats = normalizeCloudflareHeartbeatHistory(
                        await fetchCloudflareMonitorHeartbeats(monitor.id)
                    );
                    if (heartbeats.length > 0) {
                        heartbeatList[monitor.id] = heartbeats;
                    } else if (lastHeartbeat) {
                        heartbeatList[monitor.id] = [lastHeartbeat];
                    }
                    avgPingList[monitor.id] = calculateAveragePing(heartbeatList[monitor.id] || []);
                    for (const type of ["24", "720", "1y"]) {
                        uptimeList[`${monitor.id}_${type}`] = calculateUptime(heartbeatList[monitor.id] || []);
                    }
                }));

                this.monitorList = monitorList;
                this.heartbeatList = heartbeatList;
                this.avgPingList = avgPingList;
                this.uptimeList = uptimeList;
                this.notificationList = notificationBody.notifications || [];
                this.proxyList = normalizeProxyList(proxyBody.proxies || []);
                this.dockerHostList = dockerHostBody.dockerHosts || [];
                this.remoteBrowserList = remoteBrowserBody.remoteBrowsers || [];
                this.statusPageList = await fetchCloudflareStatusPages();
                this.statusPageListLoaded = true;
            } catch (error) {
                console.error(`Failed to load Cloudflare Worker monitor data: ${error.message}`);
                this.connectionErrorMsg = `Cannot load Cloudflare Worker monitor data. [${error.message}]`;
                this.socket.connected = false;
                this.statusPageListLoaded = true;
            }
        },
        /**
         * parse all urls from list.
         * @param {object} data Monitor data to modify
         * @returns {object} list
         */
        assignMonitorUrlParser(data) {
            Object.entries(data).forEach(([monitorID, monitor]) => {
                monitor.getUrl = () => {
                    try {
                        return new URL(monitor.url);
                    } catch (_) {
                        return null;
                    }
                };
            });
            return data;
        },

        /**
         * The storage currently in use
         * @returns {Storage} Current storage
         */
        storage() {
            return this.remember ? localStorage : sessionStorage;
        },

        /**
         * Get payload of JWT cookie
         * @returns {(object | undefined)} JWT payload
         */
        getJWTPayload() {
            const jwtToken = this.$root.storage().token;

            if (jwtToken && jwtToken !== "autoLogin") {
                return jwtDecode(jwtToken);
            }
            return undefined;
        },

        /**
         * Get current socket
         * @returns {Socket} Current socket
         */
        getSocket() {
            return socket;
        },

        /**
         * Apply translation to a message if possible
         * @param {string | {key: string, values: object}} msg Message to translate
         * @returns {string} Translated message
         */
        applyTranslation(msg) {
            if (msg != null && typeof msg === "object") {
                return this.$t(msg.key, msg.values);
            } else {
                return this.$t(msg);
            }
        },

        /**
         * Show success or error toast dependent on response status code
         * @param {{ok:boolean, msg: string, msgi18n: false} | {ok:boolean, msg: string|{key: string, values: object}, msgi18n: true}} res Response object
         * @returns {void}
         */
        toastRes(res) {
            if (res.msgi18n) {
                res.msg = this.applyTranslation(res.msg);
            }

            if (res.ok) {
                toast.success(res.msg);
            } else {
                toast.error(res.msg);
            }
        },

        /**
         * Show a success toast
         * @param {string} msg Message to show
         * @returns {void}
         */
        toastSuccess(msg) {
            toast.success(this.$t(msg));
        },

        /**
         * Show an error toast
         * @param {string} msg Message to show
         * @returns {void}
         */
        toastError(msg) {
            toast.error(this.$t(msg));
        },

        /**
         * Callback for login
         * @callback loginCB
         * @param {object} res Response object
         */

        /**
         * Send request to log user in
         * @param {string} username Username to log in with
         * @param {string} password Password to log in with
         * @param {string} token User token
         * @param {loginCB} callback Callback to call with result
         * @returns {void}
         */
        login(username, password, token, callback) {
            socket.emit(
                "login",
                {
                    username,
                    password,
                    token,
                },
                (res) => {
                    if (res.tokenRequired) {
                        callback(res);
                    }

                    if (res.ok) {
                        this.storage().token = res.token;
                        this.socket.token = res.token;
                        this.loggedIn = true;
                        this.username = res.username || this.getJWTPayload()?.username;
                        this.workerLocalAuthConfigured = res.localAuthConfigured ?? this.workerLocalAuthConfigured;
                        if (this.isCloudflareWorkerUI) {
                            this.loadCloudflareWorkerData();
                        }

                        // Trigger Chrome Save Password
                        history.pushState({}, "");
                    }

                    callback(res);
                }
            );
        },

        /**
         * Log in using a token
         * @param {string} token Token to log in with
         * @returns {void}
         */
        loginByToken(token) {
            socket.emit("loginByToken", token, (res) => {
                this.allowLoginDialog = true;

                if (!res.ok) {
                    this.logout();
                } else {
                    this.loggedIn = true;
                    this.username = res.username || this.getJWTPayload()?.username;
                    this.workerLocalAuthConfigured = res.localAuthConfigured ?? this.workerLocalAuthConfigured;
                }
            });
        },

        /**
         * Log out of the web application
         * @returns {void}
         */
        logout() {
            socket.emit("logout", () => {});
            this.storage().removeItem("token");
            this.socket.token = null;
            this.loggedIn = false;
            this.username = null;
            this.clearData();
        },

        /**
         * Callback for general socket requests
         * @callback socketCB
         * @param {object} res Result of operation
         */
        /**
         * Prepare 2FA configuration
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        prepare2FA(callback) {
            socket.emit("prepare2FA", callback);
        },

        /**
         * Save the current 2FA configuration
         * @param {unknown} secret Unused
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        save2FA(secret, callback) {
            socket.emit("save2FA", callback);
        },

        /**
         * Disable 2FA for this user
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        disable2FA(callback) {
            socket.emit("disable2FA", callback);
        },

        /**
         * Verify the provided 2FA token
         * @param {string} token Token to verify
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        verifyToken(token, callback) {
            socket.emit("verifyToken", token, callback);
        },

        /**
         * Get current 2FA status
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        twoFAStatus(callback) {
            socket.emit("twoFAStatus", callback);
        },

        /**
         * Get list of monitors
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        getMonitorList(callback) {
            if (!callback) {
                callback = () => {};
            }
            socket.emit("getMonitorList", callback);
        },

        /**
         * Get list of maintenances
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        getMaintenanceList(callback) {
            if (!callback) {
                callback = () => {};
            }
            socket.emit("getMaintenanceList", callback);
        },

        /**
         * Send list of API keys
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        getAPIKeyList(callback) {
            if (!callback) {
                callback = () => {};
            }
            socket.emit("getAPIKeyList", callback);
        },

        /**
         * Add a monitor
         * @param {object} monitor Object representing monitor to add
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        add(monitor, callback) {
            socket.emit("add", monitor, callback);
        },

        /**
         * Adds a maintenance
         * @param {object} maintenance Maintenance to add
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        addMaintenance(maintenance, callback) {
            socket.emit("addMaintenance", maintenance, callback);
        },

        /**
         * Add monitors to maintenance
         * @param {number} maintenanceID Maintenance to modify
         * @param {number[]} monitors IDs of monitors to add
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        addMonitorMaintenance(maintenanceID, monitors, callback) {
            socket.emit("addMonitorMaintenance", maintenanceID, monitors, callback);
        },

        /**
         * Add status page to maintenance
         * @param {number} maintenanceID Maintenance to modify
         * @param {number} statusPages ID of status page to add
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        addMaintenanceStatusPage(maintenanceID, statusPages, callback) {
            socket.emit("addMaintenanceStatusPage", maintenanceID, statusPages, callback);
        },

        /**
         * Get monitors affected by maintenance
         * @param {number} maintenanceID Maintenance to read
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        getMonitorMaintenance(maintenanceID, callback) {
            socket.emit("getMonitorMaintenance", maintenanceID, callback);
        },

        /**
         * Get status pages where maintenance is shown
         * @param {number} maintenanceID Maintenance to read
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        getMaintenanceStatusPage(maintenanceID, callback) {
            socket.emit("getMaintenanceStatusPage", maintenanceID, callback);
        },

        /**
         * Delete monitor by ID
         * @param {number} monitorID ID of monitor to delete
         * @param {boolean} deleteChildren Whether to delete child monitors (for groups)
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        deleteMonitor(monitorID, deleteChildren, callback) {
            socket.emit("deleteMonitor", monitorID, deleteChildren, callback);
        },

        /**
         * Delete specified maintenance
         * @param {number} maintenanceID Maintenance to delete
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        deleteMaintenance(maintenanceID, callback) {
            socket.emit("deleteMaintenance", maintenanceID, callback);
        },

        /**
         * Add an API key
         * @param {object} key API key to add
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        addAPIKey(key, callback) {
            socket.emit("addAPIKey", key, callback);
        },

        /**
         * Delete specified API key
         * @param {int} keyID ID of key to delete
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        deleteAPIKey(keyID, callback) {
            socket.emit("deleteAPIKey", keyID, callback);
        },

        /**
         * Clear the hearbeat list
         * @returns {void}
         */
        clearData() {
            console.log("reset heartbeat list");
            this.heartbeatList = {};
        },

        /**
         * Upload the provided backup
         * @param {string} uploadedJSON JSON to upload
         * @param {string} importHandle Type of import. If set to
         * most data in database will be replaced
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        uploadBackup(uploadedJSON, importHandle, callback) {
            socket.emit("uploadBackup", uploadedJSON, importHandle, callback);
        },

        /**
         * Clear events for a specified monitor
         * @param {number} monitorID ID of monitor to clear
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        clearEvents(monitorID, callback) {
            socket.emit("clearEvents", monitorID, callback);
        },

        /**
         * Clear the heartbeats of a specified monitor
         * @param {number} monitorID Id of monitor to clear
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        clearHeartbeats(monitorID, callback) {
            socket.emit("clearHeartbeats", monitorID, callback);
        },

        /**
         * Clear all statistics
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        clearStatistics(callback) {
            socket.emit("clearStatistics", callback);
        },

        /**
         * Get monitor beats for a specific monitor in a time range
         * @param {number} monitorID ID of monitor to fetch
         * @param {number} period Time in hours from now
         * @param {socketCB} callback Callback for socket response
         * @returns {void}
         */
        getMonitorBeats(monitorID, period, callback) {
            socket.emit("getMonitorBeats", monitorID, period, callback);
        },

        /**
         * Retrieves monitor chart data.
         * @param {string} monitorID - The ID of the monitor.
         * @param {number} period - The time period for the chart data, in hours.
         * @param {socketCB} callback - The callback function to handle the chart data.
         * @returns {void}
         */
        getMonitorChartData(monitorID, period, callback) {
            socket.emit("getMonitorChartData", monitorID, period, callback);
        },
    },

    computed: {
        usernameFirstChar() {
            if (typeof this.username == "string" && this.username.length >= 1) {
                return this.username.charAt(0).toUpperCase();
            } else {
                return "🐻";
            }
        },

        lastHeartbeatList() {
            let result = {};

            for (let monitorID in this.heartbeatList) {
                let index = this.heartbeatList[monitorID].length - 1;
                result[monitorID] = this.heartbeatList[monitorID][index];
            }

            return result;
        },

        statusList() {
            let result = {};

            let unknown = {
                text: this.$t("Unknown"),
                color: "secondary",
            };

            for (let monitorID in this.lastHeartbeatList) {
                let lastHeartBeat = this.lastHeartbeatList[monitorID];

                if (!lastHeartBeat) {
                    result[monitorID] = unknown;
                } else if (lastHeartBeat.status === UP) {
                    result[monitorID] = {
                        text: this.$t("Up"),
                        color: "primary",
                    };
                } else if (lastHeartBeat.status === DOWN) {
                    result[monitorID] = {
                        text: this.$t("Down"),
                        color: "danger",
                    };
                } else if (lastHeartBeat.status === PENDING) {
                    result[monitorID] = {
                        text: this.$t("Pending"),
                        color: "warning",
                    };
                } else if (lastHeartBeat.status === MAINTENANCE) {
                    result[monitorID] = {
                        text: this.$t("statusMaintenance"),
                        color: "maintenance",
                    };
                } else {
                    result[monitorID] = unknown;
                }
            }

            return result;
        },

        stats() {
            let result = {
                active: 0,
                up: 0,
                down: 0,
                maintenance: 0,
                pending: 0,
                unknown: 0,
                pause: 0,
            };

            for (let monitorID in this.$root.monitorList) {
                let beat = this.$root.lastHeartbeatList[monitorID];
                let monitor = this.$root.monitorList[monitorID];

                if (monitor && !monitor.active) {
                    result.pause++;
                } else if (beat) {
                    result.active++;
                    if (beat.status === UP) {
                        result.up++;
                    } else if (beat.status === DOWN) {
                        result.down++;
                    } else if (beat.status === PENDING) {
                        result.pending++;
                    } else if (beat.status === MAINTENANCE) {
                        result.maintenance++;
                    } else {
                        result.unknown++;
                    }
                } else {
                    result.unknown++;
                }
            }

            return result;
        },

        /**
         *  Frontend Version
         *  It should be compiled to a static value while building the frontend.
         *  Please see ./config/vite.config.js, it is defined via vite.js
         * @returns {string} Current version
         */
        frontendVersion() {
            // eslint-disable-next-line no-undef
            return FRONTEND_VERSION;
        },

        /**
         * Are both frontend and backend in the same version?
         * @returns {boolean} The frontend and backend match?
         */
        isFrontendBackendVersionMatched() {
            if (!this.info.version) {
                return true;
            }
            return this.info.version === this.frontendVersion;
        },
    },

    watch: {
        // Update Badge
        "stats.down"(to, from) {
            if (to !== from) {
                if (this.faviconUpdateDebounce != null) {
                    clearTimeout(this.faviconUpdateDebounce);
                }
                this.faviconUpdateDebounce = setTimeout(() => {
                    favicon.badge(to);
                }, 1000);
            }
        },

        // Reload the SPA if the server version is changed.
        "info.version"(to, from) {
            if (from && from !== to) {
                window.location.reload();
            }
        },

        remember() {
            localStorage.remember = this.remember ? "1" : "0";
        },

        // Reconnect the socket io, if status-page to dashboard
        "$route.fullPath"(newValue, oldValue) {
            if (newValue) {
                for (let page of noSocketIOPages) {
                    if (newValue.match(page)) {
                        return;
                    }
                }
            }

            this.initSocketIO();
        },
    },
};

/**
 * Check whether the frontend is running on the Cloudflare Worker deployment.
 * @returns {boolean} True when hosted on the Worker UI hostname.
 */
function isCloudflareWorkerUI() {
    return cloudflareWorkerHostnames.has(location.hostname) || location.port === "8787";
}

/**
 * Normalize proxy booleans from REST and Socket.IO payloads.
 * @param {object[]} data Proxy rows.
 * @returns {object[]} Normalized proxy rows.
 */
function normalizeProxyList(data = []) {
    return data.map((item) => ({
        ...item,
        auth: !!item.auth,
        active: !!item.active,
        default: !!item.default,
    }));
}

/**
 * Create the small socket-compatible shim needed by dashboard components.
 * @param {object} app Vue root component instance.
 * @returns {object} Socket-like object for REST-backed Worker UI mode.
 */
function createCloudflareSocketStub(app) {
    return {
        on() {},
        off() {},
        disconnect() {},
        async emit(event, ...args) {
            const callback = args.find((arg) => typeof arg === "function");

            try {
                if (event === "login") {
                    const credentials = args[0] || {};
                    const body = await requestCloudflareJson("/api/auth/login", {
                        method: "POST",
                        body: JSON.stringify({
                            username: credentials.username,
                            password: credentials.password,
                            remember: app.remember,
                        }),
                    });
                    callback?.(body);
                    return;
                }

                if (event === "loginByToken") {
                    const body = await requestCloudflareJson("/api/auth/session", {
                        headers: {
                            authorization: `Bearer ${args[0]}`,
                        },
                    });
                    callback?.({
                        ok: body.authenticated,
                        username: body.username,
                        localAuthConfigured: body.localAuthConfigured,
                    });
                    return;
                }

                if (event === "logout") {
                    await requestCloudflareJson("/api/auth/logout", { method: "POST" }).catch(() => {});
                    callback?.({ ok: true });
                    return;
                }

                if (event === "saveWorkerAuthUser") {
                    const body = await requestCloudflareJson("/api/auth/local-user", {
                        method: "PUT",
                        body: JSON.stringify(args[0] || {}),
                    });
                    app.workerLocalAuthConfigured = true;
                    callback?.(body);
                    return;
                }

                if (event === "twoFAStatus") {
                    const body = await requestCloudflareJson("/api/auth/2fa/status");
                    callback?.(body);
                    return;
                }

                if (event === "prepare2FA") {
                    const [currentPassword] = args;
                    const body = await requestCloudflareJson("/api/auth/2fa/prepare", {
                        method: "POST",
                        body: JSON.stringify({ currentPassword }),
                    });
                    callback?.(body);
                    return;
                }

                if (event === "verifyToken") {
                    const [token, currentPassword] = args;
                    const body = await requestCloudflareJson("/api/auth/2fa/verify", {
                        method: "POST",
                        body: JSON.stringify({ token, currentPassword }),
                    });
                    callback?.(body);
                    return;
                }

                if (event === "save2FA") {
                    const [currentPassword] = args;
                    const body = await requestCloudflareJson("/api/auth/2fa/save", {
                        method: "POST",
                        body: JSON.stringify({ currentPassword }),
                    });
                    callback?.(body);
                    return;
                }

                if (event === "disable2FA") {
                    const [currentPassword] = args;
                    const body = await requestCloudflareJson("/api/auth/2fa/disable", {
                        method: "POST",
                        body: JSON.stringify({ currentPassword }),
                    });
                    callback?.(body);
                    return;
                }

                if (event === "getSettings") {
                    const body = await requestCloudflareJson("/api/settings");
                    callback?.({ ok: true, data: body.data });
                    return;
                }

                if (event === "getStatusPage") {
                    const [slug] = args;
                    const body = await requestCloudflareJson(`/api/status-page/${slug || "default"}`);
                    callback?.({ ok: true, config: body.config });
                    return;
                }

                if (event === "saveStatusPage") {
                    const [slug, config, imgDataUrl, publicGroupList] = args;
                    const body = await requestCloudflareJson(`/api/status-page/${slug || "default"}`, {
                        method: "PUT",
                        body: JSON.stringify({
                            config,
                            imgDataUrl,
                            publicGroupList,
                        }),
                    });
                    await app.loadCloudflareWorkerData();
                    callback?.(body);
                    return;
                }

                if (event === "setSettings") {
                    const body = await requestCloudflareJson("/api/settings", {
                        method: "PUT",
                        body: JSON.stringify(args[0] || {}),
                    });
                    callback?.(body);
                    return;
                }

                if (event === "addDockerHost") {
                    const [dockerHost, dockerHostID] = args;
                    const body = await requestCloudflareJson(
                        dockerHostID ? `/api/docker-hosts/${dockerHostID}` : "/api/docker-hosts",
                        {
                            method: dockerHostID ? "PUT" : "POST",
                            body: JSON.stringify(dockerHost || {}),
                        }
                    );
                    await app.loadCloudflareWorkerData();
                    callback?.(body);
                    return;
                }

                if (event === "deleteDockerHost") {
                    const body = await requestCloudflareJson(`/api/docker-hosts/${args[0]}`, {
                        method: "DELETE",
                    });
                    await app.loadCloudflareWorkerData();
                    callback?.(body);
                    return;
                }

                if (event === "testDockerHost") {
                    const body = await requestCloudflareJson("/api/docker-hosts/test", {
                        method: "POST",
                        body: JSON.stringify(args[0] || {}),
                    });
                    callback?.(body);
                    return;
                }

                if (event === "addRemoteBrowser") {
                    const [remoteBrowser, remoteBrowserID] = args;
                    const body = await requestCloudflareJson(
                        remoteBrowserID ? `/api/remote-browsers/${remoteBrowserID}` : "/api/remote-browsers",
                        {
                            method: remoteBrowserID ? "PUT" : "POST",
                            body: JSON.stringify(remoteBrowser || {}),
                        }
                    );
                    await app.loadCloudflareWorkerData();
                    callback?.(body);
                    return;
                }

                if (event === "deleteRemoteBrowser") {
                    const body = await requestCloudflareJson(`/api/remote-browsers/${args[0]}`, {
                        method: "DELETE",
                    });
                    await app.loadCloudflareWorkerData();
                    callback?.(body);
                    return;
                }

                if (event === "testRemoteBrowser") {
                    const body = await requestCloudflareJson("/api/remote-browsers/test", {
                        method: "POST",
                        body: JSON.stringify(args[0] || {}),
                    });
                    callback?.(body);
                    return;
                }

                if (event === "addNotification") {
                    const [notification, notificationID] = args;
                    const body = await requestCloudflareJson(
                        notificationID ? `/api/notifications/${notificationID}` : "/api/notifications",
                        {
                            method: notificationID ? "PUT" : "POST",
                            body: JSON.stringify(notification || {}),
                        }
                    );
                    await app.loadCloudflareWorkerData();
                    callback?.(body);
                    return;
                }

                if (event === "deleteNotification") {
                    const body = await requestCloudflareJson(`/api/notifications/${args[0]}`, {
                        method: "DELETE",
                    });
                    await app.loadCloudflareWorkerData();
                    callback?.(body);
                    return;
                }

                if (event === "addProxy") {
                    const [proxy, proxyID] = args;
                    const body = await requestCloudflareJson(proxyID ? `/api/proxies/${proxyID}` : "/api/proxies", {
                        method: proxyID ? "PUT" : "POST",
                        body: JSON.stringify(proxy || {}),
                    });
                    await app.loadCloudflareWorkerData();
                    callback?.(body);
                    return;
                }

                if (event === "deleteProxy") {
                    const body = await requestCloudflareJson(`/api/proxies/${args[0]}`, {
                        method: "DELETE",
                    });
                    await app.loadCloudflareWorkerData();
                    callback?.(body);
                    return;
                }

                if (event === "getTags") {
                    const body = await requestCloudflareJson("/api/tags");
                    callback?.({ ok: true, tags: body.tags || [] });
                    return;
                }

                if (event === "addTag") {
                    const body = await requestCloudflareJson("/api/tags", {
                        method: "POST",
                        body: JSON.stringify(args[0] || {}),
                    });
                    callback?.(body);
                    return;
                }

                if (event === "editTag") {
                    const tag = args[0] || {};
                    const body = await requestCloudflareJson(`/api/tags/${tag.id}`, {
                        method: "PUT",
                        body: JSON.stringify(tag),
                    });
                    await app.loadCloudflareWorkerData();
                    callback?.(body);
                    return;
                }

                if (event === "deleteTag") {
                    const body = await requestCloudflareJson(`/api/tags/${args[0]}`, {
                        method: "DELETE",
                    });
                    await app.loadCloudflareWorkerData();
                    callback?.(body);
                    return;
                }

                if (event === "addMonitorTag") {
                    const [tagId, monitorId, value] = args;
                    const body = await requestCloudflareJson(`/api/monitors/${monitorId}/tags`, {
                        method: "POST",
                        body: JSON.stringify({ tagId, value }),
                    });
                    await app.loadCloudflareWorkerData();
                    callback?.(body);
                    return;
                }

                if (event === "editMonitorTag") {
                    const [tagId, monitorId, value] = args;
                    await requestCloudflareJson(`/api/monitors/${monitorId}/tags`, {
                        method: "DELETE",
                        body: JSON.stringify({ tagId, value: "" }),
                    });
                    const body = await requestCloudflareJson(`/api/monitors/${monitorId}/tags`, {
                        method: "POST",
                        body: JSON.stringify({ tagId, value }),
                    });
                    await app.loadCloudflareWorkerData();
                    callback?.({ ok: true, msg: "successEdited", msgi18n: true, ...body });
                    return;
                }

                if (event === "deleteMonitorTag") {
                    const [tagId, monitorId, value] = args;
                    const body = await requestCloudflareJson(`/api/monitors/${monitorId}/tags`, {
                        method: "DELETE",
                        body: JSON.stringify({ tagId, value }),
                    });
                    await app.loadCloudflareWorkerData();
                    callback?.(body);
                    return;
                }

                if (event === "getMonitor") {
                    const body = await requestCloudflareJson(`/api/monitors/${args[0]}`);
                    callback?.(body);
                    return;
                }

                if (event === "add") {
                    const body = await requestCloudflareJson("/api/monitors", {
                        method: "POST",
                        body: JSON.stringify(args[0] || {}),
                    });
                    await app.loadCloudflareWorkerData();
                    callback?.(body);
                    return;
                }

                if (event === "uploadBackup") {
                    const [uploadedJSON, importHandle] = args;
                    const body = await requestCloudflareJson("/api/monitors/import", {
                        method: "POST",
                        body: JSON.stringify({
                            backup: JSON.parse(uploadedJSON || "{}"),
                            importHandle,
                        }),
                    });
                    await app.loadCloudflareWorkerData();
                    callback?.(body);
                    return;
                }

                if (event === "editMonitor") {
                    const monitor = args[0] || {};
                    const body = await requestCloudflareJson(`/api/monitors/${monitor.id}`, {
                        method: "PUT",
                        body: JSON.stringify(monitor),
                    });
                    await app.loadCloudflareWorkerData();
                    callback?.(body);
                    return;
                }

                if (event === "pauseMonitor" || event === "resumeMonitor") {
                    const body = await requestCloudflareJson(`/api/monitors/${args[0]}/active`, {
                        method: "PATCH",
                        body: JSON.stringify({ active: event === "resumeMonitor" }),
                    });
                    await app.loadCloudflareWorkerData();
                    callback?.({ ok: true, msg: event === "resumeMonitor" ? "Resumed" : "Paused", ...body });
                    return;
                }

                if (event === "deleteMonitor") {
                    const body = await requestCloudflareJson(`/api/monitors/${args[0]}`, {
                        method: "DELETE",
                    });
                    await app.loadCloudflareWorkerData();
                    callback?.({ ok: true, msg: "Deleted", ...body });
                    return;
                }

                if (event === "monitorImportantHeartbeatListCount") {
                    const monitorID = args[0];
                    callback?.({ ok: true, count: await countCloudflareHeartbeats(app, monitorID) });
                    return;
                }

                if (event === "monitorImportantHeartbeatListPaged") {
                    const [monitorID, offset, count] = args;
                    callback?.({
                        ok: true,
                        data: await getCloudflareHeartbeatPage(app, monitorID, offset, count),
                    });
                    return;
                }

                if (event === "clearEvents" || event === "clearHeartbeats") {
                    await requestCloudflareJson(`/api/monitors/${args[0]}/heartbeats`, {
                        method: "DELETE",
                    });
                    await app.loadCloudflareWorkerData();
                    callback?.({ ok: true, msg: "Heartbeats cleared" });
                    return;
                }

                if (event === "clearStatistics") {
                    const body = await requestCloudflareJson("/api/statistics", {
                        method: "DELETE",
                    });
                    await app.loadCloudflareWorkerData();
                    callback?.(body);
                    return;
                }

                if (event === "getMonitorChartData") {
                    const [monitorID, period] = args;
                    callback?.({ ok: true, data: getCloudflareChartData(app, monitorID, period) });
                    return;
                }

                if (event === "getMonitorBeats") {
                    const [monitorID] = args;
                    callback?.({ ok: true, data: app.heartbeatList[monitorID] || [] });
                    return;
                }

                if (event === "testChrome") {
                    callback?.({ ok: false, msg: "This action is not available in the Cloudflare Worker UI yet." });
                    return;
                }

                if (event === "testNotification") {
                    const body = await requestCloudflareJson("/api/notifications/test", {
                        method: "POST",
                        body: JSON.stringify(args[0] || {}),
                    });
                    callback?.(body);
                    return;
                }

                callback?.({ ok: false, msg: "This action is not available in the Cloudflare Worker UI yet." });
            } catch (error) {
                callback?.({ ok: false, msg: error.message });
            }
        },
    };
}

/**
 * Fetch heartbeat rows for a Worker-backed monitor.
 * @param {number} monitorID Monitor ID.
 * @param {number} offset Pagination offset.
 * @param {number} count Number of rows to fetch.
 * @returns {Promise<object[]>} Heartbeat rows.
 */
async function fetchCloudflareMonitorHeartbeats(monitorID, offset = 0, count = 150) {
    const body = await requestCloudflareJson(`/api/monitors/${monitorID}/heartbeats?offset=${offset}&count=${count}`);
    return body.heartbeats || [];
}

/**
 * Normalize Worker heartbeat history for live monitor state.
 * The Worker API returns newest-first rows for paged tables, while the heartbeat bar expects oldest-first.
 * @param {object[]} heartbeats Worker heartbeat rows.
 * @returns {object[]} Heartbeat rows ordered oldest-to-newest.
 */
function normalizeCloudflareHeartbeatHistory(heartbeats) {
    return heartbeats.slice().reverse();
}

/**
 * Fetch status pages for the Worker-backed UI.
 * @returns {Promise<object>} Status page map keyed by ID.
 */
async function fetchCloudflareStatusPages() {
    const body = await requestCloudflareJson("/api/status-pages");
    return body.statusPages || {};
}

/**
 * Count heartbeat rows for one monitor or all loaded monitors.
 * @param {object} app Vue root component instance.
 * @param {number|null} monitorID Monitor ID, or null for all loaded monitors.
 * @returns {Promise<number>} Heartbeat row count.
 */
async function countCloudflareHeartbeats(app, monitorID) {
    if (monitorID != null) {
        const body = await requestCloudflareJson(`/api/monitors/${monitorID}/heartbeats?offset=0&count=1`);
        return body.count || 0;
    }
    return Object.values(app.heartbeatList).reduce((total, beats) => total + beats.length, 0);
}

/**
 * Fetch a page of heartbeats for one monitor or all loaded monitors.
 * @param {object} app Vue root component instance.
 * @param {number|null} monitorID Monitor ID, or null for all loaded monitors.
 * @param {number} offset Pagination offset.
 * @param {number} count Number of rows to fetch.
 * @returns {Promise<object[]>} Heartbeat rows.
 */
async function getCloudflareHeartbeatPage(app, monitorID, offset = 0, count = 25) {
    if (monitorID != null) {
        return await fetchCloudflareMonitorHeartbeats(monitorID, offset, count);
    }
    return Object.values(app.heartbeatList)
        .flat()
        .sort((a, b) => String(b.time).localeCompare(String(a.time)))
        .slice(offset, offset + count);
}

/**
 * Calculate average ping from loaded heartbeat rows.
 * @param {object[]} heartbeats Heartbeat rows.
 * @returns {number|null} Average ping in milliseconds.
 */
function calculateAveragePing(heartbeats) {
    const upBeats = heartbeats.filter((beat) => beat.status === UP && beat.ping != null);
    if (upBeats.length === 0) {
        return null;
    }
    return Math.round(upBeats.reduce((total, beat) => total + Number(beat.ping), 0) / upBeats.length);
}

/**
 * Calculate uptime from loaded heartbeat rows.
 * @param {object[]} heartbeats Heartbeat rows.
 * @returns {number|undefined} Uptime ratio.
 */
function calculateUptime(heartbeats) {
    if (heartbeats.length === 0) {
        return undefined;
    }
    const available = heartbeats.filter((beat) => beat.status === UP).length;
    return available / heartbeats.length;
}

/**
 * Build simple chart datapoints from loaded heartbeat rows.
 * @param {object} app Vue root component instance.
 * @param {number} monitorID Monitor ID.
 * @param {number} periodHours Requested chart period in hours.
 * @returns {object[]} Chart datapoints.
 */
function getCloudflareChartData(app, monitorID, periodHours) {
    const since = Date.now() - Number(periodHours || 24) * 60 * 60 * 1000;
    return (app.heartbeatList[monitorID] || [])
        .filter((beat) => new Date(beat.time).getTime() >= since)
        .map((beat) => ({
            timestamp: Math.floor(new Date(beat.time).getTime() / 1000),
            up: beat.status === UP ? 1 : 0,
            down: beat.status === DOWN ? 1 : 0,
            maintenance: beat.status === MAINTENANCE ? 1 : 0,
            avgPing: beat.ping,
            minPing: beat.ping,
            maxPing: beat.ping,
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
}
