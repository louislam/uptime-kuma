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

    static install(agent) {
        this.cacheable.install(agent);
    }

    /**
     * @var {https.AgentOptions} agentOptions
     * @return {https.Agent}
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
     * @var {http.AgentOptions} agentOptions
     * @return {https.Agents}
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
