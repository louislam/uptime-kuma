const tcpp = require("tcp-ping");
const ping = require("@louislam/ping");
const { R } = require("redbean-node");
const { log, genSecret, badgeConstants } = require("../src/util");
const passwordHash = require("./password-hash");
const { Resolver } = require("dns");
const childProcess = require("child_process");
const iconv = require("iconv-lite");
const chardet = require("chardet");
const mqtt = require("mqtt");
const chroma = require("chroma-js");
const mssql = require("mssql");
const { Client } = require("pg");
const postgresConParse = require("pg-connection-string").parse;
const mysql = require("mysql2");
const { MongoClient } = require("mongodb");
const { NtlmClient } = require("axios-ntlm");
const { Settings } = require("./settings");
const grpc = require("@grpc/grpc-js");
const protojs = require("protobufjs");
const radiusClient = require("node-radius-client");
const redis = require("redis");
const oidc = require("openid-client");
const tls = require("tls");

const {
    dictionaries: {
        rfc2865: { file, attributes },
    },
} = require("node-radius-utils");
const dayjs = require("dayjs");

// SASLOptions used in JSDoc
// eslint-disable-next-line no-unused-vars
const { Kafka, SASLOptions } = require("kafkajs");
const crypto = require("crypto");

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
 * Decodes a jwt and returns the payload portion without verifying the jqt.
 * @param {string} jwt The input jwt as a string
 * @returns {Object} Decoded jwt payload object
 */
exports.decodeJwt = (jwt) => {
    return JSON.parse(Buffer.from(jwt.split(".")[1], "base64").toString());
};

/**
 * Gets a Access Token form a oidc/oauth2 provider
 * @param {string} tokenEndpoint The token URI form the auth service provider
 * @param {string} clientId The oidc/oauth application client id
 * @param {string} clientSecret The oidc/oauth application client secret
 * @param {string} scope The scope the for which the token should be issued for
 * @param {string} authMethod The method on how to sent the credentials. Default client_secret_basic
 * @returns {Promise<oidc.TokenSet>} TokenSet promise if the token request was successful
 */
exports.getOidcTokenClientCredentials = async (tokenEndpoint, clientId, clientSecret, scope, authMethod = "client_secret_basic") => {
    const oauthProvider = new oidc.Issuer({ token_endpoint: tokenEndpoint });
    let client = new oauthProvider.Client({
        client_id: clientId,
        client_secret: clientSecret,
        token_endpoint_auth_method: authMethod
    });

    // Increase default timeout and clock tolerance
    client[oidc.custom.http_options] = () => ({ timeout: 10000 });
    client[oidc.custom.clock_tolerance] = 5;

    let grantParams = { grant_type: "client_credentials" };
    if (scope) {
        grantParams.scope = scope;
    }
    return await client.grant(grantParams);
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
 * @param {number} [size=56] Size of packet to send
 * @returns {Promise<number>} Time for ping in ms rounded to nearest integer
 */
exports.ping = async (hostname, size = 56) => {
    try {
        return await exports.pingAsync(hostname, false, size);
    } catch (e) {
        // If the host cannot be resolved, try again with ipv6
        console.debug("ping", "IPv6 error message: " + e.message);

        // As node-ping does not report a specific error for this, try again if it is an empty message with ipv6 no matter what.
        if (!e.message) {
            return await exports.pingAsync(hostname, true, size);
        } else {
            throw e;
        }
    }
};

/**
 * Ping the specified machine
 * @param {string} hostname Hostname / address of machine to ping
 * @param {boolean} ipv6 Should IPv6 be used?
 * @param {number} [size = 56] Size of ping packet to send
 * @returns {Promise<number>} Time for ping in ms rounded to nearest integer
 */
exports.pingAsync = function (hostname, ipv6 = false, size = 56) {
    return new Promise((resolve, reject) => {
        ping.promise.probe(hostname, {
            v6: ipv6,
            min_reply: 1,
            deadline: 10,
            packetSize: size,
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
        if (!/^(?:http|mqtt|ws)s?:\/\//.test(hostname)) {
            hostname = "mqtt://" + hostname;
        }

        const timeoutID = setTimeout(() => {
            log.debug("mqtt", "MQTT timeout triggered");
            client.end();
            reject(new Error("Timeout"));
        }, interval * 1000 * 0.8);

        const mqttUrl = `${hostname}:${port}`;

        log.debug("mqtt", `MQTT connecting to ${mqttUrl}`);

        let client = mqtt.connect(mqttUrl, {
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
 * Monitor Kafka using Producer
 * @param {string} topic Topic name to produce into
 * @param {string} message Message to produce
 * @param {Object} [options={interval = 20, allowAutoTopicCreation = false, ssl = false, clientId = "Uptime-Kuma"}]
 * Kafka client options. Contains ssl, clientId, allowAutoTopicCreation and
 * interval (interval defaults to 20, allowAutoTopicCreation defaults to false, clientId defaults to "Uptime-Kuma"
 * and ssl defaults to false)
 * @param {string[]} brokers List of kafka brokers to connect, host and port joined by ':'
 * @param {SASLOptions} [saslOptions={}] Options for kafka client Authentication (SASL) (defaults to
 * {})
 * @returns {Promise<string>}
 */
exports.kafkaProducerAsync = function (brokers, topic, message, options = {}, saslOptions = {}) {
    return new Promise((resolve, reject) => {
        const { interval = 20, allowAutoTopicCreation = false, ssl = false, clientId = "Uptime-Kuma" } = options;

        let connectedToKafka = false;

        const timeoutID = setTimeout(() => {
            log.debug("kafkaProducer", "KafkaProducer timeout triggered");
            connectedToKafka = true;
            reject(new Error("Timeout"));
        }, interval * 1000 * 0.8);

        if (saslOptions.mechanism === "None") {
            saslOptions = undefined;
        }

        let client = new Kafka({
            brokers: brokers,
            clientId: clientId,
            sasl: saslOptions,
            retry: {
                retries: 0,
            },
            ssl: ssl,
        });

        let producer = client.producer({
            allowAutoTopicCreation: allowAutoTopicCreation,
            retry: {
                retries: 0,
            }
        });

        producer.connect().then(
            () => {
                producer.send({
                    topic: topic,
                    messages: [{
                        value: message,
                    }],
                }).then((_) => {
                    resolve("Message sent successfully");
                }).catch((e) => {
                    connectedToKafka = true;
                    producer.disconnect();
                    clearTimeout(timeoutID);
                    reject(new Error("Error sending message: " + e.message));
                }).finally(() => {
                    connectedToKafka = true;
                    clearTimeout(timeoutID);
                });
            }
        ).catch(
            (e) => {
                connectedToKafka = true;
                producer.disconnect();
                clearTimeout(timeoutID);
                reject(new Error("Error in producer connection: " + e.message));
            }
        );

        producer.on("producer.network.request_timeout", (_) => {
            if (!connectedToKafka) {
                clearTimeout(timeoutID);
                reject(new Error("producer.network.request_timeout"));
            }
        });

        producer.on("producer.disconnect", (_) => {
            if (!connectedToKafka) {
                clearTimeout(timeoutID);
                reject(new Error("producer.disconnect"));
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
        if (!query) {
            query = "SELECT 1";
        }
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

        // Fix #3868, which true/false is not parsed to boolean
        if (typeof config.ssl === "string") {
            config.ssl = config.ssl === "true";
        }

        if (config.password === "") {
            // See https://github.com/brianc/node-postgres/issues/1927
            reject(new Error("Password is undefined."));
            return;
        }
        const client = new Client(config);

        client.on("error", (error) => {
            log.debug("postgres", "Error caught in the error event handler.");
            reject(error);
        });

        client.connect((err) => {
            if (err) {
                reject(err);
                client.end();
            } else {
                // Connected here
                try {
                    // No query provided by user, use SELECT 1
                    if (!query || (typeof query === "string" && query.trim() === "")) {
                        query = "SELECT 1";
                    }

                    client.query(query, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                        client.end();
                    });
                } catch (e) {
                    reject(e);
                    client.end();
                }
            }
        });

    });
};

/**
 * Run a query on MySQL/MariaDB
 * @param {string} connectionString The database connection string
 * @param {string} query The query to validate the database with
 * @param {?string} password The password to use
 * @returns {Promise<(string)>}
 */
exports.mysqlQuery = function (connectionString, query, password = undefined) {
    return new Promise((resolve, reject) => {
        const connection = mysql.createConnection({
            uri: connectionString,
            password
        });

        connection.on("error", (err) => {
            reject(err);
        });

        connection.query(query, (err, res) => {
            if (err) {
                reject(err);
            } else {
                if (Array.isArray(res)) {
                    resolve("Rows: " + res.length);
                } else {
                    resolve("No Error, but the result is not an array. Type: " + typeof res);
                }
            }

            try {
                connection.end();
            } catch (_) {
                connection.destroy();
            }
        });
    });
};

/**
 * Connect to and Ping a MongoDB database
 * @param {string} connectionString The database connection string
 * @returns {Promise<(string[]|Object[]|Object)>}
 */
exports.mongodbPing = async function (connectionString) {
    let client = await MongoClient.connect(connectionString);
    let dbPing = await client.db().command({ ping: 1 });
    await client.close();

    if (dbPing["ok"] === 1) {
        return "UP";
    } else {
        throw Error("failed");
    }
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
 * @param {number} [timeout=2500] Timeout for connection to use
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
    timeout = 2500,
) {
    const client = new radiusClient({
        host: hostname,
        hostPort: port,
        timeout: timeout,
        retries: 1,
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
    }).catch((error) => {
        if (error.response?.code) {
            throw Error(error.response.code);
        } else {
            throw Error(error.message);
        }
    });
};

/**
 * Redis server ping
 * @param {string} dsn The redis connection string
 */
exports.redisPingAsync = function (dsn) {
    return new Promise((resolve, reject) => {
        const client = redis.createClient({
            url: dsn
        });
        client.on("error", (err) => {
            if (client.isOpen) {
                client.disconnect();
            }
            reject(err);
        });
        client.connect().then(() => {
            if (!client.isOpen) {
                client.emit("error", new Error("connection isn't open"));
            }
            client.ping().then((res, err) => {
                if (client.isOpen) {
                    client.disconnect();
                }
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            }).catch(error => reject(error));
        });
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
            link.certType = (i === 0) ? "self-signed" : "root CA";
            break;
        } else if (link.issuerCertificate.fingerprint in existingList) {
            // a root CA certificate is typically "signed by itself"  (=> "self signed certificate") and thus the "issuerCertificate" is a reference to itself.
            log.debug("cert", `[Last] ${link.issuerCertificate.fingerprint}`);
            link.certType = (i === 0) ? "self-signed" : "root CA";
            link.issuerCertificate = null;
            break;
        } else {
            link.certType = (i === 0) ? "server" : "intermediate CA";
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
 * @param {tls.TLSSocket} socket TLSSocket, which may or may not be connected
 * @returns {Object} Object containing certificate information
 */
exports.checkCertificate = function (socket) {
    let certInfoStartTime = dayjs().valueOf();

    // Return null if there is no socket
    if (socket === undefined || socket == null) {
        return null;
    }

    const info = socket.getPeerCertificate(true);
    const valid = socket.authorized || false;

    log.debug("cert", "Parsing Certificate Info");
    const parsedInfo = parseCertificateInfo(info);

    if (process.env.TIMELOGGER === "1") {
        log.debug("monitor", "Cert Info Query Time: " + (dayjs().valueOf() - certInfoStartTime) + "ms");
    }

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
 */
exports.checkStatusCode = function (status, acceptedCodes) {
    if (acceptedCodes == null || acceptedCodes.length === 0) {
        return false;
    }

    for (const codeRange of acceptedCodes) {
        if (typeof codeRange !== "string") {
            log.error("monitor", `Accepted status code not a string. ${codeRange} is of type ${typeof codeRange}`);
            continue;
        }

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
            log.error("monitor", `${codeRange} is not a valid status code range`);
            continue;
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
 * Send an Error response
 * @param {Object} res Express response object
 * @param {string} [msg=""] Message to send
 */
module.exports.sendHttpError = (res, msg = "") => {
    if (msg.includes("SQLITE_BUSY") || msg.includes("SQLITE_LOCKED")) {
        res.status(503).json({
            "status": "fail",
            "msg": msg,
        });
    } else if (msg.toLowerCase().includes("not found")) {
        res.status(404).json({
            "status": "fail",
            "msg": msg,
        });
    } else {
        res.status(403).json({
            "status": "fail",
            "msg": msg,
        });
    }
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

/**
 * Returns an array of SHA256 fingerprints for all known root certificates.
 * @returns {Set} A set of SHA256 fingerprints.
 */
module.exports.rootCertificatesFingerprints = () => {
    let fingerprints = tls.rootCertificates.map(cert => {
        let certLines = cert.split("\n");
        certLines.shift();
        certLines.pop();
        let certBody = certLines.join("");
        let buf = Buffer.from(certBody, "base64");

        const shasum = crypto.createHash("sha256");
        shasum.update(buf);

        return shasum.digest("hex").toUpperCase().replace(/(.{2})(?!$)/g, "$1:");
    });

    fingerprints.push("6D:99:FB:26:5E:B1:C5:B3:74:47:65:FC:BC:64:8F:3C:D8:E1:BF:FA:FD:C4:C2:F9:9B:9D:47:CF:7F:F1:C2:4F"); // ISRG X1 cross-signed with DST X3
    fingerprints.push("8B:05:B6:8C:C6:59:E5:ED:0F:CB:38:F2:C9:42:FB:FD:20:0E:6F:2F:F9:F8:5D:63:C6:99:4E:F5:E0:B0:27:01"); // ISRG X2 cross-signed with ISRG X1

    return new Set(fingerprints);
};

module.exports.SHAKE256_LENGTH = 16;

/**
 *
 * @param {string} data
 * @param {number} len
 * @return {string}
 */
module.exports.shake256 = (data, len) => {
    if (!data) {
        return "";
    }
    return crypto.createHash("shake256", { outputLength: len })
        .update(data)
        .digest("hex");
};

// For unit test, export functions
if (process.env.TEST_BACKEND) {
    module.exports.__test = {
        parseCertificateInfo,
    };
    module.exports.__getPrivateFunction = (functionName) => {
        return module.exports.__test[functionName];
    };
}

/**
 * Generates an abort signal with the specified timeout.
 * @param {number} timeoutMs - The timeout in milliseconds.
 * @returns {AbortSignal | null} - The generated abort signal, or null if not supported.
 */
module.exports.axiosAbortSignal = (timeoutMs) => {
    try {
        // Just in case, as 0 timeout here will cause the request to be aborted immediately
        if (!timeoutMs || timeoutMs <= 0) {
            timeoutMs = 5000;
        }
        return AbortSignal.timeout(timeoutMs);
    } catch (_) {
        // v16-: AbortSignal.timeout is not supported
        try {
            const abortController = new AbortController();
            setTimeout(() => abortController.abort(), timeoutMs);

            return abortController.signal;
        } catch (_) {
            // v15-: AbortController is not supported
            return null;
        }
    }
};
