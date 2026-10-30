import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { ZodError } from "zod";
import { checkLogin as betterAuthCheckLogin } from "./better-auth";
import type { Request, Response } from "express";
import type { SASLOptions } from "kafkajs";
import type { TokenSet } from "openid-client";
import type { Bean } from "redbean-node";
import type { Server, Socket } from "socket.io";
import type { TLSSocket } from "tls";

const { R } = require("redbean-node");
const { log, badgeConstants } = require("../src/util");
const chroma = require("chroma-js");
const { NtlmClient } = require("./modules/axios-ntlm/lib/ntlmClient.js");
const { Settings } = require("./settings");
const RadiusClient = require("./radius-client");
const oidc = require("openid-client");
const tls = require("tls");
const { exists } = require("fs");
const { networkInterfaces } = require("os");

const {
    dictionaries: {
        rfc2865: { file, attributes },
    },
} = require("node-radius-utils");

const { Kafka } = require("kafkajs");
const crypto = require("crypto");

/**
 * Gets an Access Token from an oidc/oauth2 provider
 * @param tokenEndpoint The token URI from the auth service provider
 * @param clientId The oidc/oauth application client id
 * @param clientSecret The oidc/oauth application client secret
 * @param scope The scope(s) for which the token should be issued for
 * @param audience The audience for which the token should be issued for
 * @param authMethod The method used to send the credentials. Default client_secret_basic
 * @returns TokenSet promise if the token request was successful
 */
export async function getOidcTokenClientCredentials(
    tokenEndpoint: string,
    clientId: string,
    clientSecret: string,
    scope: string,
    audience: string,
    authMethod: string = "client_secret_basic"
): Promise<TokenSet> {
    const oauthProvider = new oidc.Issuer({ token_endpoint: tokenEndpoint });
    let client = new oauthProvider.Client({
        client_id: clientId,
        client_secret: clientSecret,
        token_endpoint_auth_method: authMethod,
    });

    // Increase default timeout and clock tolerance
    client[oidc.custom.http_options] = () => ({ timeout: 10000 });
    client[oidc.custom.clock_tolerance] = 5;

    let grantParams = { grant_type: "client_credentials" };
    if (scope) {
        grantParams.scope = scope;
    }

    if (audience) {
        grantParams.audience = audience;
    }
    return await client.grant(grantParams);
}

/**
 * Monitor Kafka using Producer
 * @param brokers List of kafka brokers to connect, host and
 * port joined by ':'
 * @param topic Topic name to produce into
 * @param message Message to produce
 * @param options Kafka client options. Contains ssl, clientId,
 * allowAutoTopicCreation and interval (interval defaults to 20,
 * allowAutoTopicCreation defaults to false, clientId defaults to
 * "Uptime-Kuma" and ssl defaults to false)
 * @param saslOptions Options for kafka client
 * Authentication (SASL) (defaults to {})
 * @returns Status message
 */
export function kafkaProducerAsync(
    brokers: string[],
    topic: string,
    message: string,
    options: object = {},
    saslOptions: SASLOptions = {}
): Promise<string> {
    return new Promise((resolve, reject) => {
        const {
            interval = 20,
            allowAutoTopicCreation = false,
            ssl = false,
            clientId = "Uptime-Kuma",
            connectionTimeout = 1,
        } = options;

        let connectedToKafka = false;

        const timeoutID = setTimeout(
            () => {
                log.debug("kafkaProducer", "KafkaProducer timeout triggered");
                connectedToKafka = true;
                reject(new Error("Timeout"));
            },
            interval * 1000 * 0.8
        );

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
            connectionTimeout: connectionTimeout * 1000,
        });

        let producer = client.producer({
            allowAutoTopicCreation: allowAutoTopicCreation,
            retry: {
                retries: 0,
            },
        });

        producer
            .connect()
            .then(() => {
                producer
                    .send({
                        topic: topic,
                        messages: [
                            {
                                value: message,
                            },
                        ],
                    })
                    .then((_) => {
                        resolve("Message sent successfully");
                    })
                    .catch((e) => {
                        connectedToKafka = true;
                        producer.disconnect();
                        clearTimeout(timeoutID);
                        reject(new Error("Error sending message: " + e.message));
                    })
                    .finally(() => {
                        connectedToKafka = true;
                        clearTimeout(timeoutID);
                    });
            })
            .catch((e) => {
                connectedToKafka = true;
                producer.disconnect();
                clearTimeout(timeoutID);
                reject(new Error("Error in producer connection: " + e.message));
            });

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
}

/**
 * Use NTLM Auth for a http request.
 * @param options The http request options
 * @param ntlmOptions The auth options
 * @returns NTLM response
 */
export function httpNtlm(options: object, ntlmOptions: object): Promise<string[] | object[] | object> {
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
}

/**
 * Query radius server
 * @param hostname Hostname of radius server
 * @param username Username to use
 * @param password Password to use
 * @param calledStationId ID of called station
 * @param callingStationId ID of calling station
 * @param secret Secret to use
 * @param port Port to contact radius server on
 * @param timeout Timeout for connection to use
 * @returns Response from server
 */
export function radius(
    hostname: string,
    username: string,
    password: string,
    calledStationId: string,
    callingStationId: string,
    secret: string,
    port: number = 1812,
    timeout: number = 2500
): Promise<{ code: string }> {
    const client = new RadiusClient({
        host: hostname,
        hostPort: port,
        timeout: timeout,
        retries: 1,
        dictionaries: [file],
    });

    return client
        .accessRequest({
            secret: secret,
            attributes: [
                [attributes.USER_NAME, username],
                [attributes.USER_PASSWORD, password],
                [attributes.CALLING_STATION_ID, callingStationId],
                [attributes.CALLED_STATION_ID, calledStationId],
            ],
        })
        .catch((error) => {
            // Preserve error stack trace and provide better context
            if (error.response?.code) {
                const radiusError = new Error(`RADIUS ${error.response.code} from ${hostname}:${port}`);
                radiusError.response = error.response;
                radiusError.originalError = error;
                throw radiusError;
            } else {
                // Preserve original error message and stack trace
                const enhancedError = new Error(
                    `RADIUS authentication failed for ${hostname}:${port}: ${error.message}`
                );
                enhancedError.originalError = error;
                enhancedError.stack = error.stack || enhancedError.stack;
                throw enhancedError;
            }
        });
}

/**
 * Retrieve value of setting based on key
 * @param key Key of setting to retrieve
 * @returns Value
 * @deprecated Use await Settings.get(key)
 */
export async function setting(key: string): Promise<Bean | null> {
    return await Settings.get(key);
}

/**
 * Sets the specified setting to specified value
 * @param key Key of setting to set
 * @param value Value to set to
 * @param type Type of setting
 * @returns
 */
export async function setSetting(key: string, value: unknown, type: string | null = null): Promise<void> {
    await Settings.set(key, value, type);
}

/**
 * Get settings based on type
 * @param type The type of setting
 * @returns Settings of requested type
 */
export async function getSettings(type: string): Promise<Record<string, unknown>> {
    return await Settings.getSettings(type);
}

/**
 * Set settings based on type
 * @param type Type of settings to set
 * @param data Values of settings
 * @returns
 */
export async function setSettings(type: string, data: object): Promise<void> {
    await Settings.setSettings(type, data);
}

// ssl-checker by @dyaa
//https://github.com/dyaa/ssl-checker/blob/master/src/index.ts

/**
 * Get number of days between two dates
 * @param {Date} validFrom Start date
 * @param {Date} validTo End date
 * @returns {number} Number of days
 */
const getDaysBetween = (validFrom, validTo) => Math.round(Math.abs(+validFrom - +validTo) / 8.64e7);

/**
 * Get days remaining from a time range
 * @param validFrom Start date
 * @param validTo End date
 * @returns Number of days remaining
 */
export function getDaysRemaining(validFrom: Date, validTo: Date): number {
    const daysRemaining = getDaysBetween(validFrom, validTo);
    if (new Date(validTo).getTime() < new Date().getTime()) {
        return -daysRemaining;
    }
    return daysRemaining;
}

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
        link.daysRemaining = dayjs.utc(link.validTo).diff(dayjs.utc(), "day");

        existingList[link.fingerprint] = true;

        // Move up the chain until loop is encountered
        if (link.issuerCertificate == null) {
            link.certType = i === 0 ? "self-signed" : "root CA";
            break;
        } else if (link.issuerCertificate.fingerprint in existingList) {
            // a root CA certificate is typically "signed by itself"  (=> "self signed certificate") and thus the "issuerCertificate" is a reference to itself.
            log.debug("cert", `[Last] ${link.issuerCertificate.fingerprint}`);
            link.certType = i === 0 ? "self-signed" : "root CA";
            link.issuerCertificate = null;
            break;
        } else {
            link.certType = i === 0 ? "server" : "intermediate CA";
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
 * @param socket TLSSocket, which may or may not be connected
 * @returns} Object containing certificate information
 */
export function checkCertificate(socket: TLSSocket): null | { valid: boolean; certInfo: object } {
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
        certInfo: parsedInfo,
    };
}

/**
 * Checks if the certificate is valid for the provided hostname.
 * Defaults to true if feature `X509Certificate` is not available, or input is not valid.
 * @param certBuffer - The certificate buffer.
 * @param hostname - The hostname to compare against.
 * @returns True if the certificate is valid for the provided hostname, false otherwise.
 */
export function checkCertificateHostname(certBuffer: Buffer, hostname: string): boolean {
    let X509Certificate;
    try {
        X509Certificate = require("node:crypto").X509Certificate;
    } catch (_) {
        // X509Certificate is not available in this version of Node.js
        return true;
    }

    if (!X509Certificate || !certBuffer || !hostname) {
        return true;
    }

    let certObject = new X509Certificate(certBuffer);
    return certObject.checkHost(hostname) !== undefined;
}

/**
 * Check if the provided status code is within the accepted ranges
 * @param status The status code to check
 * @param acceptedCodes An array of accepted status codes
 * @returns True if status code within range, false otherwise
 */
export function checkStatusCode(status: number, acceptedCodes: string[]): boolean {
    if (acceptedCodes == null || acceptedCodes.length === 0) {
        return false;
    }

    for (const codeRange of acceptedCodes) {
        if (typeof codeRange !== "string") {
            log.error("monitor", `Accepted status code not a string. ${codeRange} is of type ${typeof codeRange}`);
            continue;
        }

        const codeRangeSplit = codeRange.split("-").map((string) => parseInt(string));
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
}

/**
 * Get total number of clients in room
 * @param io Socket server instance
 * @param roomName Name of room to check
 * @returns Total clients in room
 */
export function getTotalClientInRoom(io: Server, roomName: string): number {
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
}

/**
 * @deprecated Use allowDevOrigin
 * Allow CORS all origins if development
 * @param res Response object from axios
 * @returns
 */
export function allowDevAllOrigin(res: object): void {
    if (process.env.NODE_ENV === "development") {
        allowAllOrigin(res);
    }
}

/**
 * @deprecated Use allowOrigin
 * Allow CORS all origins
 * @param res Response object from axios
 * @returns
 */
export function allowAllOrigin(res: object): void {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
}

/**
 * Allow CORS all origins if development
 * @param req Express request object
 * @param res Express response object
 * @returns
 */
export function allowDevOrigin(req: Request, res: Response): void {
    if (process.env.NODE_ENV === "development") {
        allowOrigin(req, res);
    }
}

/**
 * Allow CORS all origins
 * Since Allow-Credentials is set to true, the Access-Control-Allow-Origin cannot be *, so we will set it to the request origin.
 * @param req Express request object
 * @param res Response object
 * @returns
 */
export function allowOrigin(req: Request, res: Response): void {
    res.header("Access-Control-Allow-Origin", req.get("origin"));
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Credentials", "true");
}

/**
 * @deprecated Use better-auth's checkLogin
 * Check if a user is logged in
 * @param socket Socket instance
 * @returns
 * @throws The user is not logged in
 */
export function checkLogin(socket: Socket): void {
    betterAuthCheckLogin(socket);
}

/**
 * Returns a color code in hex format based on a given percentage:
 * 0% => hue = 10 => red
 * 100% => hue = 90 => green
 * @param percentage float, 0 to 1
 * @param maxHue Maximum hue - int
 * @param minHue Minimum hue - int
 * @returns Color in hex
 */
export function percentageToColor(percentage: number, maxHue: number = 90, minHue: number = 10): string {
    const hue = percentage * (maxHue - minHue) + minHue;
    try {
        return chroma(`hsl(${hue}, 90%, 40%)`).hex();
    } catch (err) {
        return badgeConstants.naColor;
    }
}

/**
 * Joins and array of string to one string after filtering out empty values
 * @param parts Strings to join
 * @param connector Separator for joined strings
 * @returns Joined strings
 */
export function filterAndJoin(parts: string[], connector: string = ""): string {
    return parts.filter((part) => !!part && part !== "").join(connector);
}

/**
 * Send an Error response
 * @param res Express response object
 * @param msg Message to send
 * @returns
 */
export function sendHttpError(res: object, msg: string = ""): void {
    if (msg.includes("SQLITE_BUSY") || msg.includes("SQLITE_LOCKED")) {
        res.status(503).json({
            status: "fail",
            msg: msg,
        });
    } else if (msg.toLowerCase().includes("not found")) {
        res.status(404).json({
            status: "fail",
            msg: msg,
        });
    } else {
        res.status(403).json({
            status: "fail",
            msg: msg,
        });
    }
}

/**
 * Convert timezone of time object
 * @param obj Time object to update
 * @param timezone New timezone to set
 * @param timeObjectToUTC Convert time object to UTC
 * @returns Time object with updated timezone
 */
function timeObjectConvertTimezone(obj: object, timezone: string, timeObjectToUTC: boolean = true): object {
    let offsetString;

    if (timezone) {
        offsetString = dayjs().tz(timezone).format("Z");
    } else {
        offsetString = dayjs().format("Z");
    }

    let hours = parseInt(offsetString.substring(1, 3));
    let minutes = parseInt(offsetString.substring(4, 6));

    if ((timeObjectToUTC && offsetString.startsWith("+")) || (!timeObjectToUTC && offsetString.startsWith("-"))) {
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
 * @param obj Object to convert
 * @param timezone Timezone of time object
 * @returns Updated time object
 */
export function timeObjectToUTC(obj: object, timezone: string = undefined): object {
    return timeObjectConvertTimezone(obj, timezone, true);
}

/**
 * Convert time object to local time
 * @param obj Object to convert
 * @param timezone Timezone to convert to
 * @returns Updated object
 */
export function timeObjectToLocal(obj: object, timezone: string = undefined): object {
    return timeObjectConvertTimezone(obj, timezone, false);
}

/**
 * Returns an array of SHA256 fingerprints for all known root certificates.
 * @returns A set of SHA256 fingerprints.
 */
export function rootCertificatesFingerprints(): Set<unknown> {
    let fingerprints = tls.rootCertificates.map((cert) => {
        let certLines = cert.split("\n");
        certLines.shift();
        certLines.pop();
        let certBody = certLines.join("");
        let buf = Buffer.from(certBody, "base64");

        const shasum = crypto.createHash("sha256");
        shasum.update(buf);

        return shasum
            .digest("hex")
            .toUpperCase()
            .replace(/(.{2})(?!$)/g, "$1:");
    });

    fingerprints.push(
        "6D:99:FB:26:5E:B1:C5:B3:74:47:65:FC:BC:64:8F:3C:D8:E1:BF:FA:FD:C4:C2:F9:9B:9D:47:CF:7F:F1:C2:4F"
    ); // ISRG X1 cross-signed with DST X3
    fingerprints.push(
        "8B:05:B6:8C:C6:59:E5:ED:0F:CB:38:F2:C9:42:FB:FD:20:0E:6F:2F:F9:F8:5D:63:C6:99:4E:F5:E0:B0:27:01"
    ); // ISRG X2 cross-signed with ISRG X1

    return new Set(fingerprints);
}

export const SHAKE256_LENGTH = 16;

/**
 * @param data The data to be hashed
 * @param len Output length of the hash
 * @returns The hashed data in hex format
 */
export function shake256(data: string, len: number): string {
    if (!data) {
        return "";
    }
    return crypto.createHash("shake256", { outputLength: len }).update(data).digest("hex");
}

/**
 * Non await sleep
 * Source: https://stackoverflow.com/questions/59099454/is-there-a-way-to-call-sleep-without-await-keyword
 * @param n Milliseconds to wait
 * @returns
 */
export function wait(n: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
}

// For unit test, export functions
export const __test = process.env.TEST_BACKEND ? { parseCertificateInfo } : undefined;
export function __getPrivateFunction(functionName) {
    return __test?.[functionName];
}

/**
 * Generates an abort signal with the specified timeout.
 * @param timeoutMs - The timeout in milliseconds.
 * @returns - The generated abort signal, or null if not supported.
 */
export function axiosAbortSignal(timeoutMs: number): AbortSignal | null {
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
}

/**
 * Async version of fs.existsSync
 * @param path File path
 * @returns True if file exists, false otherwise
 */
export function fsExists(path: string | Buffer): Promise<boolean> {
    return new Promise(function (resolve, reject) {
        exists(path, function (exists) {
            resolve(exists);
        });
    });
}

/**
 * Encode user and password to Base64 encoding
 * for HTTP "basic" auth, as per RFC-7617
 * @param user - The username (defaults to empty string if null/undefined)
 * @param pass - The password (defaults to empty string if null/undefined)
 * @returns Encoded Base64 string
 */
export function encodeBase64(user: string | null, pass: string | null): string {
    return Buffer.from(`${user || ""}:${pass || ""}`).toString("base64");
}

/**
 * checks certificate chain for expiring certificates
 * @param monitor - The monitor object
 * @param tlsInfoObject Information about certificate
 * @returns
 */
export async function checkCertExpiryNotifications(monitor: object, tlsInfoObject: object): Promise<void> {
    if (!tlsInfoObject || !tlsInfoObject.certInfo || !tlsInfoObject.certInfo.daysRemaining) {
        return;
    }

    let notificationList = await R.getAll(
        "SELECT notification.* FROM notification, monitor_notification WHERE monitor_id = ? AND monitor_notification.notification_id = notification.id ",
        [monitor.id]
    );

    if (!notificationList.length > 0) {
        // fail fast. If no notification is set, all the following checks can be skipped.
        log.debug("monitor", "No notification, no need to send cert notification");
        return;
    }

    let notifyDays = await Settings.get("tlsExpiryNotifyDays");
    if (notifyDays == null || !Array.isArray(notifyDays)) {
        // Reset Default
        await Settings.set("tlsExpiryNotifyDays", [7, 14, 21], "general");
        notifyDays = [7, 14, 21];
    }

    for (const targetDays of notifyDays) {
        let certInfo = tlsInfoObject.certInfo;
        while (certInfo) {
            let subjectCN = certInfo.subject["CN"];
            if (monitor.rootCertificates.has(certInfo.fingerprint256)) {
                log.debug(
                    "monitor",
                    `Known root cert: ${certInfo.certType} certificate "${subjectCN}" (${certInfo.daysRemaining} days valid) on ${targetDays} deadline.`
                );
                break;
            } else if (certInfo.daysRemaining > targetDays) {
                log.debug(
                    "monitor",
                    `No need to send cert notification for ${certInfo.certType} certificate "${subjectCN}" (${certInfo.daysRemaining} days valid) on ${targetDays} deadline.`
                );
            } else {
                log.debug(
                    "monitor",
                    `call sendCertNotificationByTargetDays for ${targetDays} deadline on certificate ${subjectCN}.`
                );
                await monitor.sendCertNotificationByTargetDays(
                    subjectCN,
                    certInfo.certType,
                    certInfo.daysRemaining,
                    targetDays,
                    notificationList
                );
            }
            certInfo = certInfo.issuerCertificate;
        }
    }
}

/**
 * By default, command-exists will throw a null error if the command does not exist, which is ugly. The function makes it better.
 * Read more: https://github.com/mathisonian/command-exists/issues/22
 * @param command Command to check
 * @returns True if command exists, false otherwise
 */
export async function commandExists(command: string): Promise<boolean> {
    try {
        await require("command-exists")(command);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Log the server's listening URLs, similar to Vite's dev server output.
 * When no hostname is specified (bound to all interfaces), it prints
 * localhost plus every non-internal network address.
 * @param tag Log tag (e.g. "server", "setup-database")
 * @param port Port number
 * @param hostname Bound hostname, if any
 * @param isHTTPS Whether the server is using HTTPS
 * @returns
 */
export function printServerUrls(tag: string, port: number, hostname: string, isHTTPS: boolean = false): void {
    try {
        // If hostname is specified, just print that one.
        if (hostname) {
            log.info(tag, `Listening on: `, createURL(isHTTPS, hostname, port));
            return;
        }

        // Since no hostname is specified, which means the server is bound to all interfaces, we need to print all possible URLs.
        const nets = networkInterfaces();

        log.info(tag, "Listening on:");
        log.info(tag, `- `, createURL(isHTTPS, "localhost", port));

        // Prepare a list of valid address
        const addressList = [];
        for (const iface of Object.values(nets)) {
            for (const addr of iface) {
                if (!addr.internal) {
                    addressList.push(addr);
                }
            }
        }

        // Sort IPv4 addresses first
        addressList.sort((a, b) => {
            if (a.family === "IPv4" && b.family === "IPv6") {
                return -1;
            } else if (a.family === "IPv6" && b.family === "IPv4") {
                return 1;
            } else {
                return a.address.localeCompare(b.address);
            }
        });

        for (const address of addressList) {
            if (!address.internal) {
                const host = address.family === "IPv6" ? `[${address.address}]` : address.address;
                log.info(tag, `- `, createURL(isHTTPS, host, port));
            }
        }
    } catch (e) {
        log.error(tag, "Error printing server URLs: " + e.message);
    }
}

/**
 * Construct a URL a bit more safely
 * @param isHTTPS Whether the URL should use HTTPS protocol
 * @param hostname The hostname to use in the URL
 * @param port The port
 * @returns The constructed URL as a string
 */
function createURL(isHTTPS: boolean, hostname: string, port: number = 80): string {
    const url = new URL((isHTTPS ? "https" : "http") + `://` + hostname);
    url.port = String(port);

    // Prefer origin if available, it doesn't contain the trailing slash
    return url.origin || url.toString();
}

/**
 * Extend dayjs with the plugins the backend uses
 * @returns The shared dayjs instance
 */
export function initDayjs(): object {
    dayjs.extend(utc);
    dayjs.extend(timezone);
    dayjs.extend(customParseFormat);
    return dayjs;
}

/**
 * @param res Express response
 * @param e Any error
 * @returns
 */
export function generalErrorResponse(res: Response, e: unknown): void {
    if (e instanceof ZodError) {
        let message = "";
        for (const issue of e.issues) {
            message += `${issue.path.join(".")}: ${issue.message}\n`;
        }
        res.status(400).json({
            ok: false,
            msg: message,
        });
    } else if (e instanceof Error) {
        res.status(400).json({
            ok: false,
            msg: e.message,
        });
    } else {
        res.status(400).json({
            ok: false,
            msg: "Unknown error",
        });
    }
}
