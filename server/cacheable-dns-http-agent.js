const https = require("https");
const http = require("http");
const CacheableLookup = require("cacheable-lookup");
const { Settings } = require("./settings");
const { log } = require("../src/util");

class CacheableDnsHttpAgent {

    static cacheable = new CacheableLookup();

    static httpAgentList = {};
    static httpsAgentList = {};

    static enable = false;

    /**
     * Register/Disable cacheable to global agents
     * @returns {void}
     */
    static async update() {
        log.debug("CacheableDnsHttpAgent", "update");
        let isEnable = await Settings.get("dnsCache");

        if (isEnable !== this.enable) {
            log.debug("CacheableDnsHttpAgent", "value changed");

            if (isEnable) {
                log.debug("CacheableDnsHttpAgent", "enable");
                this.cacheable.install(http.globalAgent);
                this.cacheable.install(https.globalAgent);
            } else {
                log.debug("CacheableDnsHttpAgent", "disable");
                this.cacheable.uninstall(http.globalAgent);
                this.cacheable.uninstall(https.globalAgent);
            }
        }

        this.enable = isEnable;
    }

    /**
     * Attach cacheable to HTTP agent
     * @param {http.Agent} agent Agent to install
     * @returns {void}
     */
    static install(agent) {
        this.cacheable.install(agent);
    }

    /**
     * @param {https.AgentOptions} agentOptions Options to pass to HTTPS agent
     * @returns {https.Agent} The new HTTPS agent
     */
    static getHttpsAgent(agentOptions) {
        if (!this.enable) {
            return new https.Agent(agentOptions);
        }

        let key = JSON.stringify(agentOptions);
        if (!(key in this.httpsAgentList)) {
            this.httpsAgentList[key] = new https.Agent(agentOptions);
            this.cacheable.install(this.httpsAgentList[key]);
        }
        return this.httpsAgentList[key];
    }

    /**
     * @param {http.AgentOptions} agentOptions Options to pass to the HTTP agent
     * @returns {https.Agents} The new HTTP agent
     */
    static getHttpAgent(agentOptions) {
        if (!this.enable) {
            return new http.Agent(agentOptions);
        }

        let key = JSON.stringify(agentOptions);
        if (!(key in this.httpAgentList)) {
            this.httpAgentList[key] = new http.Agent(agentOptions);
            this.cacheable.install(this.httpAgentList[key]);
        }
        return this.httpAgentList[key];
    }

}

module.exports = {
    CacheableDnsHttpAgent,
};
