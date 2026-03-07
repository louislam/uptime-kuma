const { log } = require("../../src/util");
const fs = require("fs");
const path = require("path");

/**
 * Scans a directory for .js files, instantiates any exported class that extends
 * the given base type, and passes each instance to the provided registration callback.
 * @param {string} directory - Absolute path to the directory to scan.
 * @param {Function} type - Base class; only subclasses of this type will be loaded.
 * @param {function(object, string): void} registerFn - Called for each valid instance with the instance and its filename.
 * @returns {void}
 * @throws {Error} If the plugin directory does not exist.
 * @throws {Error} If a plugin file cannot be required.
 */
function loadPlugins(directory, type, registerFn) {
    if (!fs.existsSync(directory)) {
        throw new Error(`Plugin directory "${directory}" does not exist.`);
    }
    log.info("plugin-loader", `Loading plugins from "${path.basename(directory)}"`);

    // deterministic load order
    const files = fs.readdirSync(directory).sort();

    for (const file of files) {
        if (!file.endsWith(".js")) {
            continue;
        }

        const modulePath = path.join(directory, file);
        let mod;
        try {
            mod = require(modulePath);
        } catch (e) {
            const originalMessage = e && typeof e.message === "string" ? e.message : String(e);
            throw new Error(`Failed to load plugin "${modulePath}": ${originalMessage}`, { cause: e });
        }

        const exportsList =
            typeof mod === "function" ? [mod] : mod && typeof mod === "object" ? Object.values(mod) : [];

        for (const exported of exportsList) {
            if (typeof exported !== "function") {
                continue;
            }

            if (exported === type || !exported.prototype || !(exported.prototype instanceof type)) {
                continue;
            }

            let instance;

            try {
                instance = new exported();
            } catch (e) {
                throw new Error(`Failed to instantiate plugin "${file}"`, { cause: e });
            }

            registerFn(instance, file);
        }
    }
}

module.exports = {
    loadPlugins,
};
