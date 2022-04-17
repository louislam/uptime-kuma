const { setSetting, setting } = require("./util-server");
const axios = require("axios");
const compareVersions = require("compare-versions");

exports.version = require("../package.json").version;
exports.latestVersion = null;

let interval;

exports.startInterval = () => {
    let check = async () => {
        try {
            const res = await axios.get("https://uptime.kuma.pet/version");

            // For debug
            if (process.env.TEST_CHECK_VERSION === "1") {
                res.data.slow = "1000.0.0";
            }

            if (await setting("checkUpdate") === false) {
                return;
            }

            let checkBeta = await setting("checkBeta");

            if (checkBeta && res.data.beta) {
                if (compareVersions.compare(res.data.beta, res.data.beta, ">")) {
                    exports.latestVersion = res.data.beta;
                    return;
                }
            }

            if (res.data.slow) {
                exports.latestVersion = res.data.slow;
            }

        } catch (_) { }

    };

    check();
    interval = setInterval(check, 3600 * 1000 * 48);
};

exports.enableCheckUpdate = async (value) => {
    await setSetting("checkUpdate", value);

    clearInterval(interval);

    if (value) {
        exports.startInterval();
    }
};

exports.socket = null;
