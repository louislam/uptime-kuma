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
 * Query PM2 for the current process list.
 * @returns {Promise<{id: string, name: string, status: string}[]>} The normalized PM2 process list.
 */
function getPM2ProcessList() {
    return new Promise((resolve, reject) => {
        execFile(process.platform === "win32" ? "pm2.cmd" : "pm2", ["jlist"], PM2_EXEC_OPTIONS, (error, stdout, stderr) => {
            if (error) {
                const details = truncateOutput(stderr) || error.code || error.message;
                reject(new Error(`Unable to query PM2 process list (${details}).`));
                return;
            }

            try {
                const parsed = JSON.parse((stdout || "").toString());
                if (!Array.isArray(parsed)) {
                    reject(new Error("Unexpected PM2 process list output."));
                    return;
                }

                resolve(parsed
                    .map((item) => {
                        const id = item?.pm_id != null ? String(item.pm_id) : null;
                        const name = item?.name || null;

                        if (!id && !name) {
                            return null;
                        }

                        return {
                            id: id || name,
                            name: name || id,
                            status: item?.pm2_env?.status?.toString().toLowerCase() || "unknown",
                        };
                    })
                    .filter(Boolean));
            } catch (parseError) {
                reject(new Error(truncateOutput(stderr) || "Unable to parse PM2 process list output."));
            }
        });
    });
}

module.exports = {
    getPM2ProcessList,
};
