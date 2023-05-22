const NotificationProvider = require("./notification-provider");
const { DOWN, UP } = require("../../src/util");
const axios = require("axios");

class Alerta extends NotificationProvider {

    name = "alerta";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            let alertaUrl = `${notification.alertaApiEndpoint}`;
            let config = {
                headers: {
                    "Content-Type": "application/json;charset=UTF-8",
                    "Authorization": "Key " + notification.alertaApiKey,
                }
            };
            let data = {
                environment: notification.alertaEnvironment,
                severity: "critical",
                correlate: [],
                service: [ "UptimeKuma" ],
                value: "Timeout",
                tags: [ "uptimekuma" ],
                attributes: {},
                origin: "uptimekuma",
                type: "exceptionAlert",
            };

            if (heartbeatJSON == null) {
                let postData = Object.assign({
                    event: "msg",
                    text: msg,
                    group: "uptimekuma-msg",
                    resource: "Message",
                }, data);

                await axios.post(alertaUrl, postData, config);
            } else {
                let datadup = Object.assign( {
                    correlate: [ "service_up", "service_down" ],
                    event: monitorJSON["type"],
                    group: "uptimekuma-" + monitorJSON["type"],
                    resource: monitorJSON["name"],
                }, data );

                if (heartbeatJSON["status"] === DOWN) {
                    datadup.severity = notification.alertaAlertState; // critical
                    datadup.text = "Service " + monitorJSON["type"] + " is down.";
                    await axios.post(alertaUrl, datadup, config);
                } else if (heartbeatJSON["status"] === UP) {
                    datadup.severity = notification.alertaRecoverState; // cleaned
                    datadup.text = "Service " + monitorJSON["type"] + " is up.";
                    await axios.post(alertaUrl, datadup, config);
                }
            }
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }
}

module.exports = Alerta;
