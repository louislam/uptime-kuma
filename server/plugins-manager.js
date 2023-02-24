const fs = require("fs");
const { log } = require("../src/util");
const path = require("path");
const axios = require("axios");
const { Git } = require("./git");
const childProcess = require("child_process");

class PluginsManager {

    static disable = false;

    /**
     * Plugin List
     * @type {PluginWrapper[]}
     */
    pluginList = [];

    /**
     * Plugins Dir
     */
    pluginsDir;

    server;

    /**
     *
     * @param {UptimeKumaServer} server
     */
    constructor(server) {
        this.server = server;

        if (!PluginsManager.disable) {
            this.pluginsDir = "./data/plugins/";

            if (! fs.existsSync(this.pluginsDir)) {
                fs.mkdirSync(this.pluginsDir, { recursive: true });
            }

            log.debug("plugin", "Scanning plugin directory");
            let list = fs.readdirSync(this.pluginsDir);

            this.pluginList = [];
            for (let item of list) {
                this.loadPlugin(item);
            }

        } else {
            log.warn("PLUGIN", "Skip scanning plugin directory");
        }

    }

    /**
     * Install a Plugin
     */
    async loadPlugin(name) {
        log.info("plugin", "Load " + name);
        let plugin = new PluginWrapper(this.server, this.pluginsDir + name);

        try {
            await plugin.load();
            this.pluginList.push(plugin);
        } catch (e) {
            log.error("plugin", "Failed to load plugin: " + this.pluginsDir + name);
            log.error("plugin", "Reason: " + e.message);
        }
    }

    /**
     * Download a Plugin
     * @param {string} repoURL Git repo url
     * @param {string} name Directory name, also known as plugin unique name
     */
    downloadPlugin(repoURL, name) {
        if (fs.existsSync(this.pluginsDir + name)) {
            log.info("plugin", "Plugin folder already exists? Removing...");
            fs.rmSync(this.pluginsDir + name, {
                recursive: true
            });
        }
        log.info("plugin", "Installing plugin: " + name + " " + repoURL);
        let result = Git.clone(repoURL, this.pluginsDir, name);
        log.info("plugin", "Install result: " + result);
    }

    /**
     * Remove a plugin
     * @param {string} name
     */
    async removePlugin(name) {
        log.info("plugin", "Removing plugin: " + name);
        for (let plugin of this.pluginList) {
            if (plugin.info.name === name) {
                await plugin.unload();

                // Delete the plugin directory
                fs.rmSync(this.pluginsDir + name, {
                    recursive: true
                });

                this.pluginList.splice(this.pluginList.indexOf(plugin), 1);
                return;
            }
        }
        log.warn("plugin", "Plugin not found: " + name);
        throw new Error("Plugin not found: " + name);
    }

    /**
     * TODO: Update a plugin
     * Only available for plugins which were downloaded from the official list
     * @param pluginID
     */
    updatePlugin(pluginID) {

    }

    /**
     * Get the plugin list from server + local installed plugin list
     * Item will be merged if the `name` is the same.
     * @returns {Promise<[]>}
     */
    async fetchPluginList() {
        let remotePluginList;
        try {
            const res = await axios.get("https://uptime.kuma.pet/c/plugins.json");
            remotePluginList = res.data.pluginList;
        } catch (e) {
            log.error("plugin", "Failed to fetch plugin list: " + e.message);
            remotePluginList = [];
        }

        for (let plugin of this.pluginList) {
            let find = false;
            // Try to merge
            for (let remotePlugin of remotePluginList) {
                if (remotePlugin.name === plugin.info.name) {
                    find = true;
                    remotePlugin.installed = true;
                    remotePlugin.name = plugin.info.name;
                    remotePlugin.fullName = plugin.info.fullName;
                    remotePlugin.description = plugin.info.description;
                    remotePlugin.version = plugin.info.version;
                    break;
                }
            }

            // Local plugin
            if (!find) {
                plugin.info.local = true;
                remotePluginList.push(plugin.info);
            }
        }

        // Sort Installed first, then sort by name
        return remotePluginList.sort((a, b) => {
            if (a.installed === b.installed) {
                if (a.fullName < b.fullName) {
                    return -1;
                }
                if (a.fullName > b.fullName) {
                    return 1;
                }
                return 0;
            } else if (a.installed) {
                return -1;
            } else {
                return 1;
            }
        });
    }
}

class PluginWrapper {

    server = undefined;
    pluginDir = undefined;

    /**
     * Must be an `new-able` class.
     * @type {function}
     */
    pluginClass = undefined;

    /**
     *
     * @type {Plugin}
     */
    object = undefined;
    info = {};

    /**
     *
     * @param {UptimeKumaServer} server
     * @param {string} pluginDir
     */
    constructor(server, pluginDir) {
        this.server = server;
        this.pluginDir = pluginDir;
    }

    async load() {
        let indexFile = this.pluginDir + "/index.js";
        let packageJSON = this.pluginDir + "/package.json";

        log.info("plugin", "Installing dependencies");

        if (fs.existsSync(indexFile)) {
            // Install dependencies
            let result = childProcess.spawnSync("npm", [ "install" ], {
                cwd: this.pluginDir,
                env: {
                    ...process.env,
                    PLAYWRIGHT_BROWSERS_PATH: "../../browsers",    // Special handling for read-browser-monitor
                }
            });

            if (result.stdout) {
                log.info("plugin", "Install dependencies result: " + result.stdout.toString("utf-8"));
            } else {
                log.warn("plugin", "Install dependencies result: no output");
            }

            this.pluginClass = require(path.join(process.cwd(), indexFile));

            let pluginClassType = typeof this.pluginClass;

            if (pluginClassType === "function") {
                this.object = new this.pluginClass(this.server);
                await this.object.load();
            } else {
                throw new Error("Invalid plugin, it does not export a class");
            }

            if (fs.existsSync(packageJSON)) {
                this.info = require(path.join(process.cwd(), packageJSON));
            } else {
                this.info.fullName = this.pluginDir;
                this.info.name = "[unknown]";
                this.info.version = "[unknown-version]";
            }

            this.info.installed = true;
            log.info("plugin", `${this.info.fullName} v${this.info.version} loaded`);
        }
    }

    async unload() {
        await this.object.unload();
    }
}

module.exports = {
    PluginsManager,
    PluginWrapper
};
