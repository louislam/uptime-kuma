const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const https = require("https");

class Indigo extends NotificationProvider {
    name = "Indigo";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = `${notification.indigoUrl.trim().replace(/\/*$/, "")}/v2/api/command`;
        const variableId = parseInt(notification.indigoVariableId);
        const actionGroupId = parseInt(notification.indigoActionGroupId);

        if (!variableId && !actionGroupId) {
            throw new Error("Set an Indigo variable ID, an action group ID, or both.");
        }

        // The variable is written first so the action group can read it.
        const commands = [];
        if (variableId) {
            commands.push({
                message: "indigo.variable.updateValue",
                objectId: variableId,
                parameters: { value: msg },
            });
        }
        if (actionGroupId) {
            commands.push({
                message: "indigo.actionGroup.execute",
                objectId: actionGroupId,
            });
        }

        try {
            let config = {
                headers: {
                    Authorization: `Bearer ${notification.indigoApiKey}`,
                    "Content-Type": "application/json",
                },
            };
            // The Indigo Web Server on a LAN uses a self-signed certificate;
            // the Reflector (NAME.indigodomo.net) has a valid one.
            if (notification.indigoIgnoreTlsError) {
                config.httpsAgent = new https.Agent({ rejectUnauthorized: false });
            }
            config = this.getAxiosConfigWithProxy(config);

            for (const command of commands) {
                const result = await axios.post(url, { id: "uptime-kuma", ...command }, config);
                if (result.data?.error || result.data?.validationErrors) {
                    throw new Error(
                        `Indigo rejected ${command.message}: ${result.data.error || JSON.stringify(result.data.validationErrors)}`
                    );
                }
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Indigo;
