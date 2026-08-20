const net = require("net");

const listenHost = process.env.TARGET_LISTEN_HOST || "0.0.0.0";
const listenPort = Number(process.env.TARGET_LISTEN_PORT || 8080);
const server = net.createServer(() => {});

server.listen(listenPort, listenHost, () => {
    console.log(`TCP target fixture listening on ${listenHost}:${listenPort}`);
});
