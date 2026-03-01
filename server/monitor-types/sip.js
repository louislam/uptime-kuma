const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const { sipRegisterRequest, sipOptionRequest } = require("../sip");
const dayjs = require("dayjs");
const version = require("../../package.json").version;

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
