const { getKnex } = require("./db");
const { HttpProxyAgent } = require("http-proxy-agent");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { SocksProxyAgent } = require("socks-proxy-agent");
const { debug } = require("../src/util");
const { UptimeKumaServer } = require("./uptime-kuma-server");
const { CookieJar } = require("tough-cookie");
const { createCookieAgent } = require("http-cookie-agent/http");
const ProxyModel = require("./model/proxy");

class Proxy {
    static SUPPORTED_PROXY_PROTOCOLS = ["http", "https", "socks", "socks5", "socks5h", "socks4"];

    /**
     * Saves and updates given proxy entity
     * @param {object} proxy Proxy to store
     * @param {number} proxyID ID of proxy to update
     * @param {number} userID ID of user the proxy belongs to
     * @returns {Promise<import("./model/proxy")>} Updated proxy
     */
    static async save(proxy, proxyID, userID) {
        const knex = getKnex();

        // Make sure given proxy protocol is supported
        if (!this.SUPPORTED_PROXY_PROTOCOLS.includes(proxy.protocol)) {
            throw new Error(`
                Unsupported proxy protocol "${proxy.protocol}.
                Supported protocols are ${this.SUPPORTED_PROXY_PROTOCOLS.join(", ")}."`);
        }

        // When proxy is default update deactivate old default proxy
        if (proxy.default) {
            await knex("proxy").where({ default: true }).update({ default: false });
        }

        const payload = {
            user_id: userID,
            protocol: proxy.protocol,
            host: proxy.host,
            port: proxy.port,
            auth: proxy.auth,
            username: proxy.username,
            password: proxy.password,
            active: proxy.active ?? true,
            default: proxy.default || false,
        };

        let bean;
        if (proxyID) {
            const existing = await ProxyModel.query().where({ id: proxyID,
                user_id: userID }).first();
            if (!existing) {
                throw new Error("proxy not found");
            }
            bean = await ProxyModel.query().patchAndFetchById(proxyID, payload);
        } else {
            bean = await ProxyModel.query().insertAndFetch(payload);
        }

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
        const knex = getKnex();
        const existing = await knex("proxy").where({ id: proxyID,
            user_id: userID }).first();
        if (!existing) {
            throw new Error("proxy not found");
        }

        // Detach removed proxy from monitors
        await knex("monitor").where("proxy_id", proxyID).update({ proxy_id: null });

        // Delete proxy from list
        await knex("proxy").where("id", proxyID).delete();
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

            default:
                throw new Error(`Unsupported proxy protocol provided. ${proxy.protocol}`);
        }

        return {
            httpAgent,
            httpsAgent,
        };
    }

    /**
     * Reload proxy settings for current monitors
     * @returns {Promise<void>}
     */
    static async reloadProxy() {
        const server = UptimeKumaServer.getInstance();
        const rows = await getKnex()("monitor").select("id", "proxy_id");
        const updatedList = {};
        for (const row of rows) {
            updatedList[row.id] = row.proxy_id;
        }

        for (let monitorID in server.monitorList) {
            let monitor = server.monitorList[monitorID];

            if (Object.prototype.hasOwnProperty.call(updatedList, monitorID)) {
                monitor.proxy_id = updatedList[monitorID];
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
    const knex = getKnex();
    // Find all monitors with id and proxy id
    const monitors = await knex("monitor").where("user_id", userID).select("id", "proxy_id");

    // Update proxy id not matching given proxy id
    for (const monitor of monitors) {
        if (monitor.proxy_id !== proxyID) {
            await knex("monitor").where("id", monitor.id).update({ proxy_id: proxyID });
        }
    }
}

module.exports = {
    Proxy,
};
