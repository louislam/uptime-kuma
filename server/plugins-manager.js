const fs = require("fs");
const { log } = require("../src/util");

class PluginsManager {

    pluginList = [];

    /**
     * Plugins Dir
     */
    pluginsDir;

    constructor(dir) {
        this.pluginsDir = dir;

        if (! fs.existsSync(this.pluginsDir)) {
            fs.mkdirSync(this.pluginsDir, { recursive: true });
        }

        let list = fs.readdirSync(this.pluginsDir);

        this.pluginList = [];
        for (let item of list) {
            let indexFile = this.pluginsDir + item + "/index.js";

            if (fs.existsSync(indexFile)) {
                this.pluginList.push(require(indexFile));
                log.debug("plugin", indexFile);
                log.info("plugin", `${item} loaded`);
            }
        }
    }

}

module.exports = {
    PluginsManager
};
