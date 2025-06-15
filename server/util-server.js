const tcpp = require("tcp-ping");
const ping = require("@louislam/ping");
const { R } = require("redbean-node");
const { log, genSecret, badgeConstants } = require("../src/util");
const passwordHash = require("./password-hash");
const dnsPacket = require("dns-packet");
const optioncodes = require("dns-packet/optioncodes.js");
const dgram = require("dgram");
const { Socket, isIP, isIPv4, isIPv6 } = require("net");
const { Address6 } = require("ip-address");
const iconv = require("iconv-lite");
const chardet = require("chardet");
const chroma = require("chroma-js");
const mssql = require("mssql");
const { Client } = require("pg");
const postgresConParse = require("pg-connection-string").parse;
const mysql = require("mysql2");
const { NtlmClient } = require("./modules/axios-ntlm/lib/ntlmClient.js");
const { Settings } = require("./settings");
const grpc = require("@grpc/grpc-js");
const protojs = require("protobufjs");
const radiusClient = require("node-radius-client");
const redis = require("redis");
const oidc = require("openid-client");
const tls = require("tls");
const https = require("https");
const http2 = require("http2");
const url = require("url");

const {
    HTTP2_HEADER_PATH,
    HTTP2_HEADER_METHOD,
    HTTP2_HEADER_AUTHORITY,
    HTTP2_HEADER_ACCEPT,
    HTTP2_HEADER_CONTENT_LENGTH,
    HTTP2_HEADER_CONTENT_TYPE,
    HTTP2_HEADER_STATUS,
} = http2.constants;

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
 * @returns {Promise<Bean>} JWT secret
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
 * @returns {object} Decoded jwt payload object
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
 * @param {number} size Size of packet to send
 * @returns {Promise<number>} Time for ping in ms rounded to nearest integer
 */
exports.ping = async (hostname, size = 56) => {
    try {
        return await exports.pingAsync(hostname, false, size);
    } catch (e) {
        // If the host cannot be resolved, try again with ipv6
        log.debug("ping", "IPv6 error message: " + e.message);

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
 * @param {number} size Size of ping packet to send
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
 * Monitor Kafka using Producer
 * @param {string[]} brokers List of kafka brokers to connect, host and
 * port joined by ':'
 * @param {string} topic Topic name to produce into
 * @param {string} message Message to produce
 * @param {object} options Kafka client options. Contains ssl, clientId,
 * allowAutoTopicCreation and interval (interval defaults to 20,
 * allowAutoTopicCreation defaults to false, clientId defaults to
 * "Uptime-Kuma" and ssl defaults to false)
 * @param {SASLOptions} saslOptions Options for kafka client
 * Authentication (SASL) (defaults to {})
 * @returns {Promise<string>} Status message
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
 * @param {object} options The http request options
 * @param {object} ntlmOptions The auth options
 * @returns {Promise<(string[] | object[] | object)>} NTLM response
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
 * Encode DNS query packet data to a buffer. Adapted from
 * https://github.com/hildjj/dohdec/blob/v7.0.2/pkg/dohdec/lib/dnsUtils.js
 * @param {object} opts Options for the query.
 * @param {string} opts.name The name to look up.
 * @param {number} opts.id ID for the query. SHOULD be 0 for DOH.
 * @param {packet.RecordType} opts.rrtype The record type to look up.
 * @param {boolean} opts.dnssec Request DNSSec information?
 * @param {boolean} opts.dnssecCheckingDisabled Disable DNSSec validation?
 * @param {string} opts.ecsSubnet Subnet to use for ECS.
 * @param {number} opts.ecs Number of ECS bits. Defaults to 24 (IPv4) or 56
 *   (IPv6).
 * @param {boolean} opts.stream Encode for streaming, with the packet prefixed
 *   by a 2-byte big-endian integer of the number of bytes in the packet.
 * @param {number} opts.udpPayloadSize Set a custom UDP payload size (EDNS).
 * @returns {Buffer} The encoded packet.
 * @throws {TypeError} opts does not contain a name attribute.
 */
exports.makeDnsPacket = function (opts) {
    const PAD_SIZE = 128;

    if (!opts?.name) {
        throw new TypeError("Name is required");
    }

    /** @type {dnsPacket.OptAnswer} */
    const opt = {
        name: ".",
        type: "OPT",
        udpPayloadSize: opts.udpPayloadSize || 4096,
        extendedRcode: 0,
        flags: 0,
        flag_do: false, // Setting here has no effect
        ednsVersion: 0,
        options: [],
    };

    /** @type {dnsPacket.Packet} */
    const dns = {
        type: "query",
        id: opts.id || 0,
        flags: dnsPacket.RECURSION_DESIRED,
        questions: [{
            type: opts.rrtype || "A",
            class: "IN",
            name: opts.name,
        }],
        additionals: [ opt ],
    };
    //assert(dns.flags !== undefined);
    if (opts.dnssec) {
        dns.flags |= dnsPacket.AUTHENTIC_DATA;
        opt.flags |= dnsPacket.DNSSEC_OK;
    }
    if (opts.dnssecCheckingDisabled) {
        dns.flags |= dnsPacket.CHECKING_DISABLED;
    }
    if (
        (opts.ecs != null) ||
        (opts.ecsSubnet && (isIP(opts.ecsSubnet) !== 0))
    ) {
        // https://tools.ietf.org/html/rfc7871#section-11.1
        const prefix = (opts.ecsSubnet && isIPv4(opts.ecsSubnet)) ? 24 : 56;
        opt.options.push({
            code: optioncodes.toCode("CLIENT_SUBNET"),
            ip: opts.ecsSubnet || "0.0.0.0",
            sourcePrefixLength: (opts.ecs == null) ? prefix : opts.ecs,
        });
    }
    const unpadded = dnsPacket.encodingLength(dns);
    opt.options.push({
        code: optioncodes.toCode("PADDING"),
        // Next pad size, minus what we already have, minus another 4 bytes for
        // the option header
        length: (Math.ceil(unpadded / PAD_SIZE) * PAD_SIZE) - unpadded - 4,
    });
    if (opts.stream) {
        return dnsPacket.streamEncode(dns);
    }
    return dnsPacket.encode(dns);
};

/**
 * Decodes DNS packet response data with error handling
 * @param {Buffer} data DNS packet data to decode
 * @param {boolean} isStream If the data is encoded as a stream
 * @param {Function} callback function to call if error is encountered
 *   Passes error object as a parameter to the function
 * @returns {dnsPacket.Packet} DNS packet data in an object
 */
exports.decodeDnsPacket = function (data, isStream = false, callback) {
    let decodedData;
    try {
        decodedData = isStream ? dnsPacket.streamDecode(data) : dnsPacket.decode(data);
        log.debug("dns", "Response decoded");
        // If the truncated bit is set, the answers section was too large
        if (decodedData.flag_tc) {
            callback({ message: "Response is truncated." });
        }
    } catch (err) {
        err.message = `Error decoding DNS response data: ${err.message}`;
        log.warn("dns", err.message);
        if (callback) {
            callback(err);
        }
    }
    return decodedData;
};

/**
 * Resolves a given record using the specified DNS server
 * @param {object} opts Options for the query, used to generate DNS packet
 * @param {string} opts.name The name of the record to query
 * @param {string} opts.rrtype The resource record type
 * @param {number} opts.id Set a specific ID number to use on the query
 * @param {number} opts.udpPayloadSize Set a custom UDP payload size (EDNS).
 *   Defaults to safe values, 1432 bytes (IPv4) or 1232 bytes (IPv6).
 * @param {string} resolverServer The DNS server to use
 * @param {number} resolverPort Port the DNS server is listening on
 * @param {object} transport The transport method and options
 * @param {string} transport.type Transport method, default is UDP
 * @param {number} transport.timeout Timeout to use for queries
 * @param {boolean} transport.ignoreCertErrors Proceed with secure connections
 *   even if the server presents an untrusted or expired certificate
 * @param {string} transport.dohQueryPath Query path to use for DoH requests
 * @param {boolean} transport.dohUsePost If true, DNS query will be sent using
 *   HTTP POST method for DoH requests, otherwise use HTTP GET method
 * @param {boolean} transport.dohUseHttp2 If true, DNS query will be made with
 *   HTTP/2 session for DOH requests, otherwise use HTTP/1.1
 * @returns {Promise<(string[] | object[] | object)>} DNS response
 */
exports.dnsResolve = function (opts, resolverServer, resolverPort, transport) {
    // Set transport variables to defaults if not defined
    const method = ("type" in transport) ? transport.type.toUpperCase() : "UDP";
    const isSecure = [ "DOH", "DOT", "DOQ" ].includes(method);
    const timeout = transport.timeout ?? 30000; // 30 seconds
    const skipCertCheck = transport.ignoreCertErrors ?? false;
    const dohQuery = transport.dohQueryPath ?? "dns-query";
    const dohUsePost = transport.dohUsePost ?? false;
    const dohUseHttp2 = transport.dohUseHttp2 ?? false;

    // Parse IPv4 and IPv6 addresses to determine address family and
    // add square brackets to IPv6 addresses, following RFC 3986 syntax
    resolverServer = resolverServer.replace("[", "").replace("]", "");
    const addressFamily = isIP(resolverServer);
    if (addressFamily === 6) {
        resolverServer = `[${resolverServer}]`;
    }

    // If performing reverse (PTR) record lookup, ensure hostname
    // syntax follows RFC 1034 / RFC 3596
    if (opts.rrtype === "PTR") {
        if (isIPv4(opts.name)) {
            let octets = opts.name.split(".");
            octets.reverse();
            opts.name = octets.join(".") + ".in-addr.arpa";
        } else if (isIPv6(opts.name)) {
            let address = new Address6(opts.name);
            opts.name = address.reverseForm();
        }
    }

    // Set request ID
    if (opts.id == null) {
        // Set query ID to "0" for HTTP cache friendlyness on DoH requests.
        // See https://github.com/mafintosh/dns-packet/issues/77
        opts.id = (method === "DOH") ? 0 : Math.floor(Math.random() * 65534) + 1;
    }

    // Set UDP payload size to safe levels for transmission over 1500 MTU
    if (!opts.udpPayloadSize) {
        opts.udpPayloadSize = (addressFamily === 4) ? 1432 : 1232;
    }

    // Enable stream encoding for TCP and DOT transport methods
    if ([ "TCP", "DOT" ].includes(method)) {
        opts.stream = true;
    }
    // Generate buffer with encoded DNS query
    const buf = exports.makeDnsPacket(opts);

    let client;
    let resolver;
    // Transport method determines which client type to use
    switch (method) {

        case "TCP":
        case "DOT": {
            if (isSecure) {
                const options = {
                    port: resolverPort,
                    host: resolverServer,
                    rejectUnauthorized: !skipCertCheck,
                    secureContext: tls.createSecureContext({
                        minVersion: "TLSv1.2",
                    }),
                };
                // Set TLS ServerName only if server is not an IP address per
                // Section 3 of RFC 6066
                if (addressFamily === 0) {
                    options.servername = resolverServer;
                }
                client = tls.connect(options, () => {
                    log.debug("dns", `Connected to ${resolverServer}:${resolverPort}`);
                    client.write(buf);
                });
            } else {
                client = new Socket();
                client.connect(resolverPort, resolverServer, () => {
                    log.debug("dns", `Connected to ${resolverServer}:${resolverPort}`);
                    client.write(buf);
                });
            }
            resolver = new Promise((resolve, reject) => {
                // The below message is used when the response received does
                // not follow Section 4.2.2 of RFC 1035
                const lenErrMsg = "Resolver returned invalid DNS response";
                let data = Buffer.alloc(0);
                let expectedLength = 0;
                let isValidLength = false;
                client.on("error", (err) => {
                    reject(err);
                });
                client.setTimeout(timeout, () => {
                    client.destroy();
                    reject({ message: "Connection timed out" });
                });
                client.on("data", (chunk) => {
                    if (data.length === 0) {
                        if (chunk.byteLength > 1) {
                            expectedLength = chunk.readUInt16BE(0);
                            if (expectedLength < 12) {
                                reject({ message: lenErrMsg });
                            }
                        }
                    }
                    data = Buffer.concat([ data, chunk ]);
                    if (data.byteLength - 2 === expectedLength) {
                        isValidLength = true;
                        client.destroy();
                        const response = exports.decodeDnsPacket(data, true, reject);
                        resolve(response);
                    }
                });
                client.on("close", () => {
                    log.debug("dns", "Connection closed");
                    if (!isValidLength) {
                        reject({ message: lenErrMsg });
                    }
                });
            });
            break;
        }

        case "DOH": {
            const queryPath = dohUsePost ? dohQuery : `${dohQuery}?dns=${buf.toString("base64url")}`;
            const requestURL = url.parse(`https://${resolverServer}:${resolverPort}/${queryPath}`, true);
            const mimeType = "application/dns-message";
            const options = {
                hostname: requestURL.hostname,
                port: requestURL.port,
                path: requestURL.path,
                method: "GET",
                headers: {
                    "accept": mimeType,
                },
                rejectUnauthorized: !skipCertCheck,
            };
            if (dohUsePost) {
                options.method = "POST";
                // Setting Content-Length header is required for some resolvers
                options.headers["content-length"] = buf.byteLength;
                options.headers["content-type"] = mimeType;
            }
            resolver = new Promise((resolve, reject) => {
                /**
                 * Helper function to validate HTTP response
                 * @param {IncomingMessage|ClientHttp2Stream} httpResponse
                 *   The response from https or http2 client
                 * @param {object} http2Headers Response headers from http2
                 * @returns {void}
                 * @throws missing one or more headers for HTTP/2 response
                 */
                const handleResponse = (httpResponse, http2Headers) => {
                    // Determine status code and content type
                    let statusCode;
                    let contentType;
                    if (dohUseHttp2) {
                        if (!http2Headers) {
                            throw new Error("No headers passed for HTTP/2 response");
                        }
                        statusCode = http2Headers[HTTP2_HEADER_STATUS];
                        contentType = http2Headers[HTTP2_HEADER_CONTENT_TYPE];
                    } else {
                        statusCode = httpResponse.statusCode;
                        contentType = httpResponse.headers["content-type"];
                    }
                    // Validate response from resolver
                    if (statusCode !== 200) {
                        reject({ message: `Request failed with status code ${statusCode}` });
                        return;
                    } else if (contentType !== mimeType) {
                        reject({ message: `Content-Type was "${contentType}", expected ${mimeType}` });
                        return;
                    }
                    // Read the response body into a buffer
                    let data = Buffer.alloc(0);
                    httpResponse.on("data", (chunk) => {
                        data = Buffer.concat([ data, chunk ]);
                    });
                    httpResponse.on("end", () => {
                        const response = exports.decodeDnsPacket(data, false, reject);
                        resolve(response);
                    });
                };
                if (dohUseHttp2) {
                    const headers = {};
                    headers[HTTP2_HEADER_AUTHORITY] = options.hostname;
                    headers[HTTP2_HEADER_PATH] = options.path;
                    headers[HTTP2_HEADER_METHOD] = options.method;
                    headers[HTTP2_HEADER_ACCEPT] = options.headers["accept"];
                    if (dohUsePost) {
                        headers[HTTP2_HEADER_CONTENT_LENGTH] = options.headers["content-length"];
                        headers[HTTP2_HEADER_CONTENT_TYPE] = options.headers["content-type"];
                    }
                    client = http2.connect(`https://${options.hostname}:${options.port}`, {
                        rejectUnauthorized: options.rejectUnauthorized,
                    });
                    client.setTimeout(timeout, () => {
                        client.destroy();
                        reject({ message: "Request timed out" });
                    });
                    client.on("connect", () => {
                        log.debug("dns", `Connected to ${resolverServer}:${resolverPort}`);
                    });
                    const req = client.request(headers);
                    req.on("error", (err) => {
                        err.message = "HTTP/2: " + err.message;
                        reject(err);
                    });
                    req.on("response", (resHeaders) => {
                        handleResponse(req, resHeaders);
                    });
                    req.on("end", () => {
                        client.close();
                    });
                    if (dohUsePost) {
                        req.write(buf);
                    }
                    req.end();
                } else {
                    client = https.request(options, (httpResponse) => {
                        handleResponse(httpResponse);
                    });
                    client.setTimeout(timeout, () => {
                        client.destroy();
                        reject({ message: "Request timed out" });
                    });
                    client.on("socket", (socket) => {
                        socket.on("secureConnect", () => {
                            log.debug("dns", `Connected to ${resolverServer}:${resolverPort}`);
                        });
                    });
                    if (dohUsePost) {
                        client.write(buf);
                    }
                    client.end();
                }
                client.on("error", (err) => {
                    reject(err);
                });
                client.on("close", () => {
                    log.debug("dns", "Connection closed");
                });
            });
            break;
        }

        case "UDP":
        default: {
            if (addressFamily === 0) {
                return new Promise((resolve, reject) => {
                    reject({ message: "Resolver server must be IP address for UDP transport method" });
                });
            }
            client = dgram.createSocket(`udp${addressFamily}`);
            resolver = new Promise((resolve, reject) => {
                let timer;
                client.on("message", (rdata, rinfo) => {
                    client.close();
                    const response = exports.decodeDnsPacket(rdata, false, reject);
                    resolve(response);
                });
                client.on("error", (err) => {
                    clearTimeout(timer);
                    reject(err);
                });
                client.on("listening", () => {
                    log.debug("dns", `Connected to ${resolverServer}:${resolverPort}`);
                    timer = setTimeout(() => {
                        reject({ message: "Query timed out" });
                        client.close();
                    }, timeout);
                });
                client.on("close", () => {
                    clearTimeout(timer);
                    log.debug("dns", "Connection closed");
                });
            });
            client.send(buf, 0, buf.length, resolverPort, resolverServer);
        }
    }

    return resolver;
};

/**
 * Run a query on SQL Server
 * @param {string} connectionString The database connection string
 * @param {string} query The query to validate the database with
 * @returns {Promise<(string[] | object[] | object)>} Response from
 * server
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
 * @returns {Promise<(string[] | object[] | object)>} Response from
 * server
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
 * @returns {Promise<(string)>} Response from server
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
 * Query radius server
 * @param {string} hostname Hostname of radius server
 * @param {string} username Username to use
 * @param {string} password Password to use
 * @param {string} calledStationId ID of called station
 * @param {string} callingStationId ID of calling station
 * @param {string} secret Secret to use
 * @param {number} port Port to contact radius server on
 * @param {number} timeout Timeout for connection to use
 * @returns {Promise<any>} Response from server
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
 * @param {boolean} rejectUnauthorized If false, allows unverified server certificates.
 * @returns {Promise<any>} Response from server
 */
exports.redisPingAsync = function (dsn, rejectUnauthorized) {
    return new Promise((resolve, reject) => {
        const client = redis.createClient({
            url: dsn,
            socket: {
                rejectUnauthorized
            }
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
 * Sets the specified setting to specified value
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
 * @returns {Promise<Bean>} Settings of requested type
 */
exports.getSettings = async function (type) {
    return await Settings.getSettings(type);
};

/**
 * Set settings based on type
 * @param {string} type Type of settings to set
 * @param {object} data Values of settings
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
 * @returns {number} Number of days
 */
const getDaysBetween = (validFrom, validTo) =>
    Math.round(Math.abs(+validFrom - +validTo) / 8.64e7);

/**
 * Get days remaining from a time range
 * @param {Date} validFrom Start date
 * @param {Date} validTo End date
 * @returns {number} Number of days remaining
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
 * @param {object} info The chain obtained from getPeerCertificate()
 * @returns {object} An object representing certificate information
 * @throws The certificate chain length exceeded 500.
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
 * @returns {object} Object containing certificate information
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
 * @returns {number} Total clients in room
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
 * @param {object} res Response object from axios
 * @returns {void}
 */
exports.allowDevAllOrigin = (res) => {
    if (process.env.NODE_ENV === "development") {
        exports.allowAllOrigin(res);
    }
};

/**
 * Allow CORS all origins
 * @param {object} res Response object from axios
 * @returns {void}
 */
exports.allowAllOrigin = (res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
};

/**
 * Check if a user is logged in
 * @param {Socket} socket Socket instance
 * @returns {void}
 * @throws The user is not logged in
 */
exports.checkLogin = (socket) => {
    if (!socket.userID) {
        throw new Error("You are not logged in.");
    }
};

/**
 * For logged-in users, double-check the password
 * @param {Socket} socket Socket.io instance
 * @param {string} currentPassword Password to validate
 * @returns {Promise<Bean>} User
 * @throws The current password is not a string
 * @throws The provided password is not correct
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

/**
 * Convert unknown string to UTF8
 * @param {Uint8Array} body Buffer
 * @returns {string} UTF8 string
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
 * @param {number} percentage float, 0 to 1
 * @param {number} maxHue Maximum hue - int
 * @param {number} minHue Minimum hue - int
 * @returns {string} Color in hex
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
 * @param {string[]} parts Strings to join
 * @param {string} connector Separator for joined strings
 * @returns {string} Joined strings
 */
exports.filterAndJoin = (parts, connector = "") => {
    return parts.filter((part) => !!part && part !== "").join(connector);
};

/**
 * Send an Error response
 * @param {object} res Express response object
 * @param {string} msg Message to send
 * @returns {void}
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

/**
 * Convert timezone of time object
 * @param {object} obj Time object to update
 * @param {string} timezone New timezone to set
 * @param {boolean} timeObjectToUTC Convert time object to UTC
 * @returns {object} Time object with updated timezone
 */
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
 * Convert time object to UTC
 * @param {object} obj Object to convert
 * @param {string} timezone Timezone of time object
 * @returns {object} Updated time object
 */
module.exports.timeObjectToUTC = (obj, timezone = undefined) => {
    return timeObjectConvertTimezone(obj, timezone, true);
};

/**
 * Convert time object to local time
 * @param {object} obj Object to convert
 * @param {string} timezone Timezone to convert to
 * @returns {object} Updated object
 */
module.exports.timeObjectToLocal = (obj, timezone = undefined) => {
    return timeObjectConvertTimezone(obj, timezone, false);
};

/**
 * Create gRPC client stib
 * @param {object} options from gRPC client
 * @returns {Promise<object>} Result of gRPC query
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
 * @param {string} data The data to be hashed
 * @param {number} len Output length of the hash
 * @returns {string} The hashed data in hex format
 */
module.exports.shake256 = (data, len) => {
    if (!data) {
        return "";
    }
    return crypto.createHash("shake256", { outputLength: len })
        .update(data)
        .digest("hex");
};

/**
 * Non await sleep
 * Source: https://stackoverflow.com/questions/59099454/is-there-a-way-to-call-sleep-without-await-keyword
 * @param {number} n Milliseconds to wait
 * @returns {void}
 */
module.exports.wait = (n) => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
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
