const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class SMSGateway extends NotificationProvider {
    name = "SMSGateway";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = notification.smsgatewayUrl.replace(/\/+$/, "") + "/api/v1/sms/send";

        const recipients = notification.smsgatewayTo
            .split(",")
            .map((number) => number.trim())
            .filter((number) => number !== "");

        try {
            const config = this.getAxiosConfigWithProxy({
                headers: {
                    "X-API-Key": notification.smsgatewayApiKey,
                },
            });

            const failures = [];
            for (const to of recipients) {
                const result = await axios.post(
                    url,
                    {
                        to,
                        body: msg,
                    },
                    config
                );

                // The gateway responds with HTTP 200 even if the modem could
                // not send the message, so the body status must be checked.
                if (result.data.status === "failed") {
                    failures.push(`${to}: ${result.data.message || "unknown error"}`);
                }
            }

            if (failures.length > 0) {
                throw new Error("Failed to send SMS to " + failures.join("; "));
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SMSGateway;
