const { execFile } = require("child_process");
const process = require("process");

const PM2_EXEC_OPTIONS = {
    timeout: 5000,
    maxBuffer: 10 * 1024 * 1024,
};

/**
 * Truncate command output to keep error messages compact.
 * @param {string | Buffer} output Command output.
 * @returns {string} The truncated output text.
 */
function truncateOutput(output) {
    const text = (output || "").toString().trim();
    if (text.length > 200) {
        return text.substring(0, 200) + "...";
    }
    return text;
}

/**
 * Resolve the PM2 executable name for the current platform.
 * @returns {string} The PM2 executable name.
 */
function getPM2Executable() {
    return process.platform === "win32" ? "pm2.cmd" : "pm2";
}

/**
 * Parse `pm2 jlist` output into a simplified process list.
 * @param {string | Buffer} stdout Raw stdout from pm2.
 * @returns {{id: string, name: string, status: string}[]} The normalized PM2 process list.
 * @throws {Error} Throws when the PM2 output is not a JSON array.
 */
function parsePM2ProcessList(stdout) {
    const parsed = JSON.parse((stdout || "").toString());
    if (!Array.isArray(parsed)) {
        throw new Error("Unexpected PM2 output");
    }

    return parsed
        .map((item) => {
            const id = item?.pm_id != null ? String(item.pm_id) : item?.name || "";
            const name = item?.name || id;
            const status = item?.pm2_env?.status?.toString().toLowerCase() || "unknown";

            return {
                id,
                name,
                status,
            };
        })
        .filter((item) => item.id !== "");
}

/**
 * Query PM2 for the current process list.
 * @param {typeof execFile} execFileImpl Exec implementation, mainly for tests.
 * @returns {Promise<{id: string, name: string, status: string}[]>} The normalized PM2 process list.
 */
function getPM2ProcessList(execFileImpl = execFile) {
    return new Promise((resolve, reject) => {
        execFileImpl(getPM2Executable(), ["jlist"], PM2_EXEC_OPTIONS, (error, stdout, stderr) => {
            if (error) {
                const details = truncateOutput(stderr) || error.code || error.message;
                reject(new Error(`Unable to query PM2 process list (${details}).`));
                return;
            }

            try {
                resolve(parsePM2ProcessList(stdout));
            } catch (parseError) {
                reject(new Error(truncateOutput(stderr) || "Unable to parse PM2 process list output."));
            }
        });
    });
}

module.exports = {
    getPM2ProcessList,
};
