const axios = require("axios");
const https = require("https");
const { MonitorType } = require("./monitor-type");
const { log, UP } = require("../../src/util");
const { axiosAbortSignal } = require("../util-server");

const STATUS_RANK = {
    red: 0,
    yellow: 1,
    green: 2,
};

class ElasticsearchClusterHealthError extends Error {}

class ElasticsearchMonitorType extends MonitorType {
    name = "elasticsearch";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const minimumStatus = monitor.elasticsearchStatus || "yellow";
        const minimumNodes = Number(monitor.elasticsearchMinimumNodes) || 0;
        if (!(minimumStatus in STATUS_RANK)) {
            throw new Error(`Invalid minimum Elasticsearch status: ${minimumStatus}`);
        }
        if (!Number.isInteger(minimumNodes) || minimumNodes < 0) {
            throw new Error(`Invalid minimum Elasticsearch node count: ${monitor.elasticsearchMinimumNodes}`);
        }

        let baseUrls;
        try {
            baseUrls = JSON.parse(monitor.elasticsearchNodes);
        } catch (error) {
            throw new Error(`Invalid Elasticsearch nodes: ${error.message}`);
        }

        if (!Array.isArray(baseUrls) || baseUrls.length === 0) {
            throw new Error("No Elasticsearch nodes configured");
        }

        const errors = [];
        for (let i = 0; i < baseUrls.length; i++) {
            try {
                const health = await this.checkSingleNode(
                    monitor,
                    baseUrls[i],
                    minimumStatus,
                    minimumNodes,
                    `${i + 1}/${baseUrls.length}`
                );
                const clusterName = health.cluster_name ? ` (${health.cluster_name})` : "";
                heartbeat.status = UP;
                heartbeat.msg = `Elasticsearch cluster${clusterName} is ${health.status}`;
                return;
            } catch (error) {
                if (error instanceof ElasticsearchClusterHealthError) {
                    throw error;
                }
                log.warn(this.name, `Node ${i + 1}: ${error.message}`);
                errors.push(`Node ${i + 1}: ${error.message}`);
            }
        }

        throw new Error(`All ${errors.length} Elasticsearch nodes failed because ${errors.join("; ")}`);
    }

    /**
     * Check a single Elasticsearch node.
     * @param {object} monitor Monitor configuration
     * @param {string} baseUrlString Base URL of the Elasticsearch node
     * @param {string} minimumStatus Minimum acceptable cluster status
     * @param {number} minimumNodes Minimum acceptable cluster node count
     * @param {string} nodeInfo Node index information for logging
     * @returns {Promise<object>} Elasticsearch cluster health response
     * @throws {Error} If the node cannot provide a valid health response
     */
    async checkSingleNode(monitor, baseUrlString, minimumStatus, minimumNodes, nodeInfo) {
        let baseUrl;
        try {
            baseUrl = new URL(baseUrlString);
        } catch {
            throw new Error("Invalid Elasticsearch URL");
        }

        if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
            throw new Error("Elasticsearch URL must use HTTP or HTTPS");
        }
        if (baseUrl.username || baseUrl.password) {
            throw new Error("Elasticsearch node URLs must not include credentials");
        }

        if (!baseUrl.pathname.endsWith("/")) {
            baseUrl.pathname += "/";
        }

        const healthUrl = new URL("_cluster/health", baseUrl);
        healthUrl.searchParams.set(
            "filter_path",
            "cluster_name,status,timed_out,number_of_nodes,number_of_data_nodes,active_primary_shards,active_shards,unassigned_shards"
        );

        const httpsAgentOptions = {
            rejectUnauthorized: !monitor.ignoreTls,
        };
        const options = {
            url: healthUrl.href,
            method: "get",
            timeout: monitor.timeout * 1000,
            headers: {
                Accept: "application/json",
            },
            signal: axiosAbortSignal((monitor.timeout + 10) * 1000),
        };

        if (monitor.basic_auth_user || monitor.basic_auth_pass) {
            options.auth = {
                username: monitor.basic_auth_user || "",
                password: monitor.basic_auth_pass || "",
            };
        }

        if (monitor.proxy_id) {
            const { R } = require("redbean-node");
            const { Proxy } = require("../proxy");
            const proxy = await R.load("proxy", monitor.proxy_id);
            if (proxy && proxy.active) {
                const { httpAgent, httpsAgent } = Proxy.createAgents(proxy, { httpsAgentOptions });
                options.proxy = false;
                options.httpAgent = httpAgent;
                options.httpsAgent = httpsAgent;
            }
        }

        if (!options.httpsAgent) {
            options.httpsAgent = new https.Agent(httpsAgentOptions);
        }

        const logUrl = new URL(healthUrl);
        logUrl.username = "";
        logUrl.password = "";
        log.debug("monitor", `[${monitor.name}] Checking Elasticsearch node ${nodeInfo}: ${logUrl.href}`);
        const response = await axios.request(options);
        const health = response.data;

        if (!health || typeof health !== "object" || !(health.status in STATUS_RANK)) {
            throw new Error("Elasticsearch returned an invalid cluster health response");
        }
        if (health.timed_out === true) {
            throw new Error("Elasticsearch cluster health request timed out");
        }
        if (STATUS_RANK[health.status] < STATUS_RANK[minimumStatus]) {
            throw new ElasticsearchClusterHealthError(
                `Elasticsearch cluster status is ${health.status}, expected at least ${minimumStatus}`
            );
        }
        if (minimumNodes > 0) {
            if (!Number.isInteger(health.number_of_nodes) || health.number_of_nodes < 0) {
                throw new Error("Elasticsearch returned an invalid number_of_nodes");
            }
            if (health.number_of_nodes < minimumNodes) {
                throw new ElasticsearchClusterHealthError(
                    `Elasticsearch cluster has ${health.number_of_nodes} nodes, expected at least ${minimumNodes}`
                );
            }
        }

        return health;
    }
}

module.exports = {
    ElasticsearchMonitorType,
};
