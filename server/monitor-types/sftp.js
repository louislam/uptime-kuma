const { MonitorType } = require("./monitor-type");
const { UP, log } = require("../../src/util");
const SftpClient = require("ssh2-sftp-client");

/**
 * Converts a raw ssh2-sftp-client error into a clean, human-readable message.
 * The library prefixes every error with the internal method name (e.g. "getConnection: "),
 * and sometimes produces an empty remainder when the underlying socket closes silently.
 * @param {Error} err The raw error thrown by sftp.connect()
 * @param {string} host Hostname that was being connected to
 * @param {number|string} port Port that was being connected to
 * @returns {string} Human-readable error message
 */
function formatSftpError(err, host, port) {
    const code = err.code || "";

    // Strip the "getConnection: " / "sftp: " prefix the library adds to every message
    const rawMsg = (err.message || "").replace(/^[\w-]+:\s*/, "").trim();

    switch (code) {
        case "ECONNREFUSED":
            return `Connection refused — ${host}:${port} actively rejected the connection`;
        case "ENOTFOUND":
            return `Host not found — cannot resolve hostname "${host}"`;
        case "ECONNRESET":
            return `Connection reset by remote host ${host}:${port}`;
        case "ENETUNREACH":
        case "EHOSTUNREACH":
            return `Network unreachable — cannot reach ${host}:${port}`;
        case "ETIMEDOUT":
            return `Connection timed out — ${host}:${port} did not respond in time`;
        default:
            // If the remainder is empty the socket closed without any detail (server offline)
            if (!rawMsg) {
                return `Connection failed — ${host}:${port} is unreachable or offline`;
            }
            return rawMsg;
    }
}

class SFTPMonitorType extends MonitorType {
    name = "sftp";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const sftp = new SftpClient();
        const host = monitor.hostname;
        const port = monitor.port || 22;

        const timeoutSeconds = typeof monitor.timeout === "number" && monitor.timeout > 0 ? monitor.timeout : 10;
        const timeoutMs = timeoutSeconds * 1000;

        const connectOptions = {
            host,
            port,
            username: monitor.sftpUsername,
            readyTimeout: timeoutMs,
            timeout: timeoutMs,
        };

        if (monitor.sftpAuthMethod === "privateKey") {
            if (!monitor.sftpPrivateKey) {
                throw new Error("SSH private key is required for key-based authentication");
            }
            connectOptions.privateKey = monitor.sftpPrivateKey;
            if (monitor.sftpPassphrase) {
                connectOptions.passphrase = monitor.sftpPassphrase;
            }
        } else {
            connectOptions.password = monitor.sftpPassword;
        }

        try {
            await sftp.connect(connectOptions);
            log.debug("sftp", `Connected to SFTP server: ${host}:${port}`);

            if (monitor.sftpPath) {
                const exists = await sftp.exists(monitor.sftpPath);
                if (!exists) {
                    throw new Error(`Path "${monitor.sftpPath}" does not exist on the SFTP server`);
                }
                log.debug("sftp", `Path "${monitor.sftpPath}" exists on SFTP server`);
            }

            heartbeat.status = UP;
            heartbeat.msg = "SFTP connection successful";
        } catch (err) {
            throw new Error(formatSftpError(err, host, port));
        } finally {
            // Only tear down if a session was actually established (sftp.sftp is set by the
            // library after connect() resolves). Swallow teardown errors so they never mask
            // the real error from the try/catch above.
            if (sftp.sftp) {
                try {
                    await sftp.end();
                } catch (_) {
                    // cleanup errors are ignored, only log them for debugging purposes
                    log.debug("sftp", `Error during SFTP teardown: ${_.message}`);
                }
            }
        }
    }
}

module.exports = {
    SFTPMonitorType,
};
