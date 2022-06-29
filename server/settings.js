const { R } = require("redbean-node");
const { log } = require("../src/util");

class Settings {

    cacheList = [];

    /**
     * Retrieve value of setting based on key
     * @param {string} key Key of setting to retrieve
     * @returns {Promise<any>} Value
     */
    static async get(key) {
        let value = await R.getCell("SELECT `value` FROM setting WHERE `key` = ? ", [
            key,
        ]);

        try {
            const v = JSON.parse(value);
            log.debug("util", `Get Setting: ${key}: ${v}`);
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
        let bean = await R.findOne("setting", " `key` = ? ", [
            key,
        ]);
        if (!bean) {
            bean = R.dispense("setting");
            bean.key = key;
        }
        bean.type = type;
        bean.value = JSON.stringify(value);
        await R.store(bean);
    }

    /**
     * Get settings based on type
     * @param {string} type The type of setting
     * @returns {Promise<Bean>}
     */
    static async getSettings(type) {
        let list = await R.getAll("SELECT `key`, `value` FROM setting WHERE `type` = ? ", [
            type,
        ]);

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
     * @param {Object} data Values of settings
     * @returns {Promise<void>}
     */
    static async setSettings(type, data) {
        let keyList = Object.keys(data);

        let promiseList = [];

        for (let key of keyList) {
            let bean = await R.findOne("setting", " `key` = ? ", [
                key
            ]);

            if (bean == null) {
                bean = R.dispense("setting");
                bean.type = type;
                bean.key = key;
            }

            if (bean.type === type) {
                bean.value = JSON.stringify(data[key]);
                promiseList.push(R.store(bean));
            }
        }

        await Promise.all(promiseList);
    }
}

module.exports = {
    Settings,
};
