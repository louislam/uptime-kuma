const { MonitorType } = require("./monitor-type");
const { UP, DOWN } = require("../../src/util");
const { checkCertificate, setting, setSetting } = require("../util-server");
const tls = require("tls");

class TlsCertificateMonitorType extends MonitorType {
    name = "tlsCheck";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, server) {
        const host = monitor.hostname;
        const port = monitor.port || 443;
        let notifyDays = await setting("tlsExpiryNotifyDays");
        if (notifyDays == null || !Array.isArray(notifyDays)) {
            // Reset Default
            await setSetting("tlsExpiryNotifyDays", [ 7, 14, 21 ], "general");
            notifyDays = [ 7, 14, 21 ];
        }

        try {
            const options = {
                host,
                port,
                servername: host,
            };

            // Convert TLS connect to a Promise and await it
            const tlsInfoObject = await new Promise((resolve, reject) => {
                const socket = tls.connect(options);

                socket.on("secureConnect", () => {
                    try {
                        const info = checkCertificate(socket);
                        socket.end();
                        resolve(info);
                    } catch (error) {
                        socket.end();
                        reject(error);
                    }
                });

                socket.on("error", (error) => {
                    reject(error);
                });

                socket.setTimeout(10000, () => {
                    socket.end();
                    reject(new Error("Connection timed out"));
                });
            });

            const certInfo = tlsInfoObject.certInfo;

            await monitor.updateTlsInfo(tlsInfoObject);
            const alertDays = notifyDays.filter(targetDays => targetDays >= certInfo.daysRemaining);

            if (alertDays.length === 0) {
                heartbeat.status = UP;
                heartbeat.msg = "";
            } else {
                const alertDay = Math.min(...alertDays);
                heartbeat.status = DOWN;
                heartbeat.msg = `Certificate expires in less thant ${alertDay} days`;
            }
        } catch (error) {
            heartbeat.status = DOWN;
            heartbeat.msg = `Error checking SSL certificate: ${error.message}`;
        }
    }
}

module.exports = {
    TlsCertificateMonitorType,
};

