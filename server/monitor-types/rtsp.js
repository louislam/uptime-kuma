const { MonitorType } = require("./monitor-type");
const RTSPClient = require("rtsp-client");
const { log, UP, DOWN } = require("../../src/util");

class RtspMonitorType extends MonitorType {
    name = "rtsp";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const { rtspUsername, rtspPassword, hostname, port, rtspPath } = monitor;

        // Construct RTSP URL
        let url = `rtsp://${hostname}:${port}${rtspPath}`;
        if (rtspUsername && rtspPassword !== undefined) {
            url = `rtsp://${rtspUsername}:${rtspPassword}@${hostname}:${port}${rtspPath}`;
        }

        // Validate URL
        if (!url || !url.startsWith("rtsp://")) {
            heartbeat.status = DOWN;
            heartbeat.msg = "Invalid RTSP URL";
            return;
        }

        const client = new RTSPClient();
        client.on("error", (err) => {
            log.debug("monitor", `RTSP client emitted error: ${err.message}`);
        });

        try {
            log.debug("monitor", `Connecting to RTSP URL: ${url}`);
            await client.connect(url);

            const res = await client.describe();
            log.debug("monitor", `RTSP DESCRIBE response: ${JSON.stringify(res)}`);

            const statusCode = res?.statusCode;
            const statusMessage = res?.statusMessage || "Unknown";

            if (statusCode === 200) {
                heartbeat.status = UP;
                heartbeat.msg = "RTSP stream is accessible";
            } else if (statusCode === 503) {
                heartbeat.status = DOWN;
                heartbeat.msg = res.body?.reason || "Service Unavailable";
            } else {
                heartbeat.status = DOWN;
                heartbeat.msg = `${statusCode} - ${statusMessage}`;
            }
        } catch (error) {
            log.debug("monitor", `[${monitor.name}] RTSP check failed: ${error.message}`);
            heartbeat.status = DOWN;
            heartbeat.msg = `RTSP check failed: ${error.message}`;
        } finally {
            try {
                await client.close();
            } catch (closeError) {
                log.debug("monitor", `Error closing RTSP client: ${closeError.message}`);
            }
        }
    }
}

module.exports = {
    RtspMonitorType,
};
