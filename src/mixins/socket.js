import { markRaw } from "vue";
import { io } from "socket.io-client";
import { useToast } from "vue-toastification";
import Favico from "favico.js";
import dayjs from "dayjs";
import mitt from "mitt";

import { DOWN, MAINTENANCE, PENDING, UP } from "../util.ts";
import { getToastSuccessTimeout, getToastErrorTimeout } from "../util-frontend.js";
import { BeatVersionThrottle } from "../beat-version-throttle";
import { applyBeat, applyLatestBeats, beatStatusEntry } from "../beat-state";
import { logout as betterAuthLogout } from "../auth-client";
const toast = useToast();

let socket;
let disconnectTimeout;

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
                firstConnect: true,
                connected: false,
                connectCount: 0,
                initedSocketIO: false,
            },
            username: null,
            remember: localStorage.remember !== "0",
            allowLoginDialog: false, // Allowed to show login dialog, but "loggedIn" have to be true too. This exists because prevent the login dialog show 0.1s in first before the socket server auth-ed.
            loggedIn: false,
            loginRequired: false,
            monitorList: {},
            monitorTypeList: {},
            maintenanceList: {},
            heartbeatList: {},
            // Kept in sync incrementally by the heartbeat handlers. As computed values they
            // were rebuilt over all monitors on every beat (thousands of monitors = hot loop)
            lastHeartbeatList: {},
            statusList: {},
            // Non-reactive copy used by the dashboard counters, so a beat does not force
            // an O(monitors) recount; the counters refresh at most once per second
            lastBeatRaw: markRaw({}),
            heartbeatVersion: 0,
            heartbeatVersionThrottle: markRaw(
                new BeatVersionThrottle(() => {
                    this.heartbeatVersion++;
                }, 1000)
            ),
            heartbeatHistoryRequested: new Set(),
            monitorListLoaded: false,
            dashboardLoadProgress: 0,
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
            connectionErrorMsg: `${this.$t("Cannot connect to the socket server.")} ${this.$t("Reconnecting...")}`,
            showReverseProxyGuide: true,
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
         * Store the newest beat of a monitor and its display status.
         * Called per beat: must stay O(1), thousands of monitors beat every minute.
         * @param {number} monitorID Monitor id
         * @param {object} beat Heartbeat
         * @returns {void}
         */
        updateLastBeat(monitorID, beat) {
            applyBeat(this, monitorID, beat, this.statusEntryFor(beat));
            this.heartbeatVersionThrottle.schedule();
        },

        /**
         * Map a heartbeat status to its display text and color
         * @param {object} beat Heartbeat
         * @returns {{text: string, color: string}} Status entry
         */
        statusEntryFor(beat) {
            return beatStatusEntry(this.$t.bind(this), beat);
        },

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
            // The Vite dev frontend runs on :3000 and the backend on :3001. Anywhere else,
            // connect to the origin that served this page (do not rely on build-time NODE_ENV)
            if (location.port === "3000" || localStorage.dev === "dev") {
                url = protocol + location.hostname + ":3001";
            } else {
                // Connect to the current url
                url = undefined;
            }

            socket = io(url, {
                withCredentials: true,
                // Prefer WebSocket so the large login payload is compressed by perMessageDeflate
                // and is not sent over a single slow polling response
                transports: ["websocket", "polling"],
            });

            socket.on("info", (info) => {
                // Sent without `runtime` before login (hideVersion), so keep a safe default
                this.info = { runtime: { platform: "" }, ...info };
            });

            socket.on("setup", () => {
                this.$router.push("/setup");
            });

            socket.on("session", (username) => {
                this.loggedIn = true;
                this.$root.loginRequired = false;
                this.username = username;
                if (!this.$root.dashboardLoadProgress) {
                    this.$root.dashboardLoadProgress = 8;
                }
            });

            socket.on("loginRequired", () => {
                this.allowLoginDialog = true;
                this.$root.loginRequired = true;
                this.$root.dashboardLoadProgress = 0;
            });

            socket.on("monitorList", (data) => {
                this.assignMonitorUrlParser(data);
                this.monitorList = data;
                this.monitorListLoaded = true;

                // Tell the server the list is painted, so it sends the heavier heartbeat and
                // stats payloads only now (not before the first render). The loading bar is
                // done at the same point: the list is what the user is waiting for.
                this.$nextTick(() => {
                    requestAnimationFrame(() => {
                        this.$root.dashboardLoadProgress = 100;
                        if (socket && !socket.dashboardRendered) {
                            socket.dashboardRendered = true;
                            socket.emit("dashboardRendered");
                        }
                    });
                });
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

            socket.on("notificationList", (data) => {
                this.notificationList = data;
            });

            socket.on("statusPageList", (data) => {
                this.statusPageListLoaded = true;
                this.statusPageList = data;
            });

            socket.on("proxyList", (data) => {
                this.proxyList = data.map((item) => {
                    item.auth = !!item.auth;
                    item.active = !!item.active;
                    item.default = !!item.default;

                    return item;
                });
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
                this.updateLastBeat(data.monitorID, data);

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
                if (data.length > 0) {
                    this.updateLastBeat(monitorID, data[data.length - 1]);
                }
            });

            socket.on("heartbeatLists", (data) => {
                for (const monitorID in data) {
                    const beats = data[monitorID];
                    applyLatestBeats(this.heartbeatList, monitorID, beats);
                    if (beats.length > 0) {
                        this.updateLastBeat(monitorID, beats[beats.length - 1]);
                    }
                }
            });

            socket.on("avgPing", (monitorID, data) => {
                this.avgPingList[monitorID] = data;
            });

            socket.on("stats", (data) => {
                for (const [monitorID, stats] of Object.entries(data)) {
                    this.avgPingList[monitorID] = stats.avgPing;
                    this.uptimeList[`${monitorID}_24`] = stats.uptime24;
                    this.uptimeList[`${monitorID}_720`] = stats.uptime720;
                    this.uptimeList[`${monitorID}_1y`] = stats.uptime1y;
                }
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
                this.showReverseProxyGuide = true;
                this.socket.connected = false;
                this.socket.firstConnect = false;
            });

            socket.on("disconnect", () => {
                console.log("disconnect");
                // As we are using cookie based auth, we have to reconnect the socket
                // avoid noise by add a delay
                disconnectTimeout = setTimeout(() => {
                    this.connectionErrorMsg = `${this.$t("Lost connection to the socket server.")} ${this.$t("Reconnecting...")}`;
                    this.socket.connected = false;
                    this.$root.dashboardLoadProgress = 0;
                }, 2000);
            });

            socket.on("connect", () => {
                console.log("Connected to the socket server");

                clearTimeout(disconnectTimeout);

                this.socket.connectCount++;
                this.socket.connected = true;
                this.showReverseProxyGuide = false;
                // A new connection gets its own monitor list; allow the next one to signal paint
                socket.dashboardRendered = false;

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
         * Log out of the web application
         * @returns {void}
         */
        async logout() {
            await betterAuthLogout(() => {
                console.log("Logged out");
                this.loggedIn = false;
                this.username = null;
                this.allowLoginDialog = false;
                this.clearData();
                reconnectSocket();
            });
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
         * Send list of API keys (callback receives Better Auth keys and legacy keys)
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
         * Clear the heartbeat list
         * @returns {void}
         */
        clearData() {
            console.log("reset heartbeat list");
            this.heartbeatList = {};
            this.lastHeartbeatList = {};
            this.statusList = {};
            this.lastBeatRaw = markRaw({});
            this.heartbeatVersion = 0;
            this.heartbeatVersionThrottle.cancel();
            this.heartbeatHistoryRequested = new Set();
            this.monitorListLoaded = false;
            this.$root.dashboardLoadProgress = 0;
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

            // Recompute at most once per second, not on every heartbeat
            this.heartbeatVersion;
            const raw = this.lastBeatRaw;
            for (let monitorID in this.$root.monitorList) {
                let beat = raw[monitorID];
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
            // No need to refresh, when the version is not obtained, which means it is not logged in.
            if (!to) {
                return;
            }

            if (from && from !== to) {
                console.log(`Server version changed from ${from} to ${to}, reloading the page`);
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
 * Reconnect the socket.io connection.
 * Usage: Reconnect socket.io with auth-ed cookie, or drop the auth-ed session.
 */
export function reconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket.connect();
    }
}
