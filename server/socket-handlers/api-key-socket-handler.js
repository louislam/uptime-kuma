const { log } = require("../../src/util");
const { R } = require("redbean-node");
const dayjs = require("dayjs");
const apicache = require("../modules/apicache");
const { auth, createHeaders, checkLogin } = require("../better-auth");

/**
 * Handlers for API keys
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
module.exports.apiKeySocketHandler = (socket) => {
    // Add a new better-auth api key
    socket.on("addAPIKey", async (key, callback) => {
        try {
            checkLogin(socket);

            let expiresIn;

            if (key.expires) {
                expiresIn = dayjs(key.expires).diff(dayjs(), "second");
                if (expiresIn <= 0) {
                    expiresIn = undefined;
                }
            }

            const result = await auth().api.createApiKey({
                body: {
                    name: key.name,
                    expiresIn,
                    userId: socket.userID,
                },
                headers: socket.headers,
            });

            log.debug("apikeys", "Added API Key");
            log.debug("apikeys", key);

            callback({
                ok: true,
                msg: "successAdded",
                msgi18n: true,
                key: result.key,
                keyID: result.id,
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("getAPIKeyList", async (callback) => {
        try {
            checkLogin(socket);

            const baKeys = await auth().api.listApiKeys({
                query: {},
                headers: socket.headers,
            });

            const legacyBeans = await R.find("api_key");
            const legacyAPIKeyList = legacyBeans.map((bean) => bean.toPublicJSON());

            callback({
                ok: true,
                apiKeyList: baKeys.apiKeys,
                legacyAPIKeyList: legacyAPIKeyList,
            });
        } catch (e) {
            log.error("apikeys", e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("deleteAPIKey", async (keyID, callback) => {
        try {
            checkLogin(socket);

            await auth().api.deleteApiKey({
                body: {
                    keyId: keyID,
                },
                headers: createHeaders(socket.request.headers.cookie),
            });

            callback({
                ok: true,
                msg: "successDeleted",
                msgi18n: true,
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("deleteLegacyAPIKey", async (keyID, callback) => {
        try {
            checkLogin(socket);

            log.debug("apikeys", `Deleted Legacy API Key: ${keyID} User ID: ${socket.userID}`);

            await R.exec("DELETE FROM api_key WHERE id = ? AND user_id = ? ", [keyID, socket.userID]);

            apicache.clear();

            const legacyBeans = await R.find("api_key");
            const legacyKeys = legacyBeans.map((bean) => bean.toPublicJSON());

            callback({
                ok: true,
                msg: "successDeleted",
                msgi18n: true,
                legacyKeys: legacyKeys,
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
