const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Alerta extends NotificationProvider {

    name = "alerta";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            let alertaUrl = `${notification.alertaapiEndpoint}/alert`;
            let config = {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Key " + notification.alertaapiKey,
                    "Accept": "text/json"
                }
            };
            let data = {
                environment: notification.alertaenvironment,
                severity: notification.alertaalertState, // critical
                status: notification.alertarecoverState, // cleared
                correlate: [],
                service: [ "UptimeKuma" ],
                group: "UptimeKuma-" + monitorJSON["type"], // Type de Sonde
                value: "Timeout",
                tags: [ "uptimekuma" ],
                attributes: {},
                origin: "uptimekuma",
                type: "browserAlert",
                resource: monitorJSON["name"]
            };

            if (heartbeatJSON == null) {
                let testdata = Object.assign( {
                    event: "TestAlert",
                    text: "Testing Successful.",
                }, data );
                await axios.post(alertaUrl, testdata)
            } else if (heartbeatJSON["status"] == DOWN) {
                let downdata = Object.assign( {
                    event: monitorJSON["name"],
                    value: "DOWN",
                    text: "[🔴 Down] " + heartbeatJSON["msg"] + "\nTime (UTC): " + heartbeatJSON["time"],
                }, data );
                await axios.post(alertaUrl, downdata)
            } else if (heartbeatJSON["status"] == UP) {
                let updata = Object.assign( {
                    event: monitorJSON["name"],
                    value: "UP",
                    text: "[✅ Up] " + heartbeatJSON["msg"] + "\nTime (UTC): " + heartbeatJSON["time"],
                }, data );
                await axios.post(alertaUrl, updata)
            }
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error)
        }

    }
}

module.exports = Alerta;
