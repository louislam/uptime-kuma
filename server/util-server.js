const tcpp = require("tcp-ping");
const Ping = require("./ping-lite");
const { R } = require("redbean-node");
const { debug } = require("../src/util");
const passwordHash = require("./password-hash");
const dayjs = require("dayjs");
const { Resolver } = require("dns");

/**
 * Init or reset JWT secret
 * @returns {Promise<Bean>}
 */
exports.initJWTSecret = async () => {
    let jwtSecretBean = await R.findOne("setting", " `key` = ? ", [
        "jwtSecret",
    ]);

    if (! jwtSecretBean) {
        jwtSecretBean = R.dispense("setting");
        jwtSecretBean.key = "jwtSecret";
    }

    jwtSecretBean.value = passwordHash.generate(dayjs() + "");
    await R.store(jwtSecretBean);
    return jwtSecretBean;
};

exports.tcping = function (hostname, port) {
    return new Promise((resolve, reject) => {
        tcpp.ping({
            address: hostname,
            port: port,
            attempts: 1,
        }, function (err, data) {

            if (err) {
                reject(err);
            }

            if (data.results.length >= 1 && data.results[0].err) {
                reject(data.results[0].err);
            }

            resolve(Math.round(data.max));
        });
    });
};

exports.ping = async (hostname) => {
    try {
        return await exports.pingAsync(hostname);
    } catch (e) {
        // If the host cannot be resolved, try again with ipv6
        if (e.message.includes("service not known")) {
            return await exports.pingAsync(hostname, true);
        } else {
            throw e;
        }
    }
};

exports.pingAsync = function (hostname, ipv6 = false) {
    return new Promise((resolve, reject) => {
        const ping = new Ping(hostname, {
            ipv6
        });

        ping.send(function (err, ms, stdout) {
            if (err) {
                reject(err);
            } else if (ms === null) {
                reject(new Error(stdout));
            } else {
                resolve(Math.round(ms));
            }
        });
    });
};

exports.dnsResolve = function (hostname, resolver_server, rrtype) {
    const resolver = new Resolver();
    resolver.setServers([resolver_server]);
    return new Promise((resolve, reject) => {
        if (rrtype == "PTR") {
            resolver.reverse(hostname, (err, records) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(records);
                }
            });
        } else {
            resolver.resolve(hostname, rrtype, (err, records) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(records);
                }
            });
        }
    });
};

exports.setting = async function (key) {
    let value = await R.getCell("SELECT `value` FROM setting WHERE `key` = ? ", [
        key,
    ]);

    try {
        const v = JSON.parse(value);
        debug(`Get Setting: ${key}: ${v}`);
        return v;
    } catch (e) {
        return value;
    }
};

exports.setSetting = async function (key, value) {
    let bean = await R.findOne("setting", " `key` = ? ", [
        key,
    ]);
    if (!bean) {
        bean = R.dispense("setting");
        bean.key = key;
    }
    bean.value = JSON.stringify(value);
    await R.store(bean);
};

exports.getSettings = async function (type) {
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
};

exports.setSettings = async function (type, data) {
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
};

// ssl-checker by @dyaa
// param: res - response object from axios
// return an object containing the certificate information

const getDaysBetween = (validFrom, validTo) =>
    Math.round(Math.abs(+validFrom - +validTo) / 8.64e7);

const getDaysRemaining = (validFrom, validTo) => {
    const daysRemaining = getDaysBetween(validFrom, validTo);
    if (new Date(validTo).getTime() < new Date().getTime()) {
        return -daysRemaining;
    }
    return daysRemaining;
};

exports.checkCertificate = function (res) {
    const {
        valid_from,
        valid_to,
        subjectaltname,
        issuer,
        fingerprint,
    } = res.request.res.socket.getPeerCertificate(false);

    if (!valid_from || !valid_to || !subjectaltname) {
        throw {
            message: "No TLS certificate in response",
        };
    }

    const valid = res.request.res.socket.authorized || false;

    const validTo = new Date(valid_to);

    const validFor = subjectaltname
        .replace(/DNS:|IP Address:/g, "")
        .split(", ");

    const daysRemaining = getDaysRemaining(new Date(), validTo);

    return {
        valid,
        validFor,
        validTo,
        daysRemaining,
        issuer,
        fingerprint,
    };
};

// Check if the provided status code is within the accepted ranges
// Param: status - the status code to check
// Param: accepted_codes - an array of accepted status codes
// Return: true if the status code is within the accepted ranges, false otherwise
// Will throw an error if the provided status code is not a valid range string or code string

exports.checkStatusCode = function (status, accepted_codes) {
    if (accepted_codes == null || accepted_codes.length === 0) {
        return false;
    }

    for (const code_range of accepted_codes) {
        const code_range_split = code_range.split("-").map(string => parseInt(string));
        if (code_range_split.length === 1) {
            if (status === code_range_split[0]) {
                return true;
            }
        } else if (code_range_split.length === 2) {
            if (status >= code_range_split[0] && status <= code_range_split[1]) {
                return true;
            }
        } else {
            throw new Error("Invalid status code range");
        }
    }

    return false;
};

exports.getTotalClientInRoom = (io, roomName) => {

    const sockets = io.sockets;

    if (! sockets) {
        return 0;
    }

    const adapter = sockets.adapter;

    if (! adapter) {
        return 0;
    }

    const room = adapter.rooms.get(roomName);

    if (room) {
        return room.size;
    } else {
        return 0;
    }
};

exports.genSecret = () => {
    let secret = "";
    let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let charsLength = chars.length;
    for ( let i = 0; i < 64; i++ ) {
        secret += chars.charAt(Math.floor(Math.random() * charsLength));
    }
    return secret;
};

exports.allowDevAllOrigin = (res) => {
    if (process.env.NODE_ENV === "development") {
        exports.allowAllOrigin(res);
    }
};

exports.allowAllOrigin = (res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
};

exports.checkLogin = (socket) => {
    if (! socket.userID) {
        throw new Error("You are not logged in.");
    }
};

exports.updateMonitorChecks = async (monitorId, checks) => {
    let trx = await R.begin();
    try {
        // delete existing checks for monitor
        const existingMonitorChecks = await R.find("monitor_checks", " monitor_id = ?", [bean.id]);
        await trx.trashAll(existingMonitorChecks);

        // Replace them with new checks
        for (let i = 0; i < (checks || []).length; i++) {
            let checkBean = trx.dispense("monitor_checks");
            checks[i].monitor_id = monitorId;
            checks[i].value = typeof checks[i].value === "object" ? JSON.stringify(checks[i].value) : checks[i].value;
            checkBean.import(checks[i]);
            await trx.store(checkBean);
        }
    } catch (err) {
        await trx.rollback();
        throw err;
    }
};
