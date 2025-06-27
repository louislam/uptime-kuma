const RTSPClient = require("rtsp-client");
const { log, UP, DOWN } = require("../../src/util");

class RtspMonitorType {
    name = "rtsp";

    /**
     * Check the availability of an RTSP stream.
     * @param {object} monitor - Monitor config: hostname, port, username, password, path.
     * @param {object} heartbeat - Heartbeat object to update with status and message.
     */
    async check(monitor, heartbeat) {
        const { rtspUsername, rtspPassword, hostname, port, rtspPath } = monitor;

        // Construct RTSP URL
        let url = `rtsp://${hostname}:${port}${rtspPath}`;
        if (rtspUsername && rtspPassword !== undefined) {
            url = url.replace(/^rtsp:\/\//, `rtsp://${rtspUsername}:${rtspPassword}@`);
        }

        // Default heartbeat status
        heartbeat.status = DOWN;
        heartbeat.msg = "Starting RTSP stream check...";

        // Validate URL
        if (!url || !url.startsWith("rtsp://")) {
            heartbeat.msg = "Invalid RTSP URL";
            return;
        }

        const client = new RTSPClient();

        try {
            await client.connect(url);
            await client.describe();
            heartbeat.status = UP;
            heartbeat.msg = "RTSP stream is accessible";
        } catch (error) {
            heartbeat.msg = `Error: ${error.message}`;
            log.debug("monitor", `[${monitor.name}] RTSP check failed: ${error.message}`);
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
