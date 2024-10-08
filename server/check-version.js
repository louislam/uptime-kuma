const { setSetting, setting } = require("./util-server");
const axios = require("axios");
const compareVersions = require("compare-versions");
const { log } = require("../src/util");

exports.version = require("../package.json").version;
exports.latestVersion = null;

// How much time in ms to wait between update checks
const UPDATE_CHECKER_INTERVAL_MS = 1000 * 60 * 60 * 48;
const UPDATE_CHECKER_LATEST_VERSION_URL = "https://uptime.kuma.pet/version";

let interval;

exports.startInterval = () => {
    let check = async () => {
        if (await setting("checkUpdate") === false) {
            return;
        }

        log.debug("update-checker", "Retrieving latest versions");

        try {
            const res = await axios.get(UPDATE_CHECKER_LATEST_VERSION_URL);

            // For debug
            if (process.env.TEST_CHECK_VERSION === "1") {
                res.data.slow = "1000.0.0";
            }

            let checkBeta = await setting("checkBeta");

            if (checkBeta && res.data.beta) {
                if (compareVersions.compare(res.data.beta, res.data.slow, ">")) {
                    exports.latestVersion = res.data.beta;
                    return;
                }
            }

            if (res.data.slow) {
                exports.latestVersion = res.data.slow;
            }

        } catch (_) {
            log.info("update-checker", "Failed to check for new versions");
        }

    };

    check();
    interval = setInterval(check, UPDATE_CHECKER_INTERVAL_MS);
};

/**
 * Enable the check update feature
 * @param {boolean} value Should the check update feature be enabled?
 * @returns {Promise<void>}
 */
exports.enableCheckUpdate = async (value) => {
    await setSetting("checkUpdate", value);

    clearInterval(interval);

    if (value) {
        exports.startInterval();
    }
};

exports.socket = null;
