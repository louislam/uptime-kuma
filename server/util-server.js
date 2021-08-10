const tcpp = require("tcp-ping");
const Ping = require("./ping-lite");
const { R } = require("redbean-node");
const { debug } = require("../src/util");
const passwordHash = require("./password-hash");
const dayjs = require("dayjs");

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
}

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
}

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
}

exports.pingAsync = function (hostname, ipv6 = false) {
    return new Promise((resolve, reject) => {
        const ping = new Ping(hostname, {
            ipv6
        });

        ping.send(function (err, ms, stdout) {
            if (err) {
                reject(err);
            } else if (ms === null) {
                reject(new Error(stdout))
            } else {
                resolve(Math.round(ms))
            }
        });
    });
}

exports.setting = async function (key) {
    let value = await R.getCell("SELECT `value` FROM setting WHERE `key` = ? ", [
        key,
    ]);

    try {
        const v = JSON.parse(value);
        debug(`Get Setting: ${key}: ${v}`)
        return v;
    } catch (e) {
        return value;
    }
}

exports.setSetting = async function (key, value) {
    let bean = await R.findOne("setting", " `key` = ? ", [
        key,
    ])
    if (!bean) {
        bean = R.dispense("setting")
        bean.key = key;
    }
    bean.value = JSON.stringify(value);
    await R.store(bean)
}

exports.getSettings = async function (type) {
    let list = await R.getAll("SELECT `key`, `value` FROM setting WHERE `type` = ? ", [
        type,
    ])

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
            promiseList.push(R.store(bean))
        }
    }

    await Promise.all(promiseList);
}

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
}

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
}
