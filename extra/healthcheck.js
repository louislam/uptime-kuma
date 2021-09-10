process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let client;

if (process.env.SSL_KEY && process.env.SSL_CERT) {
    client = require("https");
} else {
    client = require("http");
}

let options = {
    host: process.env.HOST || "127.0.0.1",
    port: parseInt(process.env.PORT) || 3001,
    timeout: 28 * 1000,
};

let request = client.request(options, (res) => {
    console.log(`Health Check OK [Res Code: ${res.statusCode}]`);
    if (res.statusCode === 200) {
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
