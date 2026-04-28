const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const axios = require("axios");
const https = require("https");

/**
 * Convert a glob pattern (supporting * and ?) to a case-insensitive RegExp.
 * @param {string} pattern Glob pattern
 * @returns {RegExp} Case-insensitive regular expression
 */
function globToRegex(pattern) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    return new RegExp("^" + escaped.replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i");
}

/**
 * Parse the filter string into compiled RegExp patterns.
 * @param {string|null} filterStr Comma-separated glob patterns
 * @returns {RegExp[]} Compiled filter patterns
 */
function parseFilter(filterStr) {
    if (!filterStr || !filterStr.trim()) {
        return [];
    }
    return filterStr
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .map(globToRegex);
}

/**
 * Decide whether an item should be included in the check.
 * @param {string} name Human-readable name
 * @param {string} id Technical identifier
 * @param {RegExp[]} patterns Compiled filter patterns (empty = no filter, include all)
 * @param {"include"|"exclude"} mode Filter mode
 * @returns {boolean} True if the item should be checked
 */
function shouldInclude(name, id, patterns, mode) {
    if (patterns.length === 0) {
        return true;
    }
    const matched = patterns.some((re) => re.test(name) || re.test(id));
    return mode === "exclude" ? !matched : matched;
}

class SyncthingMonitorType extends MonitorType {
    name = "syncthing";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, server) {
        const baseUrl = (monitor.syncthingUrl || "http://localhost:8384").replace(/\/+$/, "");
        const apiKey = monitor.syncthingApiKey || "";
        const timeoutMs = (monitor.timeout || 30) * 1000;
        const startTime = Date.now();

        const httpsAgent = baseUrl.startsWith("https://")
            ? new https.Agent({ rejectUnauthorized: !monitor.ignoreTls })
            : undefined;

        /**
         * Call a Syncthing REST API endpoint.
         * @param {string} path API path after /rest/ e.g. "system/status"
         * @returns {Promise<object>} Parsed JSON response
         */
        const api = async (path) => {
            try {
                const res = await axios.get(`${baseUrl}/rest/${path}`, {
                    headers: { "X-API-Key": apiKey },
                    timeout: timeoutMs,
                    ...(httpsAgent ? { httpsAgent } : {}),
                });
                return res.data;
            } catch (err) {
                if (err.response?.status === 403 || err.response?.status === 401) {
                    throw new Error("Invalid Syncthing API key");
                }
                if (err.code === "ECONNREFUSED") {
                    throw new Error(`Cannot connect to Syncthing at ${baseUrl}`);
                }
                if (err.code === "ENOTFOUND") {
                    throw new Error(`Cannot resolve hostname: ${baseUrl}`);
                }
                if (err.code === "ETIMEDOUT" || err.code === "ECONNABORTED") {
                    throw new Error(`Connection timed out after ${monitor.timeout}s`);
                }
                throw new Error(`Syncthing API error: ${err.message}`);
            }
        };

        const checkType = monitor.syncthingCheckType || "health";

        if (checkType === "health") {
            await this._checkHealth(monitor, heartbeat, api, startTime);
        } else if (checkType === "peers") {
            await this._checkPeers(monitor, heartbeat, api, startTime);
        } else {
            throw new Error(`Unknown check type: "${checkType}"`);
        }
    }

    /**
     * Check Syncthing system health: API reachability, active errors, folder sync status.
     * Folders can be filtered by label/ID using glob patterns.
     * @param {object} monitor Monitor configuration
     * @param {object} heartbeat Heartbeat to update
     * @param {Function} api Syncthing API helper
     * @param {number} startTime Start time in ms
     * @returns {Promise<void>}
     */
    async _checkHealth(monitor, heartbeat, api, startTime) {
        // Verifies reachability + API key in one shot
        await api("system/status");

        const patterns = parseFilter(monitor.syncthingFilter);
        const filterMode = monitor.syncthingFilterMode || "exclude";
        const thresholdMs =
            (monitor.syncthingFolderSyncThreshold || 0) > 0 ? monitor.syncthingFolderSyncThreshold * 1000 : null;

        // System errors
        const errData = await api("system/error");
        const sysErrors = Array.isArray(errData.errors) ? errData.errors.map((e) => e.message) : [];
        const sysStatus = sysErrors.length > 0 ? sysErrors.join(", ") : "ok";

        // Folder statuses
        const config = await api("system/config");
        const folderEntries = [];

        for (const folder of config.folders || []) {
            if (folder.paused) {
                continue;
            }

            const label = folder.label || folder.id;
            if (!shouldInclude(label, folder.id, patterns, filterMode)) {
                continue;
            }

            const status = await api(`db/status?folder=${encodeURIComponent(folder.id)}`);
            let folderStatus;

            switch (status.state) {
                case "error":
                    folderStatus = "error";
                    break;

                case "idle":
                    if (status.errors > 0) {
                        folderStatus = `${status.errors} items failed`;
                    } else if (status.needBytes > 0) {
                        const mib = (status.needBytes / 1024 / 1024).toFixed(1);
                        folderStatus = `out of sync ${mib} MiB`;
                    } else {
                        folderStatus = "ok";
                    }
                    break;

                case "syncing":
                case "scanning":
                    if (thresholdMs !== null) {
                        const stuckMs = Date.now() - new Date(status.stateChanged).getTime();
                        if (stuckMs > thresholdMs) {
                            folderStatus = "stuck";
                            break;
                        }
                    }
                    folderStatus = "ok";
                    break;

                default:
                    folderStatus = "ok";
                    break;
            }

            folderEntries.push({ label, folderStatus });
        }

        folderEntries.sort((a, b) => a.label.localeCompare(b.label));

        const parts = [`System: ${sysStatus}`];
        for (const { label, folderStatus } of folderEntries) {
            parts.push(`${label}: ${folderStatus}`);
        }
        const msg = parts.join(" | ");

        heartbeat.ping = Date.now() - startTime;

        if (sysErrors.length > 0 || folderEntries.some((f) => f.folderStatus !== "ok")) {
            throw new Error(msg);
        }

        heartbeat.msg = msg;
        heartbeat.status = UP;
    }

    /**
     * Check connectivity of Syncthing peers.
     * Devices can be filtered by name/ID using glob patterns.
     * Paused devices are always ignored.
     * @param {object} monitor Monitor configuration
     * @param {object} heartbeat Heartbeat to update
     * @param {Function} api Syncthing API helper
     * @param {number} startTime Start time in ms
     * @returns {Promise<void>}
     */
    async _checkPeers(monitor, heartbeat, api, startTime) {
        const patterns = parseFilter(monitor.syncthingFilter);
        const filterMode = monitor.syncthingFilterMode || "exclude";
        const peerTimeoutMs = (monitor.syncthingPeerTimeout || 86400) * 1000;

        // Fetch all required data upfront
        const [sysStatus, config, connections, stats] = await Promise.all([
            api("system/status"),
            api("system/config"),
            api("system/connections"),
            api("stats/device"),
        ]);

        const localId = sysStatus.myID;
        const devices = (config.devices || []).filter((d) => d.deviceID !== localId);
        const connMap = connections.connections || {};

        const peerEntries = [];

        for (const device of devices) {
            if (!shouldInclude(device.name, device.deviceID, patterns, filterMode)) {
                continue;
            }

            const conn = connMap[device.deviceID] || {};

            // Paused peers are intentionally offline — ignore them
            if (conn.paused) {
                continue;
            }

            let peerStatus;

            if (conn.connected) {
                peerStatus = "up";
            } else {
                const lastSeenStr = (stats[device.deviceID] || {}).lastSeen;
                // "0001-01-01T00:00:00Z" means never seen
                if (!lastSeenStr || lastSeenStr.startsWith("0001-")) {
                    peerStatus = "down";
                } else {
                    const lastSeenMs = Date.now() - new Date(lastSeenStr).getTime();
                    peerStatus = lastSeenMs > peerTimeoutMs ? "down" : "up";
                }
            }

            peerEntries.push({ name: device.name, peerStatus });
        }

        peerEntries.sort((a, b) => a.name.localeCompare(b.name));

        heartbeat.ping = Date.now() - startTime;

        if (peerEntries.length === 0) {
            heartbeat.msg = "No peers";
            heartbeat.status = UP;
            return;
        }

        const msg = peerEntries.map((p) => `${p.name}: ${p.peerStatus}`).join(" | ");

        if (peerEntries.some((p) => p.peerStatus === "down")) {
            throw new Error(msg);
        }

        heartbeat.msg = msg;
        heartbeat.status = UP;
    }
}

module.exports = { SyncthingMonitorType };
