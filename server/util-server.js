const tcpp = require("tcp-ping");
const ping = require("ping");
const { R } = require("redbean-node");
const { log, genSecret } = require("../src/util");
const passwordHash = require("./password-hash");
const { Resolver } = require("dns");
const childProcess = require("child_process");
const iconv = require("iconv-lite");
const chardet = require("chardet");
const mqtt = require("mqtt");
const chroma = require("chroma-js");
const { badgeConstants } = require("./config");
const mssql = require("mssql");
const { Client } = require("pg");
const postgresConParse = require("pg-connection-string").parse;
const mysql = require("mysql2");
const { NtlmClient } = require("axios-ntlm");
const { Settings } = require("./settings");
const grpc = require("@grpc/grpc-js");
const protojs = require("protobufjs");
const radiusClient = require("node-radius-client");
const {
    dictionaries: {
        rfc2865: { file, attributes },
    },
} = require("node-radius-utils");
const dayjs = require("dayjs");

const isWindows = process.platform === /^win/.test(process.platform);

/**
 * Init or reset JWT secret
 * @returns {Promise<Bean>}
 */
exports.initJWTSecret = async () => {
    let jwtSecretBean = await R.findOne("setting", " `key` = ? ", [
        "jwtSecret",
    ]);

    if (!jwtSecretBean) {
        jwtSecretBean = R.dispense("setting");
        jwtSecretBean.key = "jwtSecret";
    }

    jwtSecretBean.value = passwordHash.generate(genSecret());
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
        ping.promise.probe(hostname, {
            v6: ipv6,
            min_reply: 1,
            timeout: 10,
        }).then((res) => {
            // If ping failed, it will set field to unknown
            if (res.alive) {
                resolve(res.time);
            } else {
                if (isWindows) {
                    reject(new Error(exports.convertToUTF8(res.output)));
                } else {
                    reject(new Error(res.output));
                }
            }
        }).catch((err) => {
            reject(err);
        });
    });
};

/**
 * MQTT Monitor
 * @param {string} hostname Hostname / address of machine to test
 * @param {string} topic MQTT topic
 * @param {string} okMessage Expected result
 * @param {Object} [options={}] MQTT options. Contains port, username,
 * password and interval (interval defaults to 20)
 * @returns {Promise<string>}
 */
exports.mqttAsync = function (hostname, topic, okMessage, options = {}) {
    return new Promise((resolve, reject) => {
        const { port, username, password, interval = 20 } = options;

        // Adds MQTT protocol to the hostname if not already present
        if (!/^(?:http|mqtt)s?:\/\//.test(hostname)) {
            hostname = "mqtt://" + hostname;
        }

        const timeoutID = setTimeout(() => {
            log.debug("mqtt", "MQTT timeout triggered");
            client.end();
            reject(new Error("Timeout"));
        }, interval * 1000 * 0.8);

        log.debug("mqtt", "MQTT connecting");

        let client = mqtt.connect(hostname, {
            port,
            username,
            password
        });

        client.on("connect", () => {
            log.debug("mqtt", "MQTT connected");

            try {
                log.debug("mqtt", "MQTT subscribe topic");
                client.subscribe(topic);
            } catch (e) {
                client.end();
                clearTimeout(timeoutID);
                reject(new Error("Cannot subscribe topic"));
            }
        });

        client.on("error", (error) => {
            client.end();
            clearTimeout(timeoutID);
            reject(error);
        });

        client.on("message", (messageTopic, message) => {
            if (messageTopic === topic) {
                client.end();
                clearTimeout(timeoutID);
                if (okMessage != null && okMessage !== "" && message.toString() !== okMessage) {
                    reject(new Error(`Message Mismatch - Topic: ${messageTopic}; Message: ${message.toString()}`));
                } else {
                    resolve(`Topic: ${messageTopic}; Message: ${message.toString()}`);
                }
            }
        });

    });
};

/**
 * Use NTLM Auth for a http request.
 * @param {Object} options The http request options
 * @param {Object} ntlmOptions The auth options
 * @returns {Promise<(string[]|Object[]|Object)>}
 */
exports.httpNtlm = function (options, ntlmOptions) {
    return new Promise((resolve, reject) => {
        let client = NtlmClient(ntlmOptions);

        client(options)
            .then((resp) => {
                resolve(resp);
            })
            .catch((err) => {
                reject(err);
            });
    });
};

/**
 * Resolves a given record using the specified DNS server
 * @param {string} hostname The hostname of the record to lookup
 * @param {string} resolverServer The DNS server to use
 * @param {string} resolverPort Port the DNS server is listening on
 * @param {string} rrtype The type of record to request
 * @returns {Promise<(string[]|Object[]|Object)>}
 */
exports.dnsResolve = function (hostname, resolverServer, resolverPort, rrtype) {
    const resolver = new Resolver();
    // Remove brackets from IPv6 addresses so we can re-add them to
    // prevent issues with ::1:5300 (::1 port 5300)
    resolverServer = resolverServer.replace("[", "").replace("]", "");
    resolver.setServers([ `[${resolverServer}]:${resolverPort}` ]);
    return new Promise((resolve, reject) => {
        if (rrtype === "PTR") {
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
 * Run a query on SQL Server
 * @param {string} connectionString The database connection string
 * @param {string} query The query to validate the database with
 * @returns {Promise<(string[]|Object[]|Object)>}
 */
exports.mssqlQuery = async function (connectionString, query) {
    let pool;
    try {
        pool = new mssql.ConnectionPool(connectionString);
        await pool.connect();
        await pool.request().query(query);
        pool.close();
    } catch (e) {
        if (pool) {
            pool.close();
        }
        throw e;
    }
};

/**
 * Run a query on Postgres
 * @param {string} connectionString The database connection string
 * @param {string} query The query to validate the database with
 * @returns {Promise<(string[]|Object[]|Object)>}
 */
exports.postgresQuery = function (connectionString, query) {
    return new Promise((resolve, reject) => {
        const config = postgresConParse(connectionString);

        if (config.password === "") {
            // See https://github.com/brianc/node-postgres/issues/1927
            return reject(new Error("Password is undefined."));
        }

        const client = new Client({ connectionString });

        client.connect();

        return client.query(query)
            .then(res => {
                resolve(res);
            })
            .catch(err => {
                reject(err);
            })
            .finally(() => {
                client.end();
            });
    });
};

/**
 * Run a query on MySQL/MariaDB
 * @param {string} connectionString The database connection string
 * @param {string} query The query to validate the database with
 * @returns {Promise<(string[]|Object[]|Object)>}
 */
exports.mysqlQuery = function (connectionString, query) {
    return new Promise((resolve, reject) => {
        const connection = mysql.createConnection(connectionString);
        connection.promise().query(query)
            .then(res => {
                resolve(res);
            })
            .catch(err => {
                reject(err);
            })
            .finally(() => {
                connection.end();
            });
    });
};

/**
 * Query radius server
 * @param {string} hostname Hostname of radius server
 * @param {string} username Username to use
 * @param {string} password Password to use
 * @param {string} calledStationId ID of called station
 * @param {string} callingStationId ID of calling station
 * @param {string} secret Secret to use
 * @param {number} [port=1812] Port to contact radius server on
 * @returns {Promise<any>}
 */
exports.radius = function (
    hostname,
    username,
    password,
    calledStationId,
    callingStationId,
    secret,
    port = 1812,
) {
    const client = new radiusClient({
        host: hostname,
        hostPort: port,
        dictionaries: [ file ],
    });

    return client.accessRequest({
        secret: secret,
        attributes: [
            [ attributes.USER_NAME, username ],
            [ attributes.USER_PASSWORD, password ],
            [ attributes.CALLING_STATION_ID, callingStationId ],
            [ attributes.CALLED_STATION_ID, calledStationId ],
        ],
    });
};

/**
 * Retrieve value of setting based on key
 * @param {string} key Key of setting to retrieve
 * @returns {Promise<any>} Value
 * @deprecated Use await Settings.get(key)
 */
exports.setting = async function (key) {
    return await Settings.get(key);
};

/**
 * Sets the specified setting to specifed value
 * @param {string} key Key of setting to set
 * @param {any} value Value to set to
 * @param {?string} type Type of setting
 * @returns {Promise<void>}
 */
exports.setSetting = async function (key, value, type = null) {
    await Settings.set(key, value, type);
};

/**
 * Get settings based on type
 * @param {string} type The type of setting
 * @returns {Promise<Bean>}
 */
exports.getSettings = async function (type) {
    return await Settings.getSettings(type);
};

/**
 * Set settings based on type
 * @param {string} type Type of settings to set
 * @param {Object} data Values of settings
 * @returns {Promise<void>}
 */
exports.setSettings = async function (type, data) {
    await Settings.setSettings(type, data);
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
        log.debug("cert", `[${i}] ${link.fingerprint}`);

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
            log.debug("cert", `[Last] ${link.issuerCertificate.fingerprint}`);
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
    if (!res.request.res.socket) {
        throw new Error("No socket found");
    }

    const info = res.request.res.socket.getPeerCertificate(true);
    const valid = res.request.res.socket.authorized || false;

    log.debug("cert", "Parsing Certificate Info");
    const parsedInfo = parseCertificateInfo(info);

    return {
        valid: valid,
        certInfo: parsedInfo
    };
};

/**
 * Check if the provided status code is within the accepted ranges
 * @param {number} status The status code to check
 * @param {string[]} acceptedCodes An array of accepted status codes
 * @returns {boolean} True if status code within range, false otherwise
 * @throws {Error} Will throw an error if the provided status code is not a valid range string or code string
 */
exports.checkStatusCode = function (status, acceptedCodes) {
    if (acceptedCodes == null || acceptedCodes.length === 0) {
        return false;
    }

    for (const codeRange of acceptedCodes) {
        const codeRangeSplit = codeRange.split("-").map(string => parseInt(string));
        if (codeRangeSplit.length === 1) {
            if (status === codeRangeSplit[0]) {
                return true;
            }
        } else if (codeRangeSplit.length === 2) {
            if (status >= codeRangeSplit[0] && status <= codeRangeSplit[1]) {
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

    if (!sockets) {
        return 0;
    }

    const adapter = sockets.adapter;

    if (!adapter) {
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
    if (!socket.userID) {
        throw new Error("You are not logged in.");
    }
};

/**
 * For logged-in users, double-check the password
 * @param {Socket} socket Socket.io instance
 * @param {string} currentPassword
 * @returns {Promise<Bean>}
 */
exports.doubleCheckPassword = async (socket, currentPassword) => {
    if (typeof currentPassword !== "string") {
        throw new Error("Wrong data type?");
    }

    let user = await R.findOne("user", " id = ? AND active = 1 ", [
        socket.userID,
    ]);

    if (!user || !passwordHash.verify(currentPassword, user.password)) {
        throw new Error("Incorrect current password");
    }

    return user;
};

/** Start Unit tests */
exports.startUnitTest = async () => {
    console.log("Starting unit test...");
    const npm = /^win/.test(process.platform) ? "npm.cmd" : "npm";
    const child = childProcess.spawn(npm, [ "run", "jest-backend" ]);

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

/** Start end-to-end tests */
exports.startE2eTests = async () => {
    console.log("Starting unit test...");
    const npm = /^win/.test(process.platform) ? "npm.cmd" : "npm";
    const child = childProcess.spawn(npm, [ "run", "cy:run" ]);

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
    const str = iconv.decode(body, guessEncoding);
    return str.toString();
};

/**
 * Returns a color code in hex format based on a given percentage:
 * 0% => hue = 10 => red
 * 100% => hue = 90 => green
 *
 * @param {number} percentage float, 0 to 1
 * @param {number} maxHue
 * @param {number} minHue, int
 * @returns {string}, hex value
 */
exports.percentageToColor = (percentage, maxHue = 90, minHue = 10) => {
    const hue = percentage * (maxHue - minHue) + minHue;
    try {
        return chroma(`hsl(${hue}, 90%, 40%)`).hex();
    } catch (err) {
        return badgeConstants.naColor;
    }
};

/**
 * Joins and array of string to one string after filtering out empty values
 *
 * @param {string[]} parts
 * @param {string} connector
 * @returns {string}
 */
exports.filterAndJoin = (parts, connector = "") => {
    return parts.filter((part) => !!part && part !== "").join(connector);
};

/**
 * Send a 403 response
 * @param {Object} res Express response object
 * @param {string} [msg=""] Message to send
 */
module.exports.send403 = (res, msg = "") => {
    res.status(403).json({
        "status": "fail",
        "msg": msg,
    });
};

function timeObjectConvertTimezone(obj, timezone, timeObjectToUTC = true) {
    let offsetString;

    if (timezone) {
        offsetString = dayjs().tz(timezone).format("Z");
    } else {
        offsetString = dayjs().format("Z");
    }

    let hours = parseInt(offsetString.substring(1, 3));
    let minutes = parseInt(offsetString.substring(4, 6));

    if (
        (timeObjectToUTC && offsetString.startsWith("+")) ||
        (!timeObjectToUTC && offsetString.startsWith("-"))
    ) {
        hours *= -1;
        minutes *= -1;
    }

    obj.hours += hours;
    obj.minutes += minutes;

    // Handle out of bound
    if (obj.minutes < 0) {
        obj.minutes += 60;
        obj.hours--;
    } else if (obj.minutes > 60) {
        obj.minutes -= 60;
        obj.hours++;
    }

    if (obj.hours < 0) {
        obj.hours += 24;
    } else if (obj.hours > 24) {
        obj.hours -= 24;
    }

    return obj;
}

/**
 *
 * @param {object} obj
 * @param {string} timezone
 * @returns {object}
 */
module.exports.timeObjectToUTC = (obj, timezone = undefined) => {
    return timeObjectConvertTimezone(obj, timezone, true);
};

/**
 *
 * @param {object} obj
 * @param {string} timezone
 * @returns {object}
 */
module.exports.timeObjectToLocal = (obj, timezone = undefined) => {
    return timeObjectConvertTimezone(obj, timezone, false);
};

/**
 * Create gRPC client stib
 * @param {Object} options from gRPC client
 */
module.exports.grpcQuery = async (options) => {
    const { grpcUrl, grpcProtobufData, grpcServiceName, grpcEnableTls, grpcMethod, grpcBody } = options;
    const protocObject = protojs.parse(grpcProtobufData);
    const protoServiceObject = protocObject.root.lookupService(grpcServiceName);
    const Client = grpc.makeGenericClientConstructor({});
    const credentials = grpcEnableTls ? grpc.credentials.createSsl() : grpc.credentials.createInsecure();
    const client = new Client(
        grpcUrl,
        credentials
    );
    const grpcService = protoServiceObject.create(function (method, requestData, cb) {
        const fullServiceName = method.fullName;
        const serviceFQDN = fullServiceName.split(".");
        const serviceMethod = serviceFQDN.pop();
        const serviceMethodClientImpl = `/${serviceFQDN.slice(1).join(".")}/${serviceMethod}`;
        log.debug("monitor", `gRPC method ${serviceMethodClientImpl}`);
        client.makeUnaryRequest(
            serviceMethodClientImpl,
            arg => arg,
            arg => arg,
            requestData,
            cb);
    }, false, false);
    return new Promise((resolve, _) => {
        try {
            return grpcService[`${grpcMethod}`](JSON.parse(grpcBody), function (err, response) {
                const responseData = JSON.stringify(response);
                if (err) {
                    return resolve({
                        code: err.code,
                        errorMessage: err.details,
                        data: ""
                    });
                } else {
                    log.debug("monitor:", `gRPC response: ${JSON.stringify(response)}`);
                    return resolve({
                        code: 1,
                        errorMessage: "",
                        data: responseData
                    });
                }
            });
        } catch (err) {
            return resolve({
                code: -1,
                errorMessage: `Error ${err}. Please review your gRPC configuration option. The service name must not include package name value, and the method name must follow camelCase format`,
                data: ""
            });
        }

    });
};
