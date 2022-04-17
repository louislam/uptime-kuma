const { R } = require("redbean-node");
const HttpProxyAgent = require("http-proxy-agent");
const HttpsProxyAgent = require("https-proxy-agent");
const SocksProxyAgent = require("socks-proxy-agent");
const { debug } = require("../src/util");
const server = require("./server");

class Proxy {

    static SUPPORTED_PROXY_PROTOCOLS = ["http", "https", "socks", "socks5", "socks4"]

    /**
     * Saves and updates given proxy entity
     *
     * @param proxy
     * @param proxyID
     * @param userID
     * @return {Promise<Bean>}
     */
    static async save(proxy, proxyID, userID) {
        let bean;

        if (proxyID) {
            bean = await R.findOne("proxy", " id = ? AND user_id = ? ", [proxyID, userID]);

            if (!bean) {
                throw new Error("proxy not found");
            }

        } else {
            bean = R.dispense("proxy");
        }

        // Make sure given proxy protocol is supported
        if (!this.SUPPORTED_PROXY_PROTOCOLS.includes(proxy.protocol)) {
            throw new Error(`
                Unsupported proxy protocol "${proxy.protocol}.
                Supported protocols are ${this.SUPPORTED_PROXY_PROTOCOLS.join(", ")}."`
            );
        }

        // When proxy is default update deactivate old default proxy
        if (proxy.default) {
            await R.exec("UPDATE proxy SET `default` = 0 WHERE `default` = 1");
        }

        bean.user_id = userID;
        bean.protocol = proxy.protocol;
        bean.host = proxy.host;
        bean.port = proxy.port;
        bean.auth = proxy.auth;
        bean.username = proxy.username;
        bean.password = proxy.password;
        bean.active = proxy.active || true;
        bean.default = proxy.default || false;

        await R.store(bean);

        if (proxy.applyExisting) {
            await applyProxyEveryMonitor(bean.id, userID);
        }

        return bean;
    }

    /**
     * Deletes proxy with given id and removes it from monitors
     *
     * @param proxyID
     * @param userID
     * @return {Promise<void>}
     */
    static async delete(proxyID, userID) {
        const bean = await R.findOne("proxy", " id = ? AND user_id = ? ", [proxyID, userID]);

        if (!bean) {
            throw new Error("proxy not found");
        }

        // Delete removed proxy from monitors if exists
        await R.exec("UPDATE monitor SET proxy_id = null WHERE proxy_id = ?", [proxyID]);

        // Delete proxy from list
        await R.trash(bean);
    }

    /**
     * Create HTTP and HTTPS agents related with given proxy bean object
     *
     * @param proxy proxy bean object
     * @param options http and https agent options
     * @return {{httpAgent: Agent, httpsAgent: Agent}}
     */
    static createAgents(proxy, options) {
        const { httpAgentOptions, httpsAgentOptions } = options || {};
        let agent;
        let httpAgent;
        let httpsAgent;

        const proxyOptions = {
            protocol: proxy.protocol,
            host: proxy.host,
            port: proxy.port,
        };

        if (proxy.auth) {
            proxyOptions.auth = `${proxy.username}:${proxy.password}`;
        }

        debug(`Proxy Options: ${JSON.stringify(proxyOptions)}`);
        debug(`HTTP Agent Options: ${JSON.stringify(httpAgentOptions)}`);
        debug(`HTTPS Agent Options: ${JSON.stringify(httpsAgentOptions)}`);

        switch (proxy.protocol) {
            case "http":
            case "https":
                httpAgent = new HttpProxyAgent({
                    ...httpAgentOptions || {},
                    ...proxyOptions
                });

                httpsAgent = new HttpsProxyAgent({
                    ...httpsAgentOptions || {},
                    ...proxyOptions,
                });
                break;
            case "socks":
            case "socks5":
            case "socks4":
                agent = new SocksProxyAgent({
                    ...httpAgentOptions,
                    ...httpsAgentOptions,
                    ...proxyOptions,
                });

                httpAgent = agent;
                httpsAgent = agent;
                break;

            default: throw new Error(`Unsupported proxy protocol provided. ${proxy.protocol}`);
        }

        return {
            httpAgent,
            httpsAgent
        };
    }

    /**
     * Reload proxy settings for current monitors
     * @returns {Promise<void>}
     */
    static async reloadProxy() {
        let updatedList = await R.getAssoc("SELECT id, proxy_id FROM monitor");

        for (let monitorID in server.monitorList) {
            let monitor = server.monitorList[monitorID];

            if (updatedList[monitorID]) {
                monitor.proxy_id = updatedList[monitorID].proxy_id;
            }
        }
    }
}

/**
 * Applies given proxy id to monitors
 *
 * @param proxyID
 * @param userID
 * @return {Promise<void>}
 */
async function applyProxyEveryMonitor(proxyID, userID) {
    // Find all monitors with id and proxy id
    const monitors = await R.getAll("SELECT id, proxy_id FROM monitor WHERE user_id = ?", [userID]);

    // Update proxy id not match with given proxy id
    for (const monitor of monitors) {
        if (monitor.proxy_id !== proxyID) {
            await R.exec("UPDATE monitor SET proxy_id = ? WHERE id = ?", [proxyID, monitor.id]);
        }
    }
}

module.exports = {
    Proxy,
};
