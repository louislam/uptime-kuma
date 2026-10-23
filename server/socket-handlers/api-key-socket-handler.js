const { log } = require("../../src/util");
const { R } = require("redbean-node");
const dayjs = require("dayjs");
const apicache = require("../modules/apicache");
const { Settings } = require("../settings");
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

            // Enable API auth if the user creates a key, otherwise only basic
            // auth will be used for API.
            await Settings.set("apiKeysEnabled", true);
            apicache.clear();

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

            const result = await auth().api.listApiKeys({
                query: {},
                headers: socket.headers,
            });

            // Legacy API keys stay in the old table, prefix their ID so it cannot clash with a Better Auth ID
            const legacyBeans = await R.find("api_key");
            const legacyKeys = legacyBeans.map((bean) => ({
                id: "legacy-" + bean.id,
                name: bean.name,
                enabled: !!bean.active,
                expiresAt: bean.expires,
                createdAt: bean.created_date,
            }));

            callback({
                ok: true,
                apiKeyList: [...result.apiKeys, ...legacyKeys],
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

            if (typeof keyID === "string" && keyID.startsWith("legacy-")) {
                log.debug("apikeys", `Deleted Legacy API Key: ${keyID} User ID: ${socket.userID}`);
                await R.exec("DELETE FROM api_key WHERE id = ?", [keyID.substring("legacy-".length)]);
            } else {
                await auth().api.deleteApiKey({
                    body: {
                        keyId: keyID,
                    },
                    headers: createHeaders(socket.request.headers.cookie),
                });
            }

            apicache.clear();

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
};
