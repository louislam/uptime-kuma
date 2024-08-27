const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { Liquid } = require("liquidjs");
const { UP, DOWN } = require("../../src/util");

class SIGNL4 extends NotificationProvider {

    name = "SIGNL4";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            let data = {
                heartbeat: heartbeatJSON,
                monitor: monitorJSON,
                msg,
            };
            let config = {
                headers: {
                    "Content-Type": "application/json"
                }
            };

            // Source system
            data["X-S4-SourceSystem"] = "UptimeKuma";

            // Monitor URL
            let monitorUrl;
            if (monitorJSON) {
                if (monitorJSON.type === "port") {
                    monitorUrl = monitorJSON.hostname;
                    if (monitorJSON.port) {
                        monitorUrl += ":" + monitorJSON.port;
                    }
                } else if (monitorJSON.hostname != null) {
                    monitorUrl = monitorJSON.hostname;
                } else {
                    monitorUrl = monitorJSON.url;
                }
            }

            if (heartbeatJSON == null) {
                // Test alert
                data.title = "Uptime Kuma Alert";
                data.message = "Uptime Kuma Test Alert";
            } else if (heartbeatJSON.status === UP) {
                data.title = "Uptime Kuma Monitor ✅ Up";
                data["X-S4-ExternalID"] = "UptimeKuma" + monitorUrl;
                data["X-S4-Status"] = "resolved";
            } else if (heartbeatJSON.status === DOWN) {
                data.title = "Uptime Kuma Monitor 🔴 Down";
                data["X-S4-ExternalID"] = "UptimeKuma" + monitorUrl;
                data["X-S4-Status"] = "new";
            }

            if (notification.webhookContentType === "custom") {
                // Initialize LiquidJS and parse the custom Body Template
                const engine = new Liquid();
                const tpl = engine.parse(notification.webhookCustomBody);

                // Insert templated values into Body
                data = await engine.render(tpl,
                    {
                        msg,
                        heartbeatJSON,
                        monitorJSON
                    });
            }

            await axios.post(notification.webhookURL, data, config);
            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }

}

module.exports = SIGNL4;
