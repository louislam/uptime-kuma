const NotificationProvider = require("./notification-provider");
const axios = require("axios");

// The Ooredoo bulk_sms/v2 gateway accepts at most this many recipients per
// request, so larger recipient lists are split into batches of this size.
const MAX_RECIPIENTS_PER_REQUEST = 20;

class Ooredoo extends NotificationProvider {
    name = "Ooredoo";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = notification.ooredooServerUrl || "https://o-papi1-lb01.ooredoo.mv/bulk_sms/v2";

        // Users may enter recipients separated by comma, semicolon, space or
        // newline.
        const recipients = notification.ooredooToNumber
            .split(/[\s,;]+/)
            .map((number) => this.normalizePhoneNumber(number))
            .filter((number) => number !== "");

        if (recipients.length === 0) {
            throw new Error("No valid recipient phone number was provided.");
        }

        try {
            let config = {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: "Bearer " + notification.ooredooBearerToken,
                },
            };
            config = this.getAxiosConfigWithProxy(config);

            // The gateway only accepts MAX_RECIPIENTS_PER_REQUEST numbers per
            // call, so send the recipients in batches of that size.
            for (let i = 0; i < recipients.length; i += MAX_RECIPIENTS_PER_REQUEST) {
                const batch = recipients.slice(i, i + MAX_RECIPIENTS_PER_REQUEST);
                const data = new URLSearchParams({
                    username: notification.ooredooUsername,
                    // The gateway expects the access key to be Base64 encoded.
                    access_key: Buffer.from(notification.ooredooAccessKey).toString("base64"),
                    message: msg,
                    batch: batch.join(" "),
                });

                const resp = await axios.post(url, data.toString(), config);

                // The gateway returns HTTP 200 even on failure; the real outcome
                // is carried in "response_code" (0 means the batch was accepted).
                if (!resp.data || Number(resp.data.response_code) !== 0) {
                    const reason =
                        resp.data && resp.data.response_message
                            ? resp.data.response_message
                            : "response_code=" + (resp.data ? resp.data.response_code : "unknown");
                    throw new Error("Ooredoo rejected the message: " + reason);
                }
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Normalize a Maldivian phone number to the "960XXXXXXX" format expected
     * by the Ooredoo gateway. Numbers already in that form are returned as is.
     * @param {string} phoneNumber The phone number to normalize
     * @returns {string} The normalized phone number, or "" if it is empty
     */
    normalizePhoneNumber(phoneNumber) {
        const number = phoneNumber.replace(/[\s+]/g, "");

        if (number === "") {
            return "";
        }
        // A bare 7-digit local number gets the Maldives (960) country code.
        if (/^\d{7}$/.test(number)) {
            return "960" + number;
        }
        return number;
    }
}

module.exports = Ooredoo;
