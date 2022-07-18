const https = require("https");
const http = require("http");
const CacheableLookup = require("cacheable-lookup");

class CacheableDnsHttpAgent {

    static cacheable = new CacheableLookup();

    static httpAgentList = {};
    static httpsAgentList = {};

    /**
     * Register cacheable to global agents
     */
    static registerGlobalAgent() {
        this.cacheable.install(http.globalAgent);
        this.cacheable.install(https.globalAgent);
    }

    static install(agent) {
        this.cacheable.install(agent);
    }

    /**
     * @var {https.AgentOptions} agentOptions
     * @return {https.Agent}
     */
    static getHttpsAgent(agentOptions) {
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
