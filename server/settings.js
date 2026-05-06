const { getKnex } = require("./db");
const { log } = require("../src/util");

class Settings {
    /**
     *  Example:
     *      {
     *         key1: {
     *             value: "value2",
     *             timestamp: 12345678
     *         },
     *         key2: {
     *             value: 2,
     *             timestamp: 12345678
     *         },
     *     }
     * @type {{}}
     */
    static cacheList = {};

    static cacheCleaner = null;

    /**
     * Retrieve value of setting based on key
     * @param {string} key Key of setting to retrieve
     * @returns {Promise<any>} Value
     */
    static async get(key) {
        // Start cache clear if not started yet
        if (!Settings.cacheCleaner) {
            Settings.cacheCleaner = setInterval(() => {
                log.debug("settings", "Cache Cleaner is just started.");
                for (key in Settings.cacheList) {
                    if (Date.now() - Settings.cacheList[key].timestamp > 60 * 1000) {
                        log.debug("settings", "Cache Cleaner deleted: " + key);
                        delete Settings.cacheList[key];
                    }
                }
            }, 60 * 1000);
        }

        // Query from cache
        if (key in Settings.cacheList) {
            const v = Settings.cacheList[key].value;
            log.debug("settings", `Get Setting (cache): ${key}: ${v}`);
            return v;
        }

        const row = await getKnex()("setting").where("key", key).select("value").first();
        let value = row ? row.value : null;

        try {
            const v = JSON.parse(value);
            log.debug("settings", `Get Setting: ${key}: ${v}`);

            Settings.cacheList[key] = {
                value: v,
                timestamp: Date.now(),
            };

            return v;
        } catch (e) {
            return value;
        }
    }

    /**
     * Sets the specified setting to specified value
     * @param {string} key Key of setting to set
     * @param {any} value Value to set to
     * @param {?string} type Type of setting
     * @returns {Promise<void>}
     */
    static async set(key, value, type = null) {
        const knex = getKnex();
        const payload = {
            key,
            type,
            value: JSON.stringify(value),
        };

        await knex("setting")
            .insert(payload)
            .onConflict("key")
            .merge({
                type: payload.type,
                value: payload.value,
            });

        Settings.deleteCache([ key ]);
    }

    /**
     * Get settings based on type
     * @param {string} type The type of setting
     * @returns {Promise<object>} Settings
     */
    static async getSettings(type) {
        let list = await getKnex()("setting").where("type", type).select("key", "value");

        let result = {};

        for (let row of list) {
            try {
                result[row.key] = JSON.parse(row.value);
            } catch (e) {
                result[row.key] = row.value;
            }
        }

        return result;
    }

    /**
     * Set settings based on type
     * @param {string} type Type of settings to set
     * @param {object} data Values of settings
     * @returns {Promise<void>}
     */
    static async setSettings(type, data) {
        const keyList = Object.keys(data);
        if (keyList.length === 0) {
            return;
        }

        const knex = getKnex();
        const existingRows = await knex("setting").whereIn("key", keyList).select("key", "type");
        const existing = new Map(existingRows.map((r) => [ r.key, r.type ]));

        const inserts = [];
        const updates = [];

        for (const key of keyList) {
            const value = JSON.stringify(data[key]);
            if (!existing.has(key)) {
                inserts.push({ key,
                    type,
                    value });
            } else if (existing.get(key) === type) {
                updates.push({ key,
                    value });
            }
        }

        if (inserts.length) {
            await knex("setting").insert(inserts);
        }
        for (const u of updates) {
            await knex("setting").where("key", u.key).update({ value: u.value });
        }

        Settings.deleteCache(keyList);
    }

    /**
     * Delete selected keys from settings cache
     * @param {string[]} keyList Keys to remove
     * @returns {void}
     */
    static deleteCache(keyList) {
        for (let key of keyList) {
            delete Settings.cacheList[key];
        }
    }

    /**
     * Stop the cache cleaner if running
     * @returns {void}
     */
    static stopCacheCleaner() {
        if (Settings.cacheCleaner) {
            clearInterval(Settings.cacheCleaner);
            Settings.cacheCleaner = null;
        }
    }
}

module.exports = {
    Settings,
};
