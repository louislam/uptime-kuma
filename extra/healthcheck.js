/*
 * This script should be run after a period of time (180s), because the server may need some time to prepare.
 */
const { FBSD } = require("../server/util-server");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let client;

const sslKey = process.env.UPTIME_KUMA_SSL_KEY || process.env.SSL_KEY || undefined;
const sslCert = process.env.UPTIME_KUMA_SSL_CERT || process.env.SSL_CERT || undefined;

if (sslKey && sslCert) {
    client = require("https");
} else {
    client = require("http");
}

// If host is omitted, the server will accept connections on the unspecified IPv6 address (::) when IPv6 is available and the unspecified IPv4 address (0.0.0.0) otherwise.
// Dual-stack support for (::)
let hostname = process.env.UPTIME_KUMA_HOST;

// Also read HOST if not *BSD, as HOST is a system environment variable in FreeBSD
if (!hostname && !FBSD) {
    hostname = process.env.HOST;
}

const port = parseInt(process.env.UPTIME_KUMA_PORT || process.env.PORT || 3001);

let options = {
    host: hostname || "127.0.0.1",
    port: port,
    timeout: 28 * 1000,
};

let request = client.request(options, (res) => {
    console.log(`Health Check OK [Res Code: ${res.statusCode}]`);
    if (res.statusCode === 302) {
        process.exit(0);
    } else {
        process.exit(1);
    }
});

request.on("error", function (err) {
    console.error("Health Check ERROR");
    process.exit(1);
});

request.end();
