// server/modules/ssh-restart.js

const { NodeSSH } = require("node-ssh");
const { log } = require("../../src/util");

const ssh = new NodeSSH();

/**
 * Triggers a restart script on a remote server via SSH.
 * @param {object} monitor The monitor object containing connection details.
 * @returns {Promise<void>}
 */
async function triggerRestart(monitor) {
    // Only proceed if host and private key are configured
    if (!monitor.restartSshHost || !monitor.restartSshPrivateKey || !monitor.restartScript) {
        return;
    }

    const monitorName = monitor.name || `[Monitor #${monitor.id}]`;
    log.info("ssh-restart", `[${monitorName}] Monitor is down. Attempting to trigger restart script...`);

    try {
        await ssh.connect({
            host: monitor.restartSshHost,
            port: monitor.restartSshPort || 22,
            username: "root", // Defaulting to root, consider making this configurable
            privateKey: monitor.restartSshPrivateKey,
            tryKeyboard: true,
        });

        log.info("ssh-restart", `[${monitorName}] SSH connection successful. Executing script: ${monitor.restartScript}`);

        const result = await ssh.execCommand(monitor.restartScript);

        if (result.code === 0) {
            log.info("ssh-restart", `[${monitorName}] Restart script executed successfully.`);
        } else {
            log.error("ssh-restart", `[${monitorName}] Restart script failed with exit code ${result.code}. Stderr: ${result.stderr}`);
        }

    } catch (error) {
        log.error("ssh-restart", `[${monitorName}] Failed to trigger restart script via SSH. Error: ${error.message}`);
    } finally {
        if (ssh.isConnected()) {
            ssh.dispose();
        }
    }
}

module.exports = {
    triggerRestart,
};
