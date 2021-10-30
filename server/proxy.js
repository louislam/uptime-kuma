const { R } = require("redbean-node");

class Proxy {

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
        if (!["http", "https"].includes(proxy.protocol)) {
            throw new Error(`Unsupported proxy protocol "${proxy.protocol}. Supported protocols are http and https."`);
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
