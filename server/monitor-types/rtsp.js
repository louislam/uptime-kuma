const RTSPClient = require("rtsp-client");
const { log, UP, DOWN } = require("../../src/util"); 
class RtspMonitorType {
  name = "rtsp";

  /**
   * @param {Object} monitor - monitor config containing hostname, port, username, password, path, and timeout
   * @param {Object} heartbeat - object to update with status and message
   */
  async check(monitor, heartbeat) {
    const { rtsp_username, rtsp_password, hostname, port, rtsp_path, timeout } = monitor;
    const timeoutMs = (timeout || 10) * 1000;
    
    // Construct the RTSP URL from individual components
    let url = `rtsp://${hostname}:${port}${rtsp_path}`;

    // If username and password are provided, inject them into the URL
    if (rtsp_username && rtsp_password !== undefined) {
      const auth = `${rtsp_username}:${rtsp_password}@`;
      const urlPattern = /^rtsp:\/\//;

      // Inject authentication details into URL (before host)
      url = url.replace(urlPattern, `rtsp://${auth}`);
    }

    heartbeat.status = DOWN;
    heartbeat.msg = "Starting RTSP stream check...";

    if (!url || !url.startsWith("rtsp://")) {
      heartbeat.status = DOWN;
      heartbeat.msg = "Invalid RTSP URL";
      return;
    }

    const client = new RTSPClient();

    // Timeout promise to kill hanging connections
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("RTSP connection timed out")), timeoutMs)
    );

    try {
      // Use Promise.race to enforce timeout
      await Promise.race([
        (async () => {
          await client.connect(url);
          const describe = await client.describe();
          await client.close();

          heartbeat.status = UP;
          heartbeat.msg = "RTSP stream is accessible";
        })(),
        timeoutPromise,
      ]);
    } catch (error) {
      heartbeat.status = DOWN;
      heartbeat.msg = `Error: ${error.message}`;
      log.debug("monitor", `[${monitor.name}] RTSP check failed: ${error.message}`);
      try {
        await client.close();
      } catch {}
    }
  }
}

module.exports = {
  RtspMonitorType,
};
