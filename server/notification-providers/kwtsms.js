const NotificationProvider = require("./notification-provider");
const axios = require("axios");

// The kwtSMS send API accepts at most this many numbers per request.
const MAX_NUMBERS_PER_REQUEST = 200;

class Kwtsms extends NotificationProvider {
    name = "kwtsms";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://www.kwtsms.com/API/send/";

        const numbers = this.parseNumbers(notification.kwtsmsToNumber);
        if (numbers.length === 0) {
            throw new Error("No valid recipient phone number was provided.");
        }

        const message = this.cleanMessage(msg);
        if (message === "") {
            throw new Error("The message is empty after cleaning.");
        }

        try {
            let config = {
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
            };
            config = this.getAxiosConfigWithProxy(config);

            for (let i = 0; i < numbers.length; i += MAX_NUMBERS_PER_REQUEST) {
                const data = {
                    username: notification.kwtsmsUsername,
                    password: notification.kwtsmsPassword,
                    sender: notification.kwtsmsSenderId || "KWT-SMS",
                    mobile: numbers.slice(i, i + MAX_NUMBERS_PER_REQUEST).join(","),
                    message: message,
                };
                if (notification.kwtsmsTestMode) {
                    data.test = "1";
                }

                const resp = await axios.post(url, data, config);

                // The API returns HTTP 200 for errors too; the outcome is in "result".
                if (!resp.data || resp.data.result !== "OK") {
                    const code = resp.data && resp.data.code ? resp.data.code : "unknown";
                    const description = resp.data && resp.data.description ? resp.data.description : "no description";
                    throw new Error(`kwtSMS rejected the message: ${code} ${description}`);
                }
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Turn the recipient field into a list of numbers in international format
     * (digits only, no + or 00). Arabic-Indic and Persian digits are converted.
     * @param {string} value Numbers separated by comma, semicolon or newline; spaces inside a number are ignored
     * @returns {string[]} Unique, normalized numbers
     */
    parseNumbers(value) {
        const numbers = (value || "")
            .split(/[,;\n]+/)
            .map((number) =>
                number
                    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
                    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
                    .replace(/\D/g, "")
                    .replace(/^00/, "")
            )
            .filter((number) => number.length >= 7 && number.length <= 15);
        return [...new Set(numbers)];
    }

    /**
     * Remove emoji and invisible characters. Emoji would switch the whole SMS
     * to Unicode (70 instead of 160 characters per page).
     * @param {string} msg The notification text
     * @returns {string} The text to send
     */
    cleanMessage(msg) {
        return (msg || "")
            .replace(/\p{Extended_Pictographic}/gu, "")
            .replace(/\p{Emoji_Modifier}/gu, "")
            .replace(/\p{Regional_Indicator}/gu, "")
            .replace(/\p{Variation_Selector}/gu, "")
            .replace(/\p{Cf}/gu, "")
            .replace(/\u20E3/g, "")
            .replace(/\[[ \t]+/g, "[")
            .replace(/[ \t]{2,}/g, " ")
            .trim();
    }
}

module.exports = Kwtsms;
