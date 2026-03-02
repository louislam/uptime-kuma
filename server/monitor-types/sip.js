const { MonitorType } = require("./monitor-type");
const { log, UP } = require("../../src/util");
const crypto = require("crypto");
const sip = require("sip");
const uuid = require("uuid");
const dayjs = require("dayjs");
const version = require("../../package.json").version;

/**
 * Sends a SIP REGISTER request
 * @param {string} sipServer The SIP server to register with
 * @param {number} sipPort The port of the SIP server
 * @param {string} transport The transport protocol to use (e.g., 'udp' or 'tcp')
 * @param {string} username The username for registration
 * @param {string} userPassword The userPassword for registration
 * @param {string} ver The version of the SIP health monitor
 * @returns {Promise<object>} The response from the SIP REGISTER request
 */
async function sipRegisterRequest(sipServer, sipPort, transport, username, userPassword, ver) {
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
            "User-Agent": "SIP Health Monitor " + ver,
            "Expires": 60,
        },
        transport: transport.toLowerCase(),
    };
    const registrationResponse = await sipRegister(registerRequest);
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
        const authorizedRegisterRequest = constructAuthorizedRequest(
            registerRequest,
            username,
            userPassword,
            authHeader,
            authType
        );
        // Increment CSeq for the authenticated retry
        authorizedRegisterRequest.headers.cseq = { method: registerRequest.method, seq: 2 };
        log.debug("sip", "Sending authenticated request");
        const secondResponse = await sipRegister(authorizedRegisterRequest);
        log.debug("sip", "Authenticated response status: " + secondResponse.status);
        return secondResponse;
    } else {
        log.debug("sip", "No auth header found in response, resolving with initial response");
        return registrationResponse;
    }
}

/**
 * Sends a SIP REGISTER request via the sip library
 * @param {object} registerRequest The SIP REGISTER request object
 * @returns {Promise<object>} The response from the SIP server
 */
function sipRegister(registerRequest) {
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
}

/**
 * Constructs an authorized SIP request with digest authentication
 * @param {object} request The original SIP request
 * @param {string} username The username for authentication
 * @param {string} userPassword The password for authentication
 * @param {object} challengeHeader The challenge header from the server
 * @param {string} headerName The header name to use for authorization
 * @returns {object} The authorized SIP request
 */
function constructAuthorizedRequest(request, username, userPassword, challengeHeader, headerName = "Authorization") {
    if (!userPassword) {
        throw new Error("Password is required for digest authentication");
    }

    const realm = (challengeHeader.realm || "").replace(/"/g, "");
    const nonce = (challengeHeader.nonce || "").replace(/"/g, "");
    const opaque = (challengeHeader.opaque || "").replace(/"/g, "");
    const qopRaw = (challengeHeader.qop || "").replace(/"/g, "");
    const algorithm = (challengeHeader.algorithm || "MD5").replace(/"/g, "");

    // Parse qop list (e.g., "auth,auth-int") and select preferred value
    const qopOptions = qopRaw.split(",").map(q => q.trim().toLowerCase()).filter(Boolean);
    const qop = qopOptions.includes("auth") ? "auth" : (qopOptions[0] || "");

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
}

/**
 * Sends a SIP OPTIONS request
 * @param {string} sipServer The SIP server to send OPTIONS to
 * @param {number} sipPort The port of the SIP server
 * @param {string} transport The transport protocol to use (e.g., 'udp' or 'tcp')
 * @param {string} username The username for authentication (optional)
 * @param {string} password The password for authentication (optional)
 * @param {string} ver The version of the SIP Health Monitor
 * @returns {Promise<object>} The response from the SIP OPTIONS request
 */
async function sipOptionRequest(sipServer, sipPort, transport, username, password, ver) {
    const publicIP = process.env.PUBLIC_IP || sipServer;
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
            "User-Agent": "SIP Health Monitor " + ver,
        },
        transport: transport.toLowerCase(),
    };

    if (!username) {
        log.debug("sip", "Sending unauthenticated OPTIONS request");
        const optionResponse = await sipOption(optionsRequest);
        log.debug("sip", "optionResponse: " + JSON.stringify(optionResponse));
        return optionResponse;
    }

    const optionResponse = await sipOption(optionsRequest);
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
        const authorizedOptionRequest = constructAuthorizedRequest(
            optionsRequest,
            username,
            password,
            authHeader,
            authType
        );
        return await sipOption(authorizedOptionRequest);
    }

    return optionResponse;
}

/**
 * Sends a SIP OPTIONS request via the sip library
 * @param {object} optionsRequest The SIP OPTIONS request object
 * @returns {Promise<object>} The response from the SIP server
 */
function sipOption(optionsRequest) {
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
}

const sipStatusCodes = [
    { status: 100, msg: "Trying" },
    { status: 180, msg: "Ringing" },
    { status: 181, msg: "Call Being Forwarded" },
    { status: 182, msg: "Queued" },
    { status: 183, msg: "Session Progress" },
    { status: 199, msg: "Early Dialog Terminated" },
    { status: 200, msg: "OK" },
    { status: 202, msg: "Accepted" },
    { status: 204, msg: "No Notification" },
    { status: 300, msg: "Multiple Choices" },
    { status: 301, msg: "Moved Permanently" },
    { status: 302, msg: "Moved Temporarily" },
    { status: 305, msg: "Use Proxy" },
    { status: 380, msg: "Alternate Service" },
    { status: 400, msg: "Bad Request" },
    { status: 401, msg: "Unauthorized" },
    { status: 402, msg: "Payment Required" },
    { status: 403, msg: "Forbidden" },
    { status: 404, msg: "Not Found" },
    { status: 405, msg: "Method Not Allowed" },
    { status: 406, msg: "Not Acceptable" },
    { status: 407, msg: "Proxy Authentication Required" },
    { status: 408, msg: "Request Timeout" },
    { status: 409, msg: "Conflict" },
    { status: 410, msg: "Gone" },
    { status: 411, msg: "Length Required" },
    { status: 412, msg: "Conditional Request Failed" },
    { status: 413, msg: "Request Entity Too Large" },
    { status: 414, msg: "Request-URI Too Long" },
    { status: 415, msg: "Unsupported Media Type" },
    { status: 416, msg: "Unsupported URI Scheme" },
    { status: 417, msg: "Unknown Resource-Priority" },
    { status: 420, msg: "Bad Extension" },
    { status: 421, msg: "Extension Required" },
    { status: 422, msg: "Session Interval Too Small" },
    { status: 423, msg: "Interval Too Brief" },
    { status: 424, msg: "Bad Location Information" },
    { status: 425, msg: "Bad Alert Message" },
    { status: 428, msg: "Use Identity Header" },
    { status: 429, msg: "Provide Referrer Identity" },
    { status: 430, msg: "Flow Failed" },
    { status: 433, msg: "Anonymity Disallowed" },
    { status: 436, msg: "Bad Identity-Info" },
    { status: 437, msg: "Unsupported Certificate" },
    { status: 438, msg: "Invalid Identity Header" },
    { status: 439, msg: "First Hop Lacks Outbound Support" },
    { status: 440, msg: "Max-Breadth Exceeded" },
    { status: 469, msg: "Bad Info Package" },
    { status: 470, msg: "Consent Needed" },
    { status: 480, msg: "Temporarily Unavailable" },
    { status: 481, msg: "Call/Transaction Does Not Exist" },
    { status: 482, msg: "Loop Detected" },
    { status: 483, msg: "Too Many Hops" },
    { status: 484, msg: "Address Incomplete" },
    { status: 485, msg: "Ambiguous" },
    { status: 486, msg: "Busy Here" },
    { status: 487, msg: "Request Terminated" },
    { status: 488, msg: "Not Acceptable Here" },
    { status: 489, msg: "Bad Event" },
    { status: 491, msg: "Request Pending" },
    { status: 493, msg: "Undecipherable" },
    { status: 494, msg: "Security Agreement Required" },
    { status: 500, msg: "Internal Server Error" },
    { status: 501, msg: "Not Implemented" },
    { status: 502, msg: "Bad Gateway" },
    { status: 503, msg: "Service Unavailable" },
    { status: 504, msg: "Server Time-out" },
    { status: 505, msg: "Version Not Supported" },
    { status: 513, msg: "Message Too Large" },
    { status: 555, msg: "Push Notification Service Not Supported" },
    { status: 580, msg: "Precondition Failure" },
    { status: 600, msg: "Busy Everywhere" },
    { status: 603, msg: "Decline" },
    { status: 604, msg: "Does Not Exist Anywhere" },
    { status: 606, msg: "Not Acceptable" },
    { status: 607, msg: "Unwanted" },
    { status: 608, msg: "Rejected" },
];

class SipMonitorType extends MonitorType {
    name = "sip";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let sipResponse;
        let sipMessage;
        let startTime = dayjs().valueOf();

        if (monitor.sipMethod === "OPTIONS") {
            sipResponse = await sipOptionRequest(monitor.hostname, monitor.port, monitor.sipProtocol, monitor.basic_auth_user, monitor.basic_auth_pass, version);
        } else {
            sipResponse = await sipRegisterRequest(monitor.hostname, monitor.port, monitor.sipProtocol, monitor.basic_auth_user, monitor.basic_auth_pass, version);
        }

        heartbeat.ping = dayjs().valueOf() - startTime;

        const matchingStatus = sipStatusCodes.find(code => code.status === sipResponse?.status);

        if (matchingStatus) {
            sipMessage = `${sipResponse.status} - ${matchingStatus.msg}`;
        } else {
            sipMessage = `${sipResponse?.status} - Unknown Status`;
        }

        if (sipResponse?.status === 200) {
            heartbeat.status = UP;
            heartbeat.msg = sipMessage;
        } else {
            throw new Error(sipMessage);
        }
    }
}

module.exports = {
    SipMonitorType,
};
