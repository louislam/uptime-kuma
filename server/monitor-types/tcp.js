const { MonitorType } = require("./monitor-type");
const { UP, DOWN } = require("../../src/util");
const { tcping, checkCertificate } = require("../util-server");
const tls = require("tls");

class TCPMonitorType extends MonitorType {
    name = "port";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        try {
            heartbeat.ping = await tcping(monitor.hostname, monitor.port);
            heartbeat.msg = "";
            heartbeat.status = UP;
        } catch (error) {
            heartbeat.status = DOWN;
            heartbeat.msg = "Connection failed";
            return;
        }

        if (monitor.isEnabledExpiryNotification()) {
            let socket = null;
            try {
                const options = {
                    host: monitor.hostname,
                    port: monitor.port,
                    servername: monitor.hostname,
                };

                const tlsInfoObject = await new Promise((resolve, reject) => {
                    socket = tls.connect(options);

                    socket.on("secureConnect", () => {
                        try {
                            const info = checkCertificate(socket);
                            resolve(info);
                        } catch (error) {
                            reject(error);
                        }
                    });

                    socket.on("error", (error) => {
                        reject(error);
                    });

                    socket.setTimeout(10000, () => {
                        reject(new Error("Connection timed out"));
                    });
                });

                await monitor.handleTlsInfo(tlsInfoObject);
                if (!tlsInfoObject.valid) {
                    heartbeat.status = DOWN;
                    heartbeat.msg = "Certificate is invalid";
                }
            } catch (error) {
                heartbeat.status = DOWN;
                heartbeat.msg = "Connection failed";
            } finally {
                if (socket && !socket.destroyed) {
                    socket.end();
                }
            }
        }
    }
}

module.exports = {
    TCPMonitorType,
};

