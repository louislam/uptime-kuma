const { setSetting } = require("./util-server");
const axios = require("axios");
const { isDev } = require("../src/util");

exports.version = require("../package.json").version;
exports.latestVersion = null;

let interval;

exports.startInterval = () => {
    let check = async () => {
        try {
            const res = await axios.get("https://raw.githubusercontent.com/louislam/uptime-kuma/master/package.json");

            if (typeof res.data === "string") {
                res.data = JSON.parse(res.data);
            }

            // For debug
            if (process.env.TEST_CHECK_VERSION === "1") {
                res.data.version = "1000.0.0"
            }

            exports.latestVersion = res.data.version;
            console.log("Latest Version: " + exports.latestVersion);
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
