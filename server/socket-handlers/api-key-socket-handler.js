const { checkLogin } = require("../util-server");
const { log } = require("../../src/util");
const { R } = require("redbean-node");
const { nanoid } = require("nanoid");
const passwordHash = require("../password-hash");
const apicache = require("../modules/apicache");
const APIKey = require("../model/api_key");
const { Settings } = require("../settings");
const { sendAPIKeyList } = require("../client");

/**
 * Handlers for Maintenance
 * @param {Socket} socket Socket.io instance
 */
module.exports.apiKeySocketHandler = (socket) => {
    // Add a new api key
    socket.on("addAPIKey", async (key, callback) => {

        log.debug("server/socket-handlers/api-key-socket-handler.js/apiKeySocketHandler(socket)/socket.on(addAPIKey)","");

        try {
            checkLogin(socket);

            let clearKey = nanoid(40);
            let hashedKey = passwordHash.generate(clearKey);
            key["key"] = hashedKey;
            let bean = await APIKey.save(key, socket.userID);

            log.debug("server/socket-handlers/api-key-socket-handler.js/apiKeySocketHandler(socket)/socket.on(enableAPIKey)", "Added API Key");
            log.debug("server/socket-handlers/api-key-socket-handler.js/apiKeySocketHandler(socket)/socket.on(enableAPIKey)", key);

            // Append key ID and prefix to start of key seperated by _, used to get
            // correct hash when validating key.
            let formattedKey = "uk" + bean.id + "_" + clearKey;
            await sendAPIKeyList(socket);

            // Enable API auth if the user creates a key, otherwise only basic
            // auth will be used for API.
            await Settings.set("apiKeysEnabled", true);
            log.debug("server/socket-handlers/api-key-socket-handler.js/apiKeySocketHandler(socket)/socket.on(enableAPIKey)",
            `Settings.set("apiKeysEnabled", true)`);

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
        log.debug("server/socket-handlers/api-key-socket-handler.js/apiKeySocketHandler(socket)/socket.on(getAPIKeyList)","");
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
        log.debug("server/socket-handlers/api-key-socket-handler.js/apiKeySocketHandler(socket)/socket.on(deleteAPIKey)","");
        try {
            checkLogin(socket);

            log.debug("server/socket-handlers/api-key-socket-handler.js/apiKeySocketHandler(socket)/socket.on(enableAPIKey)", `Deleted API Key: ${keyID} User ID: ${socket.userID}`);

            await R.exec("DELETE FROM api_key WHERE id = ? AND user_id = ? ", [
                keyID,
                socket.userID,
            ]);
            log.debug("server/socket-handlers/api-key-socket-handler.js/apiKeySocketHandler(socket)/socket.on(deleteAPIKey)",
            `R.exec("DELETE FROM api_key WHERE id = ${keyID} AND user_id = ${socket.userID} ")`);

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
        log.debug("server/socket-handlers/api-key-socket-handler.js/apiKeySocketHandler(socket)/socket.on(disableAPIKey)","");
        try {
            checkLogin(socket);

            log.debug("server/socket-handlers/api-key-socket-handler.js/apiKeySocketHandler(socket)/socket.on(enableAPIKey)", `Disabled Key: ${keyID} User ID: ${socket.userID}`);

            await R.exec("UPDATE api_key SET active = 0 WHERE id = ? ", [
                keyID,
            ]);
            log.debug("server/socket-handlers/api-key-socket-handler.js/apiKeySocketHandler(socket)/socket.on(disableAPIKey)",
            ` R.exec("UPDATE api_key SET active = 0 WHERE id = ${keyId} ")`);

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
        log.debug("server/socket-handlers/api-key-socket-handler.js/apiKeySocketHandler(socket)/socket.on(enableAPIKey)","");
        try {
            checkLogin(socket);

            log.debug("server/socket-handlers/api-key-socket-handler.js/apiKeySocketHandler(socket)/socket.on(enableAPIKey)", `Enabled Key: ${keyID} User ID: ${socket.userID}`);

            await R.exec("UPDATE api_key SET active = 1 WHERE id = ? ", [
                keyID,
            ]);
              log.debug("server/socket-handlers/api-key-socket-handler.js/apiKeySocketHandler(socket)/socket.on(enableAPIKey)",
              ` R.exec("UPDATE api_key SET active = 1 WHERE id = ${keyID} ")`);

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
