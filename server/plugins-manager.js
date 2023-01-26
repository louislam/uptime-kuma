const fs = require("fs");
const { log } = require("../src/util");
const path = require("path");
const axios = require("axios");

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

    /**
     *
     * @param {UptimeKumaServer} server
     * @param {string} dir
     */
    constructor(server) {
        if (!PluginsManager.disable) {
            this.pluginsDir = "./data/plugins/";

            if (! fs.existsSync(this.pluginsDir)) {
                fs.mkdirSync(this.pluginsDir, { recursive: true });
            }

            log.debug("plugin", "Scanning plugin directory");
            let list = fs.readdirSync(this.pluginsDir);

            this.pluginList = [];
            for (let item of list) {
                let plugin = new PluginWrapper(server, this.pluginsDir + item);

                try {
                    plugin.load();
                    this.pluginList.push(plugin);
                } catch (e) {
                    log.error("plugin", "Failed to load plugin: " + this.pluginsDir + item);
                    log.error("plugin", "Reason: " + e.message);
                }
            }

        } else {
            log.warn("PLUGIN", "Skip scanning plugin directory");
        }

    }

    /**
     * TODO: Install a Plugin
     * @param {string} tarGzFileURL The url of tar.gz file
     * @param {number} userID User ID - Used for streaming installing progress
     */
    installPlugin(tarGzFileURL, userID = undefined) {

    }

    /**
     * TODO: Remove a plugin
     * @param pluginID
     */
    removePlugin(pluginID) {

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
        const res = await axios.get("https://uptime.kuma.pet/c/plugins.json");
        const list = res.data.pluginList;

        for (let plugin of this.pluginList) {
            let find = false;
            // Try to merge
            for (let remotePlugin of list) {
                if (remotePlugin.name === plugin.name) {
                    find = true;
                    remotePlugin.installed = true;
                    break;
                }
            }

            // Local plugin
            if (!find) {
                plugin.info.local = true;
                list.push(plugin.info);
            }
        }
        return list;
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
     * @type {*}
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

    load() {
        let indexFile = this.pluginDir + "/index.js";
        let packageJSON = this.pluginDir + "/package.json";

        if (fs.existsSync(indexFile)) {
            this.pluginClass = require(path.join(process.cwd(), indexFile));

            let pluginClassType = typeof this.pluginClass;

            if (pluginClassType === "function") {
                this.object = new this.pluginClass(this.server);
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
}

module.exports = {
    PluginsManager,
    PluginWrapper
};
