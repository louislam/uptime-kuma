const tcpp = require("tcp-ping");
const Ping = require("./ping-lite");
const { R } = require("redbean-node");
const { debug } = require("../src/util");
const passwordHash = require("./password-hash");
const dayjs = require("dayjs");
const { Resolver } = require("dns");
const child_process = require("child_process");
const iconv = require("iconv-lite");
const chardet = require("chardet");
const fs = require("fs");
const nodeJsUtil = require("util");

// From ping-lite
exports.WIN = /^win/.test(process.platform);
exports.LIN = /^linux/.test(process.platform);
exports.MAC = /^darwin/.test(process.platform);
exports.FBSD = /^freebsd/.test(process.platform);
exports.BSD = /bsd$/.test(process.platform);

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

/**
 * Send TCP request to specified hostname and port
 * @param {string} hostname Hostname / address of machine
 * @param {number} port TCP port to test
 * @returns {Promise<number>} Maximum time in ms rounded to nearest integer
 */
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

/**
 * Ping the specified machine
 * @param {string} hostname Hostname / address of machine
 * @returns {Promise<number>} Time for ping in ms rounded to nearest integer
 */
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

/**
 * Ping the specified machine
 * @param {string} hostname Hostname / address of machine to ping
 * @param {boolean} ipv6 Should IPv6 be used?
 * @returns {Promise<number>} Time for ping in ms rounded to nearest integer
 */
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

// `string[]`, `Object[]` and `Object`.
/**
 * Resolves a given record using the specified DNS server
 * @param {string} hostname The hostname of the record to lookup
 * @param {string} resolver_server The DNS server to use
 * @param {string} rrtype The type of record to request
 * @returns {Promise<(string[]|Object[]|Object)>}
 */
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

/**
 * Retrieve value of setting based on key
 * @param {string} key Key of setting to retrieve
 * @returns {Promise<Object>} Object representation of setting
 */
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

/**
 * Sets the specified setting to specifed value
 * @param {string} key Key of setting to set
 * @param {any} value Value to set to
 * @param {?string} type Type of setting
 * @returns {Promise<void>}
 */
exports.setSetting = async function (key, value, type = null) {
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
};

/**
 * Get settings based on type
 * @param {?string} type The type of setting
 * @returns {Promise<Bean>}
 */
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

/**
 * Set settings based on type
 * @param {?string} type Type of settings to set
 * @param {Object} data Values of settings
 * @returns {Promise<void>}
 */
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
//https://github.com/dyaa/ssl-checker/blob/master/src/index.ts

/**
 * Get number of days between two dates
 * @param {Date} validFrom Start date
 * @param {Date} validTo End date
 * @returns {number}
 */
const getDaysBetween = (validFrom, validTo) =>
    Math.round(Math.abs(+validFrom - +validTo) / 8.64e7);

/**
 * Get days remaining from a time range
 * @param {Date} validFrom Start date
 * @param {Date} validTo End date
 * @returns {number}
 */
const getDaysRemaining = (validFrom, validTo) => {
    const daysRemaining = getDaysBetween(validFrom, validTo);
    if (new Date(validTo).getTime() < new Date().getTime()) {
        return -daysRemaining;
    }
    return daysRemaining;
};

/**
 * Fix certificate info for display
 * @param {Object} info The chain obtained from getPeerCertificate()
 * @returns {Object} An object representing certificate information
 */
const parseCertificateInfo = function (info) {
    let link = info;
    let i = 0;

    const existingList = {};

    while (link) {
        debug(`[${i}] ${link.fingerprint}`);

        if (!link.valid_from || !link.valid_to) {
            break;
        }
        link.validTo = new Date(link.valid_to);
        link.validFor = link.subjectaltname?.replace(/DNS:|IP Address:/g, "").split(", ");
        link.daysRemaining = getDaysRemaining(new Date(), link.validTo);

        existingList[link.fingerprint] = true;

        // Move up the chain until loop is encountered
        if (link.issuerCertificate == null) {
            break;
        } else if (link.issuerCertificate.fingerprint in existingList) {
            debug(`[Last] ${link.issuerCertificate.fingerprint}`);
            link.issuerCertificate = null;
            break;
        } else {
            link = link.issuerCertificate;
        }

        // Should be no use, but just in case.
        if (i > 500) {
            throw new Error("Dead loop occurred in parseCertificateInfo");
        }
        i++;
    }

    return info;
};

/**
 * Check if certificate is valid
 * @param {Object} res Response object from axios
 * @returns {Object} Object containing certificate information
 */
exports.checkCertificate = function (res) {
    const info = res.request.res.socket.getPeerCertificate(true);
    const valid = res.request.res.socket.authorized || false;

    debug("Parsing Certificate Info");
    const parsedInfo = parseCertificateInfo(info);

    return {
        valid: valid,
        certInfo: parsedInfo
    };
};

/**
 * Check if the provided status code is within the accepted ranges
 * @param {string} status The status code to check
 * @param {Array<string>} accepted_codes An array of accepted status codes
 * @returns {boolean} True if status code within range, false otherwise
 * @throws {Error} Will throw an error if the provided status code is not a valid range string or code string
 */
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

/**
 * Get total number of clients in room
 * @param {Server} io Socket server instance
 * @param {string} roomName Name of room to check
 * @returns {number}
 */
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

/**
 * Allow CORS all origins if development
 * @param {Object} res Response object from axios
 */
exports.allowDevAllOrigin = (res) => {
    if (process.env.NODE_ENV === "development") {
        exports.allowAllOrigin(res);
    }
};

/**
 * Allow CORS all origins
 * @param {Object} res Response object from axios
 */
exports.allowAllOrigin = (res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
};

/**
 * Check if a user is logged in
 * @param {Socket} socket Socket instance
 */
exports.checkLogin = (socket) => {
    if (! socket.userID) {
        throw new Error("You are not logged in.");
    }
};

/** Start Unit tests */
exports.startUnitTest = async () => {
    console.log("Starting unit test...");
    const npm = /^win/.test(process.platform) ? "npm.cmd" : "npm";
    const child = child_process.spawn(npm, ["run", "jest"]);

    child.stdout.on("data", (data) => {
        console.log(data.toString());
    });

    child.stderr.on("data", (data) => {
        console.log(data.toString());
    });

    child.on("close", function (code) {
        console.log("Jest exit code: " + code);
        process.exit(code);
    });
};

/**
 * Convert unknown string to UTF8
 * @param {Uint8Array} body Buffer
 * @returns {string}
 */
exports.convertToUTF8 = (body) => {
    const guessEncoding = chardet.detect(body);
    //debug("Guess Encoding: " + guessEncoding);
    const str = iconv.decode(body, guessEncoding);
    return str.toString();
};

let logFile;

try {
    logFile = fs.createWriteStream("./data/error.log", {
        flags: "a"
    });
} catch (_) { }

/**
 * Write error to log file
 * @param {any} error The error to write
 * @param {boolean} outputToConsole Should the error also be output to console?
 */
exports.errorLog = (error, outputToConsole = true) => {
    try {
        if (logFile) {
            const dateTime = R.isoDateTime();
            logFile.write(`[${dateTime}] ` + nodeJsUtil.format(error) + "\n");

            if (outputToConsole) {
                console.error(error);
            }
        }
    } catch (_) { }
};
