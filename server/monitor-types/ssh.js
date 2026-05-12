const { MonitorType } = require("./monitor-type");
const { UP, log } = require("../../src/util");
const dayjs = require("dayjs");
const { NodeSSH } = require("node-ssh");
const crypto = require("crypto");

const SSH_DEFAULT_PORT = 22;
const SSH_DEFAULT_TIMEOUT_MS = 30 * 1000;
const SSH_OUTPUT_TRUNCATE_BYTES = 2 * 1024;
const SSH_MAX_COMMAND_LENGTH = 4 * 1024;
const SSH_MAX_PRIVATE_KEY_BYTES = 64 * 1024;
const SSH_SUPPORTED_AUTH_METHODS = new Set([ "password", "privateKey", "agent", "none" ]);

/**
 * Truncate a string for safe inclusion in heartbeat messages.
 * @param {string} value Raw text from stdout/stderr.
 * @param {number} maxBytes Maximum byte length.
 * @returns {string} Truncated string.
 */
function truncate(value, maxBytes = SSH_OUTPUT_TRUNCATE_BYTES) {
    if (!value) {
        return "";
    }
    const trimmed = value.trim();
    if (Buffer.byteLength(trimmed, "utf8") <= maxBytes) {
        return trimmed;
    }
    return Buffer.from(trimmed, "utf8").slice(0, maxBytes).toString("utf8") + "… [truncated]";
}

/**
 * Normalise a user-supplied fingerprint (sha256:..., MD5:aa:bb:..., raw hex) to lower-case
 * hex digits only so comparisons are tolerant of formatting differences.
 * @param {string} value Fingerprint provided by the user.
 * @returns {string} Normalised lower-case hex digest, empty if input is falsy.
 */
function normaliseFingerprint(value) {
    if (!value) {
        return "";
    }
    let v = value.trim().toLowerCase();
    if (v.startsWith("sha256:")) {
        v = v.slice("sha256:".length);
    } else if (v.startsWith("md5:")) {
        v = v.slice("md5:".length);
    }
    // strip colons, spaces, and any base64 padding
    v = v.replace(/[:\s=]/g, "");
    return v;
}

/**
 * Compute a list of acceptable digests of a server host key for comparison
 * against a user-provided fingerprint. We support both SHA-256 (default) and
 * MD5 (legacy ssh-keygen format), returned in both hex and base64 forms.
 * @param {Buffer} hostKey Raw host key bytes received from the server.
 * @returns {string[]} Candidate digests, already passed through {@link normaliseFingerprint}.
 */
function computeHostKeyDigests(hostKey) {
    const sha256Hex = crypto.createHash("sha256").update(hostKey).digest("hex");
    const sha256B64 = crypto.createHash("sha256").update(hostKey).digest("base64");
    const md5Hex = crypto.createHash("md5").update(hostKey).digest("hex");
    return [
        normaliseFingerprint(sha256Hex),
        normaliseFingerprint(sha256B64),
        normaliseFingerprint(md5Hex),
    ];
}

class SshMonitorType extends MonitorType {
    name = "ssh";

    /**
     * Validate that a private key blob "looks like" an OpenSSH/PEM key without
     * trying to actually parse it — parsing is delegated to ssh2 which gives a
     * clearer error if the key is malformed.
     * @param {string} key Private key text.
     * @returns {void}
     * @throws {Error} If the key is too large or lacks a PEM/OpenSSH header.
     */
    validatePrivateKey(key) {
        if (Buffer.byteLength(key, "utf8") > SSH_MAX_PRIVATE_KEY_BYTES) {
            throw new Error("SSH private key is too large");
        }
        if (!/-----BEGIN [A-Z0-9 ]+PRIVATE KEY-----/.test(key)) {
            throw new Error("SSH private key does not appear to be a valid PEM/OpenSSH key");
        }
    }

    /**
     * Build the connection config object handed to ssh2 via node-ssh.
     * @param {object} monitor Monitor bean.
     * @param {number} timeoutMs Connection timeout in milliseconds.
     * @returns {object} ssh2-compatible connect config.
     * @throws {Error} If required fields are missing or host key verification is misconfigured.
     */
    buildConnectConfig(monitor, timeoutMs) {
        const authMethod = monitor.authMethod || "password";
        if (!SSH_SUPPORTED_AUTH_METHODS.has(authMethod)) {
            throw new Error(`Unsupported SSH auth method: ${authMethod}`);
        }

        if (!monitor.hostname) {
            throw new Error("SSH hostname is required");
        }

        const username = (monitor.sshUsername || "").trim();
        if (!username) {
            throw new Error("SSH username is required");
        }

        const port = Number.isFinite(parseInt(monitor.port, 10)) ? parseInt(monitor.port, 10) : SSH_DEFAULT_PORT;

        const config = {
            host: monitor.hostname,
            port,
            username,
            readyTimeout: timeoutMs,
            // ssh2's keepalive: send a keepalive packet every 15s while the
            // exec is running so a hung command is detected via the
            // connection's own timeout rather than waiting forever.
            keepaliveInterval: 15 * 1000,
            keepaliveCountMax: 2,
        };

        const expectedFingerprint = normaliseFingerprint(monitor.sshHostKey);
        if (expectedFingerprint) {
            config.hostHash = "sha256";
            config.hostVerifier = (hashedKey, callback) => {
                // ssh2 may pass either the hash string or the raw key Buffer
                // depending on whether hostHash is set; handle both.
                let candidates;
                if (Buffer.isBuffer(hashedKey)) {
                    candidates = computeHostKeyDigests(hashedKey);
                } else {
                    candidates = [ normaliseFingerprint(hashedKey) ];
                }
                const ok = candidates.includes(expectedFingerprint);
                if (typeof callback === "function") {
                    return callback(ok);
                }
                return ok;
            };
        } else if (!monitor.sshIgnoreHostKey) {
            // No fingerprint provided AND user did not opt-in to ignoring it: refuse the connection.
            throw new Error("SSH host key verification is required: provide a host key fingerprint or explicitly enable 'Ignore Host Key'");
        }

        switch (authMethod) {
            case "password": {
                if (!monitor.sshPassword) {
                    throw new Error("SSH password is required for password authentication");
                }
                config.password = monitor.sshPassword;
                // Some servers only allow keyboard-interactive; ssh2 will
                // automatically reply with the password when tryKeyboard is set.
                config.tryKeyboard = true;
                break;
            }
            case "privateKey": {
                if (!monitor.sshPrivateKey) {
                    throw new Error("SSH private key is required for private key authentication");
                }
                this.validatePrivateKey(monitor.sshPrivateKey);
                config.privateKey = monitor.sshPrivateKey;
                if (monitor.sshKeyPassphrase) {
                    config.passphrase = monitor.sshKeyPassphrase;
                }
                break;
            }
            case "agent": {
                const sock = process.env.SSH_AUTH_SOCK;
                if (!sock) {
                    throw new Error("SSH agent authentication requested but SSH_AUTH_SOCK is not set in the server environment");
                }
                config.agent = sock;
                break;
            }
            case "none": {
                // ssh2 will attempt "none" auth when no credentials are supplied.
                break;
            }
            default:
                throw new Error(`Unsupported SSH auth method: ${authMethod}`);
        }

        return config;
    }

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const command = (monitor.sshCommand || "").toString();
        if (!command.trim()) {
            throw new Error("SSH command/script is required");
        }
        if (command.length > SSH_MAX_COMMAND_LENGTH) {
            throw new Error(`SSH command exceeds maximum length of ${SSH_MAX_COMMAND_LENGTH} characters`);
        }

        const timeoutMs = (Number.isFinite(parseInt(monitor.timeout, 10)) && monitor.timeout > 0)
            ? monitor.timeout * 1000
            : SSH_DEFAULT_TIMEOUT_MS;

        const config = this.buildConnectConfig(monitor, timeoutMs);
        const ssh = new NodeSSH();
        const startTime = dayjs().valueOf();

        // Hard wall-clock timeout — covers cases where exec hangs even though
        // ssh2's keepalive is firing (e.g. command never returns).
        let timeoutHandle;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => {
                reject(new Error(`SSH check timed out after ${timeoutMs} ms`));
            }, timeoutMs);
        });

        try {
            await Promise.race([ ssh.connect(config), timeoutPromise ]);

            const result = await Promise.race([
                ssh.execCommand(command, {
                    // PTY off: avoids leaking control sequences into stdout
                    // and prevents the remote shell from prompting for input.
                    execOptions: {},
                }),
                timeoutPromise,
            ]);

            heartbeat.ping = dayjs().valueOf() - startTime;

            const exitCode = result.code;
            const stdout = truncate(result.stdout);
            const stderr = truncate(result.stderr);

            if (exitCode === 0) {
                heartbeat.status = UP;
                heartbeat.msg = stdout ? `Exit 0 — ${stdout}` : "Exit 0";
            } else {
                // Throw so the monitor framework records DOWN with this reason
                const details = stderr || stdout || "(no output)";
                throw new Error(`SSH command exited with code ${exitCode}: ${details}`);
            }
        } catch (error) {
            // Surface a redacted error: never echo credentials back into logs/UI.
            const message = (error && error.message) ? error.message : "Unknown SSH error";
            log.debug(this.name, `[${monitor.name || monitor.id}] SSH check failed: ${message}`);
            // Re-wrap only generic errors; keep our explicit "SSH command exited..." messages intact.
            if (message.startsWith("SSH command exited")) {
                throw error;
            }
            throw new Error(`SSH check failed: ${message}`);
        } finally {
            clearTimeout(timeoutHandle);
            try {
                ssh.dispose();
            } catch (_) {
                // ignore — best-effort cleanup
            }
        }
    }
}

module.exports = {
    SshMonitorType,
    // Exported for unit tests
    truncate,
    normaliseFingerprint,
    computeHostKeyDigests,
};
