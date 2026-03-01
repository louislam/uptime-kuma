const { log } = require("../src/util");
const crypto = require("crypto");
let sip = require("sip");
const uuid = require("uuid");

/**
 * Sends a SIP REGISTER request
 * @param {string} sipServer The SIP server to register with
 * @param {number} sipPort The port of the SIP server
 * @param {string} transport The transport protocol to use (e.g., 'udp' or 'tcp')
 * @param {string} username The username for registration
 * @param {string} userPassword The userPassword for registration
 * @param {string} version The version of the SIP health monitor
 * @returns {Promise<object>} The response from the SIP REGISTER request
 */
exports.sipRegisterRequest = function (sipServer, sipPort, transport, username, userPassword, version) {

    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        try {
            const userAor = username.includes("@") ? username : `${username}@${sipServer}`;
            const registerRequest = {
                method: "REGISTER",
                uri: `sip:${sipServer}:${sipPort}`,
                headers: {
                    to: { uri: `sip:${userAor}` },
                    from: { uri: `sip:${userAor}`, params: { tag: uuid.v4() } },
                    "call-id": uuid.v4(),
                    cseq: { method: "REGISTER",
                        seq: 1 },
                    "max-forwards": 70,
                    "content-length": 0,
                    contact: [{ uri: `sip:${userAor}` }],
                    "User-Agent": "SIP Health Monitor " + version,
                    "Expires": 60,
                },
                transport: transport.toLowerCase(),
            };
            const registrationResponse = await exports.sipRegister(registerRequest);
            log.debug("sip", "Initial response status: " + registrationResponse.status);

            // Handle authentication challenges (401 = WWW-Authenticate, 407 = Proxy-Authenticate)
            let authHeader = null;
            let authType = null;
            if (registrationResponse.status === 401) {
                authHeader = registrationResponse.headers["www-authenticate"];
                if (Array.isArray(authHeader)) {
                    authHeader = authHeader[0];
                }
                authType = "Authorization";
            } else if (registrationResponse.status === 407) {
                authHeader = registrationResponse.headers["proxy-authenticate"];
                if (Array.isArray(authHeader)) {
                    authHeader = authHeader[0];
                }
                authType = "Proxy-Authorization";
            }

            log.debug("sip", "Auth header found");

            if (authHeader) {
                const authorizedRegisterRequest = exports.constructAuthorizedRequest(
                    registerRequest,
                    username,
                    userPassword,
                    authHeader,
                    authType
                );
                // Increment CSeq for the authenticated retry
                authorizedRegisterRequest.headers.cseq = { method: registerRequest.method, seq: 2 };
                log.debug("sip", "Sending authenticated request");
                const secondResponse = await exports.sipRegister(authorizedRegisterRequest);
                log.debug("sip", "Authenticated response status: " + secondResponse.status);
                resolve(secondResponse);
            } else {
                log.debug("sip", "No auth header found in response, resolving with initial response");
                resolve(registrationResponse);
            }
        } catch (error) {
            log.error("sip", "Error: " + error.message);
            reject(error);
        }
    });
};

exports.sipRegister = function (registerRequest) {
    const server = sip.create({
        logger: "console",
        port: 0,
    });
    log.debug("sip", "SIP server created");
    return new Promise((resolve, reject) => {
        const timeout = 5000;
        let settled = false;

        /**
         * Clears the timeout and destroys the SIP server instance.
         * @returns {void}
         */
        function cleanup() {
            if (timeoutID) {
                clearTimeout(timeoutID);
                timeoutID = null;
            }
            if (server && server.destroy) {
                server.destroy();
                log.debug("sip", "SIP server destroyed.");
            }
        }

        let timeoutID = setTimeout(() => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            log.error("sip", "SIP Register request timed out.");
            reject(new Error("SIP Register request timed out."));
        }, timeout);

        try {
            server.send(registerRequest, (response) => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                log.debug("sip", "Received SIP register response: " + JSON.stringify(response));
                if (response) {
                    resolve(response);
                } else {
                    reject(new Error("Empty SIP response received."));
                }
            });
        } catch (error) {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            log.error("sip", "Error sending SIP register request: " + error.message);
            reject(new Error("Error sending SIP register request: " + error.message));
        }
    });
};
exports.constructAuthorizedRequest = function (request, username, userPassword, challengeHeader, headerName = "Authorization") {
    if (!userPassword) {
        throw new Error("Password is required for digest authentication");
    }

    const realm = (challengeHeader.realm || "").replace(/"/g, "");
    const nonce = (challengeHeader.nonce || "").replace(/"/g, "");
    const opaque = (challengeHeader.opaque || "").replace(/"/g, "");
    const qop = (challengeHeader.qop || "").replace(/"/g, "");
    const algorithm = (challengeHeader.algorithm || "MD5").replace(/"/g, "");

    // Determine hash function based on server's algorithm
    let hashFn;
    if (algorithm.toLowerCase() === "sha-256" || algorithm.toLowerCase() === "sha256") {
        hashFn = (data) => crypto.createHash("sha256").update(data).digest("hex");
    } else {
        // Default to MD5 (standard SIP digest auth per RFC 2617/3261)
        hashFn = (data) => crypto.createHash("md5").update(data).digest("hex");
    }

    const ha1 = hashFn(`${username}:${realm}:${userPassword}`);
    const ha2 = hashFn(`${request.method}:${request.uri}`);

    let response;
    let authParts = [
        `Digest username="${username}"`,
        `realm="${realm}"`,
        `nonce="${nonce}"`,
        `uri="${request.uri}"`,
        `algorithm=${algorithm}`,
    ];

    if (qop === "auth") {
        // RFC 2617 qop=auth: response = H(HA1:nonce:nc:cnonce:qop:HA2)
        const nc = "00000001";
        const cnonce = crypto.randomBytes(16).toString("hex");
        response = hashFn(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
        authParts.push(`qop=${qop}`);
        authParts.push(`nc=${nc}`);
        authParts.push(`cnonce="${cnonce}"`);
    } else {
        // Basic digest: response = H(HA1:nonce:HA2)
        response = hashFn(`${ha1}:${nonce}:${ha2}`);
    }

    authParts.push(`response="${response}"`);

    if (opaque) {
        authParts.push(`opaque="${opaque}"`);
    }

    const authorizedRequest = {
        ...request,
        headers: {
            ...request.headers,
            [headerName]: authParts.join(", "),
        },
    };

    log.debug("sip", "Auth digest - realm: " + realm + ", algorithm: " + algorithm + ", qop: " + qop);

    return authorizedRequest;
};
/**
 * Sends a SIP OPTIONS request
 * @param {string} sipServer The SIP server to send OPTIONS to
 * @param {number} sipPort The port of the SIP server
 * @param {string} transport The transport protocol to use (e.g., 'udp' or 'tcp')
 * @param {string} username The username for authentication (optional)
 * @param {string} password The password for authentication (optional)
 * @param {string} version The version of the SIP Health Monitor
 * @returns {Promise<object>} The response from the SIP OPTIONS request
 */
exports.sipOptionRequest = function (sipServer, sipPort, transport, username, password, version) {
    const publicIP = process.env.PUBLIC_IP || sipServer;
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        try {
            const optionsRequest = {
                method: "OPTIONS",
                uri: `sip:${sipServer}:${sipPort}`,
                headers: {
                    to: { uri: `sip:${sipServer}:${sipPort}` },
                    from: { uri: `sip:monitor@${publicIP}`, params: { tag: uuid.v4() } },
                    "call-id": uuid.v4(),
                    cseq: { method: "OPTIONS",
                        seq: 1 },
                    "max-forwards": 70,
                    "content-length": 0,
                    contact: [{ uri: `sip:monitor@${publicIP}` }],
                    "User-Agent": "SIP Health Monitor " + version,
                },
                transport: transport.toLowerCase(),
            };
            let optionResponse;
            if (!username) {
                log.debug("sip", "Sending unauthenticated OPTIONS request");
                const optionResponse = await exports.sipOption(optionsRequest);
                log.debug("sip", "optionResponse: " + JSON.stringify(optionResponse));
                resolve(optionResponse);
            } else {
                optionResponse = await exports.sipOption(optionsRequest);
                log.debug("sip", "optionResponse: " + JSON.stringify(optionResponse));

                let authHeader = null;
                let authType = null;
                if (optionResponse.status === 401 && optionResponse.headers["www-authenticate"]) {
                    authHeader = optionResponse.headers["www-authenticate"][0] || optionResponse.headers["www-authenticate"];
                    authType = "Authorization";
                } else if (optionResponse.status === 407 && optionResponse.headers["proxy-authenticate"]) {
                    authHeader = optionResponse.headers["proxy-authenticate"][0] || optionResponse.headers["proxy-authenticate"];
                    authType = "Proxy-Authorization";
                }

                if (authHeader) {
                    const authorizedOptionRequest = exports.constructAuthorizedRequest(
                        optionsRequest,
                        username,
                        password,
                        authHeader,
                        authType
                    );
                    const secondResponse = await exports.sipOption(authorizedOptionRequest);
                    resolve(secondResponse);
                } else {
                    resolve(optionResponse);
                }
            }

        } catch (error) {
            log.error("sip", "Error: " + error.message);
            reject(error);
        }
    });
};
exports.sipOption = function (optionsRequest) {
    const server = sip.create({
        logger: "console",
        port: 0,
    });
    log.debug("sip", "SIP server created");
    return new Promise((resolve, reject) => {
        const timeout = 5000;
        let settled = false;

        /**
         * Clears the timeout and destroys the SIP server instance.
         * @returns {void}
         */
        function cleanup() {
            if (timeoutID) {
                clearTimeout(timeoutID);
                timeoutID = null;
            }
            if (server && server.destroy) {
                server.destroy();
                log.debug("sip", "SIP server destroyed.");
            }
        }

        let timeoutID = setTimeout(() => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            log.error("sip", "SIP OPTIONS request timed out.");
            reject(new Error("SIP OPTIONS request timed out."));
        }, timeout);

        try {
            server.send(optionsRequest, (response) => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                log.debug("sip", "Received SIP options response: " + JSON.stringify(response));
                if (response) {
                    resolve(response);
                } else {
                    reject(new Error("Empty SIP response received."));
                }
            });
        } catch (error) {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            log.error("sip", "Error sending SIP options request: " + error.message);
            reject(new Error("Error sending SIP options request: " + error.message));
        }
    });
};
