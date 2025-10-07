const { MonitorType } = require("./monitor-type");
const { Globalping, IpVersion } = require("globalping");
const { Settings } = require("../settings");
const { log, UP, DOWN } = require("../../src/util");

class GlobalpingMonitorType extends MonitorType {
    name = "globalping";
    agent = "";

    /**
     * @inheritdoc
     */
    constructor(agent) {
        super();
        this.agent = agent;
    }

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const apiKey = await Settings.get("globalpingApiToken");
        const client = new Globalping({
            auth: apiKey,
            agent: this.agent,
        });

        switch (monitor.type ) {
            case "globalping-ping":
                await this.ping(client, monitor, heartbeat)
                break;
        }
    }

    /**
     * @inheritdoc
     */
    async ping(client, monitor, heartbeat) {
        const opts = {
            type: "ping",
            target: monitor.hostname,
            inProgressUpdates: false,
            limit: 1,
            locations: [{ magic: monitor.location }],
            measurementOptions: {
                packets: monitor.ping_count,
                protocol: monitor.protocol,
            },
        };

        if (monitor.protocol === "TCP" && monitor.port) {
            opts.measurementOptions.port = monitor.port;
        }

        if (monitor.ipFamily === "ipv4") {
            opts.measurementOptions.ipVersion = IpVersion[4];
        } else if (monitor.ipFamily === "ipv6") {
            opts.measurementOptions.ipVersion = IpVersion[6];
        }

        log.debug("monitor", `Globalping create measurement: ${JSON.stringify(opts)}`);
        const res = await client.createMeasurement(opts);

        if (!res.ok) {
            throw new Error(
                `Failed to create measurement: ${this.formatApiError(res.data.error)}`,
            );
        }

        const measurement = await client.awaitMeasurement(res.data.id);

        if (!measurement.ok) {
            throw new Error(
                `Failed to fetch measurement (${res.data.id}): ${this.formatApiError(measurement.data.error)}`,
            );
        }

        log.debug("monitor", `Globalping measurement data: ${JSON.stringify(measurement.data)}`);
        const result = measurement.data.results[0].result;
        heartbeat.ping = result.stats?.avg || 0;
        if (!result.timings?.length) {
            heartbeat.msg = `Failed: ${result.rawOutput}`;
            heartbeat.status = DOWN;
        } else {
            heartbeat.msg = "";
            heartbeat.status = UP;
        }
    }

    /**
     * Format an API error message.
     * @param {object} error - The error object.
     * @returns {string} The formatted error message.
     */
    formatApiError(error) {
        let str = `${error.type} ${error.message}.`;
        if (error.params) {
            for (const key in error.params) {
                str += `\n${key}: ${error.params[key]}`;
            }
        }
        return str;
    }
}

module.exports = {
    GlobalpingMonitorType,
};
