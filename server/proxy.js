const { R } = require("redbean-node");
const { HttpProxyAgent } = require("http-proxy-agent");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { SocksProxyAgent } = require("socks-proxy-agent");
const { debug } = require("../src/util");
const { UptimeKumaServer } = require("./uptime-kuma-server");
const { CookieJar } = require("tough-cookie");
const { createCookieAgent } = require("http-cookie-agent/http");

class Proxy {

    static SUPPORTED_PROXY_PROTOCOLS = [ "http", "https", "socks", "socks5", "socks5h", "socks4" ];

    /**
     * Saves and updates given proxy entity
     * @param {object} proxy Proxy to store
     * @param {number} proxyID ID of proxy to update
     * @param {number} userID ID of user the proxy belongs to
     * @returns {Promise<Bean>} Updated proxy
     */
    static async save(proxy, proxyID, userID) {
        let bean;

        if (proxyID) {
            bean = await R.findOne("proxy", " id = ? AND user_id = ? ", [ proxyID, userID ]);

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
     * @param {number} proxyID ID of proxy to delete
     * @param {number} userID ID of proxy owner
     * @returns {Promise<void>}
     */
    static async delete(proxyID, userID) {
        const bean = await R.findOne("proxy", " id = ? AND user_id = ? ", [ proxyID, userID ]);

        if (!bean) {
            throw new Error("proxy not found");
        }

        // Delete removed proxy from monitors if exists
        await R.exec("UPDATE monitor SET proxy_id = null WHERE proxy_id = ?", [ proxyID ]);

        // Delete proxy from list
        await R.trash(bean);
    }

    /**
     * Create HTTP and HTTPS agents related with given proxy bean object
     * @param {object} proxy proxy bean object
     * @param {object} options http and https agent options
     * @returns {{httpAgent: Agent, httpsAgent: Agent}} New HTTP and HTTPS agents
     * @throws Proxy protocol is unsupported
     */
    static createAgents(proxy, options) {
        const { httpAgentOptions, httpsAgentOptions } = options || {};
        let agent;
        let httpAgent;
        let httpsAgent;

        let jar = new CookieJar();

        const proxyOptions = {
            cookies: { jar },
        };

        const proxyUrl = new URL(`${proxy.protocol}://${proxy.host}:${proxy.port}`);

        if (proxy.auth) {
            proxyUrl.username = proxy.username;
            proxyUrl.password = proxy.password;
        }

        debug(`Proxy URL: ${proxyUrl.toString()}`);
        debug(`HTTP Agent Options: ${JSON.stringify(httpAgentOptions)}`);
        debug(`HTTPS Agent Options: ${JSON.stringify(httpsAgentOptions)}`);

        switch (proxy.protocol) {
            case "http":
            case "https":
                // eslint-disable-next-line no-case-declarations
                const HttpCookieProxyAgent = createCookieAgent(HttpProxyAgent);
                // eslint-disable-next-line no-case-declarations
                const HttpsCookieProxyAgent = createCookieAgent(HttpsProxyAgent);

                httpAgent = new HttpCookieProxyAgent(proxyUrl.toString(), {
                    ...(httpAgentOptions || {}),
                    ...proxyOptions,
                });
                httpsAgent = new HttpsCookieProxyAgent(proxyUrl.toString(), {
                    ...(httpsAgentOptions || {}),
                    ...proxyOptions,
                });

                break;
            case "socks":
            case "socks5":
            case "socks5h":
            case "socks4":
                // eslint-disable-next-line no-case-declarations
                const SocksCookieProxyAgent = createCookieAgent(SocksProxyAgent);
                agent = new SocksCookieProxyAgent(proxyUrl.toString(), {
                    ...httpAgentOptions,
                    ...httpsAgentOptions,
                    tls: {
                        rejectUnauthorized: httpsAgentOptions.rejectUnauthorized,
                    },
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
        const server = UptimeKumaServer.getInstance();

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
 * @param {number} proxyID ID of proxy to apply
 * @param {number} userID ID of proxy owner
 * @returns {Promise<void>}
 */
async function applyProxyEveryMonitor(proxyID, userID) {
    // Find all monitors with id and proxy id
    const monitors = await R.getAll("SELECT id, proxy_id FROM monitor WHERE user_id = ?", [ userID ]);

    // Update proxy id not match with given proxy id
    for (const monitor of monitors) {
        if (monitor.proxy_id !== proxyID) {
            await R.exec("UPDATE monitor SET proxy_id = ? WHERE id = ?", [ proxyID, monitor.id ]);
        }
    }
}

module.exports = {
    Proxy,
};
