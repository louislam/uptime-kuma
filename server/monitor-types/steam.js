const { MonitorType } = require("./monitor-type");
const {
    UP,
    PING_COUNT_DEFAULT,
    PING_GLOBAL_TIMEOUT_DEFAULT,
    PING_PER_REQUEST_TIMEOUT_DEFAULT,
} = require("../../src/util");
const { ping, checkStatusCode, setting } = require("../util-server");
const axios = require("axios");
const https = require("https");
const http = require("http");
const crypto = require("crypto");

class SteamMonitorType extends MonitorType {
    name = "steam";
    steamApiUrl = "https://api.steampowered.com/IGameServersService/GetServerList/v1/";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const res = await this.getServerList(monitor);
        if (res.data.response && res.data.response.servers && res.data.response.servers.length > 0) {
            heartbeat.status = UP;
            heartbeat.msg = res.data.response.servers[0].name;

            try {
                heartbeat.ping = await ping(
                    monitor.hostname,
                    PING_COUNT_DEFAULT,
                    "",
                    true,
                    monitor.packetSize,
                    PING_GLOBAL_TIMEOUT_DEFAULT,
                    PING_PER_REQUEST_TIMEOUT_DEFAULT
                );
            } catch (_) {}
        } else {
            throw new Error("Server not found on Steam");
        }
    }

    /**
     * Get server list from Steam API
     * @param {Monitor} monitor Monitor object
     * @returns {Promise<axios.AxiosResponse>} Axios response object containing server list data
     * @throws {Error} If Steam API Key is not configured
     */
    async getServerList(monitor) {
        const steamAPIKey = await setting("steamAPIKey");
        const filter = `addr\\${monitor.hostname}:${monitor.port}`;

        if (!steamAPIKey) {
            throw new Error("Steam API Key not found");
        }
        const options = {
            timeout: monitor.timeout * 1000,
            headers: {
                Accept: "*/*",
            },
            httpsAgent: new https.Agent({
                maxCachedSessions: 0, // Use Custom agent to disable session reuse (https://github.com/nodejs/node/issues/3940)
                rejectUnauthorized: !monitor.ignoreTls,
                secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
            }),
            httpAgent: new http.Agent({
                maxCachedSessions: 0,
            }),
            maxRedirects: monitor.maxredirects,
            validateStatus: (status) => {
                return checkStatusCode(status, monitor.getAcceptedStatuscodes());
            },
            params: {
                filter: filter,
                key: steamAPIKey,
            },
        };
        return await axios.get(this.steamApiUrl, options);
    }
}

module.exports = {
    SteamMonitorType,
};
