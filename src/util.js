"use strict";
/*!
// Common Util for frontend and backend
//
// DOT NOT MODIFY util.js!
// Need to run "npm run tsc" to compile if there are any changes.
//
// Backend uses the compiled file util.js
// Frontend uses util.ts
*/
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONSOLE_STYLE_FgPink = exports.CONSOLE_STYLE_FgBrown = exports.CONSOLE_STYLE_FgViolet = exports.CONSOLE_STYLE_FgLightBlue = exports.CONSOLE_STYLE_FgLightGreen = exports.CONSOLE_STYLE_FgOrange = exports.CONSOLE_STYLE_FgGray = exports.CONSOLE_STYLE_FgWhite = exports.CONSOLE_STYLE_FgCyan = exports.CONSOLE_STYLE_FgMagenta = exports.CONSOLE_STYLE_FgBlue = exports.CONSOLE_STYLE_FgYellow = exports.CONSOLE_STYLE_FgGreen = exports.CONSOLE_STYLE_FgRed = exports.CONSOLE_STYLE_FgBlack = exports.CONSOLE_STYLE_Hidden = exports.CONSOLE_STYLE_Reverse = exports.CONSOLE_STYLE_Blink = exports.CONSOLE_STYLE_Underscore = exports.CONSOLE_STYLE_Dim = exports.CONSOLE_STYLE_Bright = exports.CONSOLE_STYLE_Reset = exports.PING_PER_REQUEST_TIMEOUT_DEFAULT = exports.PING_PER_REQUEST_TIMEOUT_MAX = exports.PING_PER_REQUEST_TIMEOUT_MIN = exports.PING_COUNT_DEFAULT = exports.PING_COUNT_MAX = exports.PING_COUNT_MIN = exports.PING_GLOBAL_TIMEOUT_DEFAULT = exports.PING_GLOBAL_TIMEOUT_MAX = exports.PING_GLOBAL_TIMEOUT_MIN = exports.PING_PACKET_SIZE_DEFAULT = exports.PING_PACKET_SIZE_MAX = exports.PING_PACKET_SIZE_MIN = exports.MIN_INTERVAL_SECOND = exports.MAX_INTERVAL_SECOND = exports.SQL_DATETIME_FORMAT_WITHOUT_SECOND = exports.SQL_DATETIME_FORMAT = exports.SQL_DATE_FORMAT = exports.STATUS_PAGE_MAINTENANCE = exports.STATUS_PAGE_PARTIAL_DOWN = exports.STATUS_PAGE_ALL_UP = exports.STATUS_PAGE_ALL_DOWN = exports.MAINTENANCE = exports.PENDING = exports.UP = exports.DOWN = exports.appName = exports.isNode = exports.isDev = void 0;
exports.evaluateJsonQuery = exports.intHash = exports.localToUTC = exports.utcToLocal = exports.utcToISODateTime = exports.isoToUTCDateTime = exports.parseTimeFromTimeObject = exports.parseTimeObject = exports.getMaintenanceRelativeURL = exports.getMonitorRelativeURL = exports.genSecret = exports.getCryptoRandomInt = exports.getRandomInt = exports.getRandomArbitrary = exports.TimeLogger = exports.polyfill = exports.log = exports.debug = exports.ucfirst = exports.sleep = exports.flipStatus = exports.badgeConstants = exports.CONSOLE_STYLE_BgGray = exports.CONSOLE_STYLE_BgWhite = exports.CONSOLE_STYLE_BgCyan = exports.CONSOLE_STYLE_BgMagenta = exports.CONSOLE_STYLE_BgBlue = exports.CONSOLE_STYLE_BgYellow = exports.CONSOLE_STYLE_BgGreen = exports.CONSOLE_STYLE_BgRed = exports.CONSOLE_STYLE_BgBlack = void 0;
const dayjs_1 = require("dayjs");
const jsonata = require("jsonata");
exports.isDev = process.env.NODE_ENV === "development";
exports.isNode = typeof process !== "undefined" && ((_a = process === null || process === void 0 ? void 0 : process.versions) === null || _a === void 0 ? void 0 : _a.node);
const dayjs = (exports.isNode) ? require("dayjs") : dayjs_1.default;
exports.appName = "Uptime Kuma";
exports.DOWN = 0;
exports.UP = 1;
exports.PENDING = 2;
exports.MAINTENANCE = 3;
exports.STATUS_PAGE_ALL_DOWN = 0;
exports.STATUS_PAGE_ALL_UP = 1;
exports.STATUS_PAGE_PARTIAL_DOWN = 2;
exports.STATUS_PAGE_MAINTENANCE = 3;
exports.SQL_DATE_FORMAT = "YYYY-MM-DD";
exports.SQL_DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
exports.SQL_DATETIME_FORMAT_WITHOUT_SECOND = "YYYY-MM-DD HH:mm";
exports.MAX_INTERVAL_SECOND = 2073600;
exports.MIN_INTERVAL_SECOND = 20;
exports.PING_PACKET_SIZE_MIN = 1;
exports.PING_PACKET_SIZE_MAX = 65500;
exports.PING_PACKET_SIZE_DEFAULT = 56;
exports.PING_GLOBAL_TIMEOUT_MIN = 1;
exports.PING_GLOBAL_TIMEOUT_MAX = 300;
exports.PING_GLOBAL_TIMEOUT_DEFAULT = 10;
exports.PING_COUNT_MIN = 1;
exports.PING_COUNT_MAX = 100;
exports.PING_COUNT_DEFAULT = 1;
exports.PING_PER_REQUEST_TIMEOUT_MIN = 1;
exports.PING_PER_REQUEST_TIMEOUT_MAX = 60;
exports.PING_PER_REQUEST_TIMEOUT_DEFAULT = 2;
exports.CONSOLE_STYLE_Reset = "\x1b[0m";
exports.CONSOLE_STYLE_Bright = "\x1b[1m";
exports.CONSOLE_STYLE_Dim = "\x1b[2m";
exports.CONSOLE_STYLE_Underscore = "\x1b[4m";
exports.CONSOLE_STYLE_Blink = "\x1b[5m";
exports.CONSOLE_STYLE_Reverse = "\x1b[7m";
exports.CONSOLE_STYLE_Hidden = "\x1b[8m";
exports.CONSOLE_STYLE_FgBlack = "\x1b[30m";
exports.CONSOLE_STYLE_FgRed = "\x1b[31m";
exports.CONSOLE_STYLE_FgGreen = "\x1b[32m";
exports.CONSOLE_STYLE_FgYellow = "\x1b[33m";
exports.CONSOLE_STYLE_FgBlue = "\x1b[34m";
exports.CONSOLE_STYLE_FgMagenta = "\x1b[35m";
exports.CONSOLE_STYLE_FgCyan = "\x1b[36m";
exports.CONSOLE_STYLE_FgWhite = "\x1b[37m";
exports.CONSOLE_STYLE_FgGray = "\x1b[90m";
exports.CONSOLE_STYLE_FgOrange = "\x1b[38;5;208m";
exports.CONSOLE_STYLE_FgLightGreen = "\x1b[38;5;119m";
exports.CONSOLE_STYLE_FgLightBlue = "\x1b[38;5;117m";
exports.CONSOLE_STYLE_FgViolet = "\x1b[38;5;141m";
exports.CONSOLE_STYLE_FgBrown = "\x1b[38;5;130m";
exports.CONSOLE_STYLE_FgPink = "\x1b[38;5;219m";
exports.CONSOLE_STYLE_BgBlack = "\x1b[40m";
exports.CONSOLE_STYLE_BgRed = "\x1b[41m";
exports.CONSOLE_STYLE_BgGreen = "\x1b[42m";
exports.CONSOLE_STYLE_BgYellow = "\x1b[43m";
exports.CONSOLE_STYLE_BgBlue = "\x1b[44m";
exports.CONSOLE_STYLE_BgMagenta = "\x1b[45m";
exports.CONSOLE_STYLE_BgCyan = "\x1b[46m";
exports.CONSOLE_STYLE_BgWhite = "\x1b[47m";
exports.CONSOLE_STYLE_BgGray = "\x1b[100m";
const consoleModuleColors = [
    exports.CONSOLE_STYLE_FgCyan,
    exports.CONSOLE_STYLE_FgGreen,
    exports.CONSOLE_STYLE_FgLightGreen,
    exports.CONSOLE_STYLE_FgBlue,
    exports.CONSOLE_STYLE_FgLightBlue,
    exports.CONSOLE_STYLE_FgMagenta,
    exports.CONSOLE_STYLE_FgOrange,
    exports.CONSOLE_STYLE_FgViolet,
    exports.CONSOLE_STYLE_FgBrown,
    exports.CONSOLE_STYLE_FgPink,
];
const consoleLevelColors = {
    "INFO": exports.CONSOLE_STYLE_FgCyan,
    "WARN": exports.CONSOLE_STYLE_FgYellow,
    "ERROR": exports.CONSOLE_STYLE_FgRed,
    "DEBUG": exports.CONSOLE_STYLE_FgGray,
};
exports.badgeConstants = {
    naColor: "#999",
    defaultUpColor: "#66c20a",
    defaultWarnColor: "#eed202",
    defaultDownColor: "#c2290a",
    defaultPendingColor: "#f8a306",
    defaultMaintenanceColor: "#1747f5",
    defaultPingColor: "blue",
    defaultStyle: "flat",
    defaultPingValueSuffix: "ms",
    defaultPingLabelSuffix: "h",
    defaultUptimeValueSuffix: "%",
    defaultUptimeLabelSuffix: "h",
    defaultCertExpValueSuffix: " days",
    defaultCertExpLabelSuffix: "h",
    defaultCertExpireWarnDays: "14",
    defaultCertExpireDownDays: "7"
};
function flipStatus(s) {
    if (s === exports.UP) {
        return exports.DOWN;
    }
    if (s === exports.DOWN) {
        return exports.UP;
    }
    return s;
}
exports.flipStatus = flipStatus;
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
exports.sleep = sleep;
function ucfirst(str) {
    if (!str) {
        return str;
    }
    const firstLetter = str.substr(0, 1);
    return firstLetter.toUpperCase() + str.substr(1);
}
exports.ucfirst = ucfirst;
function debug(msg) {
    exports.log.log("", msg, "debug");
}
exports.debug = debug;
class Logger {
    constructor() {
        this.hideLog = {
            info: [],
            warn: [],
            error: [],
            debug: [],
        };
        if (typeof process !== "undefined" && process.env.UPTIME_KUMA_HIDE_LOG) {
            const list = process.env.UPTIME_KUMA_HIDE_LOG.split(",").map(v => v.toLowerCase());
            for (const pair of list) {
                const values = pair.split(/_(.*)/s);
                if (values.length >= 2) {
                    this.hideLog[values[0]].push(values[1]);
                }
            }
            this.debug("server", "UPTIME_KUMA_HIDE_LOG is set");
            this.debug("server", this.hideLog);
        }
    }
    log(module, msg, level) {
        if (level === "DEBUG" && !exports.isDev) {
            return;
        }
        if (this.hideLog[level] && this.hideLog[level].includes(module.toLowerCase())) {
            return;
        }
        module = module.toUpperCase();
        level = level.toUpperCase();
        let now;
        if (dayjs.tz) {
            now = dayjs.tz(new Date()).format();
        }
        else {
            now = dayjs().format();
        }
        const levelColor = consoleLevelColors[level];
        const moduleColor = consoleModuleColors[intHash(module, consoleModuleColors.length)];
        let timePart;
        let modulePart;
        let levelPart;
        let msgPart;
        if (exports.isNode) {
            switch (level) {
                case "DEBUG":
                    timePart = exports.CONSOLE_STYLE_FgGray + now + exports.CONSOLE_STYLE_Reset;
                    break;
                default:
                    timePart = exports.CONSOLE_STYLE_FgCyan + now + exports.CONSOLE_STYLE_Reset;
                    break;
            }
            modulePart = "[" + moduleColor + module + exports.CONSOLE_STYLE_Reset + "]";
            levelPart = levelColor + `${level}:` + exports.CONSOLE_STYLE_Reset;
            switch (level) {
                case "ERROR":
                    if (typeof msg === "string") {
                        msgPart = exports.CONSOLE_STYLE_FgRed + msg + exports.CONSOLE_STYLE_Reset;
                    }
                    else {
                        msgPart = msg;
                    }
                    break;
                case "DEBUG":
                    if (typeof msg === "string") {
                        msgPart = exports.CONSOLE_STYLE_FgGray + msg + exports.CONSOLE_STYLE_Reset;
                    }
                    else {
                        msgPart = msg;
                    }
                    break;
                default:
                    msgPart = msg;
                    break;
            }
        }
        else {
            timePart = now;
            modulePart = `[${module}]`;
            levelPart = `${level}:`;
            msgPart = msg;
        }
        switch (level) {
            case "ERROR":
                console.error(timePart, modulePart, levelPart, msgPart);
                break;
            case "WARN":
                console.warn(timePart, modulePart, levelPart, msgPart);
                break;
            case "INFO":
                console.info(timePart, modulePart, levelPart, msgPart);
                break;
            case "DEBUG":
                if (exports.isDev) {
                    console.debug(timePart, modulePart, levelPart, msgPart);
                }
                break;
            default:
                console.log(timePart, modulePart, levelPart, msgPart);
                break;
        }
    }
    info(module, msg) {
        this.log(module, msg, "info");
    }
    warn(module, msg) {
        this.log(module, msg, "warn");
    }
    error(module, msg) {
        this.log(module, msg, "error");
    }
    debug(module, msg) {
        this.log(module, msg, "debug");
    }
    exception(module, exception, msg) {
        let finalMessage = exception;
        if (msg) {
            finalMessage = `${msg}: ${exception}`;
        }
        this.log(module, finalMessage, "error");
    }
}
exports.log = new Logger();
function polyfill() {
    if (!String.prototype.replaceAll) {
        String.prototype.replaceAll = function (str, newStr) {
            if (Object.prototype.toString.call(str).toLowerCase() === "[object regexp]") {
                return this.replace(str, newStr);
            }
            return this.replace(new RegExp(str, "g"), newStr);
        };
    }
}
exports.polyfill = polyfill;
class TimeLogger {
    constructor() {
        this.startTime = dayjs().valueOf();
    }
    print(name) {
        if (exports.isDev && process.env.TIMELOGGER === "1") {
            console.log(name + ": " + (dayjs().valueOf() - this.startTime) + "ms");
        }
    }
}
exports.TimeLogger = TimeLogger;
function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}
exports.getRandomArbitrary = getRandomArbitrary;
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
exports.getRandomInt = getRandomInt;
const getRandomBytes = ((typeof window !== "undefined" && window.crypto)
    ? function () {
        return (numBytes) => {
            const randomBytes = new Uint8Array(numBytes);
            for (let i = 0; i < numBytes; i += 65536) {
                window.crypto.getRandomValues(randomBytes.subarray(i, i + Math.min(numBytes - i, 65536)));
            }
            return randomBytes;
        };
    }
    : function () {
        return require("crypto").randomBytes;
    })();
function getCryptoRandomInt(min, max) {
    const range = max - min;
    if (range >= Math.pow(2, 32)) {
        console.log("Warning! Range is too large.");
    }
    let tmpRange = range;
    let bitsNeeded = 0;
    let bytesNeeded = 0;
    let mask = 1;
    while (tmpRange > 0) {
        if (bitsNeeded % 8 === 0) {
            bytesNeeded += 1;
        }
        bitsNeeded += 1;
        mask = mask << 1 | 1;
        tmpRange = tmpRange >>> 1;
    }
    const randomBytes = getRandomBytes(bytesNeeded);
    let randomValue = 0;
    for (let i = 0; i < bytesNeeded; i++) {
        randomValue |= randomBytes[i] << 8 * i;
    }
    randomValue = randomValue & mask;
    if (randomValue <= range) {
        return min + randomValue;
    }
    else {
        return getCryptoRandomInt(min, max);
    }
}
exports.getCryptoRandomInt = getCryptoRandomInt;
function genSecret(length = 64) {
    let secret = "";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charsLength = chars.length;
    for (let i = 0; i < length; i++) {
        secret += chars.charAt(getCryptoRandomInt(0, charsLength - 1));
    }
    return secret;
}
exports.genSecret = genSecret;
function getMonitorRelativeURL(id) {
    return "/dashboard/" + id;
}
exports.getMonitorRelativeURL = getMonitorRelativeURL;
function getMaintenanceRelativeURL(id) {
    return "/maintenance/" + id;
}
exports.getMaintenanceRelativeURL = getMaintenanceRelativeURL;
function parseTimeObject(time) {
    if (!time) {
        return {
            hours: 0,
            minutes: 0,
        };
    }
    const array = time.split(":");
    if (array.length < 2) {
        throw new Error("parseVueDatePickerTimeFormat: Invalid Time");
    }
    const obj = {
        hours: parseInt(array[0]),
        minutes: parseInt(array[1]),
        seconds: 0,
    };
    if (array.length >= 3) {
        obj.seconds = parseInt(array[2]);
    }
    return obj;
}
exports.parseTimeObject = parseTimeObject;
function parseTimeFromTimeObject(obj) {
    if (!obj) {
        return obj;
    }
    let result = "";
    result += obj.hours.toString().padStart(2, "0") + ":" + obj.minutes.toString().padStart(2, "0");
    if (obj.seconds) {
        result += ":" + obj.seconds.toString().padStart(2, "0");
    }
    return result;
}
exports.parseTimeFromTimeObject = parseTimeFromTimeObject;
function isoToUTCDateTime(input) {
    return dayjs(input).utc().format(exports.SQL_DATETIME_FORMAT);
}
exports.isoToUTCDateTime = isoToUTCDateTime;
function utcToISODateTime(input) {
    return dayjs.utc(input).toISOString();
}
exports.utcToISODateTime = utcToISODateTime;
function utcToLocal(input, format = exports.SQL_DATETIME_FORMAT) {
    return dayjs.utc(input).local().format(format);
}
exports.utcToLocal = utcToLocal;
function localToUTC(input, format = exports.SQL_DATETIME_FORMAT) {
    return dayjs(input).utc().format(format);
}
exports.localToUTC = localToUTC;
function intHash(str, length = 10) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash += str.charCodeAt(i);
    }
    return (hash % length + length) % length;
}
exports.intHash = intHash;
async function evaluateJsonQuery(data, jsonPath, jsonPathOperator, expectedValue) {
    let response;
    try {
        response = JSON.parse(data);
    }
    catch (_a) {
        response = (typeof data === "object" || typeof data === "number") && !Buffer.isBuffer(data) ? data : data.toString();
    }
    try {
        response = (jsonPath) ? await jsonata(jsonPath).evaluate(response) : response;
        if (response === null || response === undefined) {
            throw new Error("Empty or undefined response. Check query syntax and response structure");
        }
        if (typeof response === "object" || response instanceof Date || typeof response === "function") {
            throw new Error(`The post-JSON query evaluated response from the server is of type ${typeof response}, which cannot be directly compared to the expected value`);
        }
        let jsonQueryExpression;
        switch (jsonPathOperator) {
            case ">":
            case ">=":
            case "<":
            case "<=":
                jsonQueryExpression = `$number($.value) ${jsonPathOperator} $number($.expected)`;
                break;
            case "!=":
                jsonQueryExpression = "$.value != $.expected";
                break;
            case "==":
                jsonQueryExpression = "$.value = $.expected";
                break;
            case "contains":
                jsonQueryExpression = "$contains($.value, $.expected)";
                break;
            default:
                throw new Error(`Invalid condition ${jsonPathOperator}`);
        }
        const expression = jsonata(jsonQueryExpression);
        const status = await expression.evaluate({
            value: response.toString(),
            expected: expectedValue.toString()
        });
        if (status === undefined) {
            throw new Error("Query evaluation returned undefined. Check query syntax and the structure of the response data");
        }
        return {
            status,
            response
        };
    }
    catch (err) {
        response = JSON.stringify(response);
        response = (response && response.length > 50) ? `${response.substring(0, 100)}… (truncated)` : response;
        throw new Error(`Error evaluating JSON query: ${err.message}. Response from server was: ${response}`);
    }
}
exports.evaluateJsonQuery = evaluateJsonQuery;
