const { checkLogin } = require("../util-server");
const { log } = require("../../src/util");
const { R } = require("redbean-node");
const crypto = require("crypto");
const passwordHash = require("../password-hash");
const apicache = require("../modules/apicache");
const APIKey = require("../model/api_key");
const { sendAPIKeyList } = require("../client");

/**
 * Handlers for Maintenance
 * @param {Socket} socket Socket.io instance
 */
module.exports.apiKeySocketHandler = (socket) => {
    // Add a new api key
    socket.on("addAPIKey", async (key, callback) => {
        try {
            checkLogin(socket);
            let clearKey = crypto.randomUUID();
            let hashedKey = passwordHash.generate(clearKey);
            key["key"] = hashedKey;
            let bean = await APIKey.save(key, socket.userID);

            log.debug("apikeys", "Added API Key");
            log.debug("apikeys", key);

            // Append key ID to start of key seperated by -, used to get
            // correct hash when validating key.
            let formattedKey = bean.id + "-" + clearKey;
            await sendAPIKeyList(socket);

            callback({
                ok: true,
                msg: "Added Successfully.",
                key: formattedKey,
                keyID: bean.id,
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
            await sendAPIKeyList(socket);
            callback({
                ok: true,
            });
        } catch (e) {
            console.error(e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("deleteAPIKey", async (keyID, callback) => {
        try {
            checkLogin(socket);

            log.debug("apikeys", `Deleted API Key: ${keyID} User ID: ${socket.userID}`);

            await R.exec("DELETE FROM api_key WHERE id = ? AND user_id = ? ", [
                keyID,
                socket.userID,
            ]);

            apicache.clear();

            callback({
                ok: true,
                msg: "Deleted Successfully.",
            });

            await sendAPIKeyList(socket);

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("disableAPIKey", async (keyID, callback) => {
        try {
            checkLogin(socket);

            log.debug("apikeys", `Disabled Key: ${keyID} User ID: ${socket.userID}`);

            await R.exec("UPDATE api_key SET active = 0 WHERE id = ? ", [
                keyID,
            ]);

            apicache.clear();

            callback({
                ok: true,
                msg: "Disabled Successfully.",
            });

            await sendAPIKeyList(socket);

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("enableAPIKey", async (keyID, callback) => {
        try {
            checkLogin(socket);

            log.debug("apikeys", `Enabled Key: ${keyID} User ID: ${socket.userID}`);

            await R.exec("UPDATE api_key SET active = 1 WHERE id = ? ", [
                keyID,
            ]);

            apicache.clear();

            callback({
                ok: true,
                msg: "Enabled Successfully",
            });

            await sendAPIKeyList(socket);

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
