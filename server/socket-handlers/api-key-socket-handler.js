const { log } = require("../../src/util");
const { getKnex } = require("../db");
const { nanoid } = require("nanoid");
const passwordHash = require("../password-hash");
const apicache = require("../modules/apicache");
const APIKey = require("../model/api_key");
const { Settings } = require("../settings");
const { sendAPIKeyList } = require("../client");
const { onAuthed } = require("../utils/authed-event");

/**
 * Handlers for API keys
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
module.exports.apiKeySocketHandler = (socket) => {
    // Add a new api key
    onAuthed(socket, "addAPIKey", async (socket, key, callback) => {
        let clearKey = nanoid(40);
        let hashedKey = await passwordHash.generate(clearKey);
        key["key"] = hashedKey;
        let bean = await APIKey.save(key, socket.userID);

        log.debug("apikeys", "Added API Key");
        log.debug("apikeys", key);

        // Append key ID and prefix to start of key separated by _, used to get
        // correct hash when validating key.
        let formattedKey = "uk" + bean.id + "_" + clearKey;
        await sendAPIKeyList(socket);

        // Enable API auth if the user creates a key, otherwise only basic
        // auth will be used for API.
        await Settings.set("apiKeysEnabled", true);

        callback({
            ok: true,
            msg: "successAdded",
            msgi18n: true,
            key: formattedKey,
            keyID: bean.id,
        });
    }, { fallbackMsg: "Failed to add API key" });

    onAuthed(socket, "getAPIKeyList", async (socket, callback) => {
        await sendAPIKeyList(socket);
        callback({ ok: true });
    }, { fallbackMsg: "Failed to retrieve API key list" });

    onAuthed(socket, "deleteAPIKey", async (socket, keyID, callback) => {
        log.debug("apikeys", `Deleted API Key: ${keyID} User ID: ${socket.userID}`);

        // C-1: scope to owning user so another authenticated account can't
        // delete this key by guessing its id.
        await getKnex()("api_key").where({ id: keyID,
            user_id: socket.userID }).delete();

        apicache.clear();

        callback({
            ok: true,
            msg: "successDeleted",
            msgi18n: true,
        });

        await sendAPIKeyList(socket);
    }, { fallbackMsg: "Failed to delete API key" });

    onAuthed(socket, "disableAPIKey", async (socket, keyID, callback) => {
        log.debug("apikeys", `Disabled Key: ${keyID} User ID: ${socket.userID}`);

        // C-1
        await getKnex()("api_key").where({ id: keyID,
            user_id: socket.userID }).update({ active: false });

        apicache.clear();

        callback({
            ok: true,
            msg: "successDisabled",
            msgi18n: true,
        });

        await sendAPIKeyList(socket);
    }, { fallbackMsg: "Failed to disable API key" });

    onAuthed(socket, "enableAPIKey", async (socket, keyID, callback) => {
        log.debug("apikeys", `Enabled Key: ${keyID} User ID: ${socket.userID}`);

        // C-1
        await getKnex()("api_key").where({ id: keyID,
            user_id: socket.userID }).update({ active: true });

        apicache.clear();

        callback({
            ok: true,
            msg: "successEnabled",
            msgi18n: true,
        });

        await sendAPIKeyList(socket);
    }, { fallbackMsg: "Failed to enable API key" });
};
